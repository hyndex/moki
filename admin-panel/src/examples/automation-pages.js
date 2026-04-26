import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { defineCustomView } from "@/builders";
import { PageHeader } from "@/admin-primitives/PageHeader";
import { Card, CardContent } from "@/admin-primitives/Card";
import { EmptyState } from "@/admin-primitives/EmptyState";
import { Badge } from "@/primitives/Badge";
import { Spinner } from "@/primitives/Spinner";
import { useAutomationSteps } from "./_shared/live-hooks";
export const automationRunDetailView = defineCustomView({
    id: "automation.run-detail.view",
    title: "Run detail",
    description: "Trace through a single automation execution.",
    resource: "automation.run",
    render: () => _jsx(AutomationRunDetailPage, {}),
});
function AutomationRunDetailPage() {
    const { data: steps, loading } = useAutomationSteps();
    if (loading && steps.length === 0)
        return (_jsxs("div", { className: "py-16 flex items-center justify-center text-sm text-text-muted gap-2", children: [_jsx(Spinner, { size: 14 }), " Loading\u2026"] }));
    const runId = steps[0]?.runId;
    const scoped = steps.filter((s) => s.runId === runId).sort((a, b) => a.order - b.order);
    const total = scoped.reduce((a, s) => a + s.durationMs, 0);
    return (_jsxs("div", { className: "flex flex-col gap-4", children: [_jsx(PageHeader, { title: runId ? `${runId} · Send invoice reminder` : "Run detail", description: scoped.length > 0
                    ? `Completed ${(total / 1000).toFixed(1)}s · ${scoped.length} steps`
                    : "No step data" }), _jsx(Card, { children: _jsx(CardContent, { className: "p-0", children: scoped.length === 0 ? (_jsx(EmptyState, { title: "No steps recorded" })) : (_jsx("ol", { className: "divide-y divide-border-subtle", children: scoped.map((s) => (_jsxs("li", { className: "flex items-center gap-3 p-3", children: [_jsx("div", { className: "w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold " +
                                        (s.ok
                                            ? "bg-intent-success-bg text-intent-success"
                                            : "bg-intent-danger-bg text-intent-danger"), children: s.order + 1 }), _jsx("div", { className: "flex-1 text-sm text-text-primary", children: s.step }), _jsxs("div", { className: "text-xs text-text-muted tabular-nums", children: [s.durationMs, "ms"] }), _jsx(Badge, { intent: s.ok ? "success" : "danger", children: s.ok ? "ok" : "failed" })] }, s.id))) })) }) })] }));
}
