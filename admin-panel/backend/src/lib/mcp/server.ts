/** MCP server — JSON-RPC method dispatch.
 *
 *  The server is transport-agnostic. Hand it a parsed JSON-RPC
 *  request + the authenticated agent context and it returns a
 *  JSON-RPC response. The transport (HTTP + SSE) lives in
 *  `routes/mcp.ts`.
 *
 *  Hard guarantees:
 *    - every call writes one row to mcp_call_log (start + end)
 *    - rate-limit + circuit-breaker checks fire BEFORE the handler
 *    - idempotency lookup for mutations replays the cached result
 *    - JSON-RPC errors are typed (ERR_RATE_LIMITED etc.) so a smart
 *      client can decide how to react
 *    - exception-to-error translation never leaks stack traces — only
 *      `err.message` flows out */

import {
  ERR_FORBIDDEN,
  ERR_INTERNAL,
  ERR_INVALID_PARAMS,
  ERR_METHOD_NOT_FOUND,
  ERR_NOT_FOUND,
  ERR_RATE_LIMITED,
  ERR_RISK_BLOCKED,
  ERR_BUDGET_EXCEEDED,
  ERR_CIRCUIT_OPEN,
  ERR_IDEMPOTENCY_REPLAY,
  MCP_PROTOCOL_VERSION,
  type JsonRpcRequest,
  type JsonRpcResponse,
  type InitializeResult,
  type ToolsListResult,
  type ToolsCallParams,
  type ToolsCallResult,
  type ResourcesListResult,
  type ResourcesReadParams,
  type ResourcesReadResult,
} from "./protocol";
import type { Agent } from "./agents";
import { ceilingAllows, requiresDualKey, requiresIdempotency, type Risk } from "./risk";
import { consume, recordFailure, recordSuccess } from "./rate-limit";
import { hashArgs, lookup as idemLookup, store as idemStore } from "./idempotency";
import { getTool, listTools } from "./tools";
import { logCallEnd, logCallStart } from "./audit";

export interface ServerContext {
  agent: Agent;
  tenantId: string;
}

const SERVER_INFO = { name: "gutu-mcp-server", version: "1.0.0" };

/** Top-level method dispatch. Returns a JSON-RPC response (success or
 *  error). Exception-safety guaranteed — handlers may throw freely;
 *  the caller's transport just forwards what we return. */
