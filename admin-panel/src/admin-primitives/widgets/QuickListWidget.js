import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import * as React from "react";
import { ArrowUpRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../Card";
import { EmptyStateFramework } from "../EmptyStateFramework";
import { Spinner } from "@/primitives/Spinner";
import { useList } from "@/runtime/hooks";
import { filterRows } from "@/lib/filterEngine";
import { mergeFilters, useWorkspaceFilter } from "./workspaceFilter";
export function QuickListWidget({ widget }) {
    const workspaceFilter = useWorkspaceFilter(widget.resource);
    const { data, loading } = useList(widget.resource, {
        page: 1,
        // Grab a larger window when a workspace filter is in play, so post-fetch
        // client-side filtering still gives us `limit` visible rows.
        pageSize: workspaceFilter ? Math.max((widget.limit ?? 10) * 5, 50) : widget.limit ?? 10,
        sort: widget.sort,
    });
    const allRecords = (data?.rows ?? []);
    const effectiveFilter = React.useMemo(() => mergeFilters(widget.filter, workspaceFilter), [widget.filter, workspaceFilter]);
    const filtered = effectiveFilter ? filterRows(allRecords, effectiveFilter) : allRecords;
    const records = filtered.slice(0, widget.limit ?? 10);
    return (_jsxs(Card, { className: "h-full flex flex-col", children: [_jsx(CardHeader, { children: _jsx(CardTitle, { children: widget.label }) }), _jsx(CardContent, { className: "p-0 flex-1 overflow-hidden", children: loading && records.length === 0 ? (_jsxs("div", { className: "flex-1 flex items-center justify-center gap-2 py-6 text-xs text-text-muted", children: [_jsx(Spinner, { size: 12 }), " Loading\u2026"] })) : records.length === 0 ? (_jsx(EmptyStateFramework, { kind: "cleared" })) : (_jsx("ul", { className: "divide-y divide-border-subtle", children: records.map((record) => {
                        const primary = String(record[widget.primary] ?? "—");
                        const secondary = widget.secondary
                            ? String(record[widget.secondary] ?? "")
                            : null;
                        const href = widget.href?.(record);
                        const inner = (_jsxs("div", { className: "flex items-center gap-2 px-3 py-2 hover:bg-surface-1 group", children: [_jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("div", { className: "text-sm font-medium text-text-primary truncate", children: primary }), secondary && (_jsx("div", { className: "text-xs text-text-muted truncate", children: secondary }))] }), href && (_jsx(ArrowUpRight, { className: "h-3.5 w-3.5 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity" }))] }));
                        return (_jsx("li", { children: href ? (_jsx("a", { href: `#${href}`, className: "block", children: inner })) : (inner) }, String(record.id ?? primary)));
                    }) })) })] }));
}
