/** Awesome bar / command palette — Cmd+K (or Ctrl+K) global search.
 *
 *  Mounts at the shell root once. A keyboard listener toggles the
 *  palette open. The palette debounces queries to the awesome-bar
 *  backend (`/api/awesome-search`) and shows hits grouped by kind:
 *  records, domain primitives, and navigation targets. Up/Down moves
 *  the active row; Enter opens it; Esc closes the palette.
 *
 *  Accessibility: trap focus while open, restore on close, ARIA roles
 *  for combobox + listbox semantics. Renders into a portal-style
 *  overlay so it floats above the rest of the app.
 */

import * as React from "react";
import { Search, ArrowRight, Database, Box, Compass } from "lucide-react";
import { authStore } from "@/runtime/auth";
import { cn } from "@/lib/cn";

interface SearchHit {
  id: string;
  resource: string;
  title: string;
  subtitle: string | null;
  url: string;
  kind: "record" | "domain" | "nav";
  score: number;
}

function apiBase(): string {
  const base =
    (typeof import.meta !== "undefined"
      ? (import.meta as { env?: { VITE_API_BASE?: string } }).env?.VITE_API_BASE
      : undefined) ?? "/api";
  return base.toString().replace(/\/+$/, "");
}

function authHeaders(): Record<string, string> {
  const h: Record<string, string> = {};
  if (authStore.token) h.Authorization = `Bearer ${authStore.token}`;
  if (authStore.activeTenant?.id) h["x-tenant"] = authStore.activeTenant.id;
  return h;
}

const KIND_LABELS: Record<SearchHit["kind"], { label: string; icon: React.ReactNode }> = {
  record:  { label: "Records",      icon: <Box className="h-3 w-3" /> },
  domain:  { label: "Domain",       icon: <Database className="h-3 w-3" /> },
  nav:     { label: "Settings & reports", icon: <Compass className="h-3 w-3" /> },
};

export function CommandPalette(): React.JSX.Element {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [hits, setHits] = React.useState<SearchHit[]>([]);
  const [active, setActive] = React.useState(0);
  const [loading, setLoading] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const previousFocusRef = React.useRef<HTMLElement | null>(null);

  // Keyboard shortcut.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isOpenKey = (e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K");
      if (isOpenKey) {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape" && open) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Focus management.
  React.useEffect(() => {
    if (open) {
      previousFocusRef.current = document.activeElement as HTMLElement | null;
      setTimeout(() => inputRef.current?.focus(), 0);
    } else {
      setQuery("");
      setHits([]);
      setActive(0);
      previousFocusRef.current?.focus();
    }
  }, [open]);

  // Debounced query.
  React.useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (!q) {
      setHits([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `${apiBase()}/awesome-search/?q=${encodeURIComponent(q)}&limit=20`,
          { headers: authHeaders(), credentials: "include" },
        );
        if (!res.ok) {
          if (!cancelled) setHits([]);
          return;
        }
        const j = (await res.json()) as { rows: SearchHit[] };
        if (!cancelled) {
          setHits(j.rows ?? []);
          setActive(0);
        }
      } catch {
        if (!cancelled) setHits([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 130);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, query]);

  const grouped = React.useMemo(() => {
    const out: Record<SearchHit["kind"], SearchHit[]> = { record: [], domain: [], nav: [] };
    for (const h of hits) out[h.kind].push(h);
    return out;
  }, [hits]);

  const orderedHits = React.useMemo(
    () => [...grouped.nav, ...grouped.domain, ...grouped.record],
    [grouped],
  );

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(orderedHits.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const h = orderedHits[active];
      if (h) navigate(h);
    }
  };

  const navigate = (h: SearchHit) => {
    setOpen(false);
    if (h.url.startsWith("#")) {
      window.location.hash = h.url.slice(1);
    } else {
      window.location.href = h.url;
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        aria-label="Open command palette (⌘K)"
        title="Open command palette (⌘K)"
        onClick={() => setOpen(true)}
        className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-md text-xs text-text-muted bg-surface-1 border border-border-subtle hover:border-border focus-visible:outline-none focus-visible:shadow-focus"
      >
        <Search className="h-3.5 w-3.5" />
        Search…
        <kbd className="ml-2 px-1.5 py-0.5 rounded bg-surface-2 border border-border-subtle font-mono text-[10px]">
          ⌘K
        </kbd>
      </button>
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-start justify-center pt-[12vh]"
      onClick={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
    >
      <div className="w-full max-w-xl mx-4 bg-surface-0 border border-border rounded-md shadow-xl flex flex-col max-h-[75vh] overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border-subtle">
          <Search className="h-4 w-4 text-text-muted" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search records, accounts, journals, settings…"
            aria-label="Search query"
            aria-autocomplete="list"
            aria-controls="cmdk-listbox"
            className="flex-1 bg-transparent border-0 outline-none text-sm placeholder:text-text-muted"
          />
          {loading ? (
            <span className="text-xs text-text-muted">searching…</span>
          ) : null}
          <kbd className="px-1.5 py-0.5 rounded bg-surface-1 border border-border-subtle font-mono text-[10px] text-text-muted">
            esc
          </kbd>
        </div>

        <div
          id="cmdk-listbox"
          role="listbox"
          className="flex-1 overflow-y-auto"
        >
          {orderedHits.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-text-muted">
              {query.trim()
                ? loading
                  ? "Searching…"
                  : "No matches"
                : "Type to search…"}
            </div>
          ) : (
            (["nav", "domain", "record"] as const).map((kind) => {
              const list = grouped[kind];
              if (list.length === 0) return null;
              return (
                <div key={kind}>
                  <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-text-muted bg-surface-1/50 flex items-center gap-1.5">
                    {KIND_LABELS[kind].icon}
                    {KIND_LABELS[kind].label}
                  </div>
                  {list.map((h) => {
                    const i = orderedHits.indexOf(h);
                    const isActive = i === active;
                    return (
                      <button
                        key={`${h.url}-${h.id}`}
                        role="option"
                        aria-selected={isActive}
                        onMouseEnter={() => setActive(i)}
                        onClick={() => navigate(h)}
                        className={cn(
                          "w-full flex items-center gap-2 px-3 py-2 text-left text-sm",
                          isActive
                            ? "bg-accent-subtle text-accent-foreground"
                            : "hover:bg-surface-1 text-text-secondary",
                        )}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="truncate">
                            {h.title}
                          </div>
                          {h.subtitle ? (
                            <div className="text-xs text-text-muted truncate">
                              {h.subtitle}
                            </div>
                          ) : null}
                        </div>
                        <code className="text-[10px] font-mono text-text-muted shrink-0">
                          {h.resource}
                        </code>
                        <ArrowRight className="h-3 w-3 text-text-muted shrink-0" />
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>

        <div className="px-3 py-2 border-t border-border-subtle flex items-center gap-3 text-[10px] text-text-muted">
          <span>
            <kbd className="px-1 py-0.5 rounded bg-surface-1 border border-border-subtle font-mono">↑</kbd>
            <kbd className="ml-1 px-1 py-0.5 rounded bg-surface-1 border border-border-subtle font-mono">↓</kbd>
            <span className="ml-1">to navigate</span>
          </span>
          <span>
            <kbd className="px-1 py-0.5 rounded bg-surface-1 border border-border-subtle font-mono">↵</kbd>
            <span className="ml-1">to select</span>
          </span>
          <span>
            <kbd className="px-1 py-0.5 rounded bg-surface-1 border border-border-subtle font-mono">esc</kbd>
            <span className="ml-1">to close</span>
          </span>
        </div>
      </div>
    </div>
  );
}
