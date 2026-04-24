import * as React from "react";
import { Layers, Plus, RefreshCw } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import type { ListView as ListViewDef, ColumnDescriptor } from "@/contracts/views";
import type { FilterTree, SavedView } from "@/contracts/saved-views";
import { PageHeader } from "@/admin-primitives/PageHeader";
import { Toolbar, ToolbarSeparator } from "@/admin-primitives/Toolbar";
import { FilterBar } from "@/admin-primitives/FilterBar";
import {
  AdvancedDataTable,
  selectionColumn,
} from "@/admin-primitives/AdvancedDataTable";
import {
  SmartColumnConfigurator,
  type ColumnConfig,
  type ColumnOption,
} from "@/admin-primitives/SmartColumnConfigurator";
import { SavedViewManager } from "@/admin-primitives/SavedViewManager";
import { ExportCenter } from "@/admin-primitives/ExportCenter";
import { QueryBuilder, type QBField } from "@/admin-primitives/QueryBuilder";
import { ErrorState } from "@/admin-primitives/ErrorState";
import { EmptyState } from "@/admin-primitives/EmptyState";
import { Button } from "@/primitives/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/primitives/DropdownMenu";
import { Spinner } from "@/primitives/Spinner";
import { useList } from "@/runtime/hooks";
import { useRuntime } from "@/runtime/context";
import { renderCellValue, getPath } from "./renderCellValue";
import { useRegistries } from "@/host/pluginHostContext";
import { navigateTo } from "./useRoute";
import { filterRows } from "@/lib/filterEngine";
import { evalExpression } from "@/lib/expression";
import type { ActionDescriptor } from "@/contracts/actions";

export interface ListViewRendererProps {
  view: ListViewDef;
  basePath: string;
}

/** ListView — production list page with:
 *    - tanstack-react-table (pinning, reorder, multi-sort, visibility,
 *      virtualised body rendering, resizable columns)
 *    - SavedViewManager (user-/team-/tenant-scoped filter+sort+columns
 *      presets with defaults and pins)
 *    - SmartColumnConfigurator (show/hide + reorder + pin from a popover)
 *    - ExportCenter (CSV/JSON now; xlsx/pdf delegated to server)
 *    - density toggle persisted with the saved view
 *    - bulk action bar, row actions menu, page actions
 *
 *  The state is:
 *    - query state (sort, page, filters, search) — React state
 *    - column state (visibility, order, pinning) — persisted per-resource in
 *      AdvancedDataTable's localStorage slot
 *    - saved views — persisted via runtime.savedViews store
 */
