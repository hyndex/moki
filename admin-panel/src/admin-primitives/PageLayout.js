import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { cn } from "@/lib/cn";
/** Flexible page layout primitives — designed to be mixed per page so the
 *  plugin can choose the right structure without re-implementing grids. */
export function PageGrid({ columns = 1, className, children, }) {
    const map = {
        1: "grid-cols-1",
        2: "grid-cols-1 lg:grid-cols-2",
        3: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
        4: "grid-cols-1 md:grid-cols-2 lg:grid-cols-4",
        6: "grid-cols-2 md:grid-cols-3 lg:grid-cols-6",
        12: "grid-cols-12",
    };
    return _jsx("div", { className: cn("grid gap-3", map[columns], className), children: children });
}
export function Col({ span = 1, className, children, }) {
    const SPAN = {
        1: "lg:col-span-1",
        2: "lg:col-span-2",
        3: "lg:col-span-3",
        4: "lg:col-span-4",
        5: "lg:col-span-5",
        6: "lg:col-span-6",
        7: "lg:col-span-7",
        8: "lg:col-span-8",
        9: "lg:col-span-9",
        10: "lg:col-span-10",
        11: "lg:col-span-11",
        12: "col-span-full",
    };
    return _jsx("div", { className: cn(SPAN[span], className), children: children });
}
export function SplitLayout({ className, children, ratio = "2fr_1fr", gap = "gap-4", }) {
    const template = ratio.split("_").join(" ");
    return (_jsx("div", { className: cn("grid", gap, className), style: { gridTemplateColumns: `minmax(0, 1fr)` }, children: _jsx("div", { className: cn("grid", gap), style: { gridTemplateColumns: template }, children: children }) }));
}
export function Section({ title, description, actions, className, children, bare, }) {
    return (_jsxs("section", { className: cn(!bare && "rounded-lg border border-border bg-surface-0 shadow-xs", className), children: [(title || actions) && (_jsxs("header", { className: cn("flex items-start justify-between gap-3", !bare
                    ? "px-4 py-3 border-b border-border-subtle"
                    : "pb-2"), children: [_jsxs("div", { className: "min-w-0", children: [title && (_jsx("h3", { className: "text-sm font-semibold text-text-primary", children: title })), description && (_jsx("p", { className: "text-xs text-text-muted mt-0.5", children: description }))] }), actions && (_jsx("div", { className: "flex items-center gap-2 shrink-0", children: actions }))] })), _jsx("div", { className: cn(!bare && "p-4"), children: children })] }));
}
export function Inline({ className, gap = "gap-2", children, wrap, align, }) {
    return (_jsx("div", { className: cn("flex", gap, wrap && "flex-wrap", align === "start" && "items-start", align === "center" && "items-center", align === "end" && "items-end", align === "baseline" && "items-baseline", !align && "items-center", className), children: children }));
}
export function Stack({ className, gap = "gap-3", children, }) {
    return _jsx("div", { className: cn("flex flex-col", gap, className), children: children });
}
