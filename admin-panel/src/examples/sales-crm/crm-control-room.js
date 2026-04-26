import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import * as React from "react";
import { defineCustomView } from "@/builders";
import { PageHeader } from "@/admin-primitives/PageHeader";
import { FreshnessIndicator } from "@/admin-primitives/FreshnessIndicator";
import { WorkspaceRenderer } from "@/admin-primitives/widgets/WorkspaceRenderer";
/** CRM Control Room — the single-pane-of-glass view for sales + marketing.
 *
 *  All widgets are declarative and wired to the live backend via useAggregation.
 *  No hardcoded numbers. Thresholds + drilldowns baked in per widget.
 */
const workspace = {
    id: "crm.control-room",
    label: "CRM Control Room",
    description: "Live pulse of pipeline, conversion, and campaign ROI.",
    personalizable: true,
    filterBar: [
        {
            field: "owner",
            label: "Owner",
            kind: "text",
            placeholder: "Owner email",
        },
        {
            field: "status",
            label: "Status",
            kind: "enum",
            appliesTo: ["crm.lead"],
            options: [
                { value: "new", label: "New" },
                { value: "contacted", label: "Contacted" },
                { value: "qualified", label: "Qualified" },
                { value: "disqualified", label: "Disqualified" },
            ],
        },
    ],
    widgets: [
        /* ────────── KPI strip ────────── */
        { id: "hdr-pulse", type: "header", col: 12, label: "Pulse", level: 2 },
        {
            id: "kpi-leads-open",
            type: "number_card",
            col: 3,
            label: "Open leads",
            sublabel: "New + contacted + qualified",
            aggregation: {
                resource: "crm.lead",
                fn: "count",
                filter: { field: "status", op: "in", value: ["new", "contacted", "qualified"] },
            },
            drilldown: "/crm/leads",
            trend: true,
        },
        {
            id: "kpi-pipeline",
            type: "number_card",
            col: 3,
            label: "Pipeline value",
            sublabel: "Weighted by stage probability",
            aggregation: {
                resource: "crm.opportunity",
                fn: "sum",
                field: "weightedAmount",
                filter: { field: "stage", op: "nin", value: ["won", "lost"] },
            },
            format: "currency",
            drilldown: "/crm/opportunities",
        },
        {
            id: "kpi-win-rate",
            type: "number_card",
            col: 3,
            label: "Closed-won (MTD)",
            sublabel: "Revenue landed this month",
            aggregation: {
                resource: "crm.opportunity",
                fn: "sum",
                field: "amount",
                filter: { field: "stage", op: "eq", value: "won" },
                range: { kind: "mtd" },
            },
            format: "currency",
            drilldown: "/sales/revenue",
            trend: true,
        },
        {
            id: "kpi-campaigns-active",
            type: "number_card",
            col: 3,
            label: "Active campaigns",
            sublabel: "Running + scheduled",
            aggregation: {
                resource: "crm.campaign",
                fn: "count",
                filter: { field: "status", op: "in", value: ["active", "scheduled"] },
            },
            drilldown: "/crm/campaigns",
        },
        /* ────────── Pipeline + funnel ────────── */
        { id: "hdr-pipeline", type: "header", col: 12, label: "Pipeline intelligence", level: 2 },
        {
            id: "chart-opp-by-stage",
            type: "chart",
            col: 7,
            label: "Pipeline value by stage",
            description: "Open-deal weighted value grouped by sales stage.",
            chart: "bar",
            aggregation: {
                resource: "crm.opportunity",
                fn: "sum",
                field: "weightedAmount",
                groupBy: "stage",
                filter: { field: "stage", op: "nin", value: ["won", "lost"] },
            },
            format: "currency",
            drilldown: "/contacts/pipeline",
            height: 220,
        },
        {
            id: "chart-leads-by-source",
            type: "chart",
            col: 5,
            label: "Leads by source",
            chart: "donut",
            aggregation: { resource: "crm.lead", fn: "count", groupBy: "source" },
            drilldown: "/crm/leads",
        },
        /* ────────── Lead + campaign velocity ────────── */
        { id: "hdr-velocity", type: "header", col: 12, label: "Velocity", level: 2 },
        {
            id: "chart-leads-daily",
            type: "chart",
            col: 6,
            label: "New leads (last 30 days)",
            chart: "area",
            aggregation: {
                resource: "crm.lead",
                fn: "count",
                period: "day",
                range: { kind: "last", days: 30 },
            },
            drilldown: "/crm/leads",
            height: 200,
        },
        {
            id: "chart-campaign-roi",
            type: "chart",
            col: 6,
            label: "Campaign revenue (top 10)",
            chart: "bar",
            aggregation: {
                resource: "crm.campaign",
                fn: "sum",
                field: "revenueGenerated",
                groupBy: "name",
            },
            format: "currency",
            drilldown: "/crm/campaigns",
            height: 200,
        },
        /* ────────── Quick actions ────────── */
        { id: "hdr-actions", type: "header", col: 12, label: "Shortcuts", level: 2 },
        {
            id: "sc-new-lead",
            type: "shortcut",
            col: 3,
            label: "Capture a lead",
            description: "New lead → auto-scored + assigned",
            icon: "UserPlus",
            href: "/crm/leads/new",
        },
        {
            id: "sc-new-opp",
            type: "shortcut",
            col: 3,
            label: "Open an opportunity",
            description: "From an existing contact or account",
            icon: "Target",
            href: "/crm/opportunities/new",
        },
        {
            id: "sc-book-meeting",
            type: "shortcut",
            col: 3,
            label: "Book a meeting",
            description: "Schedule a demo, follow-up, or check-in",
            icon: "Calendar",
            href: "/crm/appointments/new",
        },
        {
            id: "sc-reports",
            type: "shortcut",
            col: 3,
            label: "Reports library",
            description: "Lead conversion, pipeline, campaign ROI",
            icon: "BarChart3",
            href: "/crm/reports",
            aggregation: { resource: "crm.opportunity", fn: "count" },
        },
        /* ────────── Queues ────────── */
        { id: "hdr-queues", type: "header", col: 12, label: "Attention needed", level: 2 },
        {
            id: "ql-hot-leads",
            type: "quick_list",
            col: 4,
            label: "Hot leads (score ≥ 70, open)",
            resource: "crm.lead",
            sort: { field: "score", dir: "desc" },
            limit: 8,
            primary: "name",
            secondary: "company",
            href: (row) => `/crm/leads/${row.id}`,
        },
        {
            id: "ql-closing-soon",
            type: "quick_list",
            col: 4,
            label: "Opportunities closing this week",
            resource: "crm.opportunity",
            sort: { field: "closeDate", dir: "asc" },
            limit: 8,
            primary: "name",
            secondary: "account",
            href: (row) => `/crm/opportunities/${row.id}`,
        },
        {
            id: "ql-appointments",
            type: "quick_list",
            col: 4,
            label: "Upcoming appointments",
            resource: "crm.appointment",
            sort: { field: "startAt", dir: "asc" },
            limit: 8,
            primary: "subject",
            secondary: "type",
            href: (row) => `/crm/appointments/${row.id}`,
        },
    ],
};
export const crmControlRoomView = defineCustomView({
    id: "crm.control-room.view",
    title: "Control Room",
    description: "CRM pulse dashboard.",
    resource: "crm.contact",
    render: () => {
        const [asOf, setAsOf] = React.useState(new Date());
        React.useEffect(() => {
            const i = setInterval(() => setAsOf(new Date()), 30_000);
            return () => clearInterval(i);
        }, []);
        return (_jsxs("div", { className: "flex flex-col gap-5", children: [_jsx(PageHeader, { title: "CRM Control Room", description: "Pipeline, conversion, and campaign ROI at a glance.", actions: _jsx(FreshnessIndicator, { lastUpdatedAt: asOf, live: true }) }), _jsx(WorkspaceRenderer, { workspace: workspace })] }));
    },
});