export function ListViewRenderer({ view, basePath }: ListViewRendererProps) {
  const runtime = useRuntime();
  const registries = useRegistries();

  /* ---------------- saved view state ---------------- */
  const defaultView = runtime.savedViews.getDefault(view.resource);
  const [activeSavedViewId, setActiveSavedViewId] = React.useState<string | null>(
    defaultView?.id ?? null,
  );
  const activeSavedView = activeSavedViewId
    ? runtime.savedViews.get(activeSavedViewId)
    : null;

  /* ---------------- query state (bootstrapped from saved view) ---------------- */
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(
    activeSavedView?.pageSize ?? view.pageSize ?? 25,
  );
  const [sort, setSort] = React.useState(
    activeSavedView?.sort?.[0] ?? view.defaultSort ?? null,
  );
  const [search, setSearch] = React.useState("");
  const [filters, setFilters] = React.useState<Record<string, unknown>>({});
  const [filterTree, setFilterTree] = React.useState<FilterTree | undefined>(
    activeSavedView?.filter,
  );
  const [groupBy, setGroupBy] = React.useState<string | null>(
    activeSavedView?.grouping ?? null,
  );
  const [density, setDensity] = React.useState<"comfortable" | "compact" | "dense">(
    activeSavedView?.density ?? "compact",
  );
  const [selection, setSelection] = React.useState<Set<string>>(new Set());

  /* ---------------- column state ---------------- */
  const allColumnOptions: ColumnOption[] = React.useMemo(
    () =>
      view.columns.map((c) => ({
        field: c.field,
        label: c.label ?? humanize(c.field),
        pinnable: true,
      })),
    [view.columns],
  );
  const [columnConfig, setColumnConfig] = React.useState<ColumnConfig[]>(() =>
    allColumnOptions.map((c) => ({ field: c.field, visible: true, pinned: null })),
  );

  // When a saved view is applied, sync its column order/visibility.
  React.useEffect(() => {
    if (!activeSavedView) return;
    if (activeSavedView.columns && activeSavedView.columns.length > 0) {
      const visibleSet = new Set(activeSavedView.columns);
      setColumnConfig(
        allColumnOptions.map((c) => ({
          field: c.field,
          visible: visibleSet.has(c.field),
          pinned: null,
        })),
      );
    }
    if (activeSavedView.density) setDensity(activeSavedView.density);
    if (activeSavedView.pageSize) setPageSize(activeSavedView.pageSize);
    if (activeSavedView.sort?.[0]) setSort(activeSavedView.sort[0]);
  }, [activeSavedView, allColumnOptions]);

  /* ---------------- query + data ---------------- */
  const query = React.useMemo(
    () => ({
      page,
      pageSize,
      sort: sort ?? undefined,
      search: search || undefined,
      filters,
    }),
    [page, pageSize, sort, search, filters],
  );
  const { data, loading, error, refetch } = useList(view.resource, query);

  // Reset page when filters change
  React.useEffect(() => {
    setPage(1);
  }, [search, filters, filterTree, groupBy]);

  /* ---------------- advanced filter + groupby (client-side) ---------------- */
  const qbFields: QBField[] = React.useMemo(
    () =>
      view.columns.map((c) => ({
        field: c.field,
        label: c.label ?? humanize(c.field),
        kind: ((c.kind ?? "text") as QBField["kind"]),
        options: c.options,
      })),
    [view.columns],
  );

  const filteredRows = React.useMemo(() => {
    const baseRows = (data?.rows ?? []) as Record<string, unknown>[];
    // First evaluate any calculated columns so the filter tree can filter on them too.
    const enriched = baseRows.map((r) => withComputed(r, view.columns));
    return filterTree ? filterRows(enriched, filterTree) : enriched;
  }, [data?.rows, filterTree, view.columns]);

  const groupedRows = React.useMemo(() => {
    if (!groupBy) return null;
    return groupAndAggregate(filteredRows, groupBy, view.columns);
  }, [groupBy, filteredRows, view.columns]);

  /** Grand-totals row across the currently filtered data (only when at least
   *  one column has `totaling`). */
  const totalsRow = React.useMemo(
    () => computeTotalsRow(filteredRows, view.columns),
    [filteredRows, view.columns],
  );

  /* ---------------- action partitioning ---------------- */
  const rowActions =
    view.actions?.filter((a) => a.placement?.includes("row") || !a.placement) ??
    [];
  const bulkActions =
    view.actions?.filter((a) => a.placement?.includes("bulk")) ?? [];
  const pageActions =
    view.actions?.filter((a) => a.placement?.includes("page")) ?? [];

  /* ---------------- tanstack columns ---------------- */
  const columns = React.useMemo(() => {
    const visibleFields = new Set(
      columnConfig.filter((c) => c.visible).map((c) => c.field),
    );
    const ordered = columnConfig
      .filter((c) => visibleFields.has(c.field))
      .map((c) => view.columns.find((vc) => vc.field === c.field)!)
      .filter(Boolean);

    const cols: ColumnDef<Record<string, unknown>, unknown>[] = [];
    if (bulkActions.length > 0) cols.push(selectionColumn());

    for (const c of ordered) {
      cols.push({
        id: c.field,
        accessorFn: (row) => resolveCellValue(row, c),
        header: c.label ?? humanize(c.field),
        enableSorting: c.sortable,
        size: typeof c.width === "number" ? c.width : undefined,
        cell: (ctx) => {
          const row = ctx.row.original;
          const v = ctx.getValue();
          if (c.render) return c.render(v, row);
          return renderCellValue(c, v, row, registries);
        },
      });
    }

    if (rowActions.length > 0) {
      cols.push({
        id: "__actions",
        size: 44,
        enableSorting: false,
        header: () => null,
        cell: ({ row }) => (
          <RowActionMenu
            actions={rowActions}
            row={row.original}
            resource={view.resource}
            runtime={runtime}
          />
        ),
      });
    }
    return cols;
  }, [columnConfig, view.columns, rowActions, bulkActions.length, runtime, view.resource]);

  /* ---------------- bulk selection ---------------- */
  const handleSelectionChange = React.useCallback(
    (ids: string[]) => {
      setSelection(new Set(ids));
    },
    [],
  );
  const selectedRows = filteredRows.filter((r) => selection.has(String(r.id))) ?? [];

  /* ---------------- saved view apply ---------------- */
  const handleSavedViewSelect = (sv: SavedView | null) => {
    setActiveSavedViewId(sv?.id ?? null);
    if (sv) {
      setFilters({});
      setFilterTree(sv.filter);
      setGroupBy(sv.grouping ?? null);
      setSort(sv.sort?.[0] ?? view.defaultSort ?? null);
      setPageSize(sv.pageSize ?? view.pageSize ?? 25);
      setDensity(sv.density ?? "compact");
    } else {
      setFilters({});
      setFilterTree(undefined);
      setGroupBy(null);
      setSort(view.defaultSort ?? null);
      setPageSize(view.pageSize ?? 25);
      setDensity("compact");
    }
    setPage(1);
  };

  /* ---------------- export ---------------- */
  const fetchRowsForExport = React.useCallback(async (): Promise<
    Record<string, unknown>[]
  > => {
    const visibleFields = columnConfig.filter((c) => c.visible).map((c) => c.field);
    // Re-run list with large page size to get the entire filtered dataset.
    const full = await runtime.resources.list(view.resource, {
      page: 1,
      pageSize: 10_000,
      sort: sort ?? undefined,
      search: search || undefined,
      filters,
    });
    return full.rows.map((r) => {
      const subset: Record<string, unknown> = {};
      for (const f of visibleFields) subset[f] = getPath(r, f);
      return subset;
    });
  }, [columnConfig, runtime, view.resource, sort, search, filters]);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={view.title}
        description={view.description}
        actions={
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => runtime.resources.refresh(view.resource)}
              iconLeft={
                loading ? (
                  <Spinner size={12} />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )
              }
            >
              Refresh
            </Button>
            {pageActions.map((a) => (
              <ActionButton
                key={a.id}
                action={a}
                records={[]}
                resource={view.resource}
                runtime={runtime}
              />
            ))}
          </>
        }
      />

      <Toolbar>
        <SavedViewManager
          resource={view.resource}
          currentState={{
            filter: filterTree,
            sort: sort ? [sort] : undefined,
            columns: columnConfig.filter((c) => c.visible).map((c) => c.field),
            grouping: groupBy ?? undefined,
            density,
            pageSize,
          }}
          activeId={activeSavedViewId}
          onSelect={handleSavedViewSelect}
        />
        <ToolbarSeparator />
        <QueryBuilder
          fields={qbFields}
          value={filterTree}
          onChange={setFilterTree}
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              iconLeft={<Layers className="h-3.5 w-3.5" />}
            >
              {groupBy ? `Group by: ${humanize(groupBy)}` : "Group by"}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => setGroupBy(null)}>
              {!groupBy ? "✓ " : "  "}No grouping
            </DropdownMenuItem>
            {view.columns
              .filter((c) => {
                const k = c.kind ?? "text";
                return k === "enum" || k === "text" || k === "boolean";
              })
              .map((c) => (
                <DropdownMenuItem
                  key={c.field}
                  onSelect={() => setGroupBy(c.field)}
                >
                  {groupBy === c.field ? "✓ " : "  "}
                  {c.label ?? humanize(c.field)}
                </DropdownMenuItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <ToolbarSeparator />
        <FilterBar
          search={view.search !== false}
          searchValue={search}
          onSearchChange={setSearch}
          filters={view.filters}
          filterValues={filters}
          onFilterChange={setFilters}
          trailing={
            selection.size > 0 && bulkActions.length > 0 ? (
              <>
                <span className="text-sm text-text-muted">
                  {selection.size} selected
                </span>
                <ToolbarSeparator />
                {bulkActions.map((a) => (
                  <ActionButton
                    key={a.id}
                    action={a}
                    records={selectedRows}
                    resource={view.resource}
                    runtime={runtime}
                  />
                ))}
              </>
            ) : null
          }
        />
        <ToolbarSeparator />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              Density
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {(["comfortable", "compact", "dense"] as const).map((d) => (
              <DropdownMenuItem key={d} onSelect={() => setDensity(d)}>
                {d === density ? "✓ " : "  "}
                {d[0].toUpperCase() + d.slice(1)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <SmartColumnConfigurator
          columns={allColumnOptions}
          value={columnConfig}
          onChange={setColumnConfig}
          onReset={() =>
            setColumnConfig(
              allColumnOptions.map((c) => ({
                field: c.field,
                visible: true,
                pinned: null,
              })),
            )
          }
        />
        <ExportCenter
          resource={view.resource}
          count={data?.total}
          fetchRows={fetchRowsForExport}
          fileName={view.resource.replace(/\./g, "-")}
          formats={["csv", "json", "xlsx"]}
        />
      </Toolbar>

      {error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : !loading &&
        (data?.total ?? 0) === 0 &&
        !search &&
        Object.keys(filters).length === 0 ? (
        <EmptyState
          title={`No ${view.title.toLowerCase()} yet`}
          description={
            view.description ?? "Create the first record to get started."
          }
          action={
            pageActions[0] ? (
              <ActionButton
                action={pageActions[0]}
                records={[]}
                resource={view.resource}
                runtime={runtime}
              />
            ) : (
              <Button
                variant="primary"
                iconLeft={<Plus className="h-3.5 w-3.5" />}
                onClick={() => navigateTo(`${basePath}/new`)}
              >
                New
              </Button>
            )
          }
        />
      ) : (
        <>
          {(filterTree || groupBy) && (
            <div className="flex items-center gap-2 text-xs text-text-muted">
              {filterTree && (
                <span className="inline-flex items-center gap-1">
                  <span className="text-text">Advanced filter active</span>
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => setFilterTree(undefined)}
                  >
                    Clear
                  </Button>
                </span>
              )}
              {groupBy && (
                <span className="inline-flex items-center gap-1">
                  <span className="text-text">
                    Grouped by {humanize(groupBy)} · {groupedRows?.length ?? 0} groups
                  </span>
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => setGroupBy(null)}
                  >
                    Ungroup
                  </Button>
                </span>
              )}
              <span className="ml-auto tabular-nums">
                {filteredRows.length.toLocaleString()} matching row
                {filteredRows.length === 1 ? "" : "s"}
              </span>
            </div>
          )}
          <AdvancedDataTable
            rows={groupedRows ?? filteredRows}
            columns={columns}
            getRowId={(r) => String(r.id)}
            loading={loading}
            density={density}
            stateKey={view.resource}
            onSelectionChange={
              bulkActions.length > 0 && !groupBy ? handleSelectionChange : undefined
            }
            onRowClick={
              groupBy
                ? undefined
                : (row) =>
                    navigateTo(
                      view.detailPath
                        ? `${basePath}/${view.detailPath(row)}`
                        : `${basePath}/${row.id}`,
                    )
            }
            emptyTitle="No records match"
            emptyDescription="Try removing a filter or broadening your search."
          />
          {!groupBy && totalsRow && (
            <TotalsFooter
              totalsRow={totalsRow}
              columns={view.columns}
              columnConfig={columnConfig}
            />
          )}
          {data && data.total !== undefined && data.total > pageSize && (
            <Pagination
              page={page}
              pageSize={pageSize}
              total={data.total}
              onPageChange={setPage}
              onPageSizeChange={(s) => {
                setPageSize(s);
                setPage(1);
              }}
            />
          )}
        </>
      )}
    </div>
  );
}

/* ---------------- helpers ---------------- */

function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (p: number) => void;
  onPageSizeChange: (s: number) => void;
}) {
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <div className="flex items-center justify-between text-xs text-text-muted">
      <div>
        {from.toLocaleString()}-{to.toLocaleString()} of {total.toLocaleString()}
      </div>
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-1">
          Rows:
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="bg-surface-0 border border-border rounded px-1 py-0.5"
          >
            {[10, 25, 50, 100].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <Button
          variant="ghost"
          size="xs"
          disabled={page === 1}
          onClick={() => onPageChange(page - 1)}
        >
          Prev
        </Button>
        <span className="tabular-nums">
          {page} / {lastPage}
        </span>
        <Button
          variant="ghost"
          size="xs"
          disabled={page === lastPage}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

function RowActionMenu({
  actions,
  row,
  resource,
  runtime,
}: {
  actions: readonly ActionDescriptor[];
  row: Record<string, unknown>;
  resource: string;
  runtime: ReturnType<typeof useRuntime>;
}) {
  const visible = actions.filter(
    (a) => !a.guard || a.guard({ records: [row], resource, runtime: runtime.actions }),
  );
  if (visible.length === 0) return null;

  return (
    <div data-stop-row onClick={(e) => e.stopPropagation()}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Row actions">
            <span className="text-text-muted">⋯</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {visible.map((a) => (
            <DropdownMenuItem
              key={a.id}
              intent={a.intent === "danger" ? "danger" : "default"}
              onSelect={async () => {
                if (a.confirm) {
                  const ok = await runtime.actions.confirm({
                    title: a.confirm.title,
                    description: a.confirm.description,
                    destructive: a.confirm.destructive,
                  });
                  if (!ok) return;
                }
                await a.run({
                  records: [row],
                  resource,
                  runtime: runtime.actions,
                });
              }}
            >
              {a.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export function ActionButton({
  action,
  records,
  resource,
  runtime,
  size = "sm",
}: {
  action: ActionDescriptor;
  records: readonly Record<string, unknown>[];
  resource: string;
  runtime: ReturnType<typeof useRuntime>;
  size?: "xs" | "sm" | "md";
}) {
  const [busy, setBusy] = React.useState(false);
  const hidden =
    action.guard &&
    !action.guard({ records, resource, runtime: runtime.actions });
  if (hidden) return null;

  return (
    <Button
      variant={action.intent === "danger" ? "danger" : "primary"}
      size={size}
      loading={busy}
      onClick={async () => {
        if (action.confirm) {
          const ok = await runtime.actions.confirm({
            title: action.confirm.title,
            description: action.confirm.description,
            destructive: action.confirm.destructive,
          });
          if (!ok) return;
        }
        setBusy(true);
        try {
          await action.run({ records, resource, runtime: runtime.actions });
        } finally {
          setBusy(false);
        }
      }}
    >
      {action.label}
    </Button>
  );
}

function humanize(field: string): string {
  const last = field.split(".").pop() ?? field;
  return last
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (c) => c.toUpperCase())
    .replace(/_/g, " ")
    .trim();
}

/** Totals footer — one chip per column with a `totaling` function, labelled
 *  with the column's label + aggregate kind. Shown under the table when any
 *  column declares totaling and no grouping is active (grouping already
 *  produces per-group totals on the summary rows). */
function TotalsFooter({
  totalsRow,
  columns,
  columnConfig,
}: {
  totalsRow: Record<string, unknown>;
  columns: readonly ColumnDescriptor[];
  columnConfig: ColumnConfig[];
}) {
  const visible = new Set(
    columnConfig.filter((c) => c.visible).map((c) => c.field),
  );
  const entries = columns.filter((c) => c.totaling && visible.has(c.field));
  if (entries.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-surface-1 px-3 py-2 text-xs">
      <span className="font-medium text-text">Totals</span>
      {entries.map((c) => {
        const v = totalsRow[c.field];
        const display =
          typeof v === "number"
            ? c.totaling === "avg"
              ? v.toLocaleString(undefined, { maximumFractionDigits: 2 })
              : v.toLocaleString()
            : "—";
        return (
          <span
            key={c.field}
            className="inline-flex items-center gap-1 rounded-sm border border-border bg-surface-0 px-2 py-0.5 tabular-nums"
          >
            <span className="text-text-muted">
              {c.label ?? humanize(c.field)} · {c.totaling}:
            </span>
            <span className="font-medium text-text">{display}</span>
          </span>
        );
      })}
    </div>
  );
}

/* ---------------- expression / computed / aggregation helpers ---------------- */

/** For each column with `expr` or `compute`, evaluate and attach the computed
 *  value onto the record under `column.field`. Returns a new object — never
 *  mutates the input row. Rows without any calculated columns are returned
 *  as-is (same reference) to keep downstream memos cheap. */
function withComputed(
  row: Record<string, unknown>,
  columns: readonly ColumnDescriptor[],
): Record<string, unknown> {
  const calc = columns.filter((c) => c.expr || c.compute);
  if (calc.length === 0) return row;
  const next: Record<string, unknown> = { ...row };
  for (const c of calc) {
    let v: unknown;
    if (c.compute) {
      try {
        v = c.compute(row);
      } catch {
        v = undefined;
      }
    } else if (c.expr) {
      const res = evalExpression(c.expr, row);
      v = res.error ? undefined : res.value;
    }
    // Write under the column's field path. For non-dotted paths this is the
    // common case. For dotted paths we only write the final segment under the
    // top-level bucket to keep merging safe.
    setPath(next, c.field, v);
  }
  return next;
}

/** Resolve the cell value for a column — preferring the attached computed
 *  value (already on the row after `withComputed`) and falling back to the
 *  plain field path read. */
function resolveCellValue(
  row: Record<string, unknown>,
  column: ColumnDescriptor,
): unknown {
  if (column.expr || column.compute) return getPath(row, column.field);
  return getPath(row, column.field);
}

/** Safe shallow setPath — supports `a.b.c`. Skips writes if any intermediate
 *  segment is a primitive (non-object), to avoid clobbering real data. */
function setPath(obj: Record<string, unknown>, path: string, value: unknown) {
  const segs = path.split(".");
  if (segs.length === 1) {
    obj[path] = value;
    return;
  }
  let cur: Record<string, unknown> = obj;
  for (let i = 0; i < segs.length - 1; i++) {
    const k = segs[i];
    const nxt = cur[k];
    if (nxt && typeof nxt === "object" && !Array.isArray(nxt)) {
      // shallow-copy so we don't mutate the original nested object
      const copy = { ...(nxt as Record<string, unknown>) };
      cur[k] = copy;
      cur = copy;
    } else {
      const copy: Record<string, unknown> = {};
      cur[k] = copy;
      cur = copy;
    }
  }
  cur[segs[segs.length - 1]] = value;
}

/** Group rows by the given field and aggregate per `column.totaling`.
 *  The return is a list of "summary" rows, one per group:
 *    - `id` — stable string id derived from the group key
 *    - `[groupField]` — the group value
 *    - `__group_count` — number of rows in the group
 *    - any column with `totaling` — aggregated number
 *  Other columns are blank on summary rows. */
function groupAndAggregate(
  rows: readonly Record<string, unknown>[],
  groupField: string,
  columns: readonly ColumnDescriptor[],
): Record<string, unknown>[] {
  const buckets = new Map<string, Record<string, unknown>[]>();
  for (const r of rows) {
    const key = groupKey(getPath(r, groupField));
    const b = buckets.get(key);
    if (b) b.push(r);
    else buckets.set(key, [r]);
  }
  const totaling = columns.filter((c) => c.totaling);
  const result: Record<string, unknown>[] = [];
  for (const [key, bucketRows] of buckets) {
    const summary: Record<string, unknown> = {
      id: `__group__${key}`,
      __group_count: bucketRows.length,
    };
    // Set group key on the row under the groupField.
    setPath(summary, groupField, bucketRows[0] ? getPath(bucketRows[0], groupField) : key);
    for (const c of totaling) {
      summary[c.field] = aggregate(bucketRows, c);
    }
    result.push(summary);
  }
  return result;
}

/** Apply a column's `totaling` function over the given rows. Numeric-only —
 *  non-numeric cells are skipped. */
function aggregate(
  rows: readonly Record<string, unknown>[],
  column: ColumnDescriptor,
): number | undefined {
  const vals: number[] = [];
  for (const r of rows) {
    const v = getPath(r, column.field);
    const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
    if (Number.isFinite(n)) vals.push(n);
  }
  if (vals.length === 0) return column.totaling === "count" ? rows.length : undefined;
  switch (column.totaling) {
    case "sum":
      return vals.reduce((a, b) => a + b, 0);
    case "avg":
      return vals.reduce((a, b) => a + b, 0) / vals.length;
    case "count":
      return rows.length;
    case "min":
      return Math.min(...vals);
    case "max":
      return Math.max(...vals);
    default:
      return undefined;
  }
}

/** Compute a grand-total row over the currently filtered rows for any column
 *  that declares a `totaling` function. Returns null when no column has one. */
function computeTotalsRow(
  rows: readonly Record<string, unknown>[],
  columns: readonly ColumnDescriptor[],
): Record<string, unknown> | null {
  const totaling = columns.filter((c) => c.totaling);
  if (totaling.length === 0) return null;
  const row: Record<string, unknown> = { id: "__totals__" };
  for (const c of totaling) row[c.field] = aggregate(rows, c);
  return row;
}

function groupKey(v: unknown): string {
  if (v == null) return "__null__";
  if (typeof v === "object") {
    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  }
  return String(v);
}
