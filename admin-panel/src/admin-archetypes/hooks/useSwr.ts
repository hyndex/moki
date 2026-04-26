import * as React from "react";
import type { LoadState } from "../types";

/** Stale-while-revalidate fetcher tuned for KPI tiles, rail cards, and any
 *  read-mostly widget. Returns cached data on revisit, refetches in
 *  background, and surfaces error/empty/loading states uniformly.
 *
 *  Production hardening:
 *    • In-flight request dedup per key — concurrent useSwr instances on the
 *      same key share a single fetch.
 *    • AbortController on the fetcher's signal so explicit invalidations
 *      can cancel stale requests before they poison the cache.
 *    • Timeout (default 15s) wrapping the fetcher.
 *    • Exponential backoff with jitter on automatic failures (network /
 *      thrown). User-triggered refetch always retries from scratch.
 *    • Optional refresh-on-window-focus + refresh-on-online recovery.
 *    • Optional poll interval for cheap live-tail tiles.
 *    • Telemetry callback emits start / success / error / abort / retry. */

interface CacheEntry<T> {
  data?: T;
  error?: unknown;
  /** A controller for the current in-flight fetch (so concurrent readers
   *  share the same network call). */
  inflight?: { promise: Promise<T>; controller: AbortController };
  expires?: number;
  /** Number of consecutive failures — used for backoff diagnostics. */
  failures?: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

export interface SwrFetcher<T> {
  (signal: AbortSignal): Promise<T>;
}

export interface SwrOptions {
  /** Time-to-live for cached data, in ms. After TTL the next reader triggers
   *  a background refetch but still gets the cached value immediately.
   *  Default: 60_000. */
  ttlMs?: number;
  /** When false, never refetch automatically. Default: true. */
  revalidate?: boolean;
  /** Per-fetch timeout in ms. Aborts and returns an error after this time.
   *  Default: 15_000. */
  timeoutMs?: number;
  /** Maximum retries on automatic (non-user-triggered) failures.
   *  Default: 2. Set to 0 to disable. */
  maxRetries?: number;
  /** Refetch when the window regains focus. Default: true. */
  refreshOnFocus?: boolean;
  /** Refetch when the browser regains network connectivity. Default: true. */
  refreshOnReconnect?: boolean;
  /** Poll interval in ms. 0 disables. Default: 0. */
  pollMs?: number;
  /** Telemetry callback fired on every state transition. */
  onEvent?: (e: SwrEvent) => void;
}

export type SwrEvent =
  | { kind: "fetch-start"; key: string }
  | { kind: "fetch-success"; key: string; ms: number }
  | { kind: "fetch-error"; key: string; ms: number; error: unknown }
  | { kind: "abort"; key: string }
  | { kind: "retry"; key: string; attempt: number; delayMs: number };

export interface SwrResult<T> {
  data?: T;
  error?: unknown;
  state: LoadState;
  isValidating: boolean;
  refetch: () => Promise<T | undefined>;
}

const DEFAULT_TTL = 60_000;
const DEFAULT_TIMEOUT = 15_000;
const DEFAULT_RETRIES = 2;

/** Compute exponential-backoff delay with full jitter, capped at 5s. */
function backoffDelay(attempt: number): number {
  const base = 250 * 2 ** attempt; // 250, 500, 1000, 2000 …
  const capped = Math.min(base, 5_000);
  return Math.floor(Math.random() * capped); // full jitter
}

function withTimeout<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  controller: AbortController,
  timeoutMs: number,
): Promise<T> {
  if (timeoutMs <= 0) return fn(controller.signal);
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => {
      try {
        controller.abort(new Error(`Timeout after ${timeoutMs}ms`));
      } catch {
        /* AbortController.abort(reason) unsupported in some browsers; ignore */
      }
    }, timeoutMs);
    fn(controller.signal).then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

/** Bridge legacy `() => Promise<T>` fetchers to signal-aware ones. */
function liftFetcher<T>(
  fetcher: SwrFetcher<T> | (() => Promise<T>),
): SwrFetcher<T> {
  if (fetcher.length >= 1) return fetcher as SwrFetcher<T>;
  return (signal: AbortSignal) => {
    if (signal.aborted) return Promise.reject(signal.reason ?? new Error("aborted"));
    return (fetcher as () => Promise<T>)();
  };
}

