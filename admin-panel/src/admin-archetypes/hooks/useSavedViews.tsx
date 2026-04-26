import * as React from "react";
import type { SavedView } from "../widgets/SavedViewSwitcher";

/** Persistence adapter for saved views.
 *
 *  Production code wires this to the `saved-views-core` plugin's REST
 *  surface. The default ships a localStorage adapter so the runtime
 *  works out-of-the-box without a backend. */
export interface SavedViewsAdapter {
  /** List views for a resource (per-user or shared). */
  list: (resource: string) => Promise<SavedView[]>;
  /** Create a new view; returns the persisted view (with id). */
  create: (resource: string, view: Omit<SavedView, "id">) => Promise<SavedView>;
  /** Patch an existing view. */
  update: (
    resource: string,
    id: string,
    patch: Partial<SavedView>,
  ) => Promise<SavedView>;
  /** Delete a view. */
  remove: (resource: string, id: string) => Promise<void>;
}

/** localStorage-backed adapter. Per-user / per-tenant scoping is the
 *  caller's responsibility — set the `userScope` in the constructor
 *  to disambiguate. */
export class LocalStorageSavedViewsAdapter implements SavedViewsAdapter {
  constructor(private readonly userScope: string = "anon") {}
  private key(resource: string) {
    return `gutu.saved-views.${this.userScope}.${resource}`;
  }
  private read(resource: string): SavedView[] {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem(this.key(resource));
      return raw ? (JSON.parse(raw) as SavedView[]) : [];
    } catch {
      return [];
    }
  }
  private write(resource: string, views: SavedView[]) {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(this.key(resource), JSON.stringify(views));
    } catch {
      /* quota exceeded / private mode — drop silently */
    }
  }
  async list(resource: string): Promise<SavedView[]> {
    return this.read(resource);
  }
  async create(
    resource: string,
    view: Omit<SavedView, "id">,
  ): Promise<SavedView> {
    const id = view.label.toLowerCase().replace(/\s+/g, "-") + "-" + Date.now().toString(36);
    const created: SavedView = { ...view, id };
    const cur = this.read(resource);
    this.write(resource, [...cur, created]);
    return created;
  }
  async update(
    resource: string,
    id: string,
    patch: Partial<SavedView>,
  ): Promise<SavedView> {
    const cur = this.read(resource);
    const idx = cur.findIndex((v) => v.id === id);
    if (idx < 0) throw new Error(`Saved view "${id}" not found`);
    const next = { ...cur[idx], ...patch };
    cur[idx] = next;
    this.write(resource, cur);
    return next;
  }
  async remove(resource: string, id: string): Promise<void> {
    const cur = this.read(resource);
    this.write(
      resource,
      cur.filter((v) => v.id !== id),
    );
  }
}

const SavedViewsContext = React.createContext<SavedViewsAdapter>(
  new LocalStorageSavedViewsAdapter(),
);

export interface SavedViewsProviderProps {
  adapter: SavedViewsAdapter;
  children: React.ReactNode;
}

/** Set the active SavedViews adapter for the subtree. The shell wires
 *  the adapter once near the app root (typically connecting to the
 *  saved-views-core plugin); per-test overrides can wrap a subtree. */
export function SavedViewsProvider({ adapter, children }: SavedViewsProviderProps) {
  return (
    <SavedViewsContext.Provider value={adapter}>{children}</SavedViewsContext.Provider>
  );
}

/** Hook used by SmartList pages: reads + mutates the saved-view list
 *  via the active adapter, with stale-state protection on rapid
 *  changes. */
export function useSavedViews(resource: string): {
  views: SavedView[];
  loading: boolean;
  error: unknown;
  create: (view: Omit<SavedView, "id">) => Promise<SavedView | undefined>;
  update: (id: string, patch: Partial<SavedView>) => Promise<SavedView | undefined>;
  remove: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
} {
  const adapter = React.useContext(SavedViewsContext);
  const [views, setViews] = React.useState<SavedView[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<unknown>(undefined);
  const reqIdRef = React.useRef(0);

  const refresh = React.useCallback(async () => {
    const id = ++reqIdRef.current;
    setLoading(true);
    setError(undefined);
    try {
      const result = await adapter.list(resource);
      if (id === reqIdRef.current) {
        setViews(result);
        setLoading(false);
      }
    } catch (err) {
      if (id === reqIdRef.current) {
        setError(err);
        setLoading(false);
      }
    }
  }, [adapter, resource]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const create = React.useCallback(
    async (view: Omit<SavedView, "id">) => {
      try {
        const created = await adapter.create(resource, view);
        setViews((prev) => [...prev, created]);
        return created;
      } catch (err) {
        setError(err);
        return undefined;
      }
    },
    [adapter, resource],
  );

  const update = React.useCallback(
    async (id: string, patch: Partial<SavedView>) => {
      // Optimistic
      setViews((prev) =>
        prev.map((v) => (v.id === id ? { ...v, ...patch } : v)),
      );
      try {
        const updated = await adapter.update(resource, id, patch);
        setViews((prev) =>
          prev.map((v) => (v.id === id ? updated : v)),
        );
        return updated;
      } catch (err) {
        setError(err);
        // Roll back by re-fetching.
        await refresh();
        return undefined;
      }
    },
    [adapter, resource, refresh],
  );

  const remove = React.useCallback(
    async (id: string) => {
      const prev = views;
      // Optimistic
      setViews((p) => p.filter((v) => v.id !== id));
      try {
        await adapter.remove(resource, id);
      } catch (err) {
        setError(err);
        setViews(prev);
      }
    },
    [adapter, resource, views],
  );

  return { views, loading, error, create, update, remove, refresh };
}
