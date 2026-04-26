import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { CHART_PALETTE } from "./_helpers";
import { cn } from "@/lib/cn";
export function Funnel({ data, className, valueFormatter = (v) => v.toLocaleString(), }) {
    const max = Math.max(...data.map((d) => d.value), 1);
    return (_jsx("div", { className: cn("flex flex-col gap-1", className), children: data.map((d, i) => {
            const pct = (d.value / max) * 100;
            const prevPct = i === 0 ? 100 : (data[i - 1].value / max) * 100;
            const conversion = i === 0 ? null : d.value / data[i - 1].value;
            return (_jsxs("div", { className: "flex items-center gap-3 text-sm", children: [_jsx("div", { className: "w-32 shrink-0 text-text-secondary truncate", children: d.label }), _jsx("div", { className: "flex-1 min-w-0 relative", children: _jsx("div", { className: "w-full h-7 bg-surface-2 rounded-md overflow-hidden", children: _jsx("div", { className: "h-full transition-all duration-base flex items-center px-2 text-xs font-medium", style: {
                                    width: `${pct}%`,
                                    background: d.color ?? CHART_PALETTE[i % CHART_PALETTE.length],
                                    color: "white",
                                }, children: valueFormatter(d.value) }) }) }), _jsx("div", { className: "w-16 shrink-0 text-right text-xs text-text-muted tabular-nums", children: conversion != null
                            ? `${Math.round(conversion * 100)}%`
                            : `${Math.round(prevPct)}%` })] }, i));
        }) }));
}
