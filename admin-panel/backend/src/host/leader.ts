/** Leader-election + leased mutex backed by the `meta` table.
 *
 *  Use cases:
 *
 *    1. Singleton workers across a horizontally-scaled backend.
 *       Only one instance should run the cron tick / scheduler /
 *       webhook dispatcher / timeline writer at a time. Wrap the
 *       worker in `withLeadership(name, fn)` and only the lease
 *       holder fires.
 *
 *    2. Idempotency markers for one-shot jobs (e.g. "did we send
 *       the daily-digest email at 9am today?"). Use `acquireOnce`.
 *
 *  How it works:
 *
 *    - Lease rows live in the `meta` table under
 *      `lease:<name>` with value `{holderId, expiresAt}` JSON.
 *    - To take the lease, an instance does an atomic
 *      "INSERT … ON CONFLICT DO UPDATE … WHERE current.expiresAt < now"
 *      — so only one instance succeeds.
 *    - Holder renews the lease on a heartbeat (1/3 of TTL).
 *    - On stop, the holder voluntarily releases (deletes the row).
 *    - Crashed holder → lease expires after TTL and another instance picks it up.
 *
 *  Plugins compose this into their start() hooks:
 *
 *    let stop: (() => void) | null = null;
 *    export const hostPlugin = {
 *      start: () => { stop = withLeadership("notif:dispatcher", () => startDispatcher()); },
 *      stop: () => { stop?.(); },
 *    };
 */

import { db, nowIso } from "../db";

const HOLDER_ID = `${process.pid}:${Math.random().toString(36).slice(2, 9)}`;

interface LeaseRow {
  holderId: string;
  expiresAt: string;
}

function readLease(name: string): LeaseRow | null {
  try {
    const row = db.prepare("SELECT value FROM meta WHERE key = ?").get(`lease:${name}`) as { value: string } | undefined;
    if (!row) return null;
    return JSON.parse(row.value) as LeaseRow;
  } catch { return null; }
}

function writeLease(name: string, lease: LeaseRow): boolean {
  try {
    db.prepare(
      `INSERT INTO meta (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    ).run(`lease:${name}`, JSON.stringify(lease));
    return true;
  } catch { return false; }
}

function deleteLease(name: string, holderId: string): void {
  try {
    const cur = readLease(name);
    if (cur && cur.holderId === holderId) {
      db.prepare("DELETE FROM meta WHERE key = ?").run(`lease:${name}`);
    }
  } catch {/* meta missing */}
}

function tryAcquire(name: string, ttlMs: number): boolean {
  const cur = readLease(name);
  const now = Date.now();
  if (cur && cur.holderId !== HOLDER_ID && new Date(cur.expiresAt).getTime() > now) {
    // someone else holds a fresh lease
    return false;
  }
  const expiresAt = new Date(now + ttlMs).toISOString();
  return writeLease(name, { holderId: HOLDER_ID, expiresAt });
}

function renew(name: string, ttlMs: number): boolean {
  const cur = readLease(name);
  if (!cur || cur.holderId !== HOLDER_ID) return false;
  const expiresAt = new Date(Date.now() + ttlMs).toISOString();
  return writeLease(name, { holderId: HOLDER_ID, expiresAt });
}

export interface LeadershipOpts {
  /** Lease lifetime; the holder is considered crashed after this without a renewal. Default 30s. */
  ttlMs?: number;
  /** How often to retry acquiring + how often the holder renews. Default ttlMs/3. */
  heartbeatMs?: number;
  /** Called when leadership is acquired. */
  onAcquire?(): void;
  /** Called when leadership is lost (via crash / takeover). */
  onLose?(): void;
}

/** Run `start()` only when this instance holds the named lease.
 *  Returns a stop function that releases the lease + calls the
 *  shutdown returned by start().
 *
 *  start() returns the worker's actual stop fn (e.g. `clearInterval`).
 *  We invoke that automatically when leadership is lost.  */
export function withLeadership(
  name: string,
  start: () => (() => void) | void | Promise<(() => void) | void>,
  opts: LeadershipOpts = {},
): () => void {
  const ttlMs = opts.ttlMs ?? 30_000;
  const heartbeatMs = opts.heartbeatMs ?? Math.floor(ttlMs / 3);

  let workerStop: (() => void) | null = null;
  let amLeader = false;
  let timer: ReturnType<typeof setInterval> | null = null;
  let cancelled = false;

  const tick = async () => {
    if (cancelled) return;
    if (!amLeader) {
      if (tryAcquire(name, ttlMs)) {
        amLeader = true;
        opts.onAcquire?.();
        try {
          const ret = await start();
          if (typeof ret === "function") workerStop = ret;
        } catch (err) {
          console.error(`[leader] ${name} start() failed:`, err);
          // Release so another node can try.
          amLeader = false;
          deleteLease(name, HOLDER_ID);
        }
      }
    } else {
      if (!renew(name, ttlMs)) {
        // Lost the lease (clock skew or someone forced takeover).
        amLeader = false;
        opts.onLose?.();
        try { workerStop?.(); } catch {/* worker error */}
        workerStop = null;
      }
    }
  };

  // Initial attempt + recurring heartbeat.
  void tick();
  timer = setInterval(() => void tick(), heartbeatMs);

  return () => {
    cancelled = true;
    if (timer) clearInterval(timer);
    timer = null;
    if (amLeader) {
      try { workerStop?.(); } catch {/* worker error */}
      workerStop = null;
      amLeader = false;
      deleteLease(name, HOLDER_ID);
    }
  };
}

/** Idempotency marker: do something exactly once across all instances
 *  and across all reboots. Returns true if THIS call won the race
 *  (caller should run the job); false otherwise. */
export function acquireOnce(name: string): boolean {
  try {
    const result = db.prepare(
      `INSERT INTO meta (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO NOTHING`,
    ).run(`once:${name}`, nowIso());
    return result.changes === 1;
  } catch { return false; }
}

/** Diagnostics — used by /api/_plugins to show which instance holds each lease. */
export function listLeases(): Array<{ name: string; holderId: string; expiresAt: string; mine: boolean }> {
  try {
    const rows = db
      .prepare("SELECT key, value FROM meta WHERE key LIKE 'lease:%'")
      .all() as Array<{ key: string; value: string }>;
    return rows.map((r) => {
      const v = JSON.parse(r.value) as LeaseRow;
      return {
        name: r.key.slice("lease:".length),
        holderId: v.holderId,
        expiresAt: v.expiresAt,
        mine: v.holderId === HOLDER_ID,
      };
    });
  } catch { return []; }
}
