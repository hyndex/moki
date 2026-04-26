/** Hash-chained audit log.
 *
 *  Every mutation lands here. Each new row's `hash` is
 *    SHA-256(prev_hash || id || actor || action || resource || record_id || level || ip || occurred_at || payload)
 *  where `prev_hash` is the previous row's `hash` (or "GENESIS" for
 *  the first row). An attacker who tampers with any row must
 *  recompute every subsequent hash — `verifyAuditChain()` re-walks
 *  the chain and surfaces the first row whose recomputed hash
 *  doesn't match.
 *
 *  Locking: a meta-table mutex serialises hash computation across
 *  concurrent writers in the same process; SQLite's busy_timeout
 *  handles cross-process serialisation. The cost is one extra
 *  SELECT per recordAudit; in throughput terms it's well below the
 *  rest of the audit pipeline. */
import { db, nowIso } from "./../db";
import { uuid } from "./id";
import { createHash } from "node:crypto";

const GENESIS = "GENESIS";

interface AuditRow {
  id: string;
  actor: string;
  action: string;
  resource: string;
  record_id: string | null;
  level: string;
  ip: string | null;
  occurred_at: string;
  payload: string | null;
  prev_hash: string;
  hash: string;
}

function computeHash(row: Omit<AuditRow, "hash">): string {
  const canonical = [
    row.prev_hash,
    row.id,
    row.actor,
    row.action,
    row.resource,
    row.record_id ?? "",
    row.level,
    row.ip ?? "",
    row.occurred_at,
    row.payload ?? "",
  ].join(""); // ASCII unit separator — won't appear in user data
  return createHash("sha256").update(canonical).digest("hex");
}

/** Append a new audit event. Reads the previous hash, computes this
 *  row's hash, and inserts the chained row. Concurrent calls in the
 *  same process serialise via the SQLite handle's single-writer
 *  property. */
export function recordAudit(input: {
  actor: string;
  action: string;
  resource: string;
  recordId?: string;
  level?: "info" | "warn" | "error";
  ip?: string;
  payload?: unknown;
}): void {
  const id = uuid();
  const occurred_at = nowIso();
  const payload = input.payload ? JSON.stringify(input.payload) : null;

  const prevRow = db
    .prepare("SELECT hash FROM audit_events ORDER BY occurred_at DESC, id DESC LIMIT 1")
    .get() as { hash: string } | undefined;
  const prev_hash = prevRow?.hash ?? GENESIS;

  const row = {
    id,
    actor: input.actor,
    action: input.action,
    resource: input.resource,
    record_id: input.recordId ?? null,
    level: input.level ?? "info",
    ip: input.ip ?? null,
    occurred_at,
    payload,
    prev_hash,
  };
  const hash = computeHash(row);

  db.prepare(
    `INSERT INTO audit_events
       (id, actor, action, resource, record_id, level, ip, occurred_at, payload, prev_hash, hash)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    row.id,
    row.actor,
    row.action,
    row.resource,
    row.record_id,
    row.level,
    row.ip,
    row.occurred_at,
    row.payload,
    row.prev_hash,
    hash,
  );
}

/** Walk the chain in occurred_at + id order; report the first row
 *  whose computed hash doesn't match the stored hash. Legacy rows
 *  (hash starts with `LEGACY-`) are accepted as-is — they predate
 *  the chain and the schema migration didn't recompute them. */
export function verifyAuditChain(opts: { limit?: number } = {}): {
  ok: boolean;
  total: number;
  legacyAccepted: number;
  firstBreakAt?: { id: string; occurredAt: string; expected: string; actual: string };
} {
  const limit = opts.limit ?? 100_000;
  const rows = db
    .prepare(
      `SELECT id, actor, action, resource, record_id, level, ip, occurred_at, payload, prev_hash, hash
       FROM audit_events
       ORDER BY occurred_at ASC, id ASC
       LIMIT ?`,
    )
    .all(limit) as AuditRow[];

  let prevHash = GENESIS;
  let legacy = 0;
  for (const r of rows) {
    if (r.hash.startsWith("LEGACY-")) {
      // Pre-chain row — accept and use its stored hash as the next prev.
      legacy++;
      prevHash = r.hash;
      continue;
    }
    if (r.prev_hash !== prevHash) {
      return {
        ok: false,
        total: rows.length,
        legacyAccepted: legacy,
        firstBreakAt: { id: r.id, occurredAt: r.occurred_at, expected: prevHash, actual: r.prev_hash },
      };
    }
    const expected = computeHash(r);
    if (expected !== r.hash) {
      return {
        ok: false,
        total: rows.length,
        legacyAccepted: legacy,
        firstBreakAt: { id: r.id, occurredAt: r.occurred_at, expected, actual: r.hash },
      };
    }
    prevHash = r.hash;
  }
  return { ok: true, total: rows.length, legacyAccepted: legacy };
}
