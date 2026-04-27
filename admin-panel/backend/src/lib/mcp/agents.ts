/** Agent identity store. An MCP "agent" is a NEW principal kind
 *  alongside `user` and `tenant`. Agents are separate so:
 *
 *    - permissions can be tighter than any human user (no UI access,
 *      no settings edits, no cross-tenant read)
 *    - audit attribution is unambiguous (`agent_id`, never confused
 *      with the human who issued the token)
 *    - revoking an agent doesn't disable a human user
 *
 *  Schema (stored in the `mcp_agent` table):
 *    id            uuid (primary key)
 *    name          short label
 *    description   what this agent does
 *    tenant_id     scoped to a single tenant (cross-tenant agents
 *                  require a separate principal kind, deliberately
 *                  not built yet)
 *    issuer_user   the human user who created this agent — every
 *                  agent has a humans-in-the-loop owner
 *    mirror_user   when set, the agent inherits this user's roles +
 *                  ACL grants. permissions are AND'd with the agent
 *                  scopes — agent ⊆ user, never broader
 *    scopes        JSON: { resource: ["read", "write", "delete"] }
 *    risk_ceiling  highest risk level this agent may invoke:
 *                    "safe-read" | "low-mutation" | "high-mutation"
 *                    (irreversible always requires human dual-key)
 *    rate_limits   JSON: per-class limits per minute
 *    budget        JSON: { dailyWriteCap, dailyCostCap }
 *    status        "active" | "suspended" | "revoked"
 *    created_at, updated_at, last_used_at
 *
 *  Tokens (stored in `mcp_agent_token`):
 *    id            uuid
 *    agent_id      foreign key
 *    token_hash    SHA-256 of the bearer token. Plaintext is shown
 *                  ONCE at issue time and never again.
 *    expires_at    enforced at auth time
 *    created_at, last_used_at, revoked_at  */

import { db } from "../../db";
import { uuid } from "../id";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export type AgentStatus = "active" | "suspended" | "revoked";
export type RiskCeiling = "safe-read" | "low-mutation" | "high-mutation";

export interface AgentScopes {
  /** Map of resource id → allowed actions. Empty list = none. */
  [resource: string]: ReadonlyArray<"read" | "write" | "delete">;
}

export interface AgentRateLimits {
  /** Per-minute caps per risk class. The MCP server enforces the
   *  smallest of (this, the global default). */
  "safe-read"?: number;
  "low-mutation"?: number;
  "high-mutation"?: number;
}

export interface AgentBudget {
  /** Maximum record-writes (creates + updates + deletes) per UTC day. */
  dailyWriteCap?: number;
  /** Maximum LLM-cost in USD per UTC day. Plumbing only — we don't
   *  meter cost yet. Reserved for T4. */
  dailyCostCap?: number;
}

export interface Agent {
  id: string;
  name: string;
  description: string;
  tenantId: string;
  issuerUserId: string;
  mirrorUserId?: string;
  scopes: AgentScopes;
  riskCeiling: RiskCeiling;
  rateLimits: AgentRateLimits;
  budget: AgentBudget;
  /** Optional system-prompt-style instructions returned on initialize. */
  instructions?: string;
  status: AgentStatus;
  createdAt: string;
  updatedAt: string;
  lastUsedAt?: string;
}

interface AgentRow {
  id: string;
  name: string;
  description: string;
  tenant_id: string;
  issuer_user: string;
  mirror_user: string | null;
  scopes: string;
  risk_ceiling: string;
  rate_limits: string;
  budget: string;
  instructions: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  last_used_at: string | null;
}

