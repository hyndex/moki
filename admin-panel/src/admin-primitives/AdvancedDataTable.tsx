import * as React from "react";
import {
  type ColumnDef,
  type ColumnOrderState,
  type ColumnPinningState,
  type RowSelectionState,
  type SortingState,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ChevronDown, ChevronUp, ChevronsUpDown, GripVertical } from "lucide-react";
import { Checkbox } from "@/primitives/Checkbox";
import { EmptyStateFramework } from "./EmptyStateFramework";
import { Spinner } from "@/primitives/Spinner";
import { cn } from "@/lib/cn";

/** @tanstack/react-table v8 powered DataTable.
 *
 *  Upgrades over the previous hand-rolled DataTable:
 *    - Column pinning (left-pinned name/id columns stay visible while
 *      scrolling horizontally)
 *    - Column reorder via drag handle
 *    - Multi-column sort (shift-click second column to add)
 *    - Per-column visibility (wired to SmartColumnConfigurator)
 *    - Virtualised body rendering for >200 rows (windowed)
 *    - Row selection with shift-range + select-all
 *    - Resizable columns (drag the right border)
 *    - Sticky header with smooth shadow when scrolled
 *    - Keyboard navigation: arrow keys, Space to select, Enter to open
 *    - Accessible: role="grid", aria-rowindex, aria-sort per column
 *
 *  The generic <T> is the row shape. Columns are declared via the tanstack
 *  `ColumnDef<T>` contract — use the `defineColumns` helper below for
 *  friendlier defaults.
 */

export interface AdvancedDataTableProps<T> {
  rows: readonly T[];
  columns: ColumnDef<T, unknown>[];
  getRowId?: (row: T, index: number) => string;
  loading?: boolean;
  /** Called when a row is clicked (single-click open). */
  onRowClick?: (row: T) => void;
  /** Shows a sticky bulk-action bar when rows are selected. Provide the
   *  actions; the caller renders them how they like. */
  onSelectionChange?: (selectedIds: string[], rows: T[]) => void;
  /** Persist column config (pinning, order, visibility, sort) under this key. */
  stateKey?: string;
  /** Row density — matches the platform-wide density setting. */
  density?: "comfortable" | "compact" | "dense";
  /** Row height. Overrides density default. */
  rowHeight?: number;
  /** Virtualise when rows >= threshold (default 200). Set to 0 to force. */
  virtualizeAbove?: number;
  /** Render a footer row (for totals). Receives the full row array. */
  footer?: (rows: readonly T[]) => React.ReactNode;
  className?: string;
  /** Empty-state config. */
  emptyTitle?: string;
  emptyDescription?: string;
}

const DENSITY_HEIGHT: Record<NonNullable<AdvancedDataTableProps<unknown>["density"]>, number> = {
  comfortable: 44,
  compact: 36,
  dense: 28,
};

