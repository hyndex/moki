import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import * as React from "react";
import { ArrowUpRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../Card";
import { LineChart } from "../charts/LineChart";
import { BarChart } from "../charts/BarChart";
import { Donut } from "../charts/Donut";
import { Funnel } from "../charts/Funnel";
import { Sparkline } from "../charts/Sparkline";
import { EmptyStateFramework } from "../EmptyStateFramework";
import { Spinner } from "@/primitives/Spinner";
import { useAggregation } from "@/runtime/useAggregation";
import { formatValue } from "./formatters";
import { mergeFilters, useWorkspaceFilter } from "./workspaceFilter";
import { useRegistries } from "@/host/pluginHostContext";
export function ChartWidget({ widget }) {
    const workspaceFilter = useWorkspaceFilter(widget.aggregation.resource);
    const effectiveSpec = React.useMemo(() => workspaceFilter
        ? {
            ...widget.aggregation,
            filter: mergeFilters(widget.aggregation.filter, workspaceFilter),
        }
        : widget.aggregation, [widget.aggregation, workspaceFilter]);
    const { data, loading } = useAggregation(effectiveSpec);
    const fmt = (v) => formatValue(v, widget.format, widget.currency);
    const onOpen = widget.drilldown
        ? () => (window.location.hash = widget.drilldown)
        : undefined;
    return (_jsxs(Card, { className: "h-full flex flex-col", children: [_jsx(CardHeader, { children: _jsxs("div", { className: "flex items-start justify-between w-full", children: [_jsxs("div", { children: [_jsx(CardTitle, { children: widget.label }), widget.description && _jsx(CardDescription, { children: widget.description })] }), onOpen && (_jsx("button", { type: "button", onClick: onOpen, className: "text-text-muted hover:text-text-primary", "aria-label": "Open report", children: _jsx(ArrowUpRight, { className: "h-4 w-4" }) }))] }) }), _jsx(CardContent, { className: "flex-1 flex flex-col", children: loading && !data ? (_jsxs("div", { className: "flex-1 flex items-center justify-center text-xs text-text-muted gap-2", children: [_jsx(Spinner, { size: 12 }), " Loading\u2026"] })) : !data || (!data.series?.length && !data.groups?.length) ? (_jsx(EmptyStateFramework, { kind: "no-results" })) : (_jsx(ChartBody, { widget: widget, data: data, fmt: fmt })) })] }));
}
function ChartBody({ widget, data, fmt, }) {
    const height = widget.height ?? 200;
    if (widget.chart === "line" || widget.chart === "area") {
        const series = data.series ?? [];
        return (_jsx(LineChart, { xLabels: series.map((s) => s.label), series: [{ label: widget.label, data: series.map((s) => s.value) }], height: height, valueFormatter: fmt, area: widget.chart === "area" }));
    }
    if (widget.chart === "bar") {
        const rows = data.series ?? data.groups ?? [];
        return _jsx(BarChart, { data: rows, height: height, valueFormatter: fmt });
    }
    if (widget.chart === "donut") {
        return _jsx(Donut, { data: data.groups ?? [] });
    }
    if (widget.chart === "funnel") {
        return _jsx(Funnel, { data: data.groups ?? [] });
    }
    if (widget.chart === "sparkline") {
        return _jsx(Sparkline, { data: (data.series ?? []).map((s) => s.value) });
    }
    /* Plugin-contributed chart kind — registries.chartKinds fallback. */
    return _jsx(PluginContributedChart, { widget: widget, data: data, fmt: fmt });
}
function PluginContributedChart({ widget, data, fmt, }) {
    const registries = useRegistries();
    const spec = registries?.chartKinds.get(widget.chart);
    if (!spec) {
        return (_jsxs("div", { className: "text-xs text-text-muted p-2 border border-dashed border-border rounded", children: ["Unknown chart kind \"", _jsx("code", { className: "font-mono", children: widget.chart }), "\"."] }));
    }
    const Render = spec.render;
    return _jsx(Render, { data: data, height: widget.height, format: fmt });
}
