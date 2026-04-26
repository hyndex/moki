/** Production-grade middleware stack.
 *
 *  Wired into the shell's createApp() before tenant resolution:
 *
 *    1. trace ID         — assigns/propagates X-Request-ID; available
 *                          on c.var.requestId for every handler/log.
 *    2. structured log   — one JSON line per request with method, path,
 *                          status, duration, tenant, user, traceId.
 *    3. security headers — HSTS, CSP, X-Frame-Options, X-Content-Type,
 *                          Referrer-Policy. Cheap, applied to every
 *                          response.
 *    4. body-size cap    — refuses requests above MAX_BODY_BYTES (5 MB
 *                          default, override via env). Prevents memory
 *                          blow-up on adversarial uploads.
 *    5. rate limiter     — sliding-window per-IP. Currently in-memory;
 *                          for multi-instance prod, swap the Map for a
 *                          DB-backed store (PR welcome). */

import type { Context, Next } from "hono";

/* ---- 1. Trace ID + structured logger -------------------------------- */

let LOG_SINK: (line: string) => void = (s) => console.log(s);

export function setLogSink(fn: (line: string) => void): void { LOG_SINK = fn; }

function newTraceId(): string {
  // 16 hex chars (64 bits) — enough entropy for distributed correlation,
  // cheap to read in logs.
  const b = new Uint8Array(8);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

function safeJson(o: Record<string, unknown>): string {
  try { return JSON.stringify(o); }
  catch { return JSON.stringify({ ...o, error: "log-serialization-failed" }); }
}

export function traceAndLog() {
  return async (c: Context, next: Next) => {
    const traceId = c.req.header("x-request-id") ?? newTraceId();
    c.set("requestId", traceId);
    c.header("x-request-id", traceId);
    const t0 = performance.now();
    let user: string | undefined;
    let tenant: string | undefined;
    try {
      await next();
    } finally {
      try {
        // best-effort enrich: works after auth + tenant middleware
        user = c.get("user")?.email;
        tenant = c.get("tenantId");
      } catch {/* unauth path */}
      const dur = Math.round(performance.now() - t0);
      LOG_SINK(safeJson({
        ts: new Date().toISOString(),
        level: c.res.status >= 500 ? "error" : c.res.status >= 400 ? "warn" : "info",
        method: c.req.method,
        path: new URL(c.req.url).pathname,
        status: c.res.status,
        dur_ms: dur,
        traceId,
        user,
        tenant,
      }));
    }
  };
}

/* ---- 2. Security headers ------------------------------------------- */

export function securityHeaders() {
  return async (c: Context, next: Next) => {
    await next();
    // Strict-Transport-Security: only send if behind TLS (we trust the
    // platform's TLS terminator). Production deployments should set
    // HSTS_MAX_AGE in the platform config; we set a default of 1 year.
    const hsts = process.env.HSTS_MAX_AGE ?? "31536000";
    c.header("Strict-Transport-Security", `max-age=${hsts}; includeSubDomains`);
    c.header("X-Content-Type-Options", "nosniff");
    c.header("X-Frame-Options", "DENY");
    c.header("Referrer-Policy", "strict-origin-when-cross-origin");
    c.header("X-DNS-Prefetch-Control", "off");
    c.header("Permissions-Policy", "interest-cohort=()");
    // CSP for the JSON API: zero scripts, zero plugins, zero frames.
    // The shell's index.html is served by Vite (dev) or the static
    // hosting layer (prod) and should set its own CSP.
    if (c.req.path.startsWith("/api/")) {
      c.header("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'");
    }
  };
}

/* ---- 3. Body-size cap ---------------------------------------------- */

const MAX_BODY_BYTES = Number(process.env.MAX_BODY_BYTES ?? 5 * 1024 * 1024); // 5 MB default

export function bodySizeLimit() {
  return async (c: Context, next: Next) => {
    const cl = c.req.header("content-length");
    if (cl && Number(cl) > MAX_BODY_BYTES) {
      return c.json({
        error: `body exceeds ${MAX_BODY_BYTES} bytes`,
        code: "payload-too-large",
        max: MAX_BODY_BYTES,
      }, 413);
    }
    await next();
  };
}

/* ---- 4. Rate limiter (sliding window, per-IP, DB-backed) ----------- */

import { db } from "../db";

const RATE_WINDOW_MS = Number(process.env.RATE_WINDOW_MS ?? 60_000);
const RATE_MAX = Number(process.env.RATE_MAX ?? 600);

let rateLimitSchemaReady = false;
function ensureRateLimitSchema(): void {
  if (rateLimitSchemaReady) return;
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS rate_limit_buckets (
        bucket_key TEXT PRIMARY KEY,
        window_start_ms INTEGER NOT NULL,
        count INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS rate_limit_buckets_window_idx
        ON rate_limit_buckets(window_start_ms);
    `);
    rateLimitSchemaReady = true;
  } catch {/* meta table missing in tests */}
}

function clientIp(c: Context): string {
  const xff = c.req.header("x-forwarded-for");
  if (xff && process.env.TRUST_PROXY === "1") {
    return xff.split(",")[0]!.trim();
  }
  return c.req.header("x-real-ip") ?? "unknown";
}

interface BucketRow { bucket_key: string; window_start_ms: number; count: number }

/** Atomic-enough sliding-window counter backed by SQLite so multiple
 *  backend instances share the same view. Single-writer SQLite serialises
 *  the read-modify-write naturally; busy_timeout=5s handles contention. */
function checkAndIncrement(key: string, now: number): { allowed: boolean; remaining: number; retryAfter: number } {
  ensureRateLimitSchema();
  const row = db
    .prepare("SELECT bucket_key, window_start_ms, count FROM rate_limit_buckets WHERE bucket_key = ?")
    .get(key) as BucketRow | undefined;

  // Fresh window: reset count to 1.
  if (!row || now - row.window_start_ms > RATE_WINDOW_MS) {
    db.prepare(
      `INSERT INTO rate_limit_buckets (bucket_key, window_start_ms, count)
       VALUES (?, ?, 1)
       ON CONFLICT(bucket_key) DO UPDATE
         SET window_start_ms = excluded.window_start_ms,
             count = excluded.count`,
    ).run(key, now);
    return { allowed: true, remaining: Math.max(0, RATE_MAX - 1), retryAfter: 0 };
  }

  // Within window: bump count.
  const next = row.count + 1;
  db.prepare("UPDATE rate_limit_buckets SET count = ? WHERE bucket_key = ?").run(next, key);
  if (next > RATE_MAX) {
    const retryAfter = Math.ceil((RATE_WINDOW_MS - (now - row.window_start_ms)) / 1000);
    return { allowed: false, remaining: 0, retryAfter: Math.max(1, retryAfter) };
  }
  return { allowed: true, remaining: Math.max(0, RATE_MAX - next), retryAfter: 0 };
}

/** Periodically GC stale rate-limit rows. Bounded — runs every 5 min. */
let lastGc = 0;
function gcRateBuckets(now: number): void {
  if (now - lastGc < 5 * 60_000) return;
  lastGc = now;
  try {
    db.prepare("DELETE FROM rate_limit_buckets WHERE window_start_ms < ?").run(now - RATE_WINDOW_MS * 2);
  } catch {/* table missing */}
}

export function rateLimit() {
  return async (c: Context, next: Next) => {
    // Health + readiness probes are not rate-limited — load balancers
    // poll them aggressively.
    if (c.req.path === "/api/health" || c.req.path === "/api/ready") return next();

    const ip = clientIp(c);
    const now = Date.now();
    gcRateBuckets(now);

    let result;
    try {
      result = checkAndIncrement(`ip:${ip}`, now);
    } catch (err) {
      // If the rate-limit DB blows up, fail open rather than blocking
      // every request. Log loudly so it's visible.
      console.error("[rate-limit] check failed; failing open:", err);
      return next();
    }

    c.header("X-RateLimit-Limit", String(RATE_MAX));
    c.header("X-RateLimit-Remaining", String(result.remaining));

    if (!result.allowed) {
      c.header("Retry-After", String(result.retryAfter));
      return c.json({ error: "rate limit exceeded", code: "rate-limited" }, 429);
    }
    return next();
  };
}

/* ---- 5. Per-route metrics counters --------------------------------- */

interface RouteCounters {
  count: number;
  errors: number;
  durMin: number;
  durMax: number;
  durSum: number;
}

const ROUTE_METRICS = new Map<string, RouteCounters>();

export function metricsCollector() {
  return async (c: Context, next: Next) => {
    const t0 = performance.now();
    let key = `${c.req.method} ${new URL(c.req.url).pathname}`;
    // Collapse common id-bearing paths so we don't blow the cardinality.
    key = key.replace(/[0-9a-f-]{36}/gi, ":id").replace(/\/[0-9]+\b/g, "/:n");
    try {
      await next();
    } finally {
      const dur = performance.now() - t0;
      const m = ROUTE_METRICS.get(key) ?? { count: 0, errors: 0, durMin: Infinity, durMax: 0, durSum: 0 };
      m.count++;
      m.durMin = Math.min(m.durMin, dur);
      m.durMax = Math.max(m.durMax, dur);
      m.durSum += dur;
      if (c.res.status >= 500) m.errors++;
      ROUTE_METRICS.set(key, m);
    }
  };
}

export function readRouteMetrics(): Array<{ route: string; count: number; errors: number; durAvgMs: number; durMinMs: number; durMaxMs: number }> {
  return [...ROUTE_METRICS.entries()].map(([route, m]) => ({
    route,
    count: m.count,
    errors: m.errors,
    durAvgMs: Math.round(m.durSum / m.count),
    durMinMs: m.durMin === Infinity ? 0 : Math.round(m.durMin),
    durMaxMs: Math.round(m.durMax),
  })).sort((a, b) => b.count - a.count);
}
