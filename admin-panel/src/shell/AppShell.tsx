import * as React from "react";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { CommandPalette } from "./CommandPalette";
import { Toaster } from "./Toaster";
import { ConfirmHost } from "./ConfirmHost";
import { Breadcrumbs } from "@/admin-primitives/Breadcrumbs";
import { type AdminRegistry, RegistryContext } from "./registry";
import { usePluginHost2 } from "@/host/pluginHostContext";
import { PluginBoundary } from "@/host/PluginBoundary";
import { useHash, navigateTo } from "@/views/useRoute";
import { resolveRoute } from "./router";
import { ListViewRenderer } from "@/views/ListView";
import { FormViewRenderer } from "@/views/FormView";
import { DetailViewRenderer } from "@/views/DetailView";
import { DashboardViewRenderer } from "@/views/DashboardView";
import { KanbanViewRenderer } from "@/views/KanbanView";
import { EmptyState } from "@/admin-primitives/EmptyState";
import { EmptyStateFramework } from "@/admin-primitives/EmptyStateFramework";
import { KeyboardShortcutsOverlay, DEFAULT_SHORTCUTS } from "@/admin-primitives/KeyboardShortcutsOverlay";
import { useRuntime } from "@/runtime/context";
import { TooltipProvider } from "@/primitives/Tooltip";
import { ErrorBoundary } from "./ErrorBoundary";

export interface AppShellProps {
  registry: AdminRegistry;
}

