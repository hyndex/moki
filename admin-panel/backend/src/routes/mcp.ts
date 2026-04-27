/** MCP HTTP transport. Implements the "Streamable HTTP" transport
 *  from the MCP spec — a single endpoint that accepts JSON-RPC over
 *  POST and (optionally) upgrades to Server-Sent Events for streamed
 *  responses.
 *
 *  Endpoints:
 *    GET  /api/mcp          — discovery: returns server info + auth hint
 *    POST /api/mcp          — JSON-RPC request; returns JSON-RPC response
 *
 *  Plus the admin endpoints (NOT MCP — these are for human operators):
 *    GET    /api/mcp/admin/agents               — list agents
 *    POST   /api/mcp/admin/agents               — create agent
 *    GET    /api/mcp/admin/agents/:id           — get agent
 *    PATCH  /api/mcp/admin/agents/:id           — update agent
 *    DELETE /api/mcp/admin/agents/:id           — revoke agent
 *    POST   /api/mcp/admin/agents/:id/tokens    — issue bearer token
 *    DELETE /api/mcp/admin/tokens/:tokenId      — revoke token
 *    POST   /api/mcp/admin/dual-key             — issue dual-key
 *    GET    /api/mcp/admin/calls                — recent call log
 *    GET    /api/mcp/admin/agents/:id/stats     — per-agent stats
 *
 *  The MCP endpoint authenticates with an agent bearer token; the
 *  admin endpoints authenticate with the existing user session. */

import { Hono } from "hono";
import { z } from "zod";
import { requireAuth, currentUser } from "../middleware/auth";
import { getTenantContext } from "../tenancy/context";
import {
  createAgent,
  getAgent,
  issueToken,
  listAgents,
  revokeAgent,
  revokeToken,
  suspendAgent,
  updateAgent,
  verifyAgentToken,
  type Agent,
} from "../lib/mcp/agents";
import {
  ERR_INTERNAL,
  ERR_INVALID_REQUEST,
  ERR_PARSE,
  ERR_UNAUTHORIZED,
  type JsonRpcRequest,
  type JsonRpcResponse,
} from "../lib/mcp/protocol";
import { handleRequest, issueDualKey } from "../lib/mcp/server";
import { bootstrapMcpTools } from "../lib/mcp/bootstrap";
import { getAgentStats, listCalls } from "../lib/mcp/audit";
import { hashArgs } from "../lib/mcp/idempotency";

export const mcpRoutes = new Hono();

/* -- public discovery + JSON-RPC ---------------------------------- */

/** GET /api/mcp — return discovery metadata. Useful for clients that
 *  bootstrap a connection by HEAD/GETing the URL before opening the
 *  JSON-RPC channel. */
mcpRoutes.get("/", (c) => {
  return c.json({
    name: "gutu-mcp-server",
    version: "1.0.0",
    transport: "streamable-http",
    auth: { kind: "bearer", header: "Authorization", prefix: "Bearer " },
    rpc: {
      url: "/api/mcp",
      method: "POST",
      contentType: "application/json",
    },
  });
});

