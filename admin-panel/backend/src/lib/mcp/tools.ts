/** Tool registry. Two paths to populate:
 *
 *    1. Auto-generated — for every resource the framework knows about
 *       we synthesise list/get/search (read-only) and create/update/
 *       delete (mutation, scope-gated). Plugins get this for free
 *       without touching their manifest.
 *
 *    2. Explicit — plugins (or the host) call `registerTool()` with
 *       a hand-written handler. Used for domain operations that don't
 *       map to a CRUD verb (e.g. `accounting.post-journal`,
 *       `mail.send-test`).
 *
 *  Lookup is by tool name. Tool names are namespaced as
 *  `<resource>.<verb>` for auto-generated tools and `<plugin>.<verb>`
 *  for explicit ones — the registry doesn't enforce naming, it just
 *  rejects duplicates. */

import { listRecords, getRecord, insertRecord, updateRecord, deleteRecord } from "../query";
import { accessibleRecordIds, effectiveRole, roleAtLeast, type Role } from "../acl";
import type { Risk } from "./risk";
import { VERB_RISK } from "./risk";
import type { ToolDefinition, ContentBlock } from "./protocol";
import type { Agent } from "./agents";
import { uuid } from "../id";

export interface ToolHandlerArgs {
  agent: Agent;
  tenantId: string;
  args: Record<string, unknown>;
}

export interface ToolHandler {
  definition: ToolDefinition;
  risk: Risk;
  /** Resource the tool reads/writes. Used for scope gating. */
  resource?: string;
  /** Verb (read|write|delete). Used for scope gating. */
  scopeAction?: "read" | "write" | "delete";
  /** Synchronous result generator. Errors thrown are caught by the
   *  server and turned into JSON-RPC errors. */
  call(args: ToolHandlerArgs): Promise<{ content: ContentBlock[]; resultSummary?: string; affectedRecord?: string }>;
}

const REGISTRY = new Map<string, ToolHandler>();

export function registerTool(handler: ToolHandler): void {
  if (REGISTRY.has(handler.definition.name)) {
    throw new Error(`tool already registered: ${handler.definition.name}`);
  }
  REGISTRY.set(handler.definition.name, handler);
}

export function unregisterTool(name: string): void {
  REGISTRY.delete(name);
}

export function getTool(name: string): ToolHandler | undefined {
  return REGISTRY.get(name);
}

export function listTools(): ToolHandler[] {
  return Array.from(REGISTRY.values()).sort((a, b) => a.definition.name.localeCompare(b.definition.name));
}

/** Build the read/write tool set for a resource. Called once at boot
 *  for each known resource so the agent always sees a consistent
 *  surface regardless of which plugin contributed it. */
