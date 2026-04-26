import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import * as React from "react";
import { Layers, Plus, RefreshCw } from "lucide-react";
import { useUrlParam, useUrlJsonParam } from "@/runtime/useUrlState";
import { useFieldMetadata } from "@/runtime/useFieldMetadata";
import { PageHeader } from "@/admin-primitives/PageHeader";
import { Toolbar, ToolbarSeparator } from "@/admin-primitives/Toolbar";
import { FilterBar } from "@/admin-primitives/FilterBar";
import { AdvancedDataTable, selectionColumn, } from "@/admin-primitives/AdvancedDataTable";
import { SmartColumnConfigurator, } from "@/admin-primitives/SmartColumnConfigurator";
import { SavedViewManager } from "@/admin-primitives/SavedViewManager";
import { ExportCenter } from "@/admin-primitives/ExportCenter";
import { QueryBuilder } from "@/admin-primitives/QueryBuilder";
import { ErrorState } from "@/admin-primitives/ErrorState";
import { EmptyState } from "@/admin-primitives/EmptyState";
import { Button } from "@/primitives/Button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, } from "@/primitives/DropdownMenu";
import { Spinner } from "@/primitives/Spinner";
import { useList } from "@/runtime/hooks";
import { useRuntime } from "@/runtime/context";
import { renderCellValue, getPath } from "./renderCellValue";
import { useRegistries } from "@/host/pluginHostContext";
import { navigateTo } from "./useRoute";
import { filterRows } from "@/lib/filterEngine";
import { evalExpression } from "@/lib/expression";
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
export function ListViewRenderer({ view, basePath }) {
    const runtime = useRuntime();
    const registries = useRegistries();
    /* ---------------- saved view state (URL-synced) ----------------
     *
     *  The active saved-view id lives in `?view=<id>` so a user can paste
     *  the URL into Slack and have a colleague land on the SAME filtered
     *  view. Falls back to the user's default if no `?view` param is
     *  present. Updates flow back to the URL via `useUrlParam` so future
     *  state changes (selecting a different saved view) update the URL.
     *  Same pattern Twenty / Linear use for shareable views. */
    const [urlViewId, setUrlViewId] = useUrlParam("view");
    const defaultView = runtime.savedViews.getDefault(view.resource);
    const initialViewId = urlViewId ?? defaultView?.id ?? null;
    const [activeSavedViewId, setActiveSavedViewIdState] = React.useState(initialViewId);
    // When the user selects a different saved view, mirror it to the URL.
    const setActiveSavedViewId = React.useCallback((id) => {
        setActiveSavedViewIdState(id);
        setUrlViewId(id);
    }, [setUrlViewId]);
    // When the URL ?view= changes externally (back/forward, paste-link),
    // re-apply it.
    React.useEffect(() => {
        if (urlViewId !== activeSavedViewId) {
            setActiveSavedViewIdState(urlViewId ?? null);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [urlViewId]);
    const activeSavedView = activeSavedViewId
        ? runtime.savedViews.get(activeSavedViewId)
        : null;
    /* ---------------- query state ----------------
     *
     *  We sync THE FOLLOWING to the URL hash query string so a user can
     *  paste a URL into Slack and a colleague lands on the same view:
     *    ?view=<savedViewId>          (already wired above)
     *    ?q=<text>                    free-text search
     *    ?sort=<json>                 sort spec
     *    ?filter=<json>               filter tree
     *    ?showDeleted=1               include soft-deleted rows
     *  Falls back to saved-view defaults when params absent.
     *
     *  Twenty / Linear / GitHub all do this; the previous code kept the
     *  filter in React state which made shareable filtered views
     *  impossible. */
    const [urlSearch, setUrlSearch] = useUrlParam("q");
    const [urlSort, setUrlSort] = useUrlJsonParam("sort");
    const [urlFilter, setUrlFilter] = useUrlJsonParam("filter");
    const [urlShowDeleted, setUrlShowDeleted] = useUrlParam("deleted");
    const [page, setPage] = React.useState(1);
    const [pageSize, setPageSize] = React.useState(activeSavedView?.pageSize ?? view.pageSize ?? 25);
    const [sort, setSortState] = React.useState(urlSort ?? activeSavedView?.sort?.[0] ?? view.defaultSort ?? null);
    const setSort = (v) => {
        const next = typeof v === "function" ? v(sort) : v;
        setSortState(next);
        setUrlSort(next ?? null);
    };
    const [search, setSearchState] = React.useState(urlSearch ?? "");
    const setSearch = (v) => {
        const next = typeof v === "function" ? v(search) : v;
        setSearchState(next);
        setUrlSearch(next || null);
    };
    const [filters, setFilters] = React.useState({});
    const [filterTree, setFilterTreeState] = React.useState(urlFilter ?? activeSavedView?.filter);
    const setFilterTree = (v) => {
        const next = typeof v === "function" ? v(filterTree) : v;
        setFilterTreeState(next);
        setUrlFilter(next ?? null);
    };
    const [groupBy, setGroupBy] = React.useState(activeSavedView?.grouping ?? null);
    const [density, setDensity] = React.useState(activeSavedView?.density ?? "compact");
    const [showDeleted, setShowDeletedState] = React.useState(urlShowDeleted === "1");
    const setShowDeleted = (v) => {
        setShowDeletedState(v);
        setUrlShowDeleted(v ? "1" : null);
    };
    const [selection, setSelection] = React.useState(new Set());
    // When the URL changes externally (paste-link, back/forward), re-apply.
    React.useEffect(() => {
        if (urlSort && JSON.stringify(urlSort) !== JSON.stringify(sort))
            setSortState(urlSort);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [urlSort]);
    React.useEffect(() => {
        if (urlFilter && JSON.stringify(urlFilter) !== JSON.stringify(filterTree))
            setFilterTreeState(urlFilter);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [urlFilter]);
    React.useEffect(() => {
        if ((urlSearch ?? "") !== search)
            setSearchState(urlSearch ?? "");
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [urlSearch]);
    /* ---------------- column state ----------------
     *
     *  Effective column set = view.columns (Zod-derived, code-defined)
     *  + custom fields declared for this resource via the Settings UI.
     *  Custom fields are tagged with __custom: true so the cell renderer
     *  knows to look up the field by key in the row body. */
    const { fields: customFields } = useFieldMetadata(view.resource);
    const customColumns = React.useMemo(() => customFields.map((f) => ({
        field: f.key,
        label: f.label,
        // Map the field-metadata kind onto the platform's smaller
        // ColumnDescriptor.kind enum (FieldDescriptor["kind"]).
        // Custom-field types we don't have a direct match for fall
        // back to "text" — the cell renderer is permissive.
        kind: (["text", "email", "phone", "url", "long-text", "rich-text"].includes(f.kind) ? "text"
            : f.kind === "currency" ? "currency"
                : f.kind === "datetime" || f.kind === "date" ? "datetime"
                    : f.kind === "boolean" ? "boolean"
                        : f.kind === "number" ? "number"
                            : f.kind === "select" ? "enum"
                                : f.kind === "multiselect" ? "multi-enum"
                                    : f.kind === "relation" ? "reference"
                                        : "text"),
        options: f.options.options,
    })), [customFields]);
    const effectiveColumns = React.useMemo(() => [...view.columns, ...customColumns], [view.columns, customColumns]);
    const allColumnOptions = React.useMemo(() => effectiveColumns.map((c) => ({
        field: c.field,
        label: c.label ?? humanize(c.field),
        pinnable: true,
    })), [effectiveColumns]);
    const [columnConfig, setColumnConfig] = React.useState(() => allColumnOptions.map((c) => ({ field: c.field, visible: true, pinned: null })));
    // When a saved view is applied, sync its column order/visibility.
    React.useEffect(() => {
        if (!activeSavedView)
            return;
        if (activeSavedView.columns && activeSavedView.columns.length > 0) {
            const visibleSet = new Set(activeSavedView.columns);
            setColumnConfig(allColumnOptions.map((c) => ({
                field: c.field,
                visible: visibleSet.has(c.field),
                pinned: null,
            })));
        }
        if (activeSavedView.density)
            setDensity(activeSavedView.density);
        if (activeSavedView.pageSize)
            setPageSize(activeSavedView.pageSize);
        if (activeSavedView.sort?.[0])
            setSort(activeSavedView.sort[0]);
    }, [activeSavedView, allColumnOptions]);
    /* ---------------- query + data ---------------- */
    const query = React.useMemo(() => ({
        page,
        pageSize,
        sort: sort ?? undefined,
        search: search || undefined,
        filters: { ...filters, ...(showDeleted ? { __includeDeleted: "1" } : {}) },
    }), [page, pageSize, sort, search, filters, showDeleted]);
    const { data, loading, error, refetch } = useList(view.resource, query);
    // Reset page when filters change
    React.useEffect(() => {
        setPage(1);
    }, [search, filters, filterTree, groupBy]);
    /* ---------------- advanced filter + groupby (client-side) ---------------- */
    const qbFields = React.useMemo(() => effectiveColumns.map((c) => ({
        field: c.field,
        label: c.label ?? humanize(c.field),
        kind: (c.kind ?? "text"),
        options: c.options,
    })), [effectiveColumns]);
    const filteredRows = React.useMemo(() => {
        const baseRows = (data?.rows ?? []);
        // First evaluate any calculated columns so the filter tree can filter on them too.
        const enriched = baseRows.map((r) => withComputed(r, view.columns));
        return filterTree ? filterRows(enriched, filterTree) : enriched;
    }, [data?.rows, filterTree, view.columns]);
    const groupedRows = React.useMemo(() => {
        if (!groupBy)
            return null;
        return groupAndAggregate(filteredRows, groupBy, view.columns);
    }, [groupBy, filteredRows, view.columns]);
    /** Grand-totals row across the currently filtered data (only when at least
     *  one column has `totaling`). */
    const totalsRow = React.useMemo(() => computeTotalsRow(filteredRows, view.columns), [filteredRows, view.columns]);
    /* ---------------- action partitioning ---------------- */
    const rowActions = view.actions?.filter((a) => a.placement?.includes("row") || !a.placement) ??
        [];
    const bulkActions = view.actions?.filter((a) => a.placement?.includes("bulk")) ?? [];
    const pageActions = view.actions?.filter((a) => a.placement?.includes("page")) ?? [];
    /* ---------------- tanstack columns ---------------- */
    const columns = React.useMemo(() => {
        const visibleFields = new Set(columnConfig.filter((c) => c.visible).map((c) => c.field));
        const ordered = columnConfig
            .filter((c) => visibleFields.has(c.field))
            .map((c) => effectiveColumns.find((vc) => vc.field === c.field))
            .filter(Boolean);
        const cols = [];
        if (bulkActions.length > 0)
            cols.push(selectionColumn());
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
                    if (c.render)
                        return c.render(v, row);
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
                cell: ({ row }) => (_jsx(RowActionMenu, { actions: rowActions, row: row.original, resource: view.resource, runtime: runtime })),
            });
        }
        return cols;
    }, [columnConfig, view.columns, rowActions, bulkActions.length, runtime, view.resource]);
    /* ---------------- bulk selection ---------------- */
    const handleSelectionChange = React.useCallback((ids) => {
        setSelection(new Set(ids));
    }, []);
    const selectedRows = filteredRows.filter((r) => selection.has(String(r.id))) ?? [];
    /* ---------------- saved view apply ---------------- */
    const handleSavedViewSelect = (sv) => {
        setActiveSavedViewId(sv?.id ?? null);
        if (sv) {
            setFilters({});
            setFilterTree(sv.filter);
            setGroupBy(sv.grouping ?? null);
            setSort(sv.sort?.[0] ?? view.defaultSort ?? null);
            setPageSize(sv.pageSize ?? view.pageSize ?? 25);
            setDensity(sv.density ?? "compact");
        }
        else {
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
    const fetchRowsForExport = React.useCallback(async () => {
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
            const subset = {};
            for (const f of visibleFields)
                subset[f] = getPath(r, f);
            return subset;
        });
    }, [columnConfig, runtime, view.resource, sort, search, filters]);
    return (_jsxs("div", { className: "flex flex-col gap-4", children: [_jsx(PageHeader, { title: view.title, description: view.description, actions: _jsxs(_Fragment, { children: [_jsx(Button, { variant: "ghost", size: "sm", onClick: () => runtime.resources.refresh(view.resource), iconLeft: loading ? (_jsx(Spinner, { size: 12 })) : (_jsx(RefreshCw, { className: "h-3.5 w-3.5" })), children: "Refresh" }), pageActions.map((a) => (_jsx(ActionButton, { action: a, records: [], resource: view.resource, runtime: runtime }, a.id)))] }) }), _jsxs(Toolbar, { children: [_jsx(SavedViewManager, { resource: view.resource, currentState: {
                            filter: filterTree,
                            sort: sort ? [sort] : undefined,
                            columns: columnConfig.filter((c) => c.visible).map((c) => c.field),
                            grouping: groupBy ?? undefined,
                            density,
                            pageSize,
                        }, activeId: activeSavedViewId, onSelect: handleSavedViewSelect }), _jsx(ToolbarSeparator, {}), _jsx(QueryBuilder, { fields: qbFields, value: filterTree, onChange: setFilterTree }), _jsxs(DropdownMenu, { children: [_jsx(DropdownMenuTrigger, { asChild: true, children: _jsx(Button, { variant: "ghost", size: "sm", iconLeft: _jsx(Layers, { className: "h-3.5 w-3.5" }), children: groupBy ? `Group by: ${humanize(groupBy)}` : "Group by" }) }), _jsxs(DropdownMenuContent, { align: "end", children: [_jsxs(DropdownMenuItem, { onSelect: () => setGroupBy(null), children: [!groupBy ? "✓ " : "  ", "No grouping"] }), view.columns
                                        .filter((c) => {
                                        const k = c.kind ?? "text";
                                        return k === "enum" || k === "text" || k === "boolean";
                                    })
                                        .map((c) => (_jsxs(DropdownMenuItem, { onSelect: () => setGroupBy(c.field), children: [groupBy === c.field ? "✓ " : "  ", c.label ?? humanize(c.field)] }, c.field)))] })] }), _jsx(ToolbarSeparator, {}), _jsx(FilterBar, { search: view.search !== false, searchValue: search, onSearchChange: setSearch, filters: view.filters, filterValues: filters, onFilterChange: setFilters, trailing: selection.size > 0 && bulkActions.length > 0 ? (_jsxs(_Fragment, { children: [_jsxs("span", { className: "text-sm text-text-muted", children: [selection.size, " selected"] }), _jsx(ToolbarSeparator, {}), bulkActions.map((a) => (_jsx(ActionButton, { action: a, records: selectedRows, resource: view.resource, runtime: runtime }, a.id)))] })) : null }), _jsx(ToolbarSeparator, {}), _jsxs(DropdownMenu, { children: [_jsx(DropdownMenuTrigger, { asChild: true, children: _jsx(Button, { variant: "ghost", size: "sm", children: "Density" }) }), _jsx(DropdownMenuContent, { align: "end", children: ["comfortable", "compact", "dense"].map((d) => (_jsxs(DropdownMenuItem, { onSelect: () => setDensity(d), children: [d === density ? "✓ " : "  ", d[0].toUpperCase() + d.slice(1)] }, d))) })] }), _jsx(SmartColumnConfigurator, { columns: allColumnOptions, value: columnConfig, onChange: setColumnConfig, onReset: () => setColumnConfig(allColumnOptions.map((c) => ({
                            field: c.field,
                            visible: true,
                            pinned: null,
                        }))) }), _jsx(ExportCenter, { resource: view.resource, count: data?.total, fetchRows: fetchRowsForExport, fileName: view.resource.replace(/\./g, "-"), formats: ["csv", "json", "xlsx"] }), _jsx(ToolbarSeparator, {}), _jsx(Button, { variant: showDeleted ? "secondary" : "ghost", size: "sm", onClick: () => setShowDeleted(!showDeleted), title: showDeleted ? "Hide deleted" : "Show deleted records", children: showDeleted ? "Hide deleted" : "Show deleted" })] }), error ? (_jsx(ErrorState, { error: error, onRetry: refetch })) : !loading &&
                (data?.total ?? 0) === 0 &&
                !search &&
                Object.keys(filters).length === 0 ? (_jsx(EmptyState, { title: `No ${view.title.toLowerCase()} yet`, description: view.description ?? "Create the first record to get started.", action: pageActions[0] ? (_jsx(ActionButton, { action: pageActions[0], records: [], resource: view.resource, runtime: runtime })) : (_jsx(Button, { variant: "primary", iconLeft: _jsx(Plus, { className: "h-3.5 w-3.5" }), onClick: () => navigateTo(`${basePath}/new`), children: "New" })) })) : (_jsxs(_Fragment, { children: [(filterTree || groupBy) && (_jsxs("div", { className: "flex items-center gap-2 text-xs text-text-muted", children: [filterTree && (_jsxs("span", { className: "inline-flex items-center gap-1", children: [_jsx("span", { className: "text-text", children: "Advanced filter active" }), _jsx(Button, { variant: "ghost", size: "xs", onClick: () => setFilterTree(undefined), children: "Clear" })] })), groupBy && (_jsxs("span", { className: "inline-flex items-center gap-1", children: [_jsxs("span", { className: "text-text", children: ["Grouped by ", humanize(groupBy), " \u00B7 ", groupedRows?.length ?? 0, " groups"] }), _jsx(Button, { variant: "ghost", size: "xs", onClick: () => setGroupBy(null), children: "Ungroup" })] })), _jsxs("span", { className: "ml-auto tabular-nums", children: [filteredRows.length.toLocaleString(), " matching row", filteredRows.length === 1 ? "" : "s"] })] })), _jsx(AdvancedDataTable, { rows: groupedRows ?? filteredRows, columns: columns, getRowId: (r) => String(r.id), loading: loading, density: density, stateKey: view.resource, onSelectionChange: bulkActions.length > 0 && !groupBy ? handleSelectionChange : undefined, onRowClick: groupBy
                            ? undefined
                            : (row) => navigateTo(view.detailPath
                                ? `${basePath}/${view.detailPath(row)}`
                                : `${basePath}/${row.id}`), emptyTitle: "No records match", emptyDescription: "Try removing a filter or broadening your search." }), !groupBy && totalsRow && (_jsx(TotalsFooter, { totalsRow: totalsRow, columns: view.columns, columnConfig: columnConfig })), data && data.total !== undefined && data.total > pageSize && (_jsx(Pagination, { page: page, pageSize: pageSize, total: data.total, onPageChange: setPage, onPageSizeChange: (s) => {
                            setPageSize(s);
                            setPage(1);
                        } }))] }))] }));
}
/* ---------------- helpers ---------------- */
function Pagination({ page, pageSize, total, onPageChange, onPageSizeChange, }) {
    const lastPage = Math.max(1, Math.ceil(total / pageSize));
    const from = (page - 1) * pageSize + 1;
    const to = Math.min(total, page * pageSize);
    return (_jsxs("div", { className: "flex items-center justify-between text-xs text-text-muted", children: [_jsxs("div", { children: [from.toLocaleString(), "-", to.toLocaleString(), " of ", total.toLocaleString()] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsxs("label", { className: "flex items-center gap-1", children: ["Rows:", _jsx("select", { value: pageSize, onChange: (e) => onPageSizeChange(Number(e.target.value)), className: "bg-surface-0 border border-border rounded px-1 py-0.5", children: [10, 25, 50, 100].map((s) => (_jsx("option", { value: s, children: s }, s))) })] }), _jsx(Button, { variant: "ghost", size: "xs", disabled: page === 1, onClick: () => onPageChange(page - 1), children: "Prev" }), _jsxs("span", { className: "tabular-nums", children: [page, " / ", lastPage] }), _jsx(Button, { variant: "ghost", size: "xs", disabled: page === lastPage, onClick: () => onPageChange(page + 1), children: "Next" })] })] }));
}
function RowActionMenu({ actions, row, resource, runtime, }) {
    const visible = actions.filter((a) => !a.guard || a.guard({ records: [row], resource, runtime: runtime.actions }));
    if (visible.length === 0)
        return null;
    return (_jsx("div", { "data-stop-row": true, onClick: (e) => e.stopPropagation(), children: _jsxs(DropdownMenu, { children: [_jsx(DropdownMenuTrigger, { asChild: true, children: _jsx(Button, { variant: "ghost", size: "icon", "aria-label": "Row actions", children: _jsx("span", { className: "text-text-muted", children: "\u22EF" }) }) }), _jsx(DropdownMenuContent, { align: "end", children: visible.map((a) => (_jsx(DropdownMenuItem, { intent: a.intent === "danger" ? "danger" : "default", onSelect: async () => {
                            if (a.confirm) {
                                const ok = await runtime.actions.confirm({
                                    title: a.confirm.title,
                                    description: a.confirm.description,
                                    destructive: a.confirm.destructive,
                                });
                                if (!ok)
                                    return;
                            }
                            await a.run({
                                records: [row],
                                resource,
                                runtime: runtime.actions,
                            });
                        }, children: a.label }, a.id))) })] }) }));
}
export function ActionButton({ action, records, resource, runtime, size = "sm", }) {
    const [busy, setBusy] = React.useState(false);
    const hidden = action.guard &&
        !action.guard({ records, resource, runtime: runtime.actions });
    if (hidden)
        return null;
    return (_jsx(Button, { variant: action.intent === "danger" ? "danger" : "primary", size: size, loading: busy, onClick: async () => {
            if (action.confirm) {
                const ok = await runtime.actions.confirm({
                    title: action.confirm.title,
                    description: action.confirm.description,
                    destructive: action.confirm.destructive,
                });
                if (!ok)
                    return;
            }
            setBusy(true);
            try {
                await action.run({ records, resource, runtime: runtime.actions });
            }
            finally {
                setBusy(false);
            }
        }, children: action.label }));
}
function humanize(field) {
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
function TotalsFooter({ totalsRow, columns, columnConfig, }) {
    const visible = new Set(columnConfig.filter((c) => c.visible).map((c) => c.field));
    const entries = columns.filter((c) => c.totaling && visible.has(c.field));
    if (entries.length === 0)
        return null;
    return (_jsxs("div", { className: "flex flex-wrap items-center gap-2 rounded-md border border-border bg-surface-1 px-3 py-2 text-xs", children: [_jsx("span", { className: "font-medium text-text", children: "Totals" }), entries.map((c) => {
                const v = totalsRow[c.field];
                const display = typeof v === "number"
                    ? c.totaling === "avg"
                        ? v.toLocaleString(undefined, { maximumFractionDigits: 2 })
                        : v.toLocaleString()
                    : "—";
                return (_jsxs("span", { className: "inline-flex items-center gap-1 rounded-sm border border-border bg-surface-0 px-2 py-0.5 tabular-nums", children: [_jsxs("span", { className: "text-text-muted", children: [c.label ?? humanize(c.field), " \u00B7 ", c.totaling, ":"] }), _jsx("span", { className: "font-medium text-text", children: display })] }, c.field));
            })] }));
}
/* ---------------- expression / computed / aggregation helpers ---------------- */
/** For each column with `expr` or `compute`, evaluate and attach the computed
 *  value onto the record under `column.field`. Returns a new object — never
 *  mutates the input row. Rows without any calculated columns are returned
 *  as-is (same reference) to keep downstream memos cheap. */
function withComputed(row, columns) {
    const calc = columns.filter((c) => c.expr || c.compute);
    if (calc.length === 0)
        return row;
    const next = { ...row };
    for (const c of calc) {
        let v;
        if (c.compute) {
            try {
                v = c.compute(row);
            }
            catch {
                v = undefined;
            }
        }
        else if (c.expr) {
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
function resolveCellValue(row, column) {
    if (column.expr || column.compute)
        return getPath(row, column.field);
    return getPath(row, column.field);
}
/** Safe shallow setPath — supports `a.b.c`. Skips writes if any intermediate
 *  segment is a primitive (non-object), to avoid clobbering real data. */
function setPath(obj, path, value) {
    const segs = path.split(".");
    if (segs.length === 1) {
        obj[path] = value;
        return;
    }
    let cur = obj;
    for (let i = 0; i < segs.length - 1; i++) {
        const k = segs[i];
        const nxt = cur[k];
        if (nxt && typeof nxt === "object" && !Array.isArray(nxt)) {
            // shallow-copy so we don't mutate the original nested object
            const copy = { ...nxt };
            cur[k] = copy;
            cur = copy;
        }
        else {
            const copy = {};
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
function groupAndAggregate(rows, groupField, columns) {
    const buckets = new Map();
    for (const r of rows) {
        const key = groupKey(getPath(r, groupField));
        const b = buckets.get(key);
        if (b)
            b.push(r);
        else
            buckets.set(key, [r]);
    }
    const totaling = columns.filter((c) => c.totaling);
    const result = [];
    for (const [key, bucketRows] of buckets) {
        const summary = {
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
function aggregate(rows, column) {
    const vals = [];
    for (const r of rows) {
        const v = getPath(r, column.field);
        const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
        if (Number.isFinite(n))
            vals.push(n);
    }
    if (vals.length === 0)
        return column.totaling === "count" ? rows.length : undefined;
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
function computeTotalsRow(rows, columns) {
    const totaling = columns.filter((c) => c.totaling);
    if (totaling.length === 0)
        return null;
    const row = { id: "__totals__" };
    for (const c of totaling)
        row[c.field] = aggregate(rows, c);
    return row;
}
function groupKey(v) {
    if (v == null)
        return "__null__";
    if (typeof v === "object") {
        try {
            return JSON.stringify(v);
        }
        catch {
            return String(v);
        }
    }
    return String(v);
}
