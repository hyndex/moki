import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { defineCustomView } from "@/builders";
import { PageHeader } from "@/admin-primitives/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/admin-primitives/Card";
import { Timeline } from "@/admin-primitives/Timeline";
import { daysAgo, hoursAgo } from "../_factory/seeds";
export const auditEventDetailView = defineCustomView({
    id: "audit.event-detail.view",
    title: "Event detail (sample)",
    description: "A single tamper-evident audit event.",
    resource: "audit.event",
    render: () => (_jsxs("div", { className: "flex flex-col gap-4", children: [_jsx(PageHeader, { title: "ev_42 \u00B7 booking.confirmed", description: "Immutable record from the audit chain." }), _jsxs("div", { className: "grid gap-3 lg:grid-cols-3", children: [_jsxs(Card, { className: "lg:col-span-2", children: [_jsx(CardHeader, { children: _jsx("div", { children: _jsx(CardTitle, { children: "Payload" }) }) }), _jsx(CardContent, { children: _jsx("pre", { className: "text-xs font-mono bg-surface-1 border border-border rounded-md p-3 overflow-x-auto", children: `{
  "event":   "booking.confirmed",
  "actor":   "chinmoy@gutu.dev",
  "resource":"booking",
  "recordId":"bk_103",
  "before":  { "status": "draft" },
  "after":   { "status": "confirmed" },
  "ip":      "10.0.7.42",
  "occurredAt": "2026-04-18T14:22:01.204Z",
  "hash":    "sha256:a3…f9c",
  "prev":    "sha256:711…21a"
}` }) })] }), _jsxs(Card, { children: [_jsx(CardHeader, { children: _jsxs("div", { children: [_jsx(CardTitle, { children: "Context" }), _jsx(CardDescription, { children: "Surrounding events." })] }) }), _jsx(CardContent, { children: _jsx(Timeline, { items: [
                                        { id: "a", title: "booking.created", intent: "accent", occurredAt: daysAgo(2.01) },
                                        { id: "b", title: "booking.draft.updated", intent: "info", occurredAt: daysAgo(2) },
                                        { id: "c", title: "booking.confirmed", intent: "success", occurredAt: hoursAgo(2) },
                                        { id: "d", title: "notification.sent", intent: "info", occurredAt: hoursAgo(1.9) },
                                    ] }) })] })] })] })),
});
