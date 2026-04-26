/** Frontend plugin-UI contract.
 *
 *  A plugin contributes admin-shell UI by exporting an `AdminUiContribution`
 *  from its `host-plugin/ui/index.ts` (re-exported as
 *  `@gutu-plugin-ui/<code>`). The shell composes the contributions:
 *
 *    - `pages` are full-page React components mounted at the given hash
 *      route (e.g. `/settings/custom-fields`).
 *    - `navEntries` add nav rows under a section (defaults: `settings`).
 *    - `commands` add Cmd-K palette entries.
 *    - `detailRails` are React components mounted as rail cards on
 *      every record-detail page that matches the resource pattern.
 *
 *  Plugins are otherwise free to use whatever UI shape they want; the
 *  contract only describes how the shell finds + mounts their entry
 *  points. */

import type { ComponentType, ReactNode } from "react";

/** Page archetype identifiers — see docs/PAGE-DESIGN-SYSTEM.md.
 *  The shell uses this for analytics + theme overrides (data-archetype
 *  attribute). Plugins compose their content from primitives. */
export type PluginPageArchetype =
  | "dashboard"
  | "workspace-hub"
  | "smart-list"
  | "kanban"
  | "calendar"
  | "tree"
  | "graph"
  | "split-inbox"
  | "timeline"
  | "map"
  | "editor-canvas"
  | "detail-rich";

/** Density modes — page default; user pref still wins.
 *  See docs/UI-UX-GUIDELINES.md §4.1. */
export type PluginPageDensity = "comfortable" | "cozy" | "compact";

/** Searchable schema registered via `awesome-search-core`. The shell
 *  forwards this to the search plugin if present. */
export interface PluginPageSearchable {
  /** Resource id this page is the canonical view of (e.g. "crm.deal"). */
  resource: string;
  /** Field paths searched by global search (in priority order). */
  fields: readonly string[];
}

/** Saved-views schema registered via `saved-views-core`. */
export interface PluginPageSavedViews {
  resource: string;
  /** Filter fields a user can save in a view. */
  filterFields?: readonly string[];
  /** Group/sort fields a user can save. */
  groupFields?: readonly string[];
  sortFields?: readonly string[];
}

/** Quick action surfaced in Cmd-K palette + erp-actions-core. */
export interface PluginPageQuickAction {
  id: string;
  label: string;
  /** Optional Lucide icon name. */
  icon?: string;
  /** Search keywords for fuzzy match. */
  keywords?: readonly string[];
  /** Run handler. May be async. */
  run: () => void | Promise<void>;
}

export interface PluginPageDescriptor {
  /** Stable id, namespaced to the plugin (e.g. `forms-core.custom-fields`). */
  id: string;
  /** Hash route, with leading slash (e.g. `/settings/custom-fields`). */
  path: string;
  /** Display title for breadcrumbs / browser title. */
  title: string;
  /** One-line description for navigation tooltips and menu hovers. */
  description?: string;
  /** The React component to render. */
  Component: ComponentType;
  /** Optional Lucide icon name shown in nav + command palette. */
  icon?: string;
  /** Page archetype — drives `data-archetype` attribute and shell hints
   *  like `fullBleed`. Defaults to `detail-rich`-equivalent layout. */
  archetype?: PluginPageArchetype;
  /** When true, the shell skips the outer `max-w-[1400px] px-6 py-6`
   *  wrapper. Used by editor canvases, full-bleed dashboards, POS. */
  fullBleed?: boolean;
  /** Default density for this page. User preference still wins. */
  density?: PluginPageDensity;
  /** Searchable fields registered with `awesome-search-core`. */
  searchable?: PluginPageSearchable;
  /** Saved-views schema registered with `saved-views-core`. */
  savedViews?: PluginPageSavedViews;
  /** Quick actions surfaced in Cmd-K palette + `erp-actions-core`. */
  quickActions?: readonly PluginPageQuickAction[];
  /** Required permission(s) to view this page. The shell gates render
   *  with <RequirePermissions> automatically. Accepted shapes:
   *
   *    - `"crm.read"` (single permission)
   *    - `["crm.read", "crm.write"]` (AND — all required)
   *    - `{ anyOf: ["crm.read", "ops.read"] }` (OR — any one)
   *
   *  Pages that don't declare this default to "always allowed". */
  permissions?: string | readonly string[] | { anyOf: readonly string[] };
}

