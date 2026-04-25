/** Hybrid saved-view store: localStorage write-through cache + backend
 *  sync.
 *
 *  WHY hybrid: views must be readable instantly when the user opens a
 *  list (no spinner); but they also need to sync across devices and
 *  be shareable across the workspace. The backend at
 *  `/api/saved-views/:resource` is the source of truth; localStorage
 *  is a fast read-cache that's eagerly hydrated on each `list()` call.
 *
 *  Write flow:
 *    save()  → write to localStorage, return immediately, fire
 *              backend POST/PATCH in the background. If the backend
 *              call fails (offline / conflict), the local copy stays
 *              and we surface a "sync pending" badge later (TODO).
 *    delete() → remove from localStorage, fire backend DELETE.
 *
 *  Read flow:
 *    list()    → return localStorage rows IMMEDIATELY for the resource;
 *                trigger a background fetch that, on success, replaces
 *                local rows with backend rows and notifies subscribers.
 *
 *  Auth: requests carry the bearer token from `authStore`. If there's
 *  no token (we're pre-auth), we skip backend calls and behave as
 *  pure-localStorage. */
import type { SavedView, SavedViewScope, SavedViewStore } from "@/contracts/saved-views";
import { authStore } from "./auth";

const STORAGE_KEY = "gutu-admin-saved-views";
const DEFAULT_KEY = "gutu-admin-default-views";

interface Persisted {
  views: Record<string, SavedView>;
}

/* ------------------------------------------------------------------ */
/*  Local cache                                                        */
/* ------------------------------------------------------------------ */

function loadViews(): Persisted {
  if (typeof window === "undefined") return { views: {} };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { views: {} };
    const parsed = JSON.parse(raw);
    if (typeof parsed === "object" && parsed !== null && "views" in parsed) {
      return parsed as Persisted;
    }
  } catch { /* ignore */ }
  return { views: {} };
}