export function AppShell({ registry }: AppShellProps) {
  const hash = useHash();
  const runtime = useRuntime();
  const host = usePluginHost2();
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  const [shortcutsOpen, setShortcutsOpen] = React.useState(false);
  const route = React.useMemo(() => resolveRoute(hash, registry), [hash, registry]);

  /* Route guards — plugins can intercept navigation (auth, feature gates). */
  const prevHashRef = React.useRef<string>(hash);
  React.useEffect(() => {
    if (!host) return;
    if (prevHashRef.current === hash) return;
    const from = prevHashRef.current;
    prevHashRef.current = hash;
    const guards = Array.from(host.contributions.routeGuards.values())
      .map((e) => e.guard)
      .sort((a, b) => (a.priority ?? 50) - (b.priority ?? 50));
    (async () => {
      for (const g of guards) {
        const matches =
          typeof g.match === "string"
            ? hash.startsWith(g.match)
            : g.match.test(hash);
        if (!matches) continue;
        try {
          const result = await g.guard({ path: hash, from });
          if (result === false) {
            navigateTo(from);
            return;
          }
          if (result && typeof result === "object" && "redirect" in result) {
            navigateTo(result.redirect);
            return;
          }
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error("[route-guard] threw", err);
        }
      }
    })();
  }, [hash, host]);

  /* Track route changes for analytics. */
  React.useEffect(() => {
    runtime.analytics.setMeta({ route: hash || "/" });
    runtime.analytics.emit("page.viewed", {
      variant: route?.mode,
      viewId: route?.view.id,
    });
  }, [hash, route, runtime]);

  /* Global keyboard shortcuts + plugin-contributed shortcuts
   *
   *  Sequence support — plugins can register "g w" (press g then w within
   *  1.2s). The first token is captured; if the second matches a contributed
   *  shortcut, it fires. */
  const sequenceRef = React.useRef<{ key: string; at: number } | null>(null);
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const isMod = e.metaKey || e.ctrlKey;
      const target = e.target as HTMLElement | null;
      const inInput =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);

      if (isMod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
        runtime.analytics.emit("shell.command_palette.opened", {});
        return;
      }
      if (!inInput && e.key === "?" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setShortcutsOpen(true);
        runtime.analytics.emit("shell.keyboard_shortcut", { key: "?" });
        return;
      }
      if (!inInput && e.key === "/" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setPaletteOpen(true);
        runtime.analytics.emit("shell.keyboard_shortcut", { key: "/" });
        return;
      }
      if (e.key === "Escape") {
        if (paletteOpen) setPaletteOpen(false);
        if (shortcutsOpen) setShortcutsOpen(false);
        return;
      }

      /* Plugin-contributed shortcuts */
      if (inInput) return;
      if (!host) return;

      // Build normalized key: "mod+<key>" / "shift+<key>" / "<key>".
      const kk = e.key.toLowerCase();
      const tokens: string[] = [];
      if (isMod) tokens.push("mod");
      if (e.shiftKey && kk !== "shift") tokens.push("shift");
      if (e.altKey && kk !== "alt") tokens.push("alt");
      tokens.push(kk);
      const singleKey = tokens.join("+");

      // Sequence support — "g w" style.
      const now = performance.now();
      const prev = sequenceRef.current;
      if (prev && now - prev.at <= 1200 && !isMod) {
        const sequenceKey = `${prev.key} ${singleKey}`;
        const match = findShortcut(host, sequenceKey);
        if (match) {
          e.preventDefault();
          sequenceRef.current = null;
          runShortcut(match);
          return;
        }
      }

      // Direct match
      const direct = findShortcut(host, singleKey);
      if (direct) {
        e.preventDefault();
        sequenceRef.current = null;
        runShortcut(direct);
        return;
      }

      // Could be the first key of a sequence — remember it if it's a
      // plain single letter and any contributed shortcut starts with it.
      if (!isMod && !e.shiftKey && !e.altKey && /^[a-z]$/.test(kk)) {
        const hasSeqStarting = Array.from(host.contributions.shortcuts.values()).some(
          (s) => s.shortcut.keys.startsWith(`${kk} `),
        );
        if (hasSeqStarting) sequenceRef.current = { key: kk, at: now };
        else sequenceRef.current = null;
      } else {
        sequenceRef.current = null;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [paletteOpen, shortcutsOpen, runtime, host]);

  /* Nav events from runtime (so actions can trigger navigation) */
  React.useEffect(
    () =>
      runtime.bus.on("nav:to", (p) => {
        navigateTo(p.path);
      }),
    [runtime],
  );

  /* Handle home redirect */
  React.useEffect(() => {
    if (hash === "/" || hash === "") {
      const first = registry.nav.find((n) => n.path);
      if (first?.path && !resolveRoute("/", registry)) {
        navigateTo(first.path);
      }
    }
  }, [hash, registry]);

  const crumbs = route ? buildCrumbs(route.path, registry) : [];

  return (
    <RegistryContext.Provider value={registry}>
    <TooltipProvider delayDuration={200}>
      <div className="flex h-full w-full bg-surface-1 text-text-primary">
        <Sidebar registry={registry} currentPath={hash} />
        <div className="flex-1 min-w-0 flex flex-col h-full">
          <Topbar
            onOpenCommand={() => setPaletteOpen(true)}
            onOpenShortcuts={() => setShortcutsOpen(true)}
            breadcrumbs={
              crumbs.length > 0 ? <Breadcrumbs items={crumbs} /> : null
            }
          />
          <main
            role="main"
            className="flex-1 min-w-0 overflow-auto"
            aria-live="polite"
          >
            <div className="max-w-[1400px] mx-auto px-6 py-6">
              <ErrorBoundary key={hash}>
                <PluginBoundary
                  pluginId={
                    route?.view && "resource" in route.view
                      ? registry.pluginByResource[route.view.resource as string] ?? "shell"
                      : "shell"
                  }
                  label={route?.view?.title}
                >
                  <RouteView route={route} registry={registry} />
                </PluginBoundary>
              </ErrorBoundary>
            </div>
          </main>
        </div>

        <CommandPalette
          open={paletteOpen}
          onOpenChange={setPaletteOpen}
          registry={registry}
        />
        <KeyboardShortcutsOverlay
          shortcuts={DEFAULT_SHORTCUTS}
          open={shortcutsOpen}
          onOpenChange={setShortcutsOpen}
        />
        <Toaster />
        <ConfirmHost />
      </div>
    </TooltipProvider>
    </RegistryContext.Provider>
  );
}

