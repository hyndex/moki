import * as React from "react";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { CommandPalette } from "./CommandPalette";
import { Toaster } from "./Toaster";
import { ConfirmHost } from "./ConfirmHost";
import { Breadcrumbs } from "@/admin-primitives/Breadcrumbs";
import type { AdminRegistry } from "./registry";
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
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  const [shortcutsOpen, setShortcutsOpen] = React.useState(false);
  const route = React.useMemo(() => resolveRoute(hash, registry), [hash, registry]);

  /* Track route changes for analytics. */
  React.useEffect(() => {
    runtime.analytics.setMeta({ route: hash || "/" });
    runtime.analytics.emit("page.viewed", {
      variant: route?.mode,
      viewId: route?.view.id,
    });
  }, [hash, route, runtime]);

  /* Global keyboard shortcuts */
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
      } else if (!inInput && e.key === "?" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setShortcutsOpen(true);
        runtime.analytics.emit("shell.keyboard_shortcut", { key: "?" });
      } else if (!inInput && e.key === "/" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setPaletteOpen(true);
        runtime.analytics.emit("shell.keyboard_shortcut", { key: "/" });
      } else if (e.key === "Escape") {
        if (paletteOpen) setPaletteOpen(false);
        if (shortcutsOpen) setShortcutsOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [paletteOpen, shortcutsOpen, runtime]);

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
                <RouteView route={route} registry={registry} />
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

/** A custom view named "<resource>.<something>-detail.view" is treated as the
 *  rich detail page for that resource — used when a plugin wants full control. */
function resolveCustomDetailView(resource: string, registry: AdminRegistry) {
  return Object.values(registry.views).find(
    (v) =>
      v.type === "custom" &&
      v.resource === resource &&
      (v.id.endsWith("-detail.view") || v.id.endsWith(".detail.view")),
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
