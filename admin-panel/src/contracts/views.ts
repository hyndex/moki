import type { ReactNode } from "react";
import type { FieldDescriptor } from "./fields";
import type { ActionDescriptor } from "./actions";

export type ViewId = string;

export interface ViewBase {
  readonly id: ViewId;
  readonly title: string;
  readonly description?: string;
  readonly resource: string;
  readonly icon?: string;
}

export interface ColumnDescriptor {
  /** Field name on the record (dot paths allowed: "customer.name"). */
  readonly field: string;
  readonly label?: string;
  readonly sortable?: boolean;
  readonly width?: number | string;
  readonly align?: "left" | "right" | "center";
  /** Custom renderer — receives record and returns ReactNode. */
  readonly render?: (value: unknown, record: Record<string, unknown>) => ReactNode;
  readonly kind?: FieldDescriptor["kind"];
  readonly options?: FieldDescriptor["options"];
  /** Calculated column — safe arithmetic expression evaluated per row.
   *  Example: `revenue - cost`, `qty * price * (1 - discount_pct/100)`,
   *  `round(actual / budget * 100, 1)`.
   *  See src/lib/expression.ts for the grammar + allowlisted functions. */
  readonly expr?: string;
  /** Imperative computed value (when expr isn't expressive enough). */
  readonly compute?: (record: Record<string, unknown>) => unknown;
  /** Total function for footer aggregation in list/report views. */
  readonly totaling?: "sum" | "avg" | "count" | "min" | "max";
}

export interface FilterDescriptor {
  readonly field: string;
  readonly label?: string;
  readonly kind: "text" | "enum" | "boolean" | "date-range";
  readonly options?: FieldDescriptor["options"];
}

export interface ListView extends ViewBase {
  readonly type: "list";
  readonly columns: readonly ColumnDescriptor[];
  readonly filters?: readonly FilterDescriptor[];
  readonly pageSize?: number;
  readonly defaultSort?: { field: string; dir: "asc" | "desc" };
  /** Actions that apply per-row, to bulk selections, or to the page. */
  readonly actions?: readonly ActionDescriptor[];
  readonly search?: boolean;
  /** Path of the detail route relative to `/<plugin>/<resource>/`. */
  readonly detailPath?: (record: Record<string, unknown>) => string;
}

export interface FormSection {
  readonly id: string;
  readonly title?: string;
  readonly description?: string;
  readonly columns?: 1 | 2 | 3;
  readonly fields: readonly FieldDescriptor[];
  /** Section collapse behavior.
   *    - `false` (default): always expanded, no chevron.
   *    - `true`: collapsible; user-toggle, default expanded.
   *    - `"collapsed"`: collapsible; user-toggle, default collapsed.
   */
  readonly collapsible?: boolean | "collapsed";
  /** Hide this section when the predicate returns false. */
  readonly visibleWhen?: (ctx: {
    record: Record<string, unknown>;
    user?: { id?: string; roles?: readonly string[]; email?: string };
  }) => boolean;
  /** Icon name (lucide) shown next to the section title. */
  readonly icon?: string;
}

export interface FormView extends ViewBase {
  readonly type: "form";
  readonly sections: readonly FormSection[];
  /** Default values when creating a new record. */
  readonly defaults?: Record<string, unknown>;
  readonly actions?: readonly ActionDescriptor[];
}

export interface DetailView extends ViewBase {
  readonly type: "detail";
  readonly header?: (record: Record<string, unknown>) => ReactNode;
  readonly tabs: readonly {
    readonly id: string;
    readonly label: string;
    readonly render: (record: Record<string, unknown>) => ReactNode;
  }[];
  readonly actions?: readonly ActionDescriptor[];
}

export interface DashboardWidget {
  readonly id: string;
  readonly title: string;
  readonly size?: "sm" | "md" | "lg" | "xl";
  readonly render: () => ReactNode;
}

export interface DashboardView extends ViewBase {
  readonly type: "dashboard";
  readonly widgets: readonly DashboardWidget[];
}

export interface CustomView extends ViewBase {
  readonly type: "custom";
  readonly render: () => ReactNode;
  /** Page archetype — propagates from the plugin descriptor. The shell
   *  uses this to apply a `data-archetype` on the outer container and
   *  to decide whether to skip the max-width wrapper (when archetype is
   *  `editor-canvas` or `fullBleed === true`). Optional. */
  readonly archetype?:
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
  /** When true, the shell skips the max-width wrapper for this view. */
  readonly fullBleed?: boolean;
  /** Default density for this view. User pref still wins. */
  readonly density?: "comfortable" | "cozy" | "compact";
  /** Required permission(s) to view this page. The shell gates render
   *  with <RequirePermissions> automatically. */
  readonly permissions?: string | readonly string[] | { readonly anyOf: readonly string[] };
}

/** KanbanView — live drag-and-drop board bound to a resource. */
export interface KanbanColumnSpec {
  readonly id: string;
  readonly title: string;
  readonly intent?: "neutral" | "accent" | "success" | "warning" | "danger" | "info";
  /** WIP limit — column header turns amber when exceeded. */
  readonly wipLimit?: number;
}

export interface KanbanView extends ViewBase {
  readonly type: "kanban";
  /** Field on the record whose value is the column id (e.g. "status"). */
  readonly statusField: string;
  readonly columns: readonly KanbanColumnSpec[];
  /** How to render each card; receives the full record. */
  readonly renderCard: (record: Record<string, unknown>) => ReactNode;
  /** Optional client-side filter. */
  readonly filter?: (record: Record<string, unknown>) => boolean;
  /** Simple quick-filters shown as chips above the board. */
  readonly filters?: readonly FilterDescriptor[];
  /** Fields to expose to the advanced QueryBuilder popover. When omitted,
   *  the QueryBuilder isn't rendered. */
  readonly advancedFilterFields?: readonly {
    readonly field: string;
    readonly label?: string;
    readonly kind: FieldDescriptor["kind"];
    readonly options?: FieldDescriptor["options"];
  }[];
  /** Enable the search input above the board. */
  readonly search?: boolean;
  /** Fields to search through when `search` is true. Defaults to common
   *  `name`/`title`/`label` fields when omitted. */
  readonly searchFields?: readonly string[];
  /** Page size for initial fetch (default 200). */
  readonly pageSize?: number;
  /** Click a card → navigate to this path (defaults to `${basePath}/${id}`). */
  readonly cardPath?: (record: Record<string, unknown>) => string;
  readonly actions?: readonly ActionDescriptor[];
}

/** Plugin-contributed view — any view whose `type` isn't one of the
 *  built-ins. The shell looks up a renderer for `view.type` in the
 *  `registries.viewModes` registry at render time.
 *
 *  `type` uses a distinct `external:` prefix so TypeScript can narrow
 *  unions cleanly. Plugin authors contribute types like "external:map"
 *  or "external:timeline"; the registry strips the prefix when looking
 *  up the renderer. */
export interface ExternalView extends ViewBase {
  readonly type: `external:${string}`;
  /** Opaque payload passed to the renderer; shape is enforced by the
   *  contributing plugin. */
  readonly payload?: unknown;
}

export type View =
  | ListView
  | FormView
  | DetailView
  | DashboardView
  | KanbanView
  | CustomView
  | ExternalView;
