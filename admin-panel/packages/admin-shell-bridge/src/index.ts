/** @gutu/admin-shell-bridge — surfaces legacy @platform/admin-contracts
 *  contributions inside @gutu/admin-shell-next.
 *
 *  The mapping is conservative:
 *
 *    Legacy                          →  Next
 *    WorkspaceContribution           →  NavSection + optional landing NavItem
 *    AdminNavContribution            →  NavItem[] (flattened; group → section)
 *    PageContribution (kind=list)    →  CustomView if a component is supplied
 *    PageContribution (any kind)     →  CustomView wrapping `component`
 *    CommandContribution             →  CommandDescriptor
 *    ReportContribution              →  CustomView at route, renders component
 *    BuilderContribution             →  CustomView at route
 *    ZoneLaunchContribution          →  NavItem with simple path link
 *    WidgetContribution              →  DashboardWidget (pass-through)
 *    FieldVisibilityRule[]           →  PermissionGate per-field on the next view
 *
 *  Permission handling: the legacy API uses string permissions against a
 *  PermissionIntrospector. We accept one at adapter-time (optional) and use
 *  it to gate nav items and pages. If no introspector is provided, every
 *  permission is assumed granted (identical to current admin-panel behaviour,
 *  which also does not gate nav entries at render time).
 *
 *  Caveat: legacy pages must supply a React `component` to be rendered. The
 *  `listViewId`/`formViewId`/`detailViewId` indirection referenced by the
 *  legacy API is resolved at mount time by the host admin — the bridge
 *  cannot synthesize views it does not own.
 */

import type { ComponentType, ReactNode } from "react";
import type {
  AdminContributionRegistry,
  AdminNavContribution,
  BuilderContribution,
  CommandContribution,
  PageContribution,
  PermissionIntrospector,
  ReportContribution,
  WidgetContribution,
  WorkspaceContribution,
  ZoneLaunchContribution,
} from "./legacy-types";

export * from "./legacy-types";

/** Shape of what the adapter emits. Structurally compatible with
 *  @gutu/admin-shell-next's Plugin. We use a minimal shape here so this
 *  package has no hard dependency on the next shell for building; the
 *  resulting object is consumed by `AdminRoot`. */
export interface BridgedPlugin {
  id: string;
  label: string;
  version: string;
  description?: string;
  icon?: string;
  admin: BridgedAdminContribution;
}

export interface BridgedAdminContribution {
  navSections: BridgedNavSection[];
  nav: BridgedNavItem[];
  resources: never[];
  views: BridgedView[];
  commands: BridgedCommand[];
  widgets?: unknown[];
  globalActions?: never[];
}

export interface BridgedNavSection {
  id: string;
  label: string;
  order?: number;
}

export interface BridgedNavItem {
  id: string;
  label: string;
  icon?: string;
  path: string;
  view?: string;
  section?: string;
  order?: number;
  children?: BridgedNavItem[];
}

export type BridgedView = {
  type: "custom";
  id: string;
  title: string;
  description?: string;
  resource: string;
  render: () => ReactNode;
};

export type BridgedCommand = {
  id: string;
  label: string;
  keywords?: string[];
  run: (ctx: { runtime?: { navigate: (p: string) => void } }) => void | Promise<void>;
};

export interface AdoptOptions {
  /** Source namespace used for synthesized ids (`<sourceId>:<legacyId>.view`).
   *  Pass the legacy plugin's package name, e.g. `crm-core`. Default: "legacy". */
  sourceId?: string;
  /** Legacy permission introspector. When supplied, nav items and pages
   *  with denied permissions are filtered out of the adapter output. */
  permissions?: PermissionIntrospector;
  /** Override how legacy React components render. Useful for wrapping
   *  every legacy page with a compatibility PageHeader, error boundary,
   *  or lazy loader. Default: render the component as-is. */
  wrap?: (component: ComponentType, context: LegacyRenderContext) => ReactNode;
  /** Extra plugin metadata. */
  plugin?: { id?: string; label?: string; version?: string; description?: string; icon?: string };
}

