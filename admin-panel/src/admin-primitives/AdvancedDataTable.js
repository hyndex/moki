import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import * as React from "react";
import { flexRender, getCoreRowModel, getFilteredRowModel, getSortedRowModel, useReactTable, } from "@tanstack/react-table";
import { ChevronDown, ChevronUp, ChevronsUpDown, GripVertical } from "lucide-react";
import { Checkbox } from "@/primitives/Checkbox";
import { EmptyStateFramework } from "./EmptyStateFramework";
import { Spinner } from "@/primitives/Spinner";
import { cn } from "@/lib/cn";
const DENSITY_HEIGHT = {
    comfortable: 44,
    compact: 36,
    dense: 28,
};
export function AdvancedDataTable({ rows, columns, getRowId, loading, onRowClick, onSelectionChange, stateKey, density = "compact", rowHeight, virtualizeAbove = 200, footer, className, emptyTitle, emptyDescription, }) {
    /* ------------ persisted state ------------ */
    const persisted = loadState(stateKey);
    const [sorting, setSorting] = React.useState(persisted.sorting ?? []);
    const [columnVisibility, setColumnVisibility] = React.useState(persisted.visibility ?? {});
    const [columnPinning, setColumnPinning] = React.useState(persisted.pinning ?? { left: [], right: [] });
    const [columnOrder, setColumnOrder] = React.useState(persisted.order ?? columns.map((c) => (c.id ?? c.accessorKey ?? "")));
    const [rowSelection, setRowSelection] = React.useState({});
    React.useEffect(() => {
        if (!stateKey)
            return;
        saveState(stateKey, { sorting, visibility: columnVisibility, pinning: columnPinning, order: columnOrder });
    }, [stateKey, sorting, columnVisibility, columnPinning, columnOrder]);
    /* ------------ table instance ------------ */
    const table = useReactTable({
        data: rows,
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
        if (!onSelectionChange)
            return;
        const selectedIds = Object.keys(rowSelection).filter((k) => rowSelection[k]);
        const selectedRows = table
            .getFilteredSelectedRowModel()
            .rows.map((r) => r.original);
        onSelectionChange(selectedIds, selectedRows);
    }, [rowSelection, onSelectionChange, table]);
    /* ------------ virtualization ------------ */
    const containerRef = React.useRef(null);
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
        return (_jsxs("div", { className: cn("flex items-center justify-center gap-2 py-10 text-xs text-text-muted", className), children: [_jsx(Spinner, { size: 12 }), " Loading\u2026"] }));
    }
    if (rows.length === 0) {
        return (_jsx(EmptyStateFramework, { kind: "no-results", title: emptyTitle ?? "No records match", description: emptyDescription ?? "Try removing a filter or broadening your search." }));
    }
    return (_jsx("div", { ref: containerRef, className: cn("relative overflow-auto border border-border rounded-md bg-surface-0", className), style: virtualize ? { maxHeight: viewportHeight } : undefined, onScroll: (e) => virtualize && setScrollTop(e.currentTarget.scrollTop), role: "grid", "aria-rowcount": rowCount, children: _jsxs("table", { className: "w-full text-sm", style: { tableLayout: "fixed" }, children: [_jsx("thead", { className: "sticky top-0 z-10 bg-surface-1 border-b border-border", children: table.getHeaderGroups().map((headerGroup) => (_jsx("tr", { children: headerGroup.headers.map((header) => {
                            const sorted = header.column.getIsSorted();
                            const canSort = header.column.getCanSort();
                            return (_jsx("th", { className: cn("px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-text-muted select-none", canSort && "cursor-pointer hover:text-text-primary"), style: { width: header.getSize() }, "aria-sort": sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : "none", onClick: canSort ? header.column.getToggleSortingHandler() : undefined, children: header.isPlaceholder ? null : (_jsxs("div", { className: "flex items-center gap-1", children: [_jsx(GripVertical, { className: "h-3 w-3 text-text-muted opacity-0 group-hover:opacity-100", "aria-hidden": true }), _jsx("span", { className: "flex-1 truncate", children: flexRender(header.column.columnDef.header, header.getContext()) }), canSort && (_jsx("span", { className: "shrink-0", children: sorted === "asc" ? (_jsx(ChevronUp, { className: "h-3 w-3" })) : sorted === "desc" ? (_jsx(ChevronDown, { className: "h-3 w-3" })) : (_jsx(ChevronsUpDown, { className: "h-3 w-3 opacity-40" })) }))] })) }, header.id));
                        }) }, headerGroup.id))) }), _jsxs("tbody", { children: [virtualize && padTop > 0 && (_jsx("tr", { style: { height: padTop }, "aria-hidden": "true", children: _jsx("td", { colSpan: table.getAllColumns().length }) })), virtualRows.map((row, idx) => (_jsx("tr", { role: "row", "aria-rowindex": startIndex + idx + 1, "aria-selected": row.getIsSelected() || undefined, className: cn("border-b border-border-subtle last:border-b-0 hover:bg-surface-1 cursor-pointer", row.getIsSelected() && "bg-accent-subtle"), style: { height }, onClick: () => onRowClick?.(row.original), children: row.getVisibleCells().map((cell) => (_jsx("td", { className: "px-3 py-0 truncate align-middle", style: { width: cell.column.getSize(), height }, children: flexRender(cell.column.columnDef.cell, cell.getContext()) }, cell.id))) }, row.id))), virtualize && padBottom > 0 && (_jsx("tr", { style: { height: padBottom }, "aria-hidden": "true", children: _jsx("td", { colSpan: table.getAllColumns().length }) }))] }), footer && (_jsx("tfoot", { className: "sticky bottom-0 bg-surface-1 border-t-2 border-border", children: _jsx("tr", { children: _jsx("td", { colSpan: table.getAllColumns().length, className: "px-3 py-2", children: footer(rows) }) }) }))] }) }));
}
function loadState(key) {
    if (!key || typeof window === "undefined")
        return {};
    try {
        const raw = window.localStorage.getItem(`gutu-adv-table.${key}`);
        return raw ? JSON.parse(raw) : {};
    }
    catch {
        return {};
    }
}
function saveState(key, state) {
    if (typeof window === "undefined")
        return;
    try {
        window.localStorage.setItem(`gutu-adv-table.${key}`, JSON.stringify(state));
    }
    catch {
        /* quota */
    }
}
/** Convenience helper for a row-selection checkbox column.
 *  Drop in as the first entry in columns. */
export function selectionColumn() {
    return {
        id: "__select",
        size: 36,
        enableSorting: false,
        header: ({ table }) => (_jsx(Checkbox, { checked: table.getIsAllRowsSelected() || (table.getIsSomeRowsSelected() && "indeterminate"), onCheckedChange: (v) => table.toggleAllRowsSelected(Boolean(v)), "aria-label": "Select all" })),
        cell: ({ row }) => (_jsx(Checkbox, { checked: row.getIsSelected(), onCheckedChange: (v) => row.toggleSelected(Boolean(v)), "aria-label": "Select row", onClick: (e) => e.stopPropagation() })),
    };
}
