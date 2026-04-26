import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { ChevronDown, ChevronUp, ChevronsUpDown, ChevronLeft, ChevronRight, } from "lucide-react";
import { cn } from "@/lib/cn";
import { Checkbox } from "@/primitives/Checkbox";
import { Button } from "@/primitives/Button";
import { Skeleton } from "./Skeleton";
export function DataTable({ columns, data, total, page = 1, pageSize = 25, loading, rowKey = (row, i) => String(row.id ?? i), onRowClick, selection, sort, onSortChange, onPageChange, emptyState, className, }) {
    const pageCount = total != null ? Math.max(1, Math.ceil(total / pageSize)) : 1;
    const allIds = data.map((r, i) => rowKey(r, i));
    const allSelected = selection != null && allIds.length > 0 && allIds.every((id) => selection.selected.has(id));
    const someSelected = selection != null && allIds.some((id) => selection.selected.has(id));
    const toggleAll = () => {
        if (!selection)
            return;
        const next = new Set(selection.selected);
        if (allSelected) {
            for (const id of allIds)
                next.delete(id);
        }
        else {
            for (const id of allIds)
                next.add(id);
        }
        selection.onChange(next);
    };
    const toggleRow = (id) => {
        if (!selection)
            return;
        const next = new Set(selection.selected);
        if (next.has(id))
            next.delete(id);
        else
            next.add(id);
        selection.onChange(next);
    };
    const handleSort = (col) => {
        if (!col.sortable || !onSortChange)
            return;
        const key = col.sortKey ?? col.id;
        if (sort?.field !== key)
            onSortChange({ field: key, dir: "asc" });
        else if (sort.dir === "asc")
            onSortChange({ field: key, dir: "desc" });
        else
            onSortChange(null);
    };
    return (_jsxs("div", { className: cn("flex flex-col", className), children: [_jsx("div", { className: "overflow-auto rounded-md border border-border bg-surface-0", children: _jsxs("table", { className: "w-full text-sm border-collapse", children: [_jsx("thead", { className: "bg-surface-1 border-b border-border sticky top-0 z-[1]", children: _jsxs("tr", { children: [selection && (_jsx("th", { className: "w-9 px-3", style: { height: "var(--row-h)" }, children: _jsx(Checkbox, { checked: allSelected
                                                ? true
                                                : someSelected
                                                    ? "indeterminate"
                                                    : false, onCheckedChange: toggleAll, "aria-label": "Select all" }) })), columns.map((col) => {
                                        const key = col.sortKey ?? col.id;
                                        const active = sort?.field === key;
                                        return (_jsx("th", { className: cn("px-3 text-left font-medium text-text-secondary text-xs uppercase tracking-wide", col.align === "right" && "text-right", col.align === "center" && "text-center", col.sortable && "cursor-pointer select-none hover:text-text-primary"), style: {
                                                width: col.width,
                                                height: "var(--row-h)",
                                                paddingTop: 0,
                                                paddingBottom: 0,
                                            }, onClick: () => handleSort(col), "aria-sort": active ? (sort?.dir === "asc" ? "ascending" : "descending") : "none", children: _jsxs("span", { className: "inline-flex items-center gap-1 align-middle", children: [col.header, col.sortable && (_jsx("span", { className: "text-text-muted", children: active ? (sort?.dir === "asc" ? (_jsx(ChevronUp, { className: "h-3 w-3" })) : (_jsx(ChevronDown, { className: "h-3 w-3" }))) : (_jsx(ChevronsUpDown, { className: "h-3 w-3 opacity-50" })) }))] }) }, col.id));
                                    })] }) }), _jsx("tbody", { children: loading && data.length === 0 ? (Array.from({ length: 6 }).map((_, i) => (_jsxs("tr", { className: "border-b border-border-subtle", children: [selection && (_jsx("td", { className: "px-3", style: { height: "var(--row-h)" }, children: _jsx(Skeleton, { className: "h-4 w-4" }) })), columns.map((c) => (_jsx("td", { className: "px-3", style: { height: "var(--row-h)" }, children: _jsx(Skeleton, { className: "h-3 w-[60%]" }) }, c.id)))] }, `sk-${i}`)))) : data.length === 0 ? (_jsx("tr", { children: _jsx("td", { colSpan: columns.length + (selection ? 1 : 0), className: "text-center py-10 text-text-muted", children: emptyState ?? "No results" }) })) : (data.map((row, i) => {
                                const id = rowKey(row, i);
                                const isSelected = selection?.selected.has(id);
                                return (_jsxs("tr", { className: cn("border-b border-border-subtle last:border-b-0", "transition-colors", onRowClick && "cursor-pointer hover:bg-surface-1", isSelected && "bg-accent-subtle/40"), onClick: (e) => {
                                        if (e.target.closest("[data-stop-row]"))
                                            return;
                                        onRowClick?.(row);
                                    }, children: [selection && (_jsx("td", { className: "px-3", style: { height: "var(--row-h)" }, "data-stop-row": true, children: _jsx(Checkbox, { checked: !!isSelected, onCheckedChange: () => toggleRow(id), "aria-label": `Select row ${id}` }) })), columns.map((col) => (_jsx("td", { className: cn("px-3 text-text-primary", col.align === "right" && "text-right", col.align === "center" && "text-center"), style: {
                                                height: "var(--row-h)",
                                                width: col.width,
                                            }, children: col.cell(row) }, col.id)))] }, id));
                            })) })] }) }), total != null && total > pageSize && (_jsxs("div", { className: "flex items-center justify-between py-3 text-sm text-text-muted", children: [_jsxs("div", { children: [(page - 1) * pageSize + 1, "\u2013", Math.min(page * pageSize, total), " of ", total] }), _jsxs("div", { className: "flex items-center gap-1", children: [_jsx(Button, { size: "sm", variant: "ghost", disabled: page <= 1, onClick: () => onPageChange?.(page - 1), "aria-label": "Previous page", children: _jsx(ChevronLeft, { className: "h-3.5 w-3.5" }) }), _jsxs("span", { className: "px-2 text-text-secondary", children: ["Page ", page, " / ", pageCount] }), _jsx(Button, { size: "sm", variant: "ghost", disabled: page >= pageCount, onClick: () => onPageChange?.(page + 1), "aria-label": "Next page", children: _jsx(ChevronRight, { className: "h-3.5 w-3.5" }) })] })] }))] }));
}
