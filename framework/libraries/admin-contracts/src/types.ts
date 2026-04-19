import type React from "react";

import type { PermissionIntrospector, UiRegistry } from "@platform/ui-shell";

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

export type FieldVisibilityRule = {
  field: string;
  permission: string;
  whenDenied?: "hidden" | "readonly" | "masked";
};

export type WorkspaceContribution = {
  id: string;
  label: string;
  icon?: string | undefined;
  description?: string | undefined;
  permission: string;
  homePath?: string | undefined;
  cards?: string[];
  reports?: string[];
  quickActions?: string[];
};

export type AdminNavItem = {
  id: string;
  label: string;
  icon?: string | undefined;
  to: string;
  permission: string;
  keywords?: string[];
};

export type AdminNavContribution = {
  workspace: string;
  group: string;
  items: AdminNavItem[];
};

export type PageContribution = {
  id: string;
  kind: AdminPageKind;
  route: string;
  label: string;
  workspace: string;
  group?: string | undefined;
  permission: string;
  shell?: "admin" | undefined;
  component?: React.ComponentType | undefined;
  listViewId?: string | undefined;
  formViewId?: string | undefined;
  detailViewId?: string | undefined;
  reportId?: string | undefined;
  builderId?: string | undefined;
  fields?: FieldVisibilityRule[] | undefined;
};

export type WidgetContribution = {
  id: string;
  kind: WidgetKind;
  shell: "admin";
  slot: string;
  permission: string;
  title?: string | undefined;
  component?: React.ComponentType | undefined;
  query?: string | undefined;
  drillTo?: string | undefined;
};

export type ReportFilterDefinition = {
  key: string;
  type: "text" | "date" | "date-range" | "select" | "number" | "account-select" | "user-select";
};

export type ReportContribution = {
  id: string;
  kind: ReportKind;
  route: string;
  label: string;
  permission: string;
  query: string;
  filters: ReportFilterDefinition[];
  export: Array<"csv" | "xlsx" | "pdf" | "json">;
  component?: React.ComponentType | undefined;
};

export type SearchResultItem = {
  id: string;
  label: string;
  href: string;
  kind: "page" | "resource" | "report" | "command" | "help" | "recent";
  description?: string | undefined;
  permission?: string | undefined;
};

export type SearchContext = {
  permissions: Pick<PermissionIntrospector, "has" | "hasEvery" | "hasSome">;
  tenantId: string;
  actorId: string;
};

export type SearchContribution = {
  id: string;
  scopes: string[];
  permission: string;
  search(query: string, ctx: SearchContext): Promise<SearchResultItem[]> | SearchResultItem[];
};

export type CommandContribution = {
  id: string;
  label: string;
  permission: string;
  href?: string | undefined;
  keywords?: string[];
  run?: ((ctx: { navigate(href: string): void }) => void | Promise<void>) | undefined;
};

export type BuilderContribution = {
  id: string;
  label: string;
  host: "admin";
  route: string;
  permission: string;
  mode: BuilderMode;
  zoneId?: string | undefined;
  component?: React.ComponentType | undefined;
};

export type ZoneLaunchContribution = {
  id: string;
  zoneId: string;
  route: string;
  label: string;
  permission: string;
  workspace?: string | undefined;
  group?: string | undefined;
  description?: string | undefined;
};

export type AdminContributionRegistry = {
  workspaces: WorkspaceContribution[];
  nav: AdminNavContribution[];
  pages: PageContribution[];
  widgets: WidgetContribution[];
  reports: ReportContribution[];
  commands: CommandContribution[];
  searchProviders: SearchContribution[];
  builders: BuilderContribution[];
  zoneLaunchers: ZoneLaunchContribution[];
};

export type AdminAccessContext = Pick<PermissionIntrospector, "has" | "hasEvery" | "hasSome">;

export type AdminShell = {
  id: string;
  version: string;
  mount(contributions: AdminContributionRegistry): Promise<void> | void;
};

export type LegacyUiAdapterResult = Pick<
  AdminContributionRegistry,
  "workspaces" | "nav" | "pages" | "widgets" | "zoneLaunchers"
> & {
  source: UiRegistry;
};
