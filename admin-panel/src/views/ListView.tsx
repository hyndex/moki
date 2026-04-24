import * as React from "react";
import { Plus, RefreshCw } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import type { ListView as ListViewDef } from "@/contracts/views";
import type { SavedView } from "@/contracts/saved-views";
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
import { navigateTo } from "./useRoute";
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
  }, [search, filters]);

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
        accessorFn: (row) => getPath(row, c.field),
        header: c.label ?? humanize(c.field),
        enableSorting: c.sortable,
        size: typeof c.width === "number" ? c.width : undefined,
        cell: (ctx) => {
          const row = ctx.row.original;
          const v = ctx.getValue();
          if (c.render) return c.render(v, row);
          return renderCellValue(c, v);
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
  const selectedRows = data?.rows.filter((r) => selection.has(String(r.id))) ?? [];

  /* ---------------- saved view apply ---------------- */
  const handleSavedViewSelect = (sv: SavedView | null) => {
    setActiveSavedViewId(sv?.id ?? null);
    if (sv) {
      setFilters({});
      setSort(sv.sort?.[0] ?? view.defaultSort ?? null);
      setPageSize(sv.pageSize ?? view.pageSize ?? 25);
      setDensity(sv.density ?? "compact");
    } else {
      setFilters({});
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
            filter: undefined, // TODO: serialize filters → FilterTree
            sort: sort ? [sort] : undefined,
            columns: columnConfig.filter((c) => c.visible).map((c) => c.field),
            density,
            pageSize,
          }}
          activeId={activeSavedViewId}
          onSelect={handleSavedViewSelect}
        />
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
          <AdvancedDataTable
            rows={data?.rows ?? []}
            columns={columns}
            getRowId={(r) => String(r.id)}
            loading={loading}
            density={density}
            stateKey={view.resource}
            onSelectionChange={
              bulkActions.length > 0 ? handleSelectionChange : undefined
            }
            onRowClick={(row) =>
              navigateTo(
                view.detailPath
                  ? `${basePath}/${view.detailPath(row)}`
                  : `${basePath}/${row.id}`,
              )
            }
            emptyTitle="No records match"
            emptyDescription="Try removing a filter or broadening your search."
          />
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