mcpRoutes.post("/", async (c) => {
  // 1. Auth.
  const auth = c.req.header("authorization") ?? c.req.header("Authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const authed = verifyAgentToken(token);
  if (!authed) {
    return c.json(
      jsonRpcErr(null, ERR_UNAUTHORIZED, "missing or invalid agent token"),
      401,
    );
  }
  const tenantId = getTenantContext()?.tenantId ?? authed.agent.tenantId;
  // Cross-tenant requests are rejected; tokens are bound to one tenant.
  if (tenantId !== authed.agent.tenantId) {
    return c.json(
      jsonRpcErr(null, ERR_UNAUTHORIZED, "agent is bound to a different tenant"),
      403,
    );
  }

  // 2. Parse JSON-RPC body. Spec allows batch requests (array) — we
  //    handle both shapes uniformly.
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    return c.json(jsonRpcErr(null, ERR_PARSE, "invalid JSON"), 400);
  }
  const requests = Array.isArray(raw) ? raw : [raw];
  if (requests.length === 0) {
    return c.json(jsonRpcErr(null, ERR_INVALID_REQUEST, "empty batch"), 400);
  }
  if (requests.length > 100) {
    return c.json(jsonRpcErr(null, ERR_INVALID_REQUEST, "batch too large (max 100)"), 400);
  }

  // Lazy bootstrap — pick up newly-introduced resources without a
  // process restart.
  bootstrapMcpTools();

  // 3. Dispatch each request. Notifications (no id) get no response.
  const responses: JsonRpcResponse[] = [];
  for (const r of requests) {
    if (!isJsonRpcRequest(r)) {
      responses.push(jsonRpcErr(null, ERR_INVALID_REQUEST, "invalid JSON-RPC envelope"));
      continue;
    }
    if (r.id === undefined) continue; // notification — no response
    try {
      const resp = await handleRequest(r as JsonRpcRequest, {
        agent: authed.agent,
        tenantId,
      });
      responses.push(resp);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      responses.push(jsonRpcErr(r.id ?? null, ERR_INTERNAL, msg));
    }
  }

  return c.json(Array.isArray(raw) ? responses : responses[0]);
});

function isJsonRpcRequest(v: unknown): v is JsonRpcRequest {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return o.jsonrpc === "2.0" && typeof o.method === "string";
}

function jsonRpcErr(id: string | number | null, code: number, message: string): JsonRpcResponse {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

/* -- admin endpoints (human-authenticated) ------------------------ */

const adminRoutes = new Hono();
adminRoutes.use("*", requireAuth);

const ScopesSchema = z.record(z.array(z.enum(["read", "write", "delete"])));
const RateLimitsSchema = z.object({
  "safe-read": z.number().int().min(0).optional(),
  "low-mutation": z.number().int().min(0).optional(),
  "high-mutation": z.number().int().min(0).optional(),
}).partial();
const BudgetSchema = z.object({
  dailyWriteCap: z.number().int().min(0).optional(),
  dailyCostCap: z.number().min(0).optional(),
}).partial();

const CreateAgentBody = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
  mirrorUserId: z.string().min(1).optional(),
  scopes: ScopesSchema.optional(),
  riskCeiling: z.enum(["safe-read", "low-mutation", "high-mutation"]).optional(),
  rateLimits: RateLimitsSchema.optional(),
  budget: BudgetSchema.optional(),
  instructions: z.string().max(8000).optional(),
});

adminRoutes.get("/agents", (c) => {
  const tenantId = getTenantContext()?.tenantId ?? "default";
  return c.json({ agents: listAgents(tenantId) });
});

adminRoutes.post("/agents", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = CreateAgentBody.safeParse(body);
  if (!parsed.success) return c.json({ error: "invalid body", issues: parsed.error.issues }, 400);
  const tenantId = getTenantContext()?.tenantId ?? "default";
  const user = currentUser(c);
  const agent = createAgent({
    name: parsed.data.name,
    description: parsed.data.description,
    tenantId,
    issuerUserId: user.id,
    mirrorUserId: parsed.data.mirrorUserId,
    scopes: parsed.data.scopes,
    riskCeiling: parsed.data.riskCeiling,
    rateLimits: parsed.data.rateLimits,
    budget: parsed.data.budget,
    instructions: parsed.data.instructions,
  });
  return c.json({ agent }, 201);
});

adminRoutes.get("/agents/:id", (c) => {
  const tenantId = getTenantContext()?.tenantId ?? "default";
  const a = getAgent(c.req.param("id"));
  if (!a) return c.json({ error: "not found" }, 404);
  if (a.tenantId !== tenantId) return c.json({ error: "not found" }, 404);
  return c.json({ agent: a });
});

