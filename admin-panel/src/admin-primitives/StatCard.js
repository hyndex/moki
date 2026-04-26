import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { Sparkline } from "./charts/Sparkline";
const INTENT_ACCENT = {
    neutral: "text-text-muted",
    accent: "text-accent",
    success: "text-intent-success",
    warning: "text-intent-warning",
    danger: "text-intent-danger",
    info: "text-intent-info",
};
export function StatCard({ label, value, secondary, trend, icon, spark, sparkColor, intent = "neutral", className, }) {
    return (_jsxs("div", { className: cn("rounded-lg border border-border bg-surface-0 p-4 shadow-xs", "flex flex-col gap-2 min-w-0", className), children: [_jsxs("div", { className: "flex items-start justify-between gap-2", children: [_jsxs("div", { className: "flex items-center gap-1.5 text-xs font-medium text-text-muted uppercase tracking-wide", children: [icon && _jsx("span", { className: INTENT_ACCENT[intent], children: icon }), _jsx("span", { children: label })] }), trend && (_jsxs("span", { className: cn("inline-flex items-center gap-0.5 text-xs font-medium tabular-nums", trend.positive ? "text-intent-success" : "text-intent-danger"), children: [trend.positive ? (_jsx(ArrowUpRight, { className: "h-3 w-3" })) : (_jsx(ArrowDownRight, { className: "h-3 w-3" })), Math.abs(trend.value), "%"] }))] }), _jsxs("div", { className: "flex items-baseline justify-between gap-2", children: [_jsx("div", { className: "text-2xl font-semibold text-text-primary leading-none tabular-nums truncate", children: value }), spark && spark.length > 1 && (_jsx(Sparkline, { data: spark, width: 72, height: 24, color: sparkColor }))] }), (secondary || trend?.label) && (_jsxs("div", { className: "text-xs text-text-muted", children: [secondary, " ", trend?.label && _jsx("span", { className: "ml-1", children: trend.label })] }))] }));
}
