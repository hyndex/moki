/** Widget + workspace + report + connection contracts.
 *
 * Inspired by ERPNext's workspace/dashboard_chart/number_card/query_report model:
 * - Widgets are declarative objects placed on a 12-column grid
 * - Charts and number cards bind to report definitions or aggregation specs
 * - Reports are `execute(filters)` style functions returning columns + data + chart
 * - Connections are groupings of related-record counts shown on detail pages
 */

import type { FilterTree } from "./saved-views";
import type { ReactNode } from "react";

/* ------------------------------------------------------------------ */
/* Aggregation                                                         */
/* ------------------------------------------------------------------ */

export type AggregationFunction = "sum" | "avg" | "count" | "min" | "max";

export type TimePeriod = "day" | "week" | "month" | "quarter" | "year";

export type TimeRange =
  | { kind: "last"; days: number }
  | { kind: "mtd" }
  | { kind: "qtd" }
  | { kind: "ytd" }
  | { kind: "all" }
  | { kind: "between"; from: string; to: string };

export interface AggregationSpec {
  resource: string;
  fn: AggregationFunction;
  /** Field to aggregate. Ignored for "count". */
  field?: string;
  /** Optional filter applied before aggregation. */
  filter?: FilterTree;
  /** Optional time-series grouping. */
  period?: TimePeriod;
  /** Optional cross-tab grouping by a dimension field (e.g. "owner", "stage"). */
  groupBy?: string;
  /** Time range for records considered. */
  range?: TimeRange;
  /** Date field to use for time filtering & bucketing (default "createdAt"). */
  dateField?: string;
}

export interface AggregationResult {
  value: number;
  previousValue?: number;
  series?: { label: string; value: number }[];
  groups?: { label: string; value: number }[];
  count: number;
  asOf: string;
}

/* ------------------------------------------------------------------ */
/* Widgets                                                             */
/* ------------------------------------------------------------------ */

export type WidgetIntent = "neutral" | "success" | "warning" | "danger" | "info" | "accent";

export interface BaseWidget {
  id: string;
  /** 1–12 inclusive. Desktop column span. */
  col: number;
  /** Optional row height hint ("short" = 1 unit, "tall" = 2 units). */
  row?: "short" | "tall";
}

export interface HeaderWidget extends BaseWidget {
  type: "header";
  label: string;
  description?: string;
  level?: 1 | 2 | 3;
}

export interface SpacerWidget extends BaseWidget {
  type: "spacer";
}

export interface NumberCardWidget extends BaseWidget {
  type: "number_card";
  label: string;
  sublabel?: string;
  aggregation: AggregationSpec;
  /** How to format the final value. Default: raw number. */
  format?: "currency" | "percent" | "number" | "compact" | "duration_ms";
  /** Currency code when format === "currency". Default USD. */
  currency?: string;
  /** Show trend delta vs previous period. Default: true. */
  trend?: boolean;
  /** Threshold colors: above warn → amber, above danger → red. */
  warnAbove?: number;
  dangerAbove?: number;
  /** Invert when lower is better (e.g. latency, error rate). */
  invertThreshold?: boolean;
  drilldown?: string;
  intent?: WidgetIntent;
}

export interface ChartWidget extends BaseWidget {
  type: "chart";
  label: string;
  description?: string;
  /** Line/bar/area are time-series; donut is group-by. */
  chart: "line" | "bar" | "area" | "donut" | "funnel" | "sparkline";
  aggregation: AggregationSpec;
  height?: number;
  format?: NumberCardWidget["format"];
  currency?: string;
  drilldown?: string;
}

export interface ShortcutCardWidget extends BaseWidget {
  type: "shortcut";
  label: string;
  description?: string;
  icon?: string;
  href: string;
  /** Optional aggregation rendered as a small stat on the card. */
  aggregation?: AggregationSpec;
  intent?: WidgetIntent;
}

export interface QuickListWidget extends BaseWidget {
  type: "quick_list";
  label: string;
  resource: string;
  filter?: FilterTree;
  sort?: { field: string; dir: "asc" | "desc" };
  limit?: number;
  primary: string;
  secondary?: string;
  href?: (row: Record<string, unknown>) => string;
}

export interface CustomWidget extends BaseWidget {
  type: "custom";
  label?: string;
  render: () => ReactNode;
}

