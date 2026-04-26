import { authStore } from "./auth";
const STORAGE_KEY = "gutu-admin-saved-views";
const DEFAULT_KEY = "gutu-admin-default-views";
/* ------------------------------------------------------------------ */
/*  Local cache                                                        */
/* ------------------------------------------------------------------ */
function loadViews() {
    if (typeof window === "undefined")
        return { views: {} };
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw)
            return { views: {} };
        const parsed = JSON.parse(raw);
        if (typeof parsed === "object" && parsed !== null && "views" in parsed) {
            return parsed;
        }
    }
    catch { /* ignore */ }
    return { views: {} };
}
function loadDefaults() {
    if (typeof window === "undefined")
        return {};
    try {
        const raw = window.localStorage.getItem(DEFAULT_KEY);
        return raw ? JSON.parse(raw) : {};
    }
    catch {
        return {};
    }
}
function apiBase() {
    const base = (typeof import.meta !== "undefined" ? import.meta.env?.VITE_API_BASE : undefined) ?? "/api";
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
/** Convert backend row → frontend SavedView. The backend stores
 *  filter/sort/columns/etc. in the JSON `body`; the frontend wants
 *  them flattened on the SavedView itself. */
function fromBackend(row) {
    const body = row.body ?? {};
    return {
        id: row.id,
        resource: row.resource,
        label: row.name,
        scope: row.scope,
        ownerUserId: undefined,
        teamId: row.teamId ?? undefined,
        tenantId: row.tenantId,
        filter: body.filter,
        sort: body.sort,
        columns: body.columns,
        grouping: body.grouping,
        density: body.density,
        pageSize: body.pageSize,
        pinned: row.pinned,
        isDefault: row.isDefault,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
    };
}
/** SavedView → backend create/update body. */
function toBackendCreate(view) {
    return {
        id: view.id,
        scope: view.scope,
        teamId: view.teamId,
        name: view.label,
        pinned: view.pinned,
        isDefault: view.isDefault,
        body: {
            filter: view.filter,
            sort: view.sort,
            columns: view.columns,
            grouping: view.grouping,
            density: view.density,
            pageSize: view.pageSize,
        },
    };
}
async function fetchListFromBackend(resource) {
    if (!authStore.token)
        return null;
    try {
        const res = await fetch(`${apiBase()}/saved-views/${encodeURIComponent(resource)}`, {
            headers: authHeaders(),
            credentials: "include",
        });
        if (!res.ok)
            return null;
        const data = (await res.json());
        return data.rows.map(fromBackend);
    }
    catch {
        return null;
    }
}
async function pushSaveToBackend(view) {
    if (!authStore.token)
        return;
    const body = toBackendCreate(view);
    // Try PATCH first (the row may already exist from a previous save);
    // on 404 fall back to POST.
    try {
        const patchRes = await fetch(`${apiBase()}/saved-views/${encodeURIComponent(view.resource)}/${encodeURIComponent(view.id)}`, {
            method: "PATCH",
            headers: authHeaders(),
            credentials: "include",
            body: JSON.stringify(body),
        });
        if (patchRes.ok)
            return;
        if (patchRes.status === 404) {
            await fetch(`${apiBase()}/saved-views/${encodeURIComponent(view.resource)}`, {
                method: "POST",
                headers: authHeaders(),
                credentials: "include",
                body: JSON.stringify(body),
            });
        }
    }
    catch { /* offline; localStorage keeps the change */ }
}
async function pushDeleteToBackend(view) {
    if (!authStore.token)
        return;
    try {
        await fetch(`${apiBase()}/saved-views/${encodeURIComponent(view.resource)}/${encodeURIComponent(view.id)}`, {
            method: "DELETE",
            headers: authHeaders(),
            credentials: "include",
        });
    }
    catch { /* tolerate */ }
}
/* ------------------------------------------------------------------ */
/*  Store                                                              */
/* ------------------------------------------------------------------ */
class SavedViewStoreImpl {
    state = loadViews();
    defaults = loadDefaults();
    listeners = new Set();
    /** Resources we've already hydrated from backend in this session.
     *  Avoids hammering the API on every list() call. */
    hydrated = new Set();
    persist() {
        if (typeof window === "undefined")
            return;
        try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
            window.localStorage.setItem(DEFAULT_KEY, JSON.stringify(this.defaults));
        }
        catch { /* quota */ }
    }
    notify() {
        for (const fn of this.listeners)
            fn();
    }
    /** Background hydrate. Called on first list() per resource per
     *  session. Replaces local rows for this resource with backend rows
     *  on success; on failure, local stays. */
    hydrateInBackground(resource) {
        if (this.hydrated.has(resource))
            return;
        this.hydrated.add(resource);
        void fetchListFromBackend(resource).then((rows) => {
            if (!rows)
                return;
            // Drop existing rows for this resource and replace with backend.
            for (const id of Object.keys(this.state.views)) {
                if (this.state.views[id].resource === resource)
                    delete this.state.views[id];
            }
            for (const v of rows)
                this.state.views[v.id] = v;
            this.persist();
            this.notify();
        });
    }
    list(resource) {
        this.hydrateInBackground(resource);
        return Object.values(this.state.views)
            .filter((v) => v.resource === resource)
            .sort((a, b) => {
            if (a.pinned && !b.pinned)
                return -1;
            if (!a.pinned && b.pinned)
                return 1;
            return a.label.localeCompare(b.label);
        });
    }
    get(id) {
        return this.state.views[id] ?? null;
    }
    save(view) {
        const now = new Date().toISOString();
        const id = view.id ?? `view_${Math.random().toString(36).slice(2, 10)}`;
        const existing = this.state.views[id];
        const saved = {
            ...view,
            id,
            createdAt: existing?.createdAt ?? now,
            updatedAt: now,
        };
        this.state.views[id] = saved;
        this.persist();
        this.notify();
        void pushSaveToBackend(saved);
        return saved;
    }
    delete(id) {
        const view = this.state.views[id];
        if (!view)
            return;
        delete this.state.views[id];
        if (this.defaults[view.resource] === id) {
            delete this.defaults[view.resource];
        }
        this.persist();
        this.notify();
        void pushDeleteToBackend(view);
    }
    setDefault(resource, id) {
        if (id === null)
            delete this.defaults[resource];
        else
            this.defaults[resource] = id;
        this.persist();
        this.notify();
        // Also patch the saved-view row's `isDefault` so other devices see
        // the same default. Simple approach: set isDefault on the chosen
        // view, unset on others.
        const target = id ? this.state.views[id] : null;
        for (const v of Object.values(this.state.views)) {
            if (v.resource !== resource)
                continue;
            const want = target ? v.id === target.id : false;
            if (v.isDefault !== want) {
                v.isDefault = want;
                this.state.views[v.id] = v;
                void pushSaveToBackend(v);
            }
        }
    }
    getDefault(resource) {
        const id = this.defaults[resource];
        return id ? (this.state.views[id] ?? null) : null;
    }
    subscribe(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }
}
export function createSavedViewStore() {
    return new SavedViewStoreImpl();
}