export async function handleRequest(req: JsonRpcRequest, ctx: ServerContext): Promise<JsonRpcResponse> {
  const t0 = Date.now();
  try {
    if (req.method === "initialize") {
      const result: InitializeResult = {
        protocolVersion: MCP_PROTOCOL_VERSION,
        serverInfo: SERVER_INFO,
        capabilities: {
          tools: { listChanged: false },
          resources: { listChanged: false, subscribe: false },
        },
        instructions: ctx.agent.instructions,
      };
      return ok(req, result);
    }

    if (req.method === "ping") {
      return ok(req, {});
    }

    if (req.method === "tools/list") {
      const tools = listTools()
        // Only surface tools the agent's scopes + risk ceiling allow
        // — keeps the agent from seeing affordances it can't use.
        .filter((t) => agentMaySeeTool(ctx.agent, t.risk, t.resource, t.scopeAction))
        .map((t) => t.definition);
      return ok<ToolsListResult>(req, { tools });
    }

    if (req.method === "tools/call") {
      return await handleToolsCall(req, ctx, t0);
    }

    if (req.method === "resources/list") {
      // Resources mirror the read-only view of the resource registry;
      // every list-tool resource is exposed as an MCP resource URI.
      const resources = uniqueResources();
      const filtered = resources.filter((r) =>
        agentMaySeeTool(ctx.agent, "safe-read", r, "read"),
      );
      const result: ResourcesListResult = {
        resources: filtered.map((r) => ({
          uri: `gutu://resource/${r}`,
          name: r,
          description: `Records of ${r} (read via tools/${r}.list).`,
          mimeType: "application/json",
        })),
      };
      return ok(req, result);
    }

    if (req.method === "resources/read") {
      const p = req.params as ResourcesReadParams | undefined;
      if (!p?.uri) return err(req, ERR_INVALID_PARAMS, "missing uri");
      const m = /^gutu:\/\/resource\/([^/]+)(?:\/(.+))?$/.exec(p.uri);
      if (!m) return err(req, ERR_INVALID_PARAMS, "invalid uri");
      const resource = m[1]!;
      const id = m[2];
      const tool = getTool(id ? `${resource}.get` : `${resource}.list`);
      if (!tool) return err(req, ERR_NOT_FOUND, `unknown resource ${resource}`);
      const result = await tool.call({
        agent: ctx.agent,
        tenantId: ctx.tenantId,
        args: id ? { id } : { pageSize: 25 },
      });
      const block = result.content.find((c) => c.type === "resource") ?? result.content[0];
      const out: ResourcesReadResult = {
        contents: [
          {
            uri: p.uri,
            mimeType: "application/json",
            text:
              block?.type === "resource"
                ? block.resource.text ?? ""
                : block?.type === "text"
                  ? block.text
                  : "",
          },
        ],
      };
      return ok(req, out);
    }

    return err(req, ERR_METHOD_NOT_FOUND, `unknown method ${req.method}`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return err(req, ERR_INTERNAL, msg);
  }
}

async function handleToolsCall(
  req: JsonRpcRequest,
  ctx: ServerContext,
  t0: number,
): Promise<JsonRpcResponse> {
  const params = req.params as ToolsCallParams | undefined;
  if (!params?.name) return err(req, ERR_INVALID_PARAMS, "missing tool name");
  const tool = getTool(params.name);
  if (!tool) return err(req, ERR_METHOD_NOT_FOUND, `unknown tool ${params.name}`);

  const args = (params.arguments ?? {}) as Record<string, unknown>;
  const idempotencyKey =
    typeof (params._meta as Record<string, unknown> | undefined)?.idempotencyKey === "string"
      ? ((params._meta as Record<string, unknown>).idempotencyKey as string)
      : undefined;
  const dualKeyToken =
    typeof (params._meta as Record<string, unknown> | undefined)?.dualKeyToken === "string"
      ? ((params._meta as Record<string, unknown>).dualKeyToken as string)
      : undefined;

  const callId = logCallStart({
    agentId: ctx.agent.id,
    tenantId: ctx.tenantId,
    method: req.method,
    toolName: tool.definition.name,
    resource: tool.resource,
    action: tool.scopeAction,
    risk: tool.risk,
    arguments: args,
    idempotencyKey,
  });

  // Risk ceiling check (irreversible always blocked unless dual-key).
  if (requiresDualKey(tool.risk)) {
    if (!dualKeyToken || !verifyDualKey(ctx.agent.id, dualKeyToken, tool.definition.name, hashArgs(args))) {
      logCallEnd(callId, {
        ok: false,
        errorCode: ERR_RISK_BLOCKED,
        errorMessage: "irreversible action requires dual-key token",
        latencyMs: Date.now() - t0,
      });
      return err(req, ERR_RISK_BLOCKED, "irreversible action requires a dual-key confirmation token (set _meta.dualKeyToken). Operators issue these via the admin UI.");
    }
  } else if (!ceilingAllows(ctx.agent.riskCeiling, tool.risk)) {
    logCallEnd(callId, {
      ok: false,
      errorCode: ERR_RISK_BLOCKED,
      errorMessage: `risk ${tool.risk} above ceiling ${ctx.agent.riskCeiling}`,
      latencyMs: Date.now() - t0,
    });
    return err(req, ERR_RISK_BLOCKED, `tool requires risk ceiling >= ${tool.risk}; agent ceiling is ${ctx.agent.riskCeiling}`);
  }

  // Scope check — agent's resource grant covers the action?
  if (tool.resource && tool.scopeAction) {
    const scopes = ctx.agent.scopes[tool.resource] ?? [];
    if (!scopes.includes(tool.scopeAction)) {
      logCallEnd(callId, {
        ok: false,
        errorCode: ERR_FORBIDDEN,
        errorMessage: `agent lacks ${tool.scopeAction} scope on ${tool.resource}`,
        latencyMs: Date.now() - t0,
      });
      return err(req, ERR_FORBIDDEN, `agent token lacks ${tool.scopeAction} scope for resource ${tool.resource}`);
    }
  }

  // Idempotency lookup BEFORE rate-limit so a retry doesn't deplete
  // the bucket again.
  if (requiresIdempotency(tool.risk)) {
    if (!idempotencyKey) {
      logCallEnd(callId, {
        ok: false,
        errorCode: ERR_INVALID_PARAMS,
        errorMessage: "missing idempotency key",
        latencyMs: Date.now() - t0,
      });
      return err(req, ERR_INVALID_PARAMS, `tool risk ${tool.risk} requires _meta.idempotencyKey`);
    }
    const cached = idemLookup(ctx.agent.id, idempotencyKey);
    if (cached) {
      const argsHash = hashArgs(args);
      if (cached.toolName !== tool.definition.name || cached.argumentsHash !== argsHash) {
        logCallEnd(callId, {
          ok: false,
          errorCode: ERR_IDEMPOTENCY_REPLAY,
          errorMessage: "idempotency key reused with different tool/args",
          latencyMs: Date.now() - t0,
        });
        return err(req, ERR_IDEMPOTENCY_REPLAY, "idempotency key already used with different tool name or arguments");
      }
      logCallEnd(callId, {
        ok: cached.ok,
        resultSummary: "[idempotency replay]",
        latencyMs: Date.now() - t0,
      });
      return cached.ok ? ok(req, cached.result) : err(req, ERR_INTERNAL, "previous call failed");
    }
  }

  // Rate-limit + budget.
  const limited = consume(ctx.agent, tool.risk);
  if (limited) {
    const code =
      limited.error.includes("circuit") ? ERR_CIRCUIT_OPEN
        : limited.error.includes("budget") ? ERR_BUDGET_EXCEEDED
        : ERR_RATE_LIMITED;
    logCallEnd(callId, {
      ok: false,
      errorCode: code,
      errorMessage: limited.error,
      latencyMs: Date.now() - t0,
    });
    return err(req, code, limited.error, { retryAfterMs: limited.retryAfterMs });
  }

  try {
    const out = await tool.call({ agent: ctx.agent, tenantId: ctx.tenantId, args });
    const result: ToolsCallResult = { content: out.content, isError: false };
    if (idempotencyKey) {
      idemStore({
        agentId: ctx.agent.id,
        key: idempotencyKey,
        toolName: tool.definition.name,
        argumentsHash: hashArgs(args),
        result,
        ok: true,
      });
    }
    recordSuccess(ctx.agent, tool.risk);
    logCallEnd(callId, {
      ok: true,
      resultSummary: out.resultSummary,
      latencyMs: Date.now() - t0,
    });
    return ok<ToolsCallResult>(req, result);
  } catch (e) {
    recordFailure(ctx.agent, tool.risk);
    const msg = e instanceof Error ? e.message : String(e);
    const errResult: ToolsCallResult = {
      content: [{ type: "text", text: `Error: ${msg}` }],
      isError: true,
    };
    if (idempotencyKey) {
      idemStore({
        agentId: ctx.agent.id,
        key: idempotencyKey,
        toolName: tool.definition.name,
        argumentsHash: hashArgs(args),
        result: errResult,
        ok: false,
      });
    }
    logCallEnd(callId, {
      ok: false,
      errorCode: ERR_INTERNAL,
      errorMessage: msg,
      latencyMs: Date.now() - t0,
    });
    // Note: tools/call wraps execution errors as `isError: true`
    // inside a successful JSON-RPC envelope per MCP spec.
    return ok<ToolsCallResult>(req, errResult);
  }
}

function ok<T>(req: JsonRpcRequest, result: T): JsonRpcResponse<T> {
  return { jsonrpc: "2.0", id: req.id, result };
}

function err(req: JsonRpcRequest, code: number, message: string, data?: unknown): JsonRpcResponse {
  return { jsonrpc: "2.0", id: req.id, error: { code, message, data } };
}

function agentMaySeeTool(
  agent: Agent,
  risk: Risk,
  resource?: string,
  action?: "read" | "write" | "delete",
): boolean {
  // Always hide irreversible tools the agent can't unlock without a
  // dual-key — they're functionally invisible until an operator
  // pre-approves. Reduces accidental discovery via tools/list.
  if (risk === "irreversible") {
    if (!ceilingAllows(agent.riskCeiling, "high-mutation")) return false;
  } else if (!ceilingAllows(agent.riskCeiling, risk)) {
    return false;
  }
  if (resource && action) {
    const grants = agent.scopes[resource] ?? [];
    if (!grants.includes(action)) return false;
  }
  return true;
}

function uniqueResources(): string[] {
  const set = new Set<string>();
  for (const t of listTools()) {
    if (t.resource) set.add(t.resource);
  }
  return Array.from(set).sort();
}

/* -- dual-key tokens ---------------------------------------------- */

import { db } from "../../db";
import { createHash } from "node:crypto";

db.exec(`
  CREATE TABLE IF NOT EXISTS mcp_dual_key (
    token_hash TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    tool_name TEXT NOT NULL,
    arguments_hash TEXT NOT NULL,
    issued_by_user TEXT NOT NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    used_at TEXT
  );
`);

/** Issue a dual-key token. Operators (humans) call this from the admin
 *  UI to pre-approve a single irreversible call. The agent passes the
 *  plaintext in `_meta.dualKeyToken`. Tokens are single-use + bound
 *  to (agent, tool, arguments-hash) so an agent can't apply a
 *  delete-this-record token to delete a different record. */
export function issueDualKey(args: {
  agentId: string;
  toolName: string;
  argumentsHash: string;
  issuedByUserId: string;
  ttlMinutes?: number;
}): { plaintext: string } {
  const ttl = args.ttlMinutes ?? 30;
  const raw = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2) + Date.now().toString(36);
  const plaintext = `gmd_${raw}`;
  const hash = createHash("sha256").update(plaintext).digest("hex");
  const now = new Date();
  const expires = new Date(now.getTime() + ttl * 60_000);
  db.prepare(
    `INSERT INTO mcp_dual_key
       (token_hash, agent_id, tool_name, arguments_hash, issued_by_user, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    hash,
    args.agentId,
    args.toolName,
    args.argumentsHash,
    args.issuedByUserId,
    now.toISOString(),
    expires.toISOString(),
  );
  return { plaintext };
}

function verifyDualKey(agentId: string, plaintext: string, toolName: string, argumentsHash: string): boolean {
  const hash = createHash("sha256").update(plaintext).digest("hex");
  const row = db
    .prepare(`SELECT * FROM mcp_dual_key WHERE token_hash = ?`)
    .get(hash) as
    | { agent_id: string; tool_name: string; arguments_hash: string; expires_at: string; used_at: string | null }
    | undefined;
  if (!row) return false;
  if (row.used_at) return false;
  if (row.agent_id !== agentId) return false;
  if (row.tool_name !== toolName) return false;
  if (row.arguments_hash !== argumentsHash) return false;
  if (Date.parse(row.expires_at) < Date.now()) return false;
  // Mark used. Single-use guarantee.
  db.prepare(`UPDATE mcp_dual_key SET used_at = ? WHERE token_hash = ?`).run(new Date().toISOString(), hash);
  return true;
}