export interface LegacyRenderContext {
  pageId: string;
  route: string;
  workspace: string;
  kind: string;
  label: string;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const LEGACY_RESOURCE_PLACEHOLDER = "__legacy__" as const;

function uniqueBy<T>(items: readonly T[], keyFn: (t: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    const k = keyFn(item);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(item);
  }
  return out;
}

function gateByPermission<T extends { permission: string }>(
  items: readonly T[],
  perms: PermissionIntrospector | undefined,
): T[] {
  if (!perms) return [...items];
  return items.filter((i) => perms.has(i.permission));
}

function sectionIdFor(workspaceId: string): string {
  return `legacy.${workspaceId}`;
}

function navItemIdFor(src: string, legacyId: string): string {
  return `${src}.nav.${legacyId}`;
}

function viewIdFor(src: string, legacyId: string): string {
  return `${src}.${legacyId}.legacy.view`;
}

function commandIdFor(src: string, legacyId: string): string {
  return `${src}.cmd.${legacyId}`;
}

/* ------------------------------------------------------------------ */
/* Converters                                                          */
/* ------------------------------------------------------------------ */

function convertWorkspaces(
  workspaces: readonly WorkspaceContribution[],
  perms: PermissionIntrospector | undefined,
): { sections: BridgedNavSection[]; landings: BridgedNavItem[]; viewByWorkspace: Map<string, string> } {
  const allowed = gateByPermission(workspaces, perms);
  const sections: BridgedNavSection[] = allowed.map((w, idx) => ({
    id: sectionIdFor(w.id),
    label: w.label,
    order: 50 + idx,
  }));

  const landings: BridgedNavItem[] = [];
  const viewByWorkspace = new Map<string, string>();
  for (const w of allowed) {
    if (w.homePath) {
      landings.push({
        id: `legacy.${w.id}.home`,
        label: w.label,
        icon: w.icon,
        path: w.homePath,
        section: sectionIdFor(w.id),
        order: 0,
      });
    }
  }
  return { sections, landings, viewByWorkspace };
}

function convertNavContributions(
  contributions: readonly AdminNavContribution[],
  perms: PermissionIntrospector | undefined,
  sourceId: string,
): BridgedNavItem[] {
  const out: BridgedNavItem[] = [];
  for (const c of contributions) {
    const allowedItems = gateByPermission(c.items, perms);
    for (const item of allowedItems) {
      out.push({
        id: navItemIdFor(sourceId, item.id),
        label: item.label,
        icon: item.icon,
        path: item.to,
        section: sectionIdFor(c.workspace),
      });
    }
  }
  return out;
}

function convertPage(
  page: PageContribution,
  sourceId: string,
  wrap: AdoptOptions["wrap"],
): { nav: BridgedNavItem | null; view: BridgedView | null } {
  const viewId = viewIdFor(sourceId, page.id);
  // We can only materialize pages that bring their own component. Pages
  // declared as pure `listViewId`/`formViewId` references depend on view
  // files we don't have access to, so they're dropped with a console warn.
  if (!page.component) {
    if (typeof console !== "undefined") {
      console.warn(
        `[admin-shell-bridge] skipping page "${page.id}" — no component and no adapter for kind=${page.kind}.`,
      );
    }
    return { nav: null, view: null };
  }
  const Component = page.component;
  const render = wrap
    ? (): ReactNode =>
        wrap(Component, {
          pageId: page.id,
          route: page.route,
          workspace: page.workspace,
          kind: page.kind,
          label: page.label,
        })
    : (): ReactNode => {
        // React JSX is constructed via createElement to avoid requiring
        // a JSX toolchain in this package.
        // deno-lint-ignore no-explicit-any
        return (require("react") as any).createElement(Component);
      };

  const view: BridgedView = {
    type: "custom",
    id: viewId,
    title: page.label,
    description: `Legacy ${page.kind} contribution from ${page.workspace}.`,
    resource: LEGACY_RESOURCE_PLACEHOLDER,
    render,
  };
  const nav: BridgedNavItem = {
    id: navItemIdFor(sourceId, page.id),
    label: page.label,
    path: page.route,
    view: viewId,
    section: sectionIdFor(page.workspace),
  };
  return { nav, view };
}

function convertCommand(cmd: CommandContribution, sourceId: string): BridgedCommand {
  return {
    id: commandIdFor(sourceId, cmd.id),
    label: cmd.label,
    keywords: cmd.keywords,
    run: async ({ runtime }) => {
      if (cmd.run) {
        await cmd.run({
          navigate: (p) => {
            if (runtime?.navigate) runtime.navigate(p);
            else if (typeof window !== "undefined") window.location.hash = p;
          },
        });
        return;
      }
      if (cmd.href) {
        if (runtime?.navigate) runtime.navigate(cmd.href);
        else if (typeof window !== "undefined") window.location.hash = cmd.href;
      }
    },
  };
}

function convertReport(
  report: ReportContribution,
  sourceId: string,
  wrap: AdoptOptions["wrap"],
): { nav: BridgedNavItem | null; view: BridgedView | null } {
  if (!report.component) return { nav: null, view: null };
  const viewId = viewIdFor(sourceId, report.id);
  const Component = report.component;
  const render = wrap
    ? (): ReactNode =>
        wrap(Component, {
          pageId: report.id,
          route: report.route,
          workspace: "reports",
          kind: `report:${report.kind}`,
          label: report.label,
        })
    : (): ReactNode =>
        // deno-lint-ignore no-explicit-any
        (require("react") as any).createElement(Component);

  return {
    nav: {
      id: navItemIdFor(sourceId, report.id),
      label: report.label,
      path: report.route,
      view: viewId,
      section: sectionIdFor("reports"),
    },
    view: {
      type: "custom",
      id: viewId,
      title: report.label,
      resource: LEGACY_RESOURCE_PLACEHOLDER,
      render,
    },
  };
}

function convertBuilder(
  builder: BuilderContribution,
  sourceId: string,
  wrap: AdoptOptions["wrap"],
): { nav: BridgedNavItem | null; view: BridgedView | null } {
  if (!builder.component) return { nav: null, view: null };
  const viewId = viewIdFor(sourceId, builder.id);
  const Component = builder.component;
  const render = wrap
    ? (): ReactNode =>
        wrap(Component, {
          pageId: builder.id,
          route: builder.route,
          workspace: "builders",
          kind: "builder",
          label: builder.label,
        })
    : (): ReactNode =>
        // deno-lint-ignore no-explicit-any
        (require("react") as any).createElement(Component);

  return {
    nav: {
      id: navItemIdFor(sourceId, builder.id),
      label: builder.label,
      path: builder.route,
      view: viewId,
      section: sectionIdFor("builders"),
    },
    view: {
      type: "custom",
      id: viewId,
      title: builder.label,
      resource: LEGACY_RESOURCE_PLACEHOLDER,
      render,
    },
  };
}

function convertZoneLauncher(z: ZoneLaunchContribution, sourceId: string): BridgedNavItem {
  return {
    id: navItemIdFor(sourceId, z.id),
    label: z.label,
    path: z.route,
    section: z.workspace ? sectionIdFor(z.workspace) : undefined,
  };
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

/** Convert a legacy AdminContributionRegistry into a Plugin that
 *  @gutu/admin-shell-next can mount. Safe with partial registries.
 *
 *  Returns a single Plugin — the common case for a legacy plugin is one
 *  workspace contribution, but this is accurate regardless because all
 *  workspaces/nav/pages from one registry are grouped as one plugin.
 */
export function adoptLegacyContributions(
  registry: Partial<AdminContributionRegistry>,
  options: AdoptOptions = {},
): BridgedPlugin {
  const sourceId = options.sourceId ?? "legacy";
  const perms = options.permissions;
  const wrap = options.wrap;

  const workspaces = registry.workspaces ?? [];
  const navContributions = registry.nav ?? [];
  const pages = registry.pages ?? [];
  const commands = registry.commands ?? [];
  const reports = registry.reports ?? [];
  const builders = registry.builders ?? [];
  const zoneLaunchers = registry.zoneLaunchers ?? [];
  const widgets = (registry.widgets ?? []) as WidgetContribution[];

  const { sections, landings } = convertWorkspaces(workspaces, perms);

  const pageResults = gateByPermission(pages, perms).map((p) => convertPage(p, sourceId, wrap));
  const reportResults = gateByPermission(reports, perms).map((r) => convertReport(r, sourceId, wrap));
  const builderResults = gateByPermission(builders, perms).map((b) => convertBuilder(b, sourceId, wrap));

  const pageNavs = pageResults.map((p) => p.nav).filter((x): x is BridgedNavItem => x !== null);
  const pageViews = pageResults.map((p) => p.view).filter((x): x is BridgedView => x !== null);
  const reportNavs = reportResults.map((r) => r.nav).filter((x): x is BridgedNavItem => x !== null);
  const reportViews = reportResults.map((r) => r.view).filter((x): x is BridgedView => x !== null);
  const builderNavs = builderResults.map((b) => b.nav).filter((x): x is BridgedNavItem => x !== null);
  const builderViews = builderResults.map((b) => b.view).filter((x): x is BridgedView => x !== null);
  const zoneNavs = gateByPermission(zoneLaunchers, perms).map((z) => convertZoneLauncher(z, sourceId));
  const legacyNavs = convertNavContributions(navContributions, perms, sourceId);

  const allNav = uniqueBy(
    [...landings, ...legacyNavs, ...pageNavs, ...reportNavs, ...builderNavs, ...zoneNavs],
    (n) => n.id,
  );

  const bridgedCommands = gateByPermission(commands, perms).map((c) => convertCommand(c, sourceId));

  return {
    id: options.plugin?.id ?? sourceId,
    label: options.plugin?.label ?? sourceId,
    version: options.plugin?.version ?? "0.0.0",
    description: options.plugin?.description,
    icon: options.plugin?.icon,
    admin: {
      navSections: sections,
      nav: allNav,
      resources: [],
      views: [...pageViews, ...reportViews, ...builderViews],
      commands: bridgedCommands,
      widgets: widgets.map((w) => ({
        id: `${sourceId}.${w.id}`,
        title: w.title ?? w.id,
        slot: w.slot,
        component: w.component,
        permission: w.permission,
        kind: w.kind,
      })),
      globalActions: [],
    },
  };
}

/** Convenience for multiple registries. Returns one BridgedPlugin per
 *  (registry, sourceId) pair. */
export function adoptAllLegacyContributions(
  entries: readonly { sourceId: string; registry: Partial<AdminContributionRegistry>; plugin?: AdoptOptions["plugin"] }[],
  shared: Omit<AdoptOptions, "sourceId" | "plugin"> = {},
): BridgedPlugin[] {
  return entries.map((e) =>
    adoptLegacyContributions(e.registry, {
      ...shared,
      sourceId: e.sourceId,
      plugin: e.plugin,
    }),
  );
}

export const LEGACY_RESOURCE = LEGACY_RESOURCE_PLACEHOLDER;
