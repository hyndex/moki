import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { defineCustomView } from "@/builders";
import { PageHeader } from "@/admin-primitives/PageHeader";
import { LiveDnDKanban } from "@/admin-primitives/LiveDnDKanban";
import { Card, CardContent, CardHeader, CardTitle } from "@/admin-primitives/Card";
import { MetricGrid } from "@/admin-primitives/MetricGrid";
import { Badge } from "@/primitives/Badge";
import { BarChart } from "@/admin-primitives/charts/BarChart";
import { Donut } from "@/admin-primitives/charts/Donut";
const TICKET_COLS = [
    { id: "open", title: "Open", intent: "info", wipLimit: 40 },
    { id: "in_progress", title: "In progress", intent: "warning", wipLimit: 25 },
    { id: "resolved", title: "Resolved", intent: "success" },
    { id: "closed", title: "Closed", intent: "neutral" },
];
const PRIORITY_INTENT = {
    low: "neutral",
    normal: "info",
    high: "warning",
    urgent: "danger",
};
export const supportKanbanView = defineCustomView({
    id: "support-service.kanban.view",
    title: "Ticket Board",
    description: "Tickets grouped by status — drag to update.",
    resource: "support-service.ticket",
    render: () => (_jsxs("div", { className: "flex flex-col gap-4", children: [_jsx(PageHeader, { title: "Ticket board", description: "Drag tickets between columns to change status. WIP limits flag overloaded columns." }), _jsx(LiveDnDKanban, { resource: "support-service.ticket", statusField: "status", columns: TICKET_COLS, onCardClick: (row) => {
                    window.location.hash = `/support/tickets/${row.id}`;
                }, renderCard: (i) => (_jsxs("div", { children: [_jsxs("div", { className: "flex items-center justify-between gap-2", children: [_jsx("code", { className: "text-xs font-mono text-text-muted", children: i.code }), _jsxs("div", { className: "flex items-center gap-1", children: [i.slaBreached && (_jsx("span", { className: "text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-intent-danger-bg text-intent-danger", children: "SLA" })), i.priority && (_jsx(Badge, { intent: PRIORITY_INTENT[i.priority] ?? "neutral", children: i.priority }))] })] }), _jsx("div", { className: "text-sm text-text-primary mt-1 line-clamp-2", children: i.subject }), _jsxs("div", { className: "flex items-center justify-between mt-1", children: [_jsx("div", { className: "text-xs text-text-muted truncate", children: i.requester }), i.assignee && (_jsx("div", { className: "text-xs text-text-secondary", children: i.assignee }))] })] })) })] })),
});
export const supportAnalyticsView = defineCustomView({
    id: "support-service.analytics.view",
    title: "Analytics",
    description: "Ticket volume and resolution health.",
    resource: "support-service.ticket",
    render: () => (_jsxs("div", { className: "flex flex-col gap-4", children: [_jsx(PageHeader, { title: "Support analytics", description: "Trends and SLA health." }), _jsx(MetricGrid, { columns: 4, metrics: [
                    { label: "CSAT", value: "4.6 / 5" },
                    { label: "First response", value: "18 m", trend: { value: 2, positive: true } },
                    { label: "Time to resolution", value: "6.2 h" },
                    { label: "SLA miss", value: "3.8%", trend: { value: 1, positive: true } },
                ] }), _jsxs("div", { className: "grid gap-3 lg:grid-cols-2", children: [_jsxs(Card, { children: [_jsx(CardHeader, { children: _jsx("div", { children: _jsx(CardTitle, { children: "Volume by day" }) }) }), _jsx(CardContent, { children: _jsx(BarChart, { data: "Mon Tue Wed Thu Fri Sat Sun"
                                        .split(" ")
                                        .map((l, i) => ({ label: l, value: 20 + (i * 13) % 38 })), height: 180 }) })] }), _jsxs(Card, { children: [_jsx(CardHeader, { children: _jsx("div", { children: _jsx(CardTitle, { children: "By category" }) }) }), _jsx(CardContent, { children: _jsx(Donut, { data: [
                                        { label: "Account", value: 42 },
                                        { label: "Billing", value: 28 },
                                        { label: "Integrations", value: 19 },
                                        { label: "Product", value: 24 },
                                        { label: "Other", value: 9 },
                                    ] }) })] })] })] })),
});
