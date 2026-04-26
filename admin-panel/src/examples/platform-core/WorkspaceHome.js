import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import * as React from "react";
import { PageHeader } from "@/admin-primitives/PageHeader";
import { FreshnessIndicator } from "@/admin-primitives/FreshnessIndicator";
import { WorkspaceRenderer } from "@/admin-primitives/widgets/WorkspaceRenderer";
import { authStore } from "@/runtime/auth";
/** Declarative, production-grade Home dashboard.
 *
 * Every widget is wired to the real backend via useAggregation — no hardcoded
 * numbers, no mock data. Thresholds, trend comparisons, and drilldowns are
 * configured per-widget in this descriptor.
 */
const home = {
    id: "platform.home",
    label: "Home",
    description: "What needs you right now.",
    personalizable: true,
    widgets: [
        /* ───────────────── Section: Your pulse ─────────────────── */
        {
            id: "sec-pulse",
            type: "header",
            col: 12,
            label: "Your pulse",
            description: "Live counts across every plugin. Changes reflect instantly.",
            level: 2,
        },
        {
            id: "kpi-contacts",
            type: "number_card",
            col: 3,
            label: "Contacts",
            sublabel: "MTD additions tracked",
            aggregation: { resource: "crm.contact", fn: "count", range: { kind: "mtd" } },
            drilldown: "/contacts",
            trend: true,
            format: "compact",
        },
        {
            id: "kpi-pipeline",
            type: "number_card",
            col: 3,
            label: "Open pipeline",
            sublabel: "Non-closed deals",
            aggregation: {
                resource: "sales.deal",
                fn: "sum",
                field: "amount",
                filter: { or: [{ field: "stage", op: "nin", value: ["won", "lost"] }] },
            },
            drilldown: "/sales/deals",
            format: "currency",
        },
        {
            id: "kpi-tickets",
            type: "number_card",
            col: 3,
            label: "Open tickets",
            sublabel: "Support backlog",
            aggregation: {
                resource: "support-service.ticket",
                fn: "count",
                filter: { field: "status", op: "in", value: ["open", "in_progress"] },
            },
            drilldown: "/support/tickets",
            warnAbove: 20,
            dangerAbove: 40,
            trend: true,
        },
        {
            id: "kpi-overdue",
            type: "number_card",
            col: 3,
            label: "Overdue invoices",
            sublabel: "Needs follow-up",
            aggregation: {
                resource: "accounting.invoice",
                fn: "count",
                filter: { field: "status", op: "eq", value: "overdue" },
            },
            drilldown: "/accounting/invoices",
            warnAbove: 5,
            dangerAbove: 15,
            intent: "warning",
        },
        /* ───────────────── Section: Sales intelligence ──────────── */
        {
            id: "sec-sales",
            type: "header",
            col: 12,
            label: "Sales intelligence",
            level: 2,
        },
        {
            id: "chart-pipeline-by-stage",
            type: "chart",
            col: 8,
            label: "Pipeline value by stage",
            description: "Open-deal value grouped by sales stage.",
            chart: "bar",
            aggregation: {
                resource: "sales.deal",
                fn: "sum",
                field: "amount",
                groupBy: "stage",
            },
            format: "currency",
            drilldown: "/sales/pipeline",
            height: 220,
        },
        {
            id: "chart-deals-by-owner",
            type: "chart",
            col: 4,
            label: "Deals by owner",
            chart: "donut",
            aggregation: { resource: "sales.deal", fn: "count", groupBy: "owner" },
            drilldown: "/sales/leaderboard",
        },
        /* ───────────────── Section: Operations health ──────────── */
        {
            id: "sec-ops",
            type: "header",
            col: 12,
            label: "Operations",
            level: 2,
        },
        {
            id: "chart-tickets-by-priority",
            type: "chart",
            col: 6,
            label: "Tickets by priority",
            chart: "donut",
            aggregation: {
                resource: "support-service.ticket",
                fn: "count",
                groupBy: "priority",
                filter: { field: "status", op: "nin", value: ["closed", "resolved"] },
            },
            drilldown: "/support/tickets",
        },
        {
            id: "chart-bookings-trend",
            type: "chart",
            col: 6,
            label: "Bookings trend (30d)",
            chart: "area",
            aggregation: {
                resource: "booking.booking",
                fn: "count",
                period: "day",
                range: { kind: "last", days: 30 },
            },
            drilldown: "/bookings",
        },
        /* ───────────────── Section: Shortcuts ─────────────────── */
        {
            id: "sec-shortcuts",
            type: "header",
            col: 12,
            label: "Quick actions",
            level: 2,
        },
        {
            id: "sc-new-contact",
            type: "shortcut",
            col: 3,
            label: "New contact",
            description: "Add a person or company to CRM",
            icon: "UserPlus",
            href: "/contacts/new",
        },
        {
            id: "sc-new-deal",
            type: "shortcut",
            col: 3,
            label: "New deal",
            description: "Start tracking an opportunity",
            icon: "Handshake",
            href: "/sales/deals/new",
        },
        {
            id: "sc-new-invoice",
            type: "shortcut",
            col: 3,
            label: "New invoice",
            description: "Bill a customer",
            icon: "FileText",
            href: "/accounting/invoices/new",
        },
        {
            id: "sc-audit",
            type: "shortcut",
            col: 3,
            label: "Audit log",
            description: "Every mutation, live",
            icon: "History",
            href: "/audit",
            aggregation: {
                resource: "audit.event",
                fn: "count",
                range: { kind: "last", days: 1 },
            },
        },
        /* ───────────────── Section: Quick lists ─────────────── */
        {
            id: "ql-deals-closing",
            type: "quick_list",
            col: 6,
            label: "Deals closing this week",
            resource: "sales.deal",
            sort: { field: "closeAt", dir: "asc" },
            limit: 6,
            primary: "name",
            secondary: "account",
            href: (row) => `/sales/deals/${row.id}`,
        },
        {
            id: "ql-recent-contacts",
            type: "quick_list",
            col: 6,
            label: "Recently added contacts",
            resource: "crm.contact",
            sort: { field: "createdAt", dir: "desc" },
            limit: 6,
            primary: "name",
            secondary: "company",
            href: (row) => `/contacts/${row.id}`,
        },
    ],
};
export function WorkspaceHomePage() {
    const [asOf, setAsOf] = React.useState(new Date());
    React.useEffect(() => {
        const i = setInterval(() => setAsOf(new Date()), 30_000);
        return () => clearInterval(i);
    }, []);
    const user = authStore.user;
    const firstName = user?.name?.split(/\s+/)[0] ?? "there";
    return (_jsxs("div", { className: "flex flex-col gap-5", children: [_jsx(PageHeader, { title: `Good ${greeting()}, ${firstName}`, description: "Your live snapshot across every plugin in this workspace.", actions: _jsx(FreshnessIndicator, { lastUpdatedAt: asOf, live: true }) }), _jsx(WorkspaceRenderer, { workspace: home })] }));
}
function greeting() {
    const h = new Date().getHours();
    if (h < 12)
        return "morning";
    if (h < 18)
        return "afternoon";
    return "evening";
}
