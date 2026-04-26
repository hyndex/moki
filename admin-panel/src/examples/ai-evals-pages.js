import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Play } from "lucide-react";
import { defineCustomView } from "@/builders";
import { PageHeader } from "@/admin-primitives/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/admin-primitives/Card";
import { MetricGrid } from "@/admin-primitives/MetricGrid";
import { Button } from "@/primitives/Button";
import { Badge } from "@/primitives/Badge";
import { BarChart } from "@/admin-primitives/charts/BarChart";
import { Timeline } from "@/admin-primitives/Timeline";
import { EmptyState } from "@/admin-primitives/EmptyState";
import { Spinner } from "@/primitives/Spinner";
import { useAllRecords } from "@/runtime/hooks";
export const aiEvalsRunView = defineCustomView({
    id: "ai-evals.run-detail.view",
    title: "Run detail",
    description: "Breakdown of the latest eval run.",
    resource: "ai-evals.run",
    render: () => _jsx(AiEvalsRunDetailPage, {}),
});
function AiEvalsRunDetailPage() {
    const { data: runs, loading: runsLoading } = useAllRecords("ai-evals.run");
    const { data: cases } = useAllRecords("ai-evals.case");
    if (runsLoading && runs.length === 0) {
        return (_jsxs("div", { className: "py-16 flex items-center justify-center text-sm text-text-muted gap-2", children: [_jsx(Spinner, { size: 14 }), " Loading\u2026"] }));
    }
    const run = runs.sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1))[0];
    if (!run) {
        return (_jsx(EmptyState, { title: "No eval runs", description: "Seed the ai-evals.run resource to see this page." }));
    }
    const scoped = cases.filter((c) => c.runId === run.id);
    const passed = scoped.filter((c) => c.pass).length;
    const passRate = scoped.length > 0 ? Math.round((passed / scoped.length) * 100) : run.passRate;
    const avgLatency = scoped.length > 0
        ? Math.round(scoped.reduce((a, c) => a + c.latencyMs, 0) / scoped.length)
        : 0;
    const failures = scoped.filter((c) => !c.pass).slice(0, 5);
    const byCategory = {};
    for (const c of scoped) {
        const b = byCategory[c.category] ?? { pass: 0, total: 0 };
        b.total++;
        if (c.pass)
            b.pass++;
        byCategory[c.category] = b;
    }
    const categoryData = Object.entries(byCategory).map(([label, v]) => ({
        label,
        value: v.total > 0 ? Math.round((v.pass / v.total) * 100) : 0,
    }));
    return (_jsxs("div", { className: "flex flex-col gap-4", children: [_jsx(PageHeader, { title: `Run detail · ${run.suite}`, description: `${run.model} · ${new Date(run.startedAt).toLocaleString()} · ${Math.floor(run.durationSec / 60)}m ${run.durationSec % 60}s`, actions: _jsx(Button, { variant: "primary", size: "sm", iconLeft: _jsx(Play, { className: "h-3.5 w-3.5" }), children: "Re-run" }) }), _jsx(MetricGrid, { columns: 4, metrics: [
                    { label: "Pass rate", value: `${passRate}%` },
                    { label: "Cases", value: String(scoped.length) },
                    { label: "Avg latency", value: `${avgLatency}ms` },
                    { label: "Cost", value: "$0.48" },
                ] }), _jsxs("div", { className: "grid gap-3 lg:grid-cols-3", children: [_jsxs(Card, { className: "lg:col-span-2", children: [_jsx(CardHeader, { children: _jsxs("div", { children: [_jsx(CardTitle, { children: "By category" }), _jsx(CardDescription, { children: "Pass % per eval category." })] }) }), _jsx(CardContent, { children: categoryData.length > 0 ? (_jsx(BarChart, { data: categoryData, valueFormatter: (v) => `${v}%`, height: 220 })) : (_jsx(EmptyState, { title: "No cases" })) })] }), _jsxs(Card, { children: [_jsx(CardHeader, { children: _jsx("div", { children: _jsx(CardTitle, { children: "Recent failures" }) }) }), _jsx(CardContent, { children: failures.length > 0 ? (_jsx(Timeline, { items: failures.map((f, i) => ({
                                        id: f.id,
                                        title: `${f.category}: ${f.name}`,
                                        intent: "danger",
                                        occurredAt: new Date(Date.now() - (i + 1) * 30 * 60_000),
                                    })) })) : (_jsx(EmptyState, { title: "No failures \uD83C\uDF89" })) })] })] }), _jsxs(Card, { children: [_jsx(CardHeader, { children: _jsxs("div", { children: [_jsx(CardTitle, { children: "Cases" }), _jsxs(CardDescription, { children: [scoped.length, " cases in this run."] })] }) }), _jsx(CardContent, { className: "p-0", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "border-b border-border text-xs uppercase tracking-wider text-text-muted", children: [_jsx("th", { className: "text-left p-3", children: "Case" }), _jsx("th", { className: "text-left p-3", children: "Category" }), _jsx("th", { className: "text-center p-3", children: "Result" }), _jsx("th", { className: "text-right p-3", children: "Latency" })] }) }), _jsx("tbody", { children: scoped.map((c) => (_jsxs("tr", { className: "border-b border-border-subtle last:border-b-0", children: [_jsx("td", { className: "p-3 font-mono text-xs text-text-secondary", children: c.name }), _jsx("td", { className: "p-3 text-text-secondary", children: c.category }), _jsx("td", { className: "p-3 text-center", children: _jsx(Badge, { intent: c.pass ? "success" : "danger", children: c.pass ? "pass" : "fail" }) }), _jsxs("td", { className: "p-3 text-right tabular-nums text-text-muted", children: [c.latencyMs, "ms"] })] }, c.id))) })] }) })] })] }));
}
