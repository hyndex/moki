/** Mirror of @platform/admin-contracts types.
 *
 *  Duplicated here so the bridge has zero build-time coupling to the
 *  legacy library (which may not be resolvable in all workspaces). Every
 *  type here is structurally compatible with the real ones — the
 *  bridge accepts either by shape.
 *
 *  Source of truth: libraries/gutu-lib-admin-contracts/framework/libraries/
 *  admin-contracts/src/types.ts (keep in sync when the upstream ships a
 *  breaking change).
 */

import type { ComponentType } from "react";

export type AdminPageKind =
  | "list"
  | "form"
  | "detail"
  | "dashboard"
  | "report"
  | "builder"
  | "wizard"
  | "queue"
  | "settings"
  | "timeline"
  | "console";

export type WidgetKind =
  | "kpi"
  | "chart"
  | "table"
  | "activity"
  | "status"
  | "actions"
  | "inbox"
  | "custom";

export type ReportKind =
  | "tabular"
  | "grouped"
  | "pivot"
  | "chart"
  | "audit"
  | "compliance"
  | "export-only"
  | "metric";

export type BuilderMode = "embedded" | "embedded-or-zone" | "zone";

export interface FieldVisibilityRule {
  field: string;
  permission: string;
  whenDenied?: "hidden" | "readonly" | "masked";
}

export interface WorkspaceContribution {
  id: string;
  label: string;
  icon?: string;
  description?: string;
  permission: string;
  homePath?: string;
  cards?: string[];
  reports?: string[];
  quickActions?: string[];
}

export interface AdminNavItem {
  id: string;
  label: string;
  icon?: string;
  to: string;
  permission: string;
  keywords?: string[];
}

export interface AdminNavContribution {
  workspace: string;
  group: string;
  items: AdminNavItem[];
}

export interface PageContribution {
  id: string;
  kind: AdminPageKind;
  route: string;
  label: string;
  workspace: string;
  group?: string;
  permission: string;
  shell?: "admin";
  component?: ComponentType;
  listViewId?: string;
  formViewId?: string;
  detailViewId?: string;
  reportId?: string;
  builderId?: string;
  fields?: FieldVisibilityRule[];
}

export interface WidgetContribution {
  id: string;
  kind: WidgetKind;
  shell: "admin";
  slot: string;
  permission: string;
  title?: string;
  component?: ComponentType;
  query?: string;
  drillTo?: string;
}

export interface ReportFilterDefinition {
  key: string;
  type: "text" | "date" | "date-range" | "select" | "number" | "account-select" | "user-select";
}

export interface ReportContribution {
  id: string;
  kind: ReportKind;
  route: string;
  label: string;
  permission: string;
  query: string;
  filters: ReportFilterDefinition[];
  export: Array<"csv" | "xlsx" | "pdf" | "json">;
  component?: ComponentType;
}

export interface CommandContribution {
  id: string;
  label: string;
  permission: string;
  href?: string;
  keywords?: string[];
  run?: (ctx: { navigate(href: string): void }) => void | Promise<void>;
}

export interface BuilderContribution {
  id: string;
  label: string;
  host: "admin";
  route: string;
  permission: string;
  mode: BuilderMode;
  zoneId?: string;
  component?: ComponentType;
}

export interface ZoneLaunchContribution {
  id: string;
  zoneId: string;
  route: string;
  label: string;
  permission: string;
  workspace?: string;
  group?: string;
  description?: string;
}

/** The full legacy registry shape. Some upstream plugins only populate a
 *  subset (see existing `Pick<..., "workspaces" | "nav" | "pages" | "commands">`
 *  usage in gutu-plugin-crm-core). We accept a Partial here and treat
 *  missing arrays as empty. */
export interface AdminContributionRegistry {
  workspaces: WorkspaceContribution[];
  nav: AdminNavContribution[];
  pages: PageContribution[];
  widgets: WidgetContribution[];
  reports: ReportContribution[];
  commands: CommandContribution[];
  searchProviders: unknown[];
  builders: BuilderContribution[];
  zoneLaunchers: ZoneLaunchContribution[];
}

/** Minimal permission introspector — the bridge only needs `.has()`. */
export interface PermissionIntrospector {
  has(permission: string): boolean;
  hasEvery?(permissions: readonly string[]): boolean;
  hasSome?(permissions: readonly string[]): boolean;
}
