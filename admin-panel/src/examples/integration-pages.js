import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { defineCustomView } from "@/builders";
import { PageHeader } from "@/admin-primitives/PageHeader";
import { Card, CardContent } from "@/admin-primitives/Card";
import { EmptyState } from "@/admin-primitives/EmptyState";
import { StatusDot } from "@/admin-primitives/StatusDot";
import { Button } from "@/primitives/Button";
import { Spinner } from "@/primitives/Spinner";
import { useIntegrationPings } from "./_shared/live-hooks";
export const integrationsStatusView = defineCustomView({
    id: "integration.status.view",
    title: "Status",
    description: "Live health of every integration.",
    resource: "integration.connection",
    render: () => _jsx(IntegrationStatusPage, {}),
});
function IntegrationStatusPage() {
    const { data: pings, loading } = useIntegrationPings();
    if (loading && pings.length === 0)
        return (_jsxs("div", { className: "py-16 flex items-center justify-center text-sm text-text-muted gap-2", children: [_jsx(Spinner, { size: 14 }), " Loading\u2026"] }));
    const latest = {};
    for (const p of pings) {
        const existing = latest[p.connector];
        if (!existing || p.pingedAt > existing.pingedAt)
            latest[p.connector] = p;
    }
    const rows = Object.values(latest).sort((a, b) => a.connector.localeCompare(b.connector));
    return (_jsxs("div", { className: "flex flex-col gap-4", children: [_jsx(PageHeader, { title: "Integration status", description: `Live health of ${rows.length} connectors · realtime.` }), _jsx(Card, { children: _jsx(CardContent, { className: "p-0", children: rows.length === 0 ? (_jsx(EmptyState, { title: "No pings yet" })) : (_jsx("ul", { className: "divide-y divide-border-subtle", children: rows.map((r) => (_jsxs("li", { className: "flex items-center gap-3 p-3", children: [_jsx(StatusDot, { intent: r.status === "ok"
                                        ? "success"
                                        : r.status === "warning"
                                            ? "warning"
                                            : "danger", pulse: r.status !== "ok" }), _jsxs("div", { className: "flex-1", children: [_jsx("div", { className: "text-sm font-medium text-text-primary capitalize", children: r.connector }), _jsxs("div", { className: "text-xs text-text-muted", children: ["last ping ", new Date(r.pingedAt).toLocaleString()] })] }), r.latencyMs > 0 && (_jsxs("span", { className: "text-xs text-text-muted tabular-nums w-16 text-right", children: [r.latencyMs, "ms"] })), _jsx(Button, { size: "sm", variant: "ghost", children: "Test" })] }, r.connector))) })) }) })] }));
}
