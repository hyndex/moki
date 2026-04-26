/** Frontend hook for the per-resource custom-field metadata.
 *
 *  Fetches `/api/field-metadata/<resource>` once per resource per
 *  session, caches the result in module state so every component
 *  (form, list, detail page) stays in sync, and re-fetches when
 *  `bumpFieldMetadata(resource)` is called (used after Settings UI
 *  edits).
 *
 *  The shape mirrors the backend `FieldMeta` interface — keep them
 *  in sync. The 13 supported kinds are deliberately the same set
 *  the form/list factories already understand (text/number/select/
 *  multiselect/boolean/date/datetime/email/phone/url/relation/json
 *  + currency, rich-text, long-text). */
import { useEffect, useState } from "react";
import { authStore } from "./auth";
const cache = new Map();
const inFlight = new Map();
const listeners = new Map();
function apiBase() {
    const base = (typeof import.meta !== "undefined" ? import.meta.env?.VITE_API_BASE : undefined) ?? "/api";
    return base.toString().replace(/\/+$/, "");
}
function authHeaders() {
    const headers = {};
    if (authStore.token)
        headers.Authorization = `Bearer ${authStore.token}`;
    if (authStore.activeTenant?.id)
        headers["x-tenant"] = authStore.activeTenant.id;
    return headers;
}
async function fetchFor(resource) {
    const existing = inFlight.get(resource);
    if (existing)
        return existing;
    const p = (async () => {
        try {
            const res = await fetch(`${apiBase()}/field-metadata/${encodeURIComponent(resource)}`, { headers: authHeaders(), credentials: "include" });
            if (!res.ok)
                return [];
            const j = (await res.json());
            return j.rows ?? [];
        }
        catch {
            return [];
        }
    })();
    inFlight.set(resource, p);
    const rows = await p;
    inFlight.delete(resource);
    cache.set(resource, rows);
    // Notify subscribers in case a sibling component is waiting.
    listeners.get(resource)?.forEach((l) => l());
    return rows;
}
/** Force a refetch (e.g. after the Settings UI adds a field). */
export function bumpFieldMetadata(resource) {
    cache.delete(resource);
    void fetchFor(resource);
}
/** Reactive hook. Components re-render when the metadata for the
 *  resource changes (cache invalidated by `bumpFieldMetadata`). */
export function useFieldMetadata(resource) {
    const [, force] = useState(0);
    const cached = cache.get(resource);
    useEffect(() => {
        let cancelled = false;
        if (!cached) {
            void fetchFor(resource).then(() => { if (!cancelled)
                force((n) => n + 1); });
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
    return { fields: cached ?? [], loading: cached === undefined };
}
/** Synchronous read — null if not yet fetched. Useful for non-React
 *  call sites (e.g. table columns) that already render after the hook
 *  populated the cache. */
export function getCachedFieldMetadata(resource) {
    return cache.get(resource) ?? null;
}
