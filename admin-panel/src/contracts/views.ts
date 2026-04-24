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
  /** Page size for initial fetch (default 200). */
  readonly pageSize?: number;
  /** Click a card → navigate to this path (defaults to `${basePath}/${id}`). */
  readonly cardPath?: (record: Record<string, unknown>) => string;
  readonly actions?: readonly ActionDescriptor[];
}

export type View =
  | ListView
  | FormView
  | DetailView
  | DashboardView
  | KanbanView
  | CustomView;