export function registerResourceTools(resource: string, displayName?: string): void {
  const niceName = displayName ?? resource;

  const def = (verb: string, description: string, props: Record<string, unknown>, required: string[] = []): ToolDefinition => ({
    name: `${resource}.${verb}`,
    description,
    inputSchema: { type: "object", properties: props, required },
    annotations: {
      title: `${verb} ${niceName}`,
      readOnlyHint: VERB_RISK[verb] === "safe-read",
      destructiveHint: VERB_RISK[verb] === "irreversible",
      idempotentHint: verb === "list" || verb === "get" || verb === "search" || verb === "upsert",
      openWorldHint: false,
    },
  });

  // list
  registerTool({
    definition: def(
      "list",
      `List records of ${niceName}. Supports pagination, filter, and search.`,
      {
        page: { type: "number", minimum: 1, description: "Page number (1-indexed)." },
        pageSize: { type: "number", minimum: 1, maximum: 200, description: "Page size (max 200)." },
        search: { type: "string", description: "Free-text search across record fields." },
        filters: {
          type: "object",
          additionalProperties: true,
          description: "Per-field equality filters.",
        },
        sort: {
          type: "object",
          properties: {
            field: { type: "string" },
            dir: { type: "string", enum: ["asc", "desc"] },
          },
        },
      },
    ),
    risk: VERB_RISK.list,
    resource,
    scopeAction: "read",
    async call({ agent, tenantId, args }) {
      const accessible = accessibleRecordIds({ resource, userId: agentMirrorUser(agent), tenantId });
      const result = listRecords(resource, {
        page: typeof args.page === "number" ? args.page : 1,
        pageSize: typeof args.pageSize === "number" ? args.pageSize : 25,
        search: typeof args.search === "string" ? args.search : undefined,
        filters: (args.filters as Record<string, unknown>) ?? {},
        sort:
          args.sort && typeof args.sort === "object"
            ? (args.sort as { field: string; dir: "asc" | "desc" })
            : undefined,
        accessibleIds: accessible,
        tenantId,
      });
      return {
        content: [
          { type: "text", text: `Found ${result.total} ${niceName} records (page ${result.page}/${Math.max(1, Math.ceil(result.total / result.pageSize))}).` },
          { type: "resource", resource: { uri: `gutu://resource/${resource}`, mimeType: "application/json", text: JSON.stringify({ rows: result.rows.slice(0, 50), total: result.total, page: result.page, pageSize: result.pageSize }, null, 2) } },
        ],
        resultSummary: `total=${result.total}`,
      };
    },
  });

  // get
  registerTool({
    definition: def(
      "get",
      `Fetch a single ${niceName} record by id.`,
      { id: { type: "string", description: "Record id." } },
      ["id"],
    ),
    risk: VERB_RISK.get,
    resource,
    scopeAction: "read",
    async call({ agent, tenantId, args }) {
      const id = String(args.id ?? "");
      if (!id) throw new Error(`missing required arg: id`);
      const role = effectiveRole({ resource, recordId: id, userId: agentMirrorUser(agent), tenantId });
      if (!role || !roleAtLeast(role, "viewer")) {
        throw new Error(`forbidden: agent ${agent.id} has no read access to ${resource}/${id}`);
      }
      const rec = getRecord(resource, id);
      if (!rec) throw new Error(`not-found: ${resource}/${id}`);
      return {
        content: [
          { type: "resource", resource: { uri: `gutu://resource/${resource}/${id}`, mimeType: "application/json", text: JSON.stringify(rec, null, 2) } },
        ],
        resultSummary: `id=${id}`,
        affectedRecord: id,
      };
    },
  });

  // search
  registerTool({
    definition: def(
      "search",
      `Search ${niceName} records by free text.`,
      { query: { type: "string", description: "Search term." }, limit: { type: "number", minimum: 1, maximum: 50 } },
      ["query"],
    ),
    risk: VERB_RISK.search,
    resource,
    scopeAction: "read",
    async call({ agent, tenantId, args }) {
      const accessible = accessibleRecordIds({ resource, userId: agentMirrorUser(agent), tenantId });
      const result = listRecords(resource, {
        page: 1,
        pageSize: typeof args.limit === "number" ? Math.min(args.limit, 50) : 10,
        search: String(args.query ?? ""),
        filters: {},
        accessibleIds: accessible,
        tenantId,
      });
      return {
        content: [
          { type: "text", text: `Found ${result.total} matches.` },
          { type: "resource", resource: { uri: `gutu://search/${resource}`, mimeType: "application/json", text: JSON.stringify(result.rows.slice(0, 50), null, 2) } },
        ],
        resultSummary: `matches=${result.total}`,
      };
    },
  });

  // create
  registerTool({
    definition: def(
      "create",
      `Create a new ${niceName} record. The agent token must hold the "write" scope on this resource.`,
      {
        data: {
          type: "object",
          additionalProperties: true,
          description: "Record fields.",
        },
      },
      ["data"],
    ),
    risk: VERB_RISK.create,
    resource,
    scopeAction: "write",
    async call({ agent, tenantId, args }) {
      const data = (args.data as Record<string, unknown>) ?? {};
      const id = String(data.id ?? uuid());
      const enriched = {
        ...data,
        id,
        tenantId,
        createdBy: `agent:${agent.id}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      insertRecord(resource, id, enriched);
      return {
        content: [{ type: "text", text: `Created ${resource}/${id}.` }],
        resultSummary: `created id=${id}`,
        affectedRecord: id,
      };
    },
  });

  // update
  registerTool({
    definition: def(
      "update",
      `Update an existing ${niceName} record. The agent token must hold the "write" scope on this resource.`,
      {
        id: { type: "string" },
        data: { type: "object", additionalProperties: true },
      },
      ["id", "data"],
    ),
    risk: VERB_RISK.update,
    resource,
    scopeAction: "write",
    async call({ agent, tenantId, args }) {
      const id = String(args.id ?? "");
      if (!id) throw new Error(`missing required arg: id`);
      const role = effectiveRole({ resource, recordId: id, userId: agentMirrorUser(agent), tenantId });
      if (!role || !roleAtLeast(role, "editor")) {
        throw new Error(`forbidden: agent ${agent.id} has no write access to ${resource}/${id}`);
      }
      const data = (args.data as Record<string, unknown>) ?? {};
      const next = updateRecord(resource, id, {
        ...data,
        updatedAt: new Date().toISOString(),
        updatedBy: `agent:${agent.id}`,
      });
      if (!next) throw new Error(`not-found: ${resource}/${id}`);
      return {
        content: [{ type: "text", text: `Updated ${resource}/${id}.` }],
        resultSummary: `updated id=${id}`,
        affectedRecord: id,
      };
    },
  });

  // delete (irreversible) — requires dual-key in the call site
  registerTool({
    definition: def(
      "delete",
      `Permanently delete a ${niceName} record. IRREVERSIBLE — requires a human dual-key confirmation token.`,
      { id: { type: "string" } },
      ["id"],
    ),
    risk: "irreversible",
    resource,
    scopeAction: "delete",
    async call({ agent, tenantId, args }) {
      const id = String(args.id ?? "");
      if (!id) throw new Error(`missing required arg: id`);
      const role = effectiveRole({ resource, recordId: id, userId: agentMirrorUser(agent), tenantId });
      if (!role || !roleAtLeast(role, "owner")) {
        throw new Error(`forbidden: agent ${agent.id} has no delete access to ${resource}/${id}`);
      }
      const ok = deleteRecord(resource, id);
      if (!ok) throw new Error(`not-found: ${resource}/${id}`);
      return {
        content: [{ type: "text", text: `Deleted ${resource}/${id}.` }],
        resultSummary: `deleted id=${id}`,
        affectedRecord: id,
      };
    },
  });
}

/** Agents always run as if they were their `mirrorUser` for the
 *  purpose of ACL look-ups — that's how the "agent ⊆ user" rule is
 *  enforced. When no mirrorUser is set, the agent is treated as the
 *  issuer (the human who created it). */
function agentMirrorUser(agent: Agent): string {
  return agent.mirrorUserId ?? agent.issuerUserId;
}

/** Test-only: clear every registration. */
export function _resetToolRegistry_forTest(): void {
  REGISTRY.clear();
}

// Local Role import for verbose type narrowing.
export type { Role };