export interface PluginNavEntry {
  id: string;
  label: string;
  icon?: string;
  /** Hash route to navigate to when the entry is clicked. */
  path: string;
  /** Section id (e.g. "settings"). Default: "settings". */
  section?: string;
  /** Sort order within the section (lower = earlier). */
  order?: number;
}

export interface PluginCommand {
  id: string;
  label: string;
  icon?: string;
  /** Search keywords for the command palette fuzzy match. */
  keywords?: string[];
  /** Action to run when the command is selected. */
  run: () => void;
}

export interface PluginDetailRail {
  /** Stable id, namespaced. */
  id: string;
  /** Resource pattern: exact id (`accounting.invoice`) or glob
   *  (`accounting.*`). The shell matches the current detail-page resource
   *  against this pattern; matching rails render in the right rail in
   *  declared order. */
  resourcePattern: string;
  /** Component receives `{ resource, recordId }`; renders whatever the
   *  plugin wants — a list, a chart, a metric strip. */
  Component: ComponentType<{ resource: string; recordId: string; record?: Record<string, unknown> }>;
  /** Render priority — higher numbers float to the top. Default 0. */
  priority?: number;
}

export interface AdminUiManifest {
  label: string;
  description?: string;
  icon?: string;
  vendor?: string;
  homepage?: string;
}

export interface AdminUiContribution {
  /** Plugin id — must match the backend HostPlugin.id. */
  id: string;
  /** Optional UI-side manifest (label, icon, vendor) for surface
   *  in /api/_plugins / Settings UIs. */
  manifest?: AdminUiManifest;
  /** Pages contributed at hash routes. */
  pages?: readonly PluginPageDescriptor[];
  /** Nav entries added under their section. */
  navEntries?: readonly PluginNavEntry[];
  /** Command-palette commands. */
  commands?: readonly PluginCommand[];
  /** Detail-page rail cards. */
  detailRails?: readonly PluginDetailRail[];
  /** One-shot callback fired on first activation in the browser
   *  (e.g. register a service worker, hydrate a global cache, post a
   *  welcome toast). */
  install?(): void | Promise<void>;
  /** Called when the shell mounts this plugin's contribution. Use it
   *  to subscribe to global events, attach query-cache invalidators,
   *  warm up a connection, etc. */
  start?(): void | Promise<void>;
  /** Called when the shell unmounts the plugin (HMR reload, plugin
   *  disabled at runtime). Drain timers / subscriptions. */
  stop?(): void | Promise<void>;
}

/** Helper to declare a contribution with its arrays frozen. */
export function defineAdminUi<T extends AdminUiContribution>(c: T): Readonly<T> {
  return Object.freeze({
    ...c,
    pages: Object.freeze([...(c.pages ?? [])]) as never,
    navEntries: Object.freeze([...(c.navEntries ?? [])]) as never,
    commands: Object.freeze([...(c.commands ?? [])]) as never,
    detailRails: Object.freeze([...(c.detailRails ?? [])]) as never,
  });
}

/* ---- Resource-pattern matcher (used by detail-page rail compositor) ---- */

export function detailRailMatches(pattern: string, resource: string): ReactNode | boolean {
  if (pattern === "*") return true;
  if (pattern === resource) return true;
  if (pattern.endsWith(".*")) return resource.startsWith(pattern.slice(0, -2) + ".");
  return false;
}
