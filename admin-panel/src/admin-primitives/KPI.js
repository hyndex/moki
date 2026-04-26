import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { cn } from "@/lib/cn";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
export function KPI({ label, value, helper, trend, className }) {
    return (_jsxs("div", { className: cn("rounded-lg border border-border bg-surface-0 p-4 flex flex-col gap-1", className), children: [_jsx("div", { className: "text-xs font-medium text-text-muted uppercase tracking-wide", children: label }), _jsx("div", { className: "text-2xl font-semibold text-text-primary leading-none", children: value }), (helper || trend) && (_jsxs("div", { className: "flex items-center gap-2 mt-1", children: [trend && (_jsxs("span", { className: cn("inline-flex items-center gap-0.5 text-xs font-medium", trend.positive
                            ? "text-intent-success"
                            : "text-intent-danger"), children: [trend.positive ? (_jsx(ArrowUpRight, { className: "h-3 w-3" })) : (_jsx(ArrowDownRight, { className: "h-3 w-3" })), Math.abs(trend.value), "%", trend.label && (_jsx("span", { className: "text-text-muted font-normal ml-1", children: trend.label }))] })), helper && _jsx("span", { className: "text-xs text-text-muted", children: helper })] }))] }));
}
