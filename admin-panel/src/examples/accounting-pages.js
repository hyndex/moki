import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { defineCustomView } from "@/builders";
import { PageHeader } from "@/admin-primitives/PageHeader";
import { Card, CardContent } from "@/admin-primitives/Card";
import { MetricGrid } from "@/admin-primitives/MetricGrid";
import { StatusDot } from "@/admin-primitives/StatusDot";
import { Badge } from "@/primitives/Badge";
/** Custom page(s) bundled with the accounting plugin. */
export const accountingCloseView = defineCustomView({
    id: "accounting.close.view",
    title: "Month-end close",
    description: "Track reconciliation and approvals.",
    resource: "accounting.invoice",
    render: () => (_jsxs("div", { className: "flex flex-col gap-4", children: [_jsx(PageHeader, { title: "Month-end close", description: "All reconciliation tasks." }), _jsx(MetricGrid, { columns: 4, metrics: [
                    { label: "Completion", value: "78%", trend: { value: 12, positive: true } },
                    { label: "Open tasks", value: "9" },
                    { label: "Blocked", value: "2" },
                    { label: "Days open", value: "4" },
                ] }), _jsx(Card, { children: _jsx(CardContent, { className: "p-0", children: _jsx("ul", { className: "divide-y divide-border-subtle", children: [
                            { name: "Reconcile bank accounts", owner: "Sam", status: "done" },
                            { name: "Post AR adjustments", owner: "Alex", status: "done" },
                            { name: "Accrue payroll", owner: "Taylor", status: "in_progress" },
                            { name: "Close AP", owner: "Sam", status: "in_progress" },
                            { name: "Intercompany eliminations", owner: "Jordan", status: "blocked" },
                            { name: "FX revaluation", owner: "Alex", status: "todo" },
                            { name: "Lock period + post journals", owner: "Sam", status: "todo" },
                        ].map((t, i) => (_jsxs("li", { className: "flex items-center gap-3 p-3", children: [_jsx(StatusDot, { intent: t.status === "done"
                                        ? "success"
                                        : t.status === "in_progress"
                                            ? "info"
                                            : t.status === "blocked"
                                                ? "danger"
                                                : "neutral" }), _jsxs("div", { className: "flex-1", children: [_jsx("div", { className: "text-sm text-text-primary", children: t.name }), _jsx("div", { className: "text-xs text-text-muted", children: t.owner })] }), _jsx(Badge, { intent: t.status === "done"
                                        ? "success"
                                        : t.status === "blocked"
                                            ? "danger"
                                            : t.status === "in_progress"
                                                ? "info"
                                                : "neutral", children: t.status.replace("_", " ") })] }, i))) }) }) })] })),
});
