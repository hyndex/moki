import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import * as React from "react";
import { ArrowUpRight } from "lucide-react";
import * as Icons from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./Card";
import { useAggregation } from "@/runtime/useAggregation";
import { cn } from "@/lib/cn";
function Icon({ name }) {
    if (!name)
        return null;
    const C = Icons[name];
    if (!C)
        return null;
    return _jsx(C, { className: "h-3.5 w-3.5 text-text-muted" });
}
export function ConnectionsPanel({ descriptor, parent, title = "Connections", className, }) {
    return (_jsxs(Card, { className: className, children: [_jsx(CardHeader, { children: _jsx(CardTitle, { children: title }) }), _jsx(CardContent, { className: "p-0", children: descriptor.categories.length === 0 ? (_jsx("div", { className: "px-3 py-4 text-xs text-text-muted", children: "No connections defined." })) : (_jsx("ul", { className: "divide-y divide-border-subtle", children: descriptor.categories.map((cat) => (_jsx(CategoryRow, { category: cat, parent: parent }, cat.id))) })) })] }));
}
function CategoryRow({ category, parent, }) {
    return (_jsxs("li", { className: "py-2", children: [_jsx("div", { className: "px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-text-muted", children: category.label }), _jsx("ul", { children: category.items.map((item) => (_jsx(ConnectionRow, { item: item, parent: parent }, item.id))) })] }));
}
function ConnectionRow({ item, parent, }) {
    const filter = React.useMemo(() => item.filter(parent), [item, parent]);
    const { data, loading } = useAggregation({
        resource: item.resource,
        fn: "count",
        filter,
    });
    const href = item.href?.(parent);
    const inner = (_jsxs("div", { className: cn("flex items-center gap-2 px-3 py-1.5 group", href && "hover:bg-surface-1 cursor-pointer"), children: [_jsx(Icon, { name: item.icon }), _jsx("span", { className: "flex-1 text-sm text-text-primary truncate", children: item.label }), _jsx("span", { className: "text-xs tabular-nums text-text-muted min-w-[2ch] text-right", children: loading && !data ? "…" : data?.count ?? 0 }), href && (_jsx(ArrowUpRight, { className: "h-3 w-3 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity" }))] }));
    return (_jsx("li", { children: href ? (_jsx("a", { href: `#${href}`, className: "block", children: inner })) : (inner) }));
}
