/** Per-agent rate limiter + circuit breaker + daily budget tracker.
 *
 *  Rate limiter — token bucket per (agent, risk-class). Refill rate
 *  comes from the agent's `rateLimits` config or the global default
 *  below. The smaller of the two wins.
 *
 *  Circuit breaker — counts consecutive failed mutations (any
 *  low-/high-mutation call that returned an error). After 5 failures
 *  inside a 10-minute window, the agent is locked out of mutations
 *  for 1 hour. Reads stay open. Reset on a successful mutation.
 *
 *  Budget — daily counter of mutation-writes. Refills at UTC midnight.
 *
 *  All state is in-memory; on a restart we lose counters. That's an
 *  acceptable trade-off — counters are advisory rate-shapers, not
 *  security boundaries. The per-call audit log + per-token revocation
 *  are the security boundary. */

import type { Risk } from "./risk";
import type { Agent } from "./agents";

const DEFAULT_LIMITS: Record<Risk, number> = {
  "safe-read": 600, // 10/sec sustained
  "low-mutation": 60, // 1/sec sustained
  "high-mutation": 10, // 1/6sec sustained
  "irreversible": 1, // never auto — dual-key required, hard cap
};

const CIRCUIT_THRESHOLD = 5;
const CIRCUIT_WINDOW_MS = 10 * 60_000;
const CIRCUIT_OPEN_MS = 60 * 60_000;

interface Bucket {
  tokens: number;
  lastRefillMs: number;
  perMinute: number;
}

interface Failures {
  /** Timestamps of recent failures within the trailing window. */
  timestamps: number[];
  /** When set, all mutations are blocked until this time. */
  openUntilMs?: number;
}

interface BudgetState {
  utcDay: string; // YYYY-MM-DD
  writes: number;
}

const BUCKETS = new Map<string, Bucket>();
const FAILURES = new Map<string, Failures>();
const BUDGETS = new Map<string, BudgetState>();

function bucketKey(agentId: string, risk: Risk): string {
  return `${agentId}:${risk}`;
}

function refill(bucket: Bucket, now: number): void {
  const elapsedMs = now - bucket.lastRefillMs;
  if (elapsedMs <= 0) return;
  const refillTokens = (elapsedMs / 60_000) * bucket.perMinute;
  bucket.tokens = Math.min(bucket.perMinute, bucket.tokens + refillTokens);
  bucket.lastRefillMs = now;
}

function effectiveLimit(agent: Agent, risk: Risk): number {
  const configured = agent.rateLimits[risk as keyof typeof agent.rateLimits];
  const dflt = DEFAULT_LIMITS[risk];
  if (typeof configured === "number" && configured >= 0) {
    return Math.min(configured, dflt);
  }
  return dflt;
}

/** Try to consume one token. Returns null on success, or an error
 *  message + retry-after when blocked. */
export function consume(agent: Agent, risk: Risk): null | { error: string; retryAfterMs: number } {
  const now = Date.now();

  // Circuit breaker check (mutations only).
  if (risk !== "safe-read") {
    const failures = FAILURES.get(agent.id);
    if (failures?.openUntilMs && failures.openUntilMs > now) {
      return {
        error: `circuit open for agent ${agent.id} until ${new Date(failures.openUntilMs).toISOString()}`,
        retryAfterMs: failures.openUntilMs - now,
      };
    }
  }

  // Rate limit.
  const key = bucketKey(agent.id, risk);
  const limit = effectiveLimit(agent, risk);
  if (limit <= 0) {
    return { error: `agent ${agent.id} has zero ${risk} budget`, retryAfterMs: 60_000 };
  }
  let bucket = BUCKETS.get(key);
  if (!bucket) {
    bucket = { tokens: limit, lastRefillMs: now, perMinute: limit };
    BUCKETS.set(key, bucket);
  } else if (bucket.perMinute !== limit) {
    bucket.perMinute = limit;
    bucket.tokens = Math.min(bucket.tokens, limit);
  }
  refill(bucket, now);
  if (bucket.tokens < 1) {
    const tokensNeeded = 1 - bucket.tokens;
    const retryAfterMs = (tokensNeeded / bucket.perMinute) * 60_000;
    return {
      error: `${risk} rate-limit hit for agent ${agent.id}`,
      retryAfterMs: Math.ceil(retryAfterMs),
    };
  }
  bucket.tokens -= 1;

  // Budget (mutations only).
  if (risk !== "safe-read") {
    const utcDay = new Date(now).toISOString().slice(0, 10);
    const cap = agent.budget.dailyWriteCap;
    if (typeof cap === "number" && cap >= 0) {
      const state = BUDGETS.get(agent.id);
      if (!state || state.utcDay !== utcDay) {
        BUDGETS.set(agent.id, { utcDay, writes: 1 });
      } else {
        if (state.writes >= cap) {
          return {
            error: `agent ${agent.id} hit daily budget (${cap} writes)`,
            retryAfterMs: msUntilNextUtcDay(now),
          };
        }
        state.writes += 1;
      }
    }
  }

  return null;
}

export function recordSuccess(agent: Agent, risk: Risk): void {
  if (risk === "safe-read") return;
  const failures = FAILURES.get(agent.id);
  if (failures) {
    failures.timestamps = [];
    failures.openUntilMs = undefined;
  }
}

export function recordFailure(agent: Agent, risk: Risk): void {
  if (risk === "safe-read") return;
  const now = Date.now();
  let failures = FAILURES.get(agent.id);
  if (!failures) {
    failures = { timestamps: [] };
    FAILURES.set(agent.id, failures);
  }
  failures.timestamps.push(now);
  // Drop timestamps outside the window.
  failures.timestamps = failures.timestamps.filter((t) => now - t <= CIRCUIT_WINDOW_MS);
  if (failures.timestamps.length >= CIRCUIT_THRESHOLD) {
    failures.openUntilMs = now + CIRCUIT_OPEN_MS;
  }
}

function msUntilNextUtcDay(now: number): number {
  const next = new Date(now);
  next.setUTCDate(next.getUTCDate() + 1);
  next.setUTCHours(0, 0, 0, 0);
  return next.getTime() - now;
}

/** Test-only: clear all in-memory state. */
export function _resetRateLimitState_forTest(): void {
  BUCKETS.clear();
  FAILURES.clear();
  BUDGETS.clear();
}