function RouteView({
  route,
  registry,
}: {
  route: ReturnType<typeof resolveRoute>;
  registry: AdminRegistry;
}) {
  if (!route) {
    return (
      <EmptyStateFramework
        kind="no-results"
        title="Page not found"
        description="The path you tried to visit isn't registered by any plugin."
        primary={{ label: "Go home", href: "/home" }}
      />
    );
  }

  const base = route.navItemPath ?? "/";

  switch (route.mode) {
    case "list":
      if (route.view.type !== "list") return null;
      return <ListViewRenderer view={route.view} basePath={base} />;
    case "dashboard":
      if (route.view.type !== "dashboard") return null;
      return <DashboardViewRenderer view={route.view} />;
    case "kanban":
      if (route.view.type !== "kanban") return null;
      return <KanbanViewRenderer view={route.view} basePath={base} />;
    case "new": {
      const formView = resolveFormView(route.view.resource, registry);
      if (!formView) return <NoForm resource={route.view.resource} />;
      return (
        <FormViewRenderer
          view={formView}
          returnPath={base}
          basePath={base}
        />
      );
    }
    case "edit": {
      const formView = resolveFormView(route.view.resource, registry);
      if (!formView) return <NoForm resource={route.view.resource} />;
      return (
        <FormViewRenderer
          view={formView}
          id={route.id}
          returnPath={`${base}/${route.id}`}
          basePath={base}
        />
      );
    }
    case "detail": {
      // Prefer an explicit custom detail view (rich layouts) if one exists.
      const customDetail = resolveCustomDetailView(
        route.view.resource,
        registry,
      );
      if (customDetail) return <>{customDetail.render()}</>;
      const detailView = resolveDetailView(route.view.resource, registry);
      if (!detailView) {
        // fall back to edit form when no detail view is defined
        const formView = resolveFormView(route.view.resource, registry);
        if (formView)
          return (
            <FormViewRenderer
              view={formView}
              id={route.id}
              returnPath={base}
              basePath={base}
            />
          );
        return <NoDetail resource={route.view.resource} />;
      }
      return (
        <DetailViewRenderer
          view={detailView}
          id={route.id!}
          editPath={`${base}/${route.id}/edit`}
          basePath={base}
        />
      );
    }
    case "custom":
      if (route.view.type !== "custom") return null;
      return <>{route.view.render()}</>;
    default:
      return null;
  }
}

/** Find a plugin-contributed shortcut whose keys match the normalized seq. */
function findShortcut(host: ReturnType<typeof usePluginHost2>, keys: string) {
  if (!host) return null;
  for (const entry of host.contributions.shortcuts.values()) {
    if (entry.shortcut.keys.toLowerCase() === keys) return entry.shortcut;
  }
  return null;
}

function runShortcut(shortcut: { run: () => void | Promise<void>; when?: () => boolean }) {
  try {
    if (shortcut.when && !shortcut.when()) return;
    Promise.resolve(shortcut.run()).catch((err) => {
      // eslint-disable-next-line no-console
      console.error("[shortcut] threw", err);
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[shortcut] threw", err);
  }
}

function resolveFormView(resource: string, registry: AdminRegistry) {
  return Object.values(registry.views).find(
    (v) => v.type === "form" && v.resource === resource,
  ) as typeof registry.views[string] & { type: "form" } | undefined;
}

function resolveDetailView(resource: string, registry: AdminRegistry) {
  return Object.values(registry.views).find(
    (v) => v.type === "detail" && v.resource === resource,
  ) as typeof registry.views[string] & { type: "detail" } | undefined;
}

/** A custom view named exactly "<resource>-detail.view" or "<resource>.detail.view"
 *  is treated as the rich detail page for that resource. We require exact-id
 *  matching so report-library views (e.g. "issues.reports-detail.view") don't
 *  accidentally shadow the record detail view. */
function resolveCustomDetailView(resource: string, registry: AdminRegistry) {
  const wantA = `${resource}-detail.view`;
  const wantB = `${resource}.detail.view`;
  return Object.values(registry.views).find(
    (v) =>
      v.type === "custom" &&
      v.resource === resource &&
      (v.id === wantA || v.id === wantB),
  ) as (typeof registry.views)[string] & { type: "custom" } | undefined;
}

function NoForm({ resource }: { resource: string }) {
  return (
    <EmptyState
      title="No form view"
      description={`Resource "${resource}" has no form view defined. A plugin must contribute a \`defineFormView({ resource: "${resource}" })\`.`}
    />
  );
}

function NoDetail({ resource }: { resource: string }) {
  return (
    <EmptyState
      title="No detail view"
      description={`Resource "${resource}" has neither a detail nor form view defined.`}
    />
  );
}

function buildCrumbs(path: string, registry: AdminRegistry) {
  const items: { label: React.ReactNode; path?: string }[] = [];
  const parts = path.replace(/^\//, "").split("/").filter(Boolean);
  let accumulated = "";
  for (let i = 0; i < parts.length; i++) {
    accumulated += "/" + parts[i];
    const navItem = flatten(registry.nav).find((n) => n.path === accumulated);
    items.push({
      label: navItem?.label ?? humanize(parts[i]),
      path: i < parts.length - 1 ? accumulated : undefined,
    });
  }
  return items;
}

function flatten(
  nav: AdminRegistry["nav"],
  out: AdminRegistry["nav"][number][] = [],
): AdminRegistry["nav"][number][] {
  for (const item of nav) {
    out.push(item);
    if (item.children) flatten(item.children, out);
  }
  return out;
}

function humanize(s: string): string {
  return s
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (c) => c.toUpperCase())
    .replace(/-/g, " ")
    .trim();
}