function loadDefaults(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(DEFAULT_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch { return {}; }
}

/* ------------------------------------------------------------------ */
/*  Backend client                                                     */
/* ------------------------------------------------------------------ */

interface BackendView {
  id: string;
  tenantId: string;
  resource: string;
  createdBy: string;
  scope: SavedViewScope;
  teamId: string | null;
  name: string;
  icon: string | null;
  body: Partial<SavedView>;
  pinned: boolean;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

function apiBase(): string {
  const base =
    (typeof import.meta !== "undefined" ? import.meta.env?.VITE_API_BASE : undefined) ?? "/api";
  return base.toString().replace(/\/+$/, "");
}

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (authStore.token) headers.Authorization = `Bearer ${authStore.token}`;
  if (authStore.activeTenant?.id) headers["x-tenant"] = authStore.activeTenant.id;
  return headers;
}

/** Convert backend row → frontend SavedView. The backend stores
 *  filter/sort/columns/etc. in the JSON `body`; the frontend wants
 *  them flattened on the SavedView itself. */
function fromBackend(row: BackendView): SavedView {
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
function toBackendCreate(view: SavedView): {
  id: string;
  scope: SavedViewScope;
  teamId?: string;
  name: string;
  icon?: string;
  pinned?: boolean;
  isDefault?: boolean;
  body: Partial<SavedView>;
} {
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

async function fetchListFromBackend(resource: string): Promise<SavedView[] | null> {
  if (!authStore.token) return null;
  try {
    const res = await fetch(`${apiBase()}/saved-views/${encodeURIComponent(resource)}`, {
      headers: authHeaders(),
      credentials: "include",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { rows: BackendView[] };
    return data.rows.map(fromBackend);
  } catch {
    return null;
  }
}

async function pushSaveToBackend(view: SavedView): Promise<void> {
  if (!authStore.token) return;
  const body = toBackendCreate(view);
  // Try PATCH first (the row may already exist from a previous save);
  // on 404 fall back to POST.
  try {
    const patchRes = await fetch(
      `${apiBase()}/saved-views/${encodeURIComponent(view.resource)}/${encodeURIComponent(view.id)}`,
      {
        method: "PATCH",
        headers: authHeaders(),
        credentials: "include",
        body: JSON.stringify(body),
      },
    );
    if (patchRes.ok) return;
    if (patchRes.status === 404) {
      await fetch(`${apiBase()}/saved-views/${encodeURIComponent(view.resource)}`, {
        method: "POST",
        headers: authHeaders(),
        credentials: "include",
        body: JSON.stringify(body),
      });
    }
  } catch { /* offline; localStorage keeps the change */ }
}

async function pushDeleteToBackend(view: SavedView): Promise<void> {
  if (!authStore.token) return;
  try {
    await fetch(
      `${apiBase()}/saved-views/${encodeURIComponent(view.resource)}/${encodeURIComponent(view.id)}`,
      {
        method: "DELETE",
        headers: authHeaders(),
        credentials: "include",
      },
    );
  } catch { /* tolerate */ }
}

/* ------------------------------------------------------------------ */
/*  Store                                                              */
/* ------------------------------------------------------------------ */

class SavedViewStoreImpl implements SavedViewStore {
  private state: Persisted = loadViews();
  private defaults: Record<string, string> = loadDefaults();
  private readonly listeners = new Set<() => void>();
  /** Resources we've already hydrated from backend in this session.
   *  Avoids hammering the API on every list() call. */
  private readonly hydrated = new Set<string>();

  private persist(): void {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
      window.localStorage.setItem(DEFAULT_KEY, JSON.stringify(this.defaults));
    } catch { /* quota */ }
  }

  private notify(): void {
    for (const fn of this.listeners) fn();
  }

  /** Background hydrate. Called on first list() per resource per
   *  session. Replaces local rows for this resource with backend rows
   *  on success; on failure, local stays. */
  private hydrateInBackground(resource: string): void {
    if (this.hydrated.has(resource)) return;
    this.hydrated.add(resource);
    void fetchListFromBackend(resource).then((rows) => {
      if (!rows) return;
      // Drop existing rows for this resource and replace with backend.
      for (const id of Object.keys(this.state.views)) {
        if (this.state.views[id].resource === resource) delete this.state.views[id];
      }
      for (const v of rows) this.state.views[v.id] = v;
      this.persist();
      this.notify();
    });
  }

  list(resource: string): readonly SavedView[] {
    this.hydrateInBackground(resource);
    return Object.values(this.state.views)
      .filter((v) => v.resource === resource)
      .sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return a.label.localeCompare(b.label);
      });
  }

  get(id: string): SavedView | null {
    return this.state.views[id] ?? null;
  }

  save(view: Omit<SavedView, "id" | "createdAt" | "updatedAt"> & { id?: string }): SavedView {
    const now = new Date().toISOString();
    const id = view.id ?? `view_${Math.random().toString(36).slice(2, 10)}`;
    const existing = this.state.views[id];
    const saved: SavedView = {
      ...view,
      id,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    } as SavedView;
    this.state.views[id] = saved;
    this.persist();
    this.notify();
    void pushSaveToBackend(saved);
    return saved;
  }

  delete(id: string): void {
    const view = this.state.views[id];
    if (!view) return;
    delete this.state.views[id];
    if (this.defaults[view.resource] === id) {
      delete this.defaults[view.resource];
    }
    this.persist();
    this.notify();
    void pushDeleteToBackend(view);
  }

  setDefault(resource: string, id: string | null): void {
    if (id === null) delete this.defaults[resource];
    else this.defaults[resource] = id;
    this.persist();
    this.notify();
    // Also patch the saved-view row's `isDefault` so other devices see
    // the same default. Simple approach: set isDefault on the chosen
    // view, unset on others.
    const target = id ? this.state.views[id] : null;
    for (const v of Object.values(this.state.views)) {
      if (v.resource !== resource) continue;
      const want = target ? v.id === target.id : false;
      if (v.isDefault !== want) {
        v.isDefault = want;
        this.state.views[v.id] = v;
        void pushSaveToBackend(v);
      }
    }
  }

  getDefault(resource: string): SavedView | null {
    const id = this.defaults[resource];
    return id ? (this.state.views[id] ?? null) : null;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

export function createSavedViewStore(): SavedViewStore {
  return new SavedViewStoreImpl();
}
