/** Idempotency-key store. Mutations carrying an `Idempotency-Key`
 *  header (or `_meta.idempotencyKey` arg) get their result cached
 *  for 24 hours; a retry with the same key returns the original
 *  result without re-executing.
 *
 *  Storage: SQLite `mcp_idempotency` table — survives restart.
 *  Why SQL: an in-memory map is fine for rate limits but unsafe for
 *  idempotency. If the server restarts mid-retry, an in-memory key
 *  vanishes and the agent's retry triggers a duplicate write. */

import { db } from "../../db";

interface IdempotencyRow {
  agent_id: string;
  key: string;
  tool_name: string;
  arguments_hash: string;
  result: string;
  ok: number;
  expires_at: string;
  created_at: string;
}

db.exec(`
  CREATE TABLE IF NOT EXISTS mcp_idempotency (
    agent_id TEXT NOT NULL,
    key TEXT NOT NULL,
    tool_name TEXT NOT NULL,
    arguments_hash TEXT NOT NULL,
    result TEXT NOT NULL,
    ok INTEGER NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (agent_id, key)
  );
  CREATE INDEX IF NOT EXISTS mcp_idempotency_expiry ON mcp_idempotency(expires_at);
`);

const TTL_MS = 24 * 60 * 60_000;

export interface CachedResult {
  result: unknown;
  ok: boolean;
  toolName: string;
  argumentsHash: string;
}

export function lookup(agentId: string, key: string): CachedResult | null {
  if (!key) return null;
  const row = db
    .prepare(
      `SELECT * FROM mcp_idempotency WHERE agent_id = ? AND key = ?`,
    )
    .get(agentId, key) as IdempotencyRow | undefined;
  if (!row) return null;
  if (Date.parse(row.expires_at) < Date.now()) {
    db.prepare(`DELETE FROM mcp_idempotency WHERE agent_id = ? AND key = ?`).run(agentId, key);
    return null;
  }
  return {
    result: JSON.parse(row.result),
    ok: row.ok === 1,
    toolName: row.tool_name,
    argumentsHash: row.arguments_hash,
  };
}

export function store(args: {
  agentId: string;
  key: string;
  toolName: string;
  argumentsHash: string;
  result: unknown;
  ok: boolean;
}): void {
  if (!args.key) return;
  const now = new Date();
  const expires = new Date(now.getTime() + TTL_MS);
  db.prepare(
    `INSERT OR REPLACE INTO mcp_idempotency
       (agent_id, key, tool_name, arguments_hash, result, ok, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    args.agentId,
    args.key,
    args.toolName,
    args.argumentsHash,
    JSON.stringify(args.result),
    args.ok ? 1 : 0,
    expires.toISOString(),
    now.toISOString(),
  );
}

/** GC stale rows. Called opportunistically — not a critical path. */
export function purgeExpired(): number {
  const r = db
    .prepare(`DELETE FROM mcp_idempotency WHERE expires_at < ?`)
    .run(new Date().toISOString());
  return r.changes;
}

/** Recursively canonicalise an arbitrary value so equivalent inputs
 *  always serialise to the same string. We can't use the
 *  `JSON.stringify(v, replacer)` array shorthand because it applies
 *  the same key list at every level — that would silently strip
 *  `x` out of `{ a: { x: 1 } }`. */
function canonicalise(v: unknown): string {
  if (v === null || v === undefined) return "null";
  if (typeof v === "number" || typeof v === "boolean") return JSON.stringify(v);
  if (typeof v === "string") return JSON.stringify(v);
  if (Array.isArray(v)) return "[" + v.map(canonicalise).join(",") + "]";
  if (typeof v === "object") {
    const keys = Object.keys(v as Record<string, unknown>).sort();
    return (
      "{" +
      keys
        .map((k) => JSON.stringify(k) + ":" + canonicalise((v as Record<string, unknown>)[k]))
        .join(",") +
      "}"
    );
  }
  return JSON.stringify(v);
}

/** Stable hash of an arguments object for replay-detection. */
export function hashArgs(args: unknown): string {
  const canonical = canonicalise(args);
  // FNV-1a — fast + collision-resistant enough for this use.
  let h = 0x811c9dc5;
  for (let i = 0; i < canonical.length; i++) {
    h ^= canonical.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16);
}