adminRoutes.patch("/agents/:id", async (c) => {
  const tenantId = getTenantContext()?.tenantId ?? "default";
  const a = getAgent(c.req.param("id"));
  if (!a || a.tenantId !== tenantId) return c.json({ error: "not found" }, 404);
  const body = await c.req.json().catch(() => null);
  const parsed = CreateAgentBody.partial()
    .extend({ status: z.enum(["active", "suspended", "revoked"]).optional() })
    .safeParse(body);
  if (!parsed.success) return c.json({ error: "invalid body", issues: parsed.error.issues }, 400);
  const updated = updateAgent(a.id, parsed.data);
  return c.json({ agent: updated });
});

adminRoutes.post("/agents/:id/suspend", (c) => {
  const tenantId = getTenantContext()?.tenantId ?? "default";
  const a = getAgent(c.req.param("id"));
  if (!a || a.tenantId !== tenantId) return c.json({ error: "not found" }, 404);
  suspendAgent(a.id);
  return c.json({ ok: true });
});

adminRoutes.delete("/agents/:id", (c) => {
  const tenantId = getTenantContext()?.tenantId ?? "default";
  const a = getAgent(c.req.param("id"));
  if (!a || a.tenantId !== tenantId) return c.json({ error: "not found" }, 404);
  revokeAgent(a.id);
  return c.json({ ok: true });
});

const TokenIssueBody = z.object({
  expiresAt: z.string().datetime().optional(),
});

adminRoutes.post("/agents/:id/tokens", async (c) => {
  const tenantId = getTenantContext()?.tenantId ?? "default";
  const a = getAgent(c.req.param("id"));
  if (!a || a.tenantId !== tenantId) return c.json({ error: "not found" }, 404);
  if (a.status !== "active") return c.json({ error: "agent not active" }, 400);
  const body = await c.req.json().catch(() => ({}));
  const parsed = TokenIssueBody.safeParse(body);
  if (!parsed.success) return c.json({ error: "invalid body", issues: parsed.error.issues }, 400);
  const out = issueToken({ agentId: a.id, expiresAt: parsed.data.expiresAt });
  // The plaintext is shown ONCE — the client must store it themselves.
  return c.json({ token: out.plaintext, tokenId: out.tokenId, expiresAt: out.expiresAt }, 201);
});

adminRoutes.delete("/tokens/:tokenId", (c) => {
  revokeToken(c.req.param("tokenId"));
  return c.json({ ok: true });
});

const DualKeyBody = z.object({
  agentId: z.string().min(1),
  toolName: z.string().min(1),
  arguments: z.record(z.unknown()),
  ttlMinutes: z.number().int().min(1).max(1440).optional(),
});

adminRoutes.post("/dual-key", async (c) => {
  const tenantId = getTenantContext()?.tenantId ?? "default";
  const user = currentUser(c);
  const body = await c.req.json().catch(() => null);
  const parsed = DualKeyBody.safeParse(body);
  if (!parsed.success) return c.json({ error: "invalid body", issues: parsed.error.issues }, 400);
  const agent = getAgent(parsed.data.agentId);
  if (!agent || agent.tenantId !== tenantId) return c.json({ error: "agent not found" }, 404);
  const out = issueDualKey({
    agentId: agent.id,
    toolName: parsed.data.toolName,
    argumentsHash: hashArgs(parsed.data.arguments),
    issuedByUserId: user.id,
    ttlMinutes: parsed.data.ttlMinutes,
  });
  return c.json({ dualKeyToken: out.plaintext }, 201);
});

adminRoutes.get("/calls", (c) => {
  const tenantId = getTenantContext()?.tenantId ?? "default";
  const url = new URL(c.req.url);
  const agentId = url.searchParams.get("agentId") ?? undefined;
  const limit = Number(url.searchParams.get("limit") ?? "100") || 100;
  return c.json({ calls: listCalls({ tenantId, agentId, limit }) });
});

adminRoutes.get("/agents/:id/stats", (c) => {
  const tenantId = getTenantContext()?.tenantId ?? "default";
  const a = getAgent(c.req.param("id"));
  if (!a || a.tenantId !== tenantId) return c.json({ error: "not found" }, 404);
  return c.json({ stats: getAgentStats(a.id) });
});

mcpRoutes.route("/admin", adminRoutes);

export type { Agent };