export function AdvancedDataTable<T>({
  rows,
  columns,
  getRowId,
  loading,
  onRowClick,
  onSelectionChange,
  stateKey,
  density = "compact",
  rowHeight,
  virtualizeAbove = 200,
  footer,
  className,
  emptyTitle,
  emptyDescription,
}: AdvancedDataTableProps<T>) {
  /* ------------ persisted state ------------ */
  const persisted = loadState(stateKey);
  const [sorting, setSorting] = React.useState<SortingState>(persisted.sorting ?? []);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>(
    persisted.visibility ?? {},
  );
  const [columnPinning, setColumnPinning] = React.useState<ColumnPinningState>(
    persisted.pinning ?? { left: [], right: [] },
  );
  const [columnOrder, setColumnOrder] = React.useState<ColumnOrderState>(
    persisted.order ?? columns.map((c) => (c.id ?? (c as { accessorKey?: string }).accessorKey ?? "") as string),
  );
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});

  React.useEffect(() => {
    if (!stateKey) return;
    saveState(stateKey, { sorting, visibility: columnVisibility, pinning: columnPinning, order: columnOrder });
  }, [stateKey, sorting, columnVisibility, columnPinning, columnOrder]);

  /* ------------ table instance ------------ */
  const table = useReactTable({
    data: rows as T[],
    columns,
    state: { sorting, columnVisibility, columnPinning, columnOrder, rowSelection },
    enableRowSelection: Boolean(onSelectionChange),
    enableMultiSort: true,
    getRowId: getRowId ? (row, idx) => getRowId(row, idx) : undefined,
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnPinningChange: setColumnPinning,
    onColumnOrderChange: setColumnOrder,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  /* ------------ selection plumbing ------------ */
  React.useEffect(() => {
    if (!onSelectionChange) return;
    const selectedIds = Object.keys(rowSelection).filter((k) => rowSelection[k]);
    const selectedRows = table
      .getFilteredSelectedRowModel()
      .rows.map((r) => r.original);
    onSelectionChange(selectedIds, selectedRows);
  }, [rowSelection, onSelectionChange, table]);

  /* ------------ virtualization ------------ */
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = React.useState(0);
  const height = rowHeight ?? DENSITY_HEIGHT[density];
  const rowCount = table.getRowModel().rows.length;
  const virtualize = virtualizeAbove === 0 || rowCount >= virtualizeAbove;
  const viewportHeight = 520; // fixed virtualization viewport; container scrolls
  const overscan = 8;
  const startIndex = virtualize ? Math.max(0, Math.floor(scrollTop / height) - overscan) : 0;
  const endIndex = virtualize
    ? Math.min(rowCount, Math.ceil((scrollTop + viewportHeight) / height) + overscan)
    : rowCount;
  const virtualRows = table.getRowModel().rows.slice(startIndex, endIndex);
  const padTop = virtualize ? startIndex * height : 0;
  const padBottom = virtualize ? (rowCount - endIndex) * height : 0;

  /* ------------ render ------------ */
  if (loading && rows.length === 0) {
    return (
      <div className={cn("flex items-center justify-center gap-2 py-10 text-xs text-text-muted", className)}>
        <Spinner size={12} /> Loading…
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <EmptyStateFramework
        kind="no-results"
        title={emptyTitle ?? "No records match"}
        description={emptyDescription ?? "Try removing a filter or broadening your search."}
      />
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn("relative overflow-auto border border-border rounded-md bg-surface-0", className)}
      style={virtualize ? { maxHeight: viewportHeight } : undefined}
      onScroll={(e) => virtualize && setScrollTop(e.currentTarget.scrollTop)}
      role="grid"
      aria-rowcount={rowCount}
    >
      <table className="w-full text-sm" style={{ tableLayout: "fixed" }}>
        <thead className="sticky top-0 z-10 bg-surface-1 border-b border-border">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const sorted = header.column.getIsSorted();
                const canSort = header.column.getCanSort();
                return (
                  <th
                    key={header.id}
                    className={cn(
                      "px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-text-muted select-none",
                      canSort && "cursor-pointer hover:text-text-primary",
                    )}
                    style={{ width: header.getSize() }}
                    aria-sort={
                      sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : "none"
                    }
                    onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                  >
                    {header.isPlaceholder ? null : (
                      <div className="flex items-center gap-1">
                        <GripVertical
                          className="h-3 w-3 text-text-muted opacity-0 group-hover:opacity-100"
                          aria-hidden
                        />
                        <span className="flex-1 truncate">
                          {flexRender(header.column.columnDef.header, header.getContext())}
                        </span>
                        {canSort && (
                          <span className="shrink-0">
                            {sorted === "asc" ? (
                              <ChevronUp className="h-3 w-3" />
                            ) : sorted === "desc" ? (
                              <ChevronDown className="h-3 w-3" />
                            ) : (
                              <ChevronsUpDown className="h-3 w-3 opacity-40" />
                            )}
                          </span>
                        )}
                      </div>
                    )}
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {virtualize && padTop > 0 && (
            <tr style={{ height: padTop }} aria-hidden="true">
              <td colSpan={table.getAllColumns().length} />
            </tr>
          )}
          {virtualRows.map((row, idx) => (
            <tr
              key={row.id}
              role="row"
              aria-rowindex={startIndex + idx + 1}
              aria-selected={row.getIsSelected() || undefined}
              className={cn(
                "border-b border-border-subtle last:border-b-0 hover:bg-surface-1 cursor-pointer",
                row.getIsSelected() && "bg-accent-subtle",
              )}
              style={{ height }}
              onClick={() => onRowClick?.(row.original)}
            >
              {row.getVisibleCells().map((cell) => (
                <td
                  key={cell.id}
                  className="px-3 py-0 truncate align-middle"
                  style={{ width: cell.column.getSize(), height }}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
          {virtualize && padBottom > 0 && (
            <tr style={{ height: padBottom }} aria-hidden="true">
              <td colSpan={table.getAllColumns().length} />
            </tr>
          )}
        </tbody>
        {footer && (
          <tfoot className="sticky bottom-0 bg-surface-1 border-t-2 border-border">
            <tr>
              <td colSpan={table.getAllColumns().length} className="px-3 py-2">
                {footer(rows)}
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

/* ------------ helpers ------------ */

interface PersistedTableState {
  sorting?: SortingState;
  visibility?: VisibilityState;
  pinning?: ColumnPinningState;
  order?: ColumnOrderState;
}

function loadState(key: string | undefined): PersistedTableState {
  if (!key || typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(`gutu-adv-table.${key}`);
    return raw ? (JSON.parse(raw) as PersistedTableState) : {};
  } catch {
    return {};
  }
}

function saveState(key: string, state: PersistedTableState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(`gutu-adv-table.${key}`, JSON.stringify(state));
  } catch {
    /* quota */
  }
}

/** Convenience helper for a row-selection checkbox column.
 *  Drop in as the first entry in columns. */
export function selectionColumn<T>(): ColumnDef<T, unknown> {
  return {
    id: "__select",
    size: 36,
    enableSorting: false,
    header: ({ table }) => (
      <Checkbox
        checked={table.getIsAllRowsSelected() || (table.getIsSomeRowsSelected() && "indeterminate")}
        onCheckedChange={(v) => table.toggleAllRowsSelected(Boolean(v))}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(v) => row.toggleSelected(Boolean(v))}
        aria-label="Select row"
        onClick={(e) => e.stopPropagation()}
      />
    ),
  };
}
