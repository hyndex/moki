/** useFavorites — React hook over `/api/favorites`.
 *
 *  Backed by a module-level cache so multiple components stay in sync
 *  without re-fetching. The cache is hydrated once per session (the
 *  first hook to mount triggers the GET); subsequent mounts read the
 *  cache synchronously. Mutations (`add`, `remove`, `update`) update the
 *  cache optimistically AND fire the matching backend call; listeners
 *  fan-out so every mounted hook re-renders.
 *
 *  Auth: requests carry the bearer from `authStore` and the active
 *  tenant via `x-tenant`, mirroring `runtime/savedViews.ts`. If the user
 *  isn't signed in we behave as an empty list and skip the network.
 */
import * as React from "react";
import { authStore } from "./auth";
let cache = {
    rows: [],
    status: "idle",
    error: null,
};
const listeners = new Set();
let inflight = null;
function notify() {
    for (const fn of listeners)
        fn();
}
function setCache(next) {
    cache = { ...cache, ...next };
    notify();
}
function key(kind, targetId) {
    return `${kind}:${targetId}`;
}
/* ------------------------------------------------------------------ */
/*  HTTP helpers                                                       */
/* ------------------------------------------------------------------ */
function apiBase() {
    const base = (typeof import.meta !== "undefined"
        ? import.meta.env?.VITE_API_BASE
        : undefined) ?? "/api";
    return base.toString().replace(/\/+$/, "");
}
function authHeaders() {
    const headers = { "Content-Type": "application/json" };
    if (authStore.token)
        headers.Authorization = `Bearer ${authStore.token}`;
    if (authStore.activeTenant?.id)
        headers["x-tenant"] = authStore.activeTenant.id;
    return headers;
}
async function fetchAll() {
    if (!authStore.token)
        return [];
    const res = await fetch(`${apiBase()}/favorites`, {
        headers: authHeaders(),
        credentials: "include",
    });
    if (!res.ok)
        throw new Error(`favorites ${res.status}`);
    const data = (await res.json());
    return data.rows ?? [];
}
async function postAdd(input) {
    if (!authStore.token)
        return;
    await fetch(`${apiBase()}/favorites`, {
        method: "POST",
        headers: authHeaders(),
        credentials: "include",
        body: JSON.stringify(input),
    });
}
async function patchOne(kind, targetId, patch) {
    if (!authStore.token)
        return;
    await fetch(`${apiBase()}/favorites/${encodeURIComponent(kind)}/${encodeURIComponent(targetId)}`, {
        method: "PATCH",
        headers: authHeaders(),
        credentials: "include",
        body: JSON.stringify(patch),
    });
}
async function deleteOne(kind, targetId) {
    if (!authStore.token)
        return;
    await fetch(`${apiBase()}/favorites/${encodeURIComponent(kind)}/${encodeURIComponent(targetId)}`, {
        method: "DELETE",
        headers: authHeaders(),
        credentials: "include",
    });
}
/** Hydrate once per session. Subsequent calls are no-ops while a load
 *  is in flight or after a successful load. */
function hydrate() {
    if (cache.status === "ready" || cache.status === "loading")
        return;
    if (!authStore.token) {
        setCache({ status: "ready", rows: [], error: null });
        return;
    }
    setCache({ status: "loading", error: null });
    inflight = fetchAll()
        .then((rows) => {
        setCache({ rows, status: "ready", error: null });
    })
        .catch((err) => {
        setCache({
            status: "error",
            error: err instanceof Error ? err.message : String(err),
        });
    })
        .finally(() => {
        inflight = null;
    });
}
/** Force refetch — exposed for callers that want explicit reload (e.g.
 *  after switching tenant). */
export function refreshFavorites() {
    if (!authStore.token) {
        setCache({ status: "ready", rows: [], error: null });
        return Promise.resolve();
    }
    setCache({ status: "loading", error: null });
    inflight = fetchAll()
        .then((rows) => {
        setCache({ rows, status: "ready", error: null });
    })
        .catch((err) => {
        setCache({
            status: "error",
            error: err instanceof Error ? err.message : String(err),
        });
    })
        .finally(() => {
        inflight = null;
    });
    return inflight;
}
/* ------------------------------------------------------------------ */
/*  Reset cache on auth/tenant change                                  */
/* ------------------------------------------------------------------ */
if (typeof window !== "undefined") {
    authStore.emitter.on("change", () => {
        cache = { rows: [], status: "idle", error: null };
        notify();
    });
    authStore.emitter.on("tenant", () => {
        cache = { rows: [], status: "idle", error: null };
        notify();
    });
}
export function useFavorites() {
    const [, force] = React.useReducer((n) => n + 1, 0);
    React.useEffect(() => {
        listeners.add(force);
        hydrate();
        return () => {
            listeners.delete(force);
        };
    }, []);
    const list = React.useCallback(() => cache.rows, []);
    const isFavorite = React.useCallback((kind, targetId) => cache.rows.some((r) => r.kind === kind && r.targetId === targetId), []);
    const add = React.useCallback(async (input) => {
        // Optimistic — append if not present.
        const present = cache.rows.some((r) => r.kind === input.kind && r.targetId === input.targetId);
        if (!present) {
            const stub = {
                tenantId: authStore.activeTenant?.id ?? "default",
                userId: authStore.user?.id ?? "",
                kind: input.kind,
                targetId: input.targetId,
                label: input.label ?? null,
                icon: input.icon ?? null,
                folder: input.folder ?? null,
                position: input.position ?? 0,
                createdAt: new Date().toISOString(),
            };
            setCache({ rows: [...cache.rows, stub] });
        }
        try {
            await postAdd(input);
        }
        catch {
            // Rollback on failure.
            setCache({
                rows: cache.rows.filter((r) => !(r.kind === input.kind && r.targetId === input.targetId)),
            });
        }
    }, []);
    const remove = React.useCallback(async (kind, targetId) => {
        const before = cache.rows;
        const removed = before.find((r) => r.kind === kind && r.targetId === targetId);
        setCache({
            rows: before.filter((r) => !(r.kind === kind && r.targetId === targetId)),
        });
        try {
            await deleteOne(kind, targetId);
        }
        catch {
            // Rollback.
            if (removed)
                setCache({ rows: [...cache.rows, removed] });
        }
    }, []);
    const update = React.useCallback(async (kind, targetId, patch) => {
        const before = cache.rows;
        setCache({
            rows: before.map((r) => r.kind === kind && r.targetId === targetId
                ? {
                    ...r,
                    ...(patch.label !== undefined ? { label: patch.label } : {}),
                    ...(patch.icon !== undefined ? { icon: patch.icon } : {}),
                    ...(patch.folder !== undefined ? { folder: patch.folder } : {}),
                    ...(patch.position !== undefined
                        ? { position: patch.position }
                        : {}),
                }
                : r),
        });
        try {
            await patchOne(kind, targetId, patch);
        }
        catch {
            // Rollback to pre-patch state.
            setCache({ rows: before });
        }
    }, []);
    // Note: we intentionally do NOT memoise `list`/`isFavorite` against
    // cache.rows in the dep array — they read directly from the module
    // cache, and the listener-driven re-render keeps callers fresh.
    return {
        list,
        isFavorite,
        add,
        remove,
        update,
        loading: cache.status === "loading",
        error: cache.error,
    };
}
/** Lightweight non-hook accessor for non-React code (e.g. command palette
 *  builders). Triggers hydration if the cache hasn't loaded yet. */
export function getFavoritesSnapshot() {
    hydrate();
    return cache.rows;
}
