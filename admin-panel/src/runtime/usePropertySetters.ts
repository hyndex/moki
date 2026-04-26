/** Per-resource property-setter override hook.
 *
 *  Mirrors useFieldMetadata: fetches `/api/property-setters/<resource>/effective`
 *  for the current tenant + user context, caches in module state, and
 *  notifies React subscribers when invalidated.
 *
 *  The result is a flat `Record<fieldName, Record<property, value>>` —
 *  ready to merge with FieldDescriptor at render time. The Form / List /
 *  Detail factories call `applyOverrides()` (below) to fold these into
 *  whatever they got from the static schema. */

import { useEffect, useState } from "react";
import { authStore } from "./auth";

export type PropertyName =
  | "label"
  | "required"
  | "readonly"
  | "hidden"
  | "helpText"
  | "defaultValue"
  | "options"
  | "section"
  | "position"
  | "printHidden"
  | "portalHidden";

export type FieldOverrides = Partial<Record<PropertyName, unknown>>;

export type ResourceOverrides = Record<string, FieldOverrides>;

const cache = new Map<string, ResourceOverrides>();
const inFlight = new Map<string, Promise<ResourceOverrides>>();
const listeners = new Map<string, Set<() => void>>();

function apiBase(): string {
  const base =
    (typeof import.meta !== "undefined"
      ? (import.meta as { env?: { VITE_API_BASE?: string } }).env?.VITE_API_BASE
      : undefined) ?? "/api";
  return base.toString().replace(/\/+$/, "");
}

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  if (authStore.token) headers.Authorization = `Bearer ${authStore.token}`;
  if (authStore.activeTenant?.id) headers["x-tenant"] = authStore.activeTenant.id;
  return headers;
}

async function fetchFor(resource: string): Promise<ResourceOverrides> {
  const existing = inFlight.get(resource);
  if (existing) return existing;
  const p = (async () => {
    try {
      const res = await fetch(
        `${apiBase()}/property-setters/${encodeURIComponent(resource)}/effective`,
        { headers: authHeaders(), credentials: "include" },
      );
      if (!res.ok) return {};
      const j = (await res.json()) as { overrides: ResourceOverrides };
      return j.overrides ?? {};
    } catch {
      return {};
    }
  })();
  inFlight.set(resource, p);
  const overrides = await p;
  inFlight.delete(resource);
  cache.set(resource, overrides);
  listeners.get(resource)?.forEach((l) => l());
  return overrides;
}

/** Force a refetch (e.g. after the Settings UI changes a setter). */
export function bumpPropertySetters(resource: string): void {
  cache.delete(resource);
  void fetchFor(resource);
}

export function usePropertySetters(resource: string): {
  overrides: ResourceOverrides;
  loading: boolean;
} {
  const [, force] = useState(0);
  const cached = cache.get(resource);
  useEffect(() => {
    let cancelled = false;
    if (!cached) {
      void fetchFor(resource).then(() => {
        if (!cancelled) force((n) => n + 1);
      });
    }
    let set = listeners.get(resource);
    if (!set) {
      set = new Set();
      listeners.set(resource, set);
    }
    const l = () => force((n) => n + 1);
    set.add(l);
    return () => {
      cancelled = true;
      set?.delete(l);
    };
  }, [resource, cached]);
  return { overrides: cached ?? {}, loading: cached === undefined };
}

export function getCachedPropertySetters(resource: string): ResourceOverrides | null {
  return cache.get(resource) ?? null;
}

/** Generic: apply overrides to a list of field-descriptor-like objects.
 *  The descriptor must expose at least `name` (or `field`) so we can
 *  match. Property → descriptor key mapping: `label`→`label`,
 *  `required`→`required`, `readonly`→`readOnly`, `hidden`→`hidden`,
 *  `helpText`→`helpText`/`description`, `defaultValue`→`defaultValue`,
 *  `options`→`options`, `position`→`position`. The rest pass through
 *  on a `__overrides` bag for renderers that want raw access. */
export function applyOverrides<T extends Record<string, unknown>>(
  fields: readonly T[],
  overrides: ResourceOverrides,
  options: { fieldKey?: keyof T } = {},
): T[] {
  const key = (options.fieldKey ?? "name") as keyof T;
  return fields
    .map((f) => {
      const fieldName = String(f[key] ?? "");
      const ov = overrides[fieldName];
      if (!ov) return { ...f, __overrides: {} } as unknown as T;
      const next: Record<string, unknown> = { ...f, __overrides: ov };
      if (ov.label !== undefined) next.label = ov.label;
      if (ov.required !== undefined) next.required = ov.required;
      if (ov.readonly !== undefined) {
        next.readOnly = ov.readonly;
        next.readonly = ov.readonly;
      }
      if (ov.hidden !== undefined) next.hidden = ov.hidden;
      if (ov.helpText !== undefined) {
        next.helpText = ov.helpText;
        next.description = ov.helpText;
      }
      if (ov.defaultValue !== undefined) next.defaultValue = ov.defaultValue;
      if (ov.options !== undefined) next.options = ov.options;
      if (ov.position !== undefined) next.position = ov.position;
      return next as T;
    })
    .filter((f) => {
      const ov = overrides[String((f as Record<string, unknown>)[key as string] ?? "")];
      // Drop fully-hidden fields from the list; per-form renderers may
      // want to keep them as `hidden=true` instead — they can pass
      // their own predicate by skipping this helper and folding manually.
      return !ov?.hidden;
    })
    .sort((a, b) => {
      const pa = (a as { position?: number }).position;
      const pb = (b as { position?: number }).position;
      if (typeof pa === "number" && typeof pb === "number") return pa - pb;
      if (typeof pa === "number") return -1;
      if (typeof pb === "number") return 1;
      return 0;
    });
}
