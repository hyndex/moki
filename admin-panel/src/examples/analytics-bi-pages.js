import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { defineCustomView } from "@/builders";
import { PageHeader } from "@/admin-primitives/PageHeader";
import { MetricGrid } from "@/admin-primitives/MetricGrid";
import { Card, CardContent, CardHeader, CardTitle } from "@/admin-primitives/Card";
import { EmptyState } from "@/admin-primitives/EmptyState";
import { LineChart } from "@/admin-primitives/charts/LineChart";
import { Donut } from "@/admin-primitives/charts/Donut";
import { Spinner } from "@/primitives/Spinner";
import { useAnalyticsArr, useAnalyticsCohorts, useAnalyticsRevenueMix, } from "./_shared/live-hooks";
export const analyticsDashboardView = defineCustomView({
    id: "analytics-bi.dashboard.view",
    title: "Executive dashboard",
    description: "Cross-plugin KPIs at a glance.",
    resource: "analytics-bi.report",
    render: () => _jsx(ExecutiveDashboard, {}),
});
function ExecutiveDashboard() {
    const { data: arrRows, loading: arrLoading } = useAnalyticsArr();
    const { data: mix } = useAnalyticsRevenueMix();
    const { data: cohorts } = useAnalyticsCohorts();
    if (arrLoading && arrRows.length === 0)
        return _jsx(PendingShell, {});
    const arr = arrRows[0];
    const months = arr?.series.map((s) => s.x) ?? [];
    const arrSeries = arr?.series.map((s) => s.y / 1000) ?? [];
    return (_jsxs("div", { className: "flex flex-col gap-4", children: [_jsx(PageHeader, { title: "Executive dashboard", description: "Composed from multiple plugins." }), _jsx(MetricGrid, { columns: 5, metrics: [
                    {
                        label: "ARR",
                        value: arr ? `$${(arr.latest / 1_000_000).toFixed(2)}M` : "—",
                        trend: arr
                            ? { value: arr.yoyPct, positive: arr.yoyPct >= 0, label: "yoy" }
                            : undefined,
                    },
                    { label: "Net retention", value: "112%", trend: { value: 3, positive: true } },
                    { label: "CAC payback", value: "8.2 mo" },
                    { label: "Gross margin", value: "76%" },
                    { label: "Burn", value: "$42K/mo", trend: { value: 6, positive: false } },
                ] }), _jsxs("div", { className: "grid gap-3 lg:grid-cols-2", children: [_jsxs(Card, { children: [_jsx(CardHeader, { children: _jsx("div", { children: _jsx(CardTitle, { children: "ARR trajectory" }) }) }), _jsx(CardContent, { children: months.length > 0 ? (_jsx(LineChart, { xLabels: months, series: [{ label: "ARR", data: arrSeries }], valueFormatter: (v) => `$${Math.round(v)}K`, height: 220 })) : (_jsx(EmptyState, { title: "No ARR data", description: "Seed the analytics.arr resource." })) })] }), _jsxs(Card, { children: [_jsx(CardHeader, { children: _jsx("div", { children: _jsx(CardTitle, { children: "Revenue mix" }) }) }), _jsx(CardContent, { children: mix.length > 0 ? (_jsx(Donut, { data: mix.map((m) => ({ label: m.segment, value: Math.round(m.value / 1000) })) })) : (_jsx(EmptyState, { title: "No mix data" })) })] })] }), _jsxs(Card, { children: [_jsx(CardHeader, { children: _jsx("div", { children: _jsx(CardTitle, { children: "Cohort retention (monthly)" }) }) }), _jsx(CardContent, { children: cohorts.length === 0 ? (_jsx(EmptyState, { title: "No cohort data" })) : (_jsxs("table", { className: "w-full text-xs", children: [_jsx("thead", { children: _jsxs("tr", { className: "text-text-muted", children: [_jsx("th", { className: "text-left pl-2", children: "Cohort" }), [0, 1, 2, 3, 4, 5].map((m) => (_jsxs("th", { className: "text-right pr-2", children: ["M", m] }, m)))] }) }), _jsx("tbody", { children: cohorts.map((c) => (_jsxs("tr", { className: "border-t border-border-subtle", children: [_jsx("td", { className: "py-1.5 pl-2 text-text-secondary font-medium", children: c.cohort }), [0, 1, 2, 3, 4, 5].map((m) => {
                                                const cell = c.monthly.find((x) => x.monthOffset === m);
                                                if (!cell)
                                                    return _jsx("td", { className: "pr-2", "aria-hidden": true }, m);
                                                const intensity = (cell.retentionPct - 50) / 50;
                                                return (_jsxs("td", { className: "pr-2 py-1.5 text-right tabular-nums", style: {
                                                        background: `rgba(79, 70, 229, ${0.08 + intensity * 0.35})`,
                                                        color: intensity > 0.6 ? "white" : "rgb(var(--text-primary))",
                                                    }, children: [cell.retentionPct, "%"] }, m));
                                            })] }, c.id))) })] })) })] })] }));
}
function PendingShell() {
    return (_jsxs("div", { className: "h-full w-full flex items-center justify-center gap-2 text-sm text-text-muted py-16", children: [_jsx(Spinner, { size: 14 }), "Loading\u2026"] }));
}