export type Widget =
  | HeaderWidget
  | SpacerWidget
  | NumberCardWidget
  | ChartWidget
  | ShortcutCardWidget
  | QuickListWidget
  | CustomWidget;

/* ------------------------------------------------------------------ */
/* Workspace                                                           */
/* ------------------------------------------------------------------ */

/** A single field declared on a workspace-level filter bar. The user's chosen
 *  value is merged (AND) into every widget's aggregation.filter before
 *  evaluation — so NumberCards, Charts and QuickLists all respect the same
 *  slice. */
export interface WorkspaceFilterField {
  /** Field path on the underlying records. Use `_.wildcard` to target just a
   *  subset of widgets when the same field name is used across resources. */
  field: string;
  label: string;
  kind: "text" | "enum" | "boolean" | "date-range";
  options?: readonly { value: string; label: string }[];
  /** Placeholder for the text/enum input. */
  placeholder?: string;
}

export interface WorkspaceDescriptor {
  id: string;
  label: string;
  description?: string;
  /** Widgets in grid order. */
  widgets: Widget[];
  /** Allow per-user rearrangement via drag handle. Default: true. */
  personalizable?: boolean;
  /** Persist personalization under this key. Falls back to `id`. */
  storageKey?: string;
  /** Optional workspace-level filter bar. Whatever the user selects is
   *  AND-merged into every widget's `aggregation.filter`. Values are kept
   *  in session (not persisted) so the next visit starts fresh. */
  filterBar?: readonly WorkspaceFilterField[];
}

/* ------------------------------------------------------------------ */
/* Report                                                              */
/* ------------------------------------------------------------------ */

export interface ReportColumn {
  field: string;
  label: string;
  fieldtype: "text" | "number" | "currency" | "date" | "datetime" | "enum" | "ref" | "percent";
  width?: number;
  align?: "left" | "right" | "center";
  options?: string;
  format?: (value: unknown, row: Record<string, unknown>) => ReactNode;
  sortable?: boolean;
  totaling?: "sum" | "avg" | "count";
}

export interface ReportFilterDef {
  field: string;
  label: string;
  kind: "text" | "number" | "enum" | "date" | "date_range" | "ref" | "boolean";
  required?: boolean;
  defaultValue?: unknown;
  options?: { value: string; label: string }[];
  /** For "ref": resolve options from a resource list. */
  refResource?: string;
}

export interface ReportChartSpec {
  kind: "line" | "bar" | "area" | "donut" | "funnel";
  label: string;
  /** Map report rows into chart data. */
  from: (rows: readonly Record<string, unknown>[]) => { label: string; value: number }[]
    | { series: { label: string; data: number[] }[]; xLabels: string[] };
  format?: NumberCardWidget["format"];
  currency?: string;
  height?: number;
}

export interface ReportResult {
  columns: readonly ReportColumn[];
  rows: Record<string, unknown>[];
  message?: string;
  chart?: ReportChartSpec;
  totals?: Record<string, number>;
}

export interface ReportDefinition {
  id: string;
  label: string;
  description?: string;
  /** Icon from lucide-react name, e.g. "BarChart3". */
  icon?: string;
  /** Resource this report reads. Used for permission checks. */
  resource: string;
  filters: readonly ReportFilterDef[];
  /** Compute the report. Called with resolved filter values. */
  execute: (ctx: ReportExecutionContext) => Promise<ReportResult>;
}

export interface ReportExecutionContext {
  filters: Record<string, unknown>;
  resources: import("../runtime/resourceClient").ResourceClient;
  userId?: string;
  tenantId?: string;
}

/* ------------------------------------------------------------------ */
/* Connections (detail-page linked record panel)                       */
/* ------------------------------------------------------------------ */

export interface ConnectionCategory {
  id: string;
  label: string;
  /** Items inside this category — each counts related records of one resource. */
  items: ConnectionItem[];
}

export interface ConnectionItem {
  id: string;
  label: string;
  resource: string;
  /** Build a filter tree from the parent record to resolve linked records. */
  filter: (parent: Record<string, unknown>) => FilterTree;
  /** Deep link to the filtered list. */
  href?: (parent: Record<string, unknown>) => string;
  icon?: string;
}

export interface ConnectionDescriptor {
  /** Resource the panel is attached to. */
  parentResource: string;
  categories: ConnectionCategory[];
}