export function useSwr<T>(
  key: string | null,
  fetcher: SwrFetcher<T> | (() => Promise<T>),
  options: SwrOptions = {},
): SwrResult<T> {
  const {
    ttlMs = DEFAULT_TTL,
    revalidate = true,
    timeoutMs = DEFAULT_TIMEOUT,
    maxRetries = DEFAULT_RETRIES,
    refreshOnFocus = true,
    refreshOnReconnect = true,
    pollMs = 0,
    onEvent,
  } = options;

  const fetcherRef = React.useRef(fetcher);
  fetcherRef.current = fetcher;
  const onEventRef = React.useRef(onEvent);
  onEventRef.current = onEvent;

  const [, force] = React.useReducer((n: number) => n + 1, 0);
  const isMountedRef = React.useRef(true);

  const emit = React.useCallback((e: SwrEvent) => {
    onEventRef.current?.(e);
  }, []);

  const run = React.useCallback(
    async (allowRetry: boolean): Promise<T | undefined> => {
      if (!key) return undefined;
      const entry = (cache.get(key) ?? {}) as CacheEntry<T>;

      // Dedup: if there is already an in-flight request for this key, await
      // its result instead of starting a new one.
      if (entry.inflight) {
        try {
          return await entry.inflight.promise;
        } catch {
          return undefined;
        }
      }

      const controller = new AbortController();
      const lifted = liftFetcher(fetcherRef.current);

      const start = Date.now();
      emit({ kind: "fetch-start", key });

      const promise = (async (): Promise<T> => {
        let lastErr: unknown;
        const attempts = allowRetry ? maxRetries + 1 : 1;
        for (let attempt = 0; attempt < attempts; attempt++) {
          if (controller.signal.aborted) {
            throw controller.signal.reason ?? new Error("aborted");
          }
          try {
            const value = await withTimeout(lifted, controller, timeoutMs);
            return value;
          } catch (err) {
            lastErr = err;
            if (controller.signal.aborted) throw err;
            if (attempt < attempts - 1) {
              const delay = backoffDelay(attempt);
              emit({ kind: "retry", key, attempt: attempt + 1, delayMs: delay });
              await new Promise((r) => setTimeout(r, delay));
            }
          }
        }
        throw lastErr;
      })();

      entry.inflight = { promise, controller };
      cache.set(key, entry as CacheEntry<unknown>);
      if (isMountedRef.current) force();

      try {
        const data = await promise;
        if (!controller.signal.aborted) {
          entry.data = data;
          entry.error = undefined;
          entry.expires = Date.now() + ttlMs;
          entry.failures = 0;
        }
        const ms = Date.now() - start;
        emit({ kind: "fetch-success", key, ms });
        return data;
      } catch (err) {
        if (controller.signal.aborted) {
          emit({ kind: "abort", key });
        } else {
          entry.error = err;
          entry.failures = (entry.failures ?? 0) + 1;
          const ms = Date.now() - start;
          emit({ kind: "fetch-error", key, ms, error: err });
        }
        return undefined;
      } finally {
        entry.inflight = undefined;
        cache.set(key, entry as CacheEntry<unknown>);
        if (isMountedRef.current) force();
      }
    },
    [key, ttlMs, timeoutMs, maxRetries, emit],
  );

  React.useEffect(() => {
    isMountedRef.current = true;
    if (!key) return;
    const entry = (cache.get(key) ?? {}) as CacheEntry<T>;
    const stale = !entry.expires || entry.expires < Date.now();
    if (entry.data === undefined || (stale && revalidate)) {
      void run(true);
    }
    return () => {
      isMountedRef.current = false;
      // We don't abort here: another reader of the same key may be relying
      // on the in-flight fetch. invalidateSwr() is the explicit cancel
      // path.
    };
  }, [key, revalidate, run]);

  React.useEffect(() => {
    if (!key) return;
    if (typeof window === "undefined") return;
    const handlers: Array<() => void> = [];

    if (refreshOnFocus) {
      const onFocus = () => {
        const entry = cache.get(key) as CacheEntry<T> | undefined;
        if (!entry || !entry.expires || entry.expires < Date.now()) {
          void run(true);
        }
      };
      window.addEventListener("focus", onFocus);
      handlers.push(() => window.removeEventListener("focus", onFocus));
    }

    if (refreshOnReconnect) {
      const onOnline = () => void run(true);
      window.addEventListener("online", onOnline);
      handlers.push(() => window.removeEventListener("online", onOnline));
    }

    if (pollMs > 0) {
      const interval = setInterval(() => void run(true), pollMs);
      handlers.push(() => clearInterval(interval));
    }

    return () => {
      for (const off of handlers) off();
    };
  }, [key, refreshOnFocus, refreshOnReconnect, pollMs, run]);

  const refetch = React.useCallback(() => run(false), [run]);

  const entry = key
    ? ((cache.get(key) ?? {}) as CacheEntry<T>)
    : ({} as CacheEntry<T>);
  const data = entry.data;
  const error = entry.error;
  const inflight = entry.inflight != null;

  let state: LoadState;
  if (data !== undefined && error === undefined) state = { status: "ready" };
  else if (data !== undefined && inflight) state = { status: "ready" };
  else if (inflight) state = { status: "loading" };
  else if (error !== undefined) state = { status: "error", error };
  else state = { status: "idle" };

  return {
    data,
    error,
    state,
    isValidating: inflight,
    refetch,
  };
}

/** Clear cached SWR entries that match a prefix — used when a write
 *  invalidates downstream KPIs or rail cards. Aborts in-flight fetches. */
export function invalidateSwr(prefix: string) {
  for (const [key, entry] of cache.entries()) {
    if (!key.startsWith(prefix)) continue;
    const e = entry as CacheEntry<unknown>;
    if (e.inflight) {
      try {
        e.inflight.controller.abort(new Error("invalidated"));
      } catch {
        /* abort handlers may throw in odd browsers; ignore */
      }
    }
    cache.delete(key);
  }
}

/** Test-only: reset the entire cache. */
export function _resetSwrCache_forTest() {
  cache.clear();
}