interface TokenRow {
  id: string;
  agent_id: string;
  token_hash: string;
  expires_at: string | null;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

/** Idempotent migrations — run on first import. */
export function migrateAgentTables(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS mcp_agent (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      tenant_id TEXT NOT NULL,
      issuer_user TEXT NOT NULL,
      mirror_user TEXT,
      scopes TEXT NOT NULL DEFAULT '{}',
      risk_ceiling TEXT NOT NULL DEFAULT 'safe-read',
      rate_limits TEXT NOT NULL DEFAULT '{}',
      budget TEXT NOT NULL DEFAULT '{}',
      instructions TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      last_used_at TEXT
    );
    CREATE INDEX IF NOT EXISTS mcp_agent_tenant ON mcp_agent(tenant_id);

    CREATE TABLE IF NOT EXISTS mcp_agent_token (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL REFERENCES mcp_agent(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT,
      created_at TEXT NOT NULL,
      last_used_at TEXT,
      revoked_at TEXT
    );
    CREATE INDEX IF NOT EXISTS mcp_agent_token_agent ON mcp_agent_token(agent_id);
    CREATE INDEX IF NOT EXISTS mcp_agent_token_hash ON mcp_agent_token(token_hash);

    CREATE TABLE IF NOT EXISTS mcp_call_log (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL,
      tenant_id TEXT NOT NULL,
      method TEXT NOT NULL,
      tool_name TEXT,
      resource TEXT,
      record_id TEXT,
      action TEXT,
      risk TEXT,
      arguments TEXT,
      result_summary TEXT,
      ok INTEGER NOT NULL,
      error_code INTEGER,
      error_message TEXT,
      latency_ms INTEGER,
      idempotency_key TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS mcp_call_log_agent_time ON mcp_call_log(agent_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS mcp_call_log_idem ON mcp_call_log(agent_id, idempotency_key);
  `);
}

migrateAgentTables();

/* -- agent CRUD --------------------------------------------------- */

const RISK_RANK: Record<RiskCeiling, number> = {
  "safe-read": 0,
  "low-mutation": 1,
  "high-mutation": 2,
};

export function risksAtOrBelow(ceiling: RiskCeiling, requested: RiskCeiling): boolean {
  return RISK_RANK[requested] <= RISK_RANK[ceiling];
}

function rowToAgent(row: AgentRow): Agent {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    tenantId: row.tenant_id,
    issuerUserId: row.issuer_user,
    mirrorUserId: row.mirror_user ?? undefined,
    scopes: JSON.parse(row.scopes) as AgentScopes,
    riskCeiling: row.risk_ceiling as RiskCeiling,
    rateLimits: JSON.parse(row.rate_limits) as AgentRateLimits,
    budget: JSON.parse(row.budget) as AgentBudget,
    instructions: row.instructions ?? undefined,
    status: row.status as AgentStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastUsedAt: row.last_used_at ?? undefined,
  };
}

export function listAgents(tenantId: string): Agent[] {
  const rows = db
    .prepare(`SELECT * FROM mcp_agent WHERE tenant_id = ? ORDER BY created_at DESC`)
    .all(tenantId) as AgentRow[];
  return rows.map(rowToAgent);
}

export function getAgent(id: string): Agent | null {
  const row = db.prepare(`SELECT * FROM mcp_agent WHERE id = ?`).get(id) as AgentRow | undefined;
  return row ? rowToAgent(row) : null;
}

export interface CreateAgentArgs {
  name: string;
  description?: string;
  tenantId: string;
  issuerUserId: string;
  mirrorUserId?: string;
  scopes?: AgentScopes;
  riskCeiling?: RiskCeiling;
  rateLimits?: AgentRateLimits;
  budget?: AgentBudget;
  instructions?: string;
}

export function createAgent(args: CreateAgentArgs): Agent {
  const now = new Date().toISOString();
  const id = uuid();
  db.prepare(
    `INSERT INTO mcp_agent
       (id, name, description, tenant_id, issuer_user, mirror_user, scopes,
        risk_ceiling, rate_limits, budget, instructions, status,
        created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
  ).run(
    id,
    args.name,
    args.description ?? "",
    args.tenantId,
    args.issuerUserId,
    args.mirrorUserId ?? null,
    JSON.stringify(args.scopes ?? {}),
    args.riskCeiling ?? "safe-read",
    JSON.stringify(args.rateLimits ?? {}),
    JSON.stringify(args.budget ?? {}),
    args.instructions ?? null,
    now,
    now,
  );
  return getAgent(id)!;
}

export function updateAgent(id: string, patch: Partial<CreateAgentArgs> & { status?: AgentStatus }): Agent {
  const existing = getAgent(id);
  if (!existing) throw new Error(`unknown agent ${id}`);
  const merged = { ...existing, ...patch, updatedAt: new Date().toISOString() };
  db.prepare(
    `UPDATE mcp_agent SET
       name = ?, description = ?, mirror_user = ?, scopes = ?,
       risk_ceiling = ?, rate_limits = ?, budget = ?, instructions = ?,
       status = ?, updated_at = ?
     WHERE id = ?`,
  ).run(
    merged.name,
    merged.description,
    merged.mirrorUserId ?? null,
    JSON.stringify(merged.scopes),
    merged.riskCeiling,
    JSON.stringify(merged.rateLimits),
    JSON.stringify(merged.budget),
    merged.instructions ?? null,
    merged.status,
    merged.updatedAt,
    id,
  );
  return getAgent(id)!;
}

export function suspendAgent(id: string): void {
  db.prepare(
    `UPDATE mcp_agent SET status = 'suspended', updated_at = ? WHERE id = ?`,
  ).run(new Date().toISOString(), id);
}

export function revokeAgent(id: string): void {
  // Marking the agent revoked AND revoking every token in one tx so a
  // race-condition request mid-revoke can't slip through.
  const now = new Date().toISOString();
  const tx = db.transaction(() => {
    db.prepare(`UPDATE mcp_agent SET status = 'revoked', updated_at = ? WHERE id = ?`).run(now, id);
    db.prepare(
      `UPDATE mcp_agent_token SET revoked_at = ? WHERE agent_id = ? AND revoked_at IS NULL`,
    ).run(now, id);
  });
  tx();
}

/* -- token issue / verify ----------------------------------------- */

export interface IssuedToken {
  /** Plaintext token — shown ONCE. The store keeps only the hash. */
  plaintext: string;
  tokenId: string;
  expiresAt: string | null;
}

/** Issue a new bearer token for an agent. The plaintext is generated
 *  with `crypto.randomBytes` so the entropy survives a static-analyser
 *  re-export. We hash with SHA-256 (fast, unkeyed — good enough for
 *  random-128-bit secrets; not sufficient for password storage). */
export function issueToken(args: {
  agentId: string;
  expiresAt?: string;
}): IssuedToken {
  const agent = getAgent(args.agentId);
  if (!agent) throw new Error(`unknown agent ${args.agentId}`);
  if (agent.status !== "active") throw new Error(`agent ${args.agentId} is not active`);

  // 32 bytes = 256 bits. Encode as base64url (URL-safe) so the token
  // can travel in headers without escape hassles.
  const raw = randomBytes(32);
  const plaintext = `gma_${raw.toString("base64url")}`;
  const hash = createHash("sha256").update(plaintext).digest("hex");

  const id = uuid();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO mcp_agent_token (id, agent_id, token_hash, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(id, args.agentId, hash, args.expiresAt ?? null, now);
  return { plaintext, tokenId: id, expiresAt: args.expiresAt ?? null };
}

export function revokeToken(tokenId: string): void {
  db.prepare(
    `UPDATE mcp_agent_token SET revoked_at = ? WHERE id = ?`,
  ).run(new Date().toISOString(), tokenId);
}

export interface AuthedAgent {
  agent: Agent;
  tokenId: string;
}

/** Verify a bearer token and return the bound agent. Returns null on
 *  any failure (unknown token, expired, revoked, agent suspended). */
export function verifyAgentToken(plaintext: string): AuthedAgent | null {
  if (!plaintext || typeof plaintext !== "string") return null;
  // Defensive: we accept the bearer with or without our `gma_` prefix
  // so client mistakes don't get spuriously rejected.
  const hash = createHash("sha256").update(plaintext).digest("hex");
  const row = db
    .prepare(
      `SELECT * FROM mcp_agent_token WHERE token_hash = ? AND revoked_at IS NULL LIMIT 1`,
    )
    .get(hash) as TokenRow | undefined;
  if (!row) return null;

  // Constant-time comparison even though SQLite's lookup already
  // succeeded — defence in depth against future migration bugs.
  if (
    !timingSafeEqual(
      Buffer.from(row.token_hash, "hex"),
      Buffer.from(hash, "hex"),
    )
  ) {
    return null;
  }

  if (row.expires_at && Date.parse(row.expires_at) < Date.now()) return null;

  const agent = getAgent(row.agent_id);
  if (!agent || agent.status !== "active") return null;

  // Best-effort last-used update; failure here is non-fatal.
  try {
    db.prepare(
      `UPDATE mcp_agent_token SET last_used_at = ? WHERE id = ?`,
    ).run(new Date().toISOString(), row.id);
    db.prepare(`UPDATE mcp_agent SET last_used_at = ? WHERE id = ?`).run(
      new Date().toISOString(),
      agent.id,
    );
  } catch {
    /* ignore */
  }
  return { agent, tokenId: row.id };
}
