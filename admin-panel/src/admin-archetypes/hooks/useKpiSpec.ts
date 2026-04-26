import * as React from "react";
import { apiFetch, ApiError } from "@/runtime/auth";
import type { LoadState } from "../types";

/** A single aggregation in a KPI spec. The framework computes one numeric
 *  value per metric and keys the result by `metric.id`. */
export interface KpiMetricSpec {
  /** Stable id used as the key in the returned `data` map. */
  id: string;
  /** Aggregation function. `count` ignores `field`. */
  fn: "count" | "sum" | "avg" | "min" | "max";
  /** Field to aggregate. Required for sum/avg/min/max; ignored for count. */
  field?: string;
  /** Optional inline filter — equality only. For range filters use `where`. */
  filters?: Record<string, string | number | boolean>;
  /** Restrict to records updated within the last `withinDays` days. */
  withinDays?: number;
}

export interface KpiSpec {
  /** Stable id — the hook keys its cache off this value. */
  id: string;
  /** The resource the spec aggregates over (e.g. `accounting.invoice`). */
  resource: string;
  metrics: readonly KpiMetricSpec[];
}

export interface KpiSpecResult {
  data: Record<string, number>;
  state: LoadState;
  refetch: () => void;
}

interface CacheEntry {
  data?: Record<string, number>;
  error?: unknown;
  promise?: Promise<Record<string, number>>;
  expires?: number;
}

const cache = new Map<string, CacheEntry>();
const TTL_MS = 30_000;

function specKey(spec: KpiSpec): string {
  return `kpi:${spec.id}:${spec.resource}:${spec.metrics
    .map((m) => `${m.id}|${m.fn}|${m.field ?? ""}|${JSON.stringify(m.filters ?? {})}|${m.withinDays ?? ""}`)
    .join(";")}`;
}

async function fetchAggregate(spec: KpiSpec): Promise<Record<string, number>> {
  const res = await apiFetch<{ data: Record<string, number> }>("/kpi/aggregate", {
    method: "POST",
    body: JSON.stringify(spec),
  });
  return res.data ?? {};
}

/** Server-side KPI aggregation. Posts the spec to `/api/kpi/aggregate`; the
 *  backend runs SQL aggregations against the `records` table (with the same
 *  ACL/tenant filters as the resource list endpoint) and returns one number
 *  per metric. The hook handles SWR semantics, dedup, error fallback, and
 *  TTL-based revalidation.
 *
 *  Why server-side: client-side `useAllRecords + reduce` doesn't scale past
 *  a few hundred rows and forces every page to ship the entire dataset over
 *  the wire. The aggregate endpoint moves the work to the database.
 *
 *  Resilience: when the endpoint fails (404/500/network), the hook still
 *  returns `{ status: "error" }` so the page can render its mocked fallback
 *  the same way it would for any other widget failure. */
export function useKpiSpec(spec: KpiSpec): KpiSpecResult {
  const key = specKey(spec);
  const [, force] = React.useReducer((n: number) => n + 1, 0);

  const entry = cache.get(key) ?? {};
  if (!cache.has(key)) cache.set(key, entry);

  React.useEffect(() => {
    const e = cache.get(key)!;
    const fresh = e.expires && e.expires > Date.now();
    if (e.data && fresh) return;
    if (e.promise) return;
    e.error = undefined;
    e.promise = fetchAggregate(spec)
      .then((data) => {
        e.data = data;
        e.error = undefined;
        e.expires = Date.now() + TTL_MS;
        return data;
      })
      .catch((err) => {
        e.error = err;
        // Cache the failure briefly so a tight render loop doesn't hammer
        // the backend; the next user-triggered refetch clears it.
        e.expires = Date.now() + 5_000;
        throw err;
      })
      .finally(() => {
        e.promise = undefined;
        force();
      });
    force();
  }, [key, spec]);

  const data = entry.data ?? {};
  const state: LoadState = entry.error
    ? { status: "error", error: entry.error }
    : entry.data
      ? { status: "ready" }
      : { status: "loading" };

  const refetch = React.useCallback(() => {
    const e = cache.get(key);
    if (!e) return;
    e.expires = 0;
    e.error = undefined;
    e.promise = undefined;
    force();
  }, [key]);

  return { data, state, refetch };
}

/** Treat `ApiError` 404 as "endpoint not deployed yet" so the page can fall
 *  back to client-side aggregation without flagging an error. Other failure
 *  modes (500, network, timeout) still surface as `state.error`. */
export function isKpiEndpointMissing(err: unknown): boolean {
  return err instanceof ApiError && err.status === 404;
}
