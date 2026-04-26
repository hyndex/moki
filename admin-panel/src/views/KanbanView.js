import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import * as React from "react";
import { PageHeader } from "@/admin-primitives/PageHeader";
import { LiveDnDKanban } from "@/admin-primitives/LiveDnDKanban";
import { Toolbar, ToolbarSeparator } from "@/admin-primitives/Toolbar";
import { FilterBar } from "@/admin-primitives/FilterBar";
import { QueryBuilder } from "@/admin-primitives/QueryBuilder";
import { evalFilter, getPath } from "@/lib/filterEngine";
import { navigateTo } from "./useRoute";
/** KanbanView renderer — wraps LiveDnDKanban with a toolbar that exposes
 *  search + simple filters + the advanced QueryBuilder. All filtering is
 *  client-side — the resource is already fetched page-wise into the kanban. */
export function KanbanViewRenderer({ view, basePath }) {
    const [search, setSearch] = React.useState("");
    const [simpleFilters, setSimpleFilters] = React.useState({});
    const [filterTree, setFilterTree] = React.useState();
    const qbFields = React.useMemo(() => {
        if (!view.advancedFilterFields)
            return [];
        return view.advancedFilterFields.map((f) => ({
            field: f.field,
            label: f.label ?? humanize(f.field),
            kind: (f.kind ?? "text"),
            options: f.options,
        }));
    }, [view.advancedFilterFields]);
    const searchFields = React.useMemo(() => view.searchFields ?? DEFAULT_SEARCH_FIELDS, [view.searchFields]);
    const combinedFilter = React.useCallback((row) => {
        // 1) view-level imperative filter
        if (view.filter && !view.filter(row))
            return false;
        // 2) search
        if (search) {
            const needle = search.toLowerCase();
            const hit = searchFields.some((f) => {
                const v = getPath(row, f);
                return typeof v === "string" && v.toLowerCase().includes(needle);
            });
            if (!hit)
                return false;
        }
        // 3) simple chip filters
        for (const [field, val] of Object.entries(simpleFilters)) {
            if (val === undefined || val === null || val === "")
                continue;
            const cellValue = getPath(row, field);
            if (Array.isArray(val)) {
                if (!val.includes(cellValue))
                    return false;
            }
            else if (cellValue !== val) {
                return false;
            }
        }
        // 4) advanced QueryBuilder
        if (filterTree && !evalFilter(row, filterTree))
            return false;
        return true;
    }, [view.filter, search, searchFields, simpleFilters, filterTree]);
    const showToolbar = view.search !== false ||
        (view.filters && view.filters.length > 0) ||
        qbFields.length > 0;
    return (_jsxs("div", { className: "flex flex-col gap-4", children: [_jsx(PageHeader, { title: view.title, description: view.description }), showToolbar && (_jsxs(Toolbar, { children: [qbFields.length > 0 && (_jsxs(_Fragment, { children: [_jsx(QueryBuilder, { fields: qbFields, value: filterTree, onChange: setFilterTree }), _jsx(ToolbarSeparator, {})] })), _jsx(FilterBar, { search: view.search !== false, searchValue: search, onSearchChange: setSearch, filters: view.filters, filterValues: simpleFilters, onFilterChange: setSimpleFilters })] })), _jsx(LiveDnDKanban, { resource: view.resource, statusField: view.statusField, columns: view.columns.map((c) => ({
                    id: c.id,
                    title: c.title,
                    intent: c.intent,
                    wipLimit: c.wipLimit,
                })), filter: combinedFilter, pageSize: view.pageSize, onCardClick: (row) => navigateTo(view.cardPath
                    ? view.cardPath(row)
                    : `${basePath}/${String(row.id)}`), renderCard: (row) => view.renderCard(row) })] }));
}
const DEFAULT_SEARCH_FIELDS = [
    "name",
    "title",
    "label",
    "code",
    "subject",
    "summary",
    "description",
];
function humanize(field) {
    const last = field.split(".").pop() ?? field;
    return last
        .replace(/([A-Z])/g, " $1")
        .replace(/^./, (c) => c.toUpperCase())
        .replace(/_/g, " ")
        .trim();
}
