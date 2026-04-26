/** Process-level boot + drain orchestration.
 *
 *  Modern PaaS deployers (Kubernetes, ECS, Fly.io, …) expect:
 *
 *    GET /api/health   liveness  — am I crashed? if not, return 200.
 *                                  Cheap; doesn't touch dependencies.
 *    GET /api/ready    readiness — am I able to serve traffic? returns
 *                                  503 until plugin migrations + start
 *                                  hooks are done; flips to 200 once
 *                                  the boot is fully complete.
 *
 *    SIGTERM  →  flip readiness=false (load balancer drains)
 *               →  wait for in-flight requests to finish (up to drainMs)
 *               →  call stopPlugins()
 *               →  process.exit(0)
 *
 *  This module exposes a tiny state machine + middleware so main.ts and
 *  the health/ready routes consume a single source of truth. */

let booting = true;
let draining = false;
let inFlight = 0;
let onAllDrained: (() => void) | null = null;

/** Mark the system as booted (migrations + plugin start hooks complete).
 *  Until this is called /api/ready returns 503. */
export function markReady(): void { booting = false; }

/** True while the boot sequence is still running. */
export function isBooting(): boolean { return booting; }

/** True after SIGTERM has been received. */
export function isDraining(): boolean { return draining; }

/** Increment / decrement in-flight request counter. Used by the drain
 *  middleware so we know when zero requests remain. */
function entered(): void { inFlight++; }
function exited(): void {
  inFlight = Math.max(0, inFlight - 1);
  if (draining && inFlight === 0 && onAllDrained) onAllDrained();
}

/** Hono middleware: tracks in-flight requests + refuses new ones once
 *  draining begins (after SIGTERM). New requests get 503 with a
 *  Retry-After header so the load balancer takes us out of rotation. */
export function drainMiddleware() {
  return async (c: import("hono").Context, next: import("hono").Next) => {
    if (draining) {
      c.header("Retry-After", "5");
      return c.json({ error: "server is draining; please retry", code: "draining" }, 503);
    }
    entered();
    try { await next(); }
    finally { exited(); }
  };
}

export interface DrainOpts {
  /** How long to wait for in-flight requests before forcing exit. Default 25s. */
  drainMs?: number;
  /** Stop hook to run AFTER the drain completes (e.g. stopPlugins). */
  onDrained?: () => Promise<void> | void;
}

/** Begin the drain. Returns a promise that resolves when in-flight
 *  count hits zero OR drainMs elapses, whichever comes first. */
export async function startDrain(opts: DrainOpts = {}): Promise<void> {
  if (draining) return;
  draining = true;
  const drainMs = opts.drainMs ?? 25_000;
  const t0 = Date.now();
  console.log(`[lifecycle] drain begin; in-flight=${inFlight}; deadline=${drainMs}ms`);

  await new Promise<void>((resolve) => {
    if (inFlight === 0) return resolve();
    onAllDrained = () => resolve();
    setTimeout(() => {
      onAllDrained = null;
      console.warn(`[lifecycle] drain timeout reached; in-flight=${inFlight}; forcing on`);
      resolve();
    }, drainMs);
  });

  console.log(`[lifecycle] drain done in ${Date.now() - t0}ms; running stop hooks`);
  if (opts.onDrained) await opts.onDrained();
  console.log(`[lifecycle] stop hooks done`);
}

/** Snapshot for /api/_metrics + diagnostics. */
export function lifecycleSnapshot(): {
  booting: boolean;
  draining: boolean;
  inFlight: number;
  uptimeMs: number;
} {
  return {
    booting,
    draining,
    inFlight,
    uptimeMs: Math.round(process.uptime() * 1000),
  };
}
