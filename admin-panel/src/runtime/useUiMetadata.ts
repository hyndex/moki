/** Frontend hook for the picker-feeding metadata (resources + tools +
 *  bounded enums like currencies, timezones, locales).
 *
 *  Why a hook
 *  ----------
 *  Resources and tools come from the running plugin set, which can
 *  change at runtime (a plugin gets enabled / a new resource has its
 *  first record written). The shell can't bake either into a constant.
 *
 *  Cache shape
 *  -----------
 *  Module-level cache keyed by endpoint with a short TTL — pickers are
 *  opened repeatedly and we don't want to refetch on every mount, but
 *  we DO want a freshly-enabled plugin to surface within seconds.
 *  React state ensures rerenders propagate to every mounted picker. */

import * as React from "react";
import { apiFetch } from "./auth";

export interface UiResource {
  id: string;
  label?: string;
  pluralLabel?: string;
  group?: string;
  icon?: string;
  actions?: ReadonlyArray<"read" | "write" | "delete">;
  description?: string;
  pluginId?: string;
}

export interface UiTool {
  name: string;
  description: string;
  resource: string | null;
  scopeAction: "read" | "write" | "delete" | null;
  risk: "safe-read" | "low-mutation" | "high-mutation" | "irreversible";
  annotations: {
    title?: string;
    readOnlyHint?: boolean;
    destructiveHint?: boolean;
    idempotentHint?: boolean;
    openWorldHint?: boolean;
  } | null;
}

interface CurrencyEntry { code: string; name: string }
interface LocaleEntry { code: string; name: string }

const TTL_MS = 30_000;

interface CacheEntry<T> { at: number; data: T; promise?: Promise<T> }

const CACHE: {
  resources?: CacheEntry<UiResource[]>;
  tools?: CacheEntry<UiTool[]>;
  currencies?: CacheEntry<CurrencyEntry[]>;
  timezones?: CacheEntry<string[]>;
  locales?: CacheEntry<LocaleEntry[]>;
} = {};

const SUBSCRIBERS = new Set<() => void>();
function notify(): void { for (const fn of SUBSCRIBERS) fn(); }

async function fetchOnce<K extends keyof typeof CACHE>(
  key: K,
  url: string,
): Promise<NonNullable<typeof CACHE[K]>["data"]> {
  const existing = CACHE[key];
  if (existing && Date.now() - existing.at < TTL_MS) return existing.data;
  if (existing?.promise) return existing.promise as Promise<NonNullable<typeof CACHE[K]>["data"]>;
  const promise = apiFetch<{ rows: NonNullable<typeof CACHE[K]>["data"] }>(url)
    .then((r) => {
      CACHE[key] = { at: Date.now(), data: r.rows } as typeof CACHE[K];
      notify();
      return r.rows;
    })
    .catch((err) => {
      // Cache failure briefly so we don't hammer a broken endpoint —
      // 5s ought to be enough for a transient blip and short enough
      // for the operator to see the recovered state.
      CACHE[key] = { at: Date.now() - (TTL_MS - 5_000), data: [] as never } as typeof CACHE[K];
      notify();
      throw err;
    });
  CACHE[key] = { at: existing?.at ?? 0, data: existing?.data ?? ([] as never), promise } as typeof CACHE[K];
  return promise;
}

function useResource<K extends keyof typeof CACHE>(
  key: K,
  url: string,
): { data: NonNullable<typeof CACHE[K]>["data"]; loading: boolean; error?: string; refetch: () => void } {
  const [, setTick] = React.useState(0);
  const [error, setError] = React.useState<string | undefined>();
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    const sub = (): void => setTick((t) => t + 1);
    SUBSCRIBERS.add(sub);
    return () => { SUBSCRIBERS.delete(sub); };
  }, []);

  const load = React.useCallback((): void => {
    setLoading(true);
    fetchOnce(key, url)
      .then(() => { setError(undefined); })
      .catch((e: unknown) => { setError(e instanceof Error ? e.message : String(e)); })
      .finally(() => { setLoading(false); });
  }, [key, url]);

  React.useEffect(() => {
    const cached = CACHE[key];
    if (!cached || Date.now() - cached.at >= TTL_MS) load();
  }, [key, load]);

  const data = (CACHE[key]?.data ?? []) as NonNullable<typeof CACHE[K]>["data"];
  return { data, loading, error, refetch: load };
}

export function useUiResources(): ReturnType<typeof useResource<"resources">> {
  return useResource("resources", "/ui/resources");
}

export function useUiTools(): ReturnType<typeof useResource<"tools">> {
  return useResource("tools", "/ui/tools");
}

export function useUiCurrencies(): ReturnType<typeof useResource<"currencies">> {
  return useResource("currencies", "/ui/currencies");
}

export function useUiTimezones(): ReturnType<typeof useResource<"timezones">> {
  return useResource("timezones", "/ui/timezones");
}

export function useUiLocales(): ReturnType<typeof useResource<"locales">> {
  return useResource("locales", "/ui/locales");
}

/** Force a refresh — call after the operator does something that
 *  changes the picker source (enables a plugin, registers a new
 *  resource). */
export function refreshUiMetadata(): void {
  CACHE.resources = undefined;
  CACHE.tools = undefined;
  notify();
}
