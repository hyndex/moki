import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import * as Icons from "lucide-react";
import { defineCustomView } from "@/builders";
import { PageHeader } from "@/admin-primitives/PageHeader";
import { Card, CardContent } from "@/admin-primitives/Card";
import { ReportBuilder } from "@/admin-primitives/ReportBuilder";
import { EmptyStateFramework } from "@/admin-primitives/EmptyStateFramework";
import { useHash } from "@/views/useRoute";
/** CRM Reports library — ERPNext-parity set delivered on top of the
 *  ReportBuilder primitive. Every report reads live data via the
 *  ResourceClient; filters and totals are computed client-side in the
 *  report's `execute` function. */
/* ------------------------------------------------------------------- */
/* Helpers                                                              */
/* ------------------------------------------------------------------- */
function monthKey(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function parseDate(v) {
    if (!v)
        return null;
    if (v instanceof Date)
        return v;
    if (typeof v === "string" || typeof v === "number") {
        const d = new Date(v);
        return Number.isNaN(d.getTime()) ? null : d;
    }
    return null;
}
function num(v, fallback = 0) {
    return typeof v === "number" && !Number.isNaN(v) ? v : fallback;
}
function str(v, fallback = "") {
    return typeof v === "string" ? v : fallback;
}
async function fetchAll(resources, resource) {
    const list = await resources.list(resource, { page: 1, pageSize: 10_000 });
    return list.rows;
}
/* ------------------------------------------------------------------- */
/* 1. Lead Details                                                      */
/* ------------------------------------------------------------------- */
export const leadDetailsReport = {
    id: "crm-lead-details",
    label: "Lead Details",
    description: "Full lead register with status, score, source, territory, and owner.",
    icon: "UserRound",
    resource: "crm.lead",
    filters: [
        {
            field: "status",
            label: "Status",
            kind: "enum",
            options: [
                { value: "new", label: "New" },
                { value: "contacted", label: "Contacted" },
                { value: "qualified", label: "Qualified" },
                { value: "unqualified", label: "Unqualified" },
                { value: "converted", label: "Converted" },
                { value: "lost", label: "Lost" },
            ],
        },
        {
            field: "source",
            label: "Source",
            kind: "enum",
            options: [
                { value: "website", label: "Website" },
                { value: "referral", label: "Referral" },
                { value: "cold-outreach", label: "Cold outreach" },
                { value: "event", label: "Event" },
                { value: "partner", label: "Partner" },
                { value: "advertisement", label: "Advertisement" },
                { value: "social", label: "Social" },
                { value: "inbound-chat", label: "Inbound chat" },
            ],
        },
    ],
    async execute({ filters, resources }) {
        const leads = await fetchAll(resources, "crm.lead");
        const rows = leads
            .filter((l) => !filters.status || l.status === filters.status)
            .filter((l) => !filters.source || l.source === filters.source)
            .map((l) => ({
            code: str(l.code),
            name: str(l.name),
            company: str(l.company),
            status: str(l.status),
            score: num(l.score),
            source: str(l.source),
            owner: str(l.owner),
            territory: str(l.territory),
            createdAt: str(l.createdAt),
        }))
            .sort((a, b) => b.score - a.score);
        const columns = [
            { field: "code", label: "Code", fieldtype: "text", width: 90 },
            { field: "name", label: "Name", fieldtype: "text" },
            { field: "company", label: "Company", fieldtype: "text" },
            { field: "status", label: "Status", fieldtype: "enum" },
            { field: "score", label: "Score", fieldtype: "number", align: "right", totaling: "avg" },
            { field: "source", label: "Source", fieldtype: "enum" },
            { field: "owner", label: "Owner", fieldtype: "text" },
            { field: "territory", label: "Territory", fieldtype: "text" },
            { field: "createdAt", label: "Created", fieldtype: "date" },
        ];
        return { columns, rows, totals: { score: Math.round(rows.reduce((a, r) => a + r.score, 0) / Math.max(rows.length, 1)) } };
    },
};
/* ------------------------------------------------------------------- */
/* 2. Lead Conversion Time                                              */
/* ------------------------------------------------------------------- */
export const leadConversionTimeReport = {
    id: "crm-lead-conversion-time",
    label: "Lead Conversion Time",
    description: "How long each lead took to convert to an opportunity, grouped by source.",
    icon: "Clock",
    resource: "crm.lead",
    filters: [],
    async execute({ resources }) {
        const leads = await fetchAll(resources, "crm.lead");
        const converted = leads.filter((l) => l.status === "converted" && l.convertedAt && l.createdAt);
        const bySource = new Map();
        for (const l of converted) {
            const created = parseDate(l.createdAt);
            const conv = parseDate(l.convertedAt);
            if (!created || !conv)
                continue;
            const hours = (conv.getTime() - created.getTime()) / 3_600_000;
            const source = str(l.source, "unknown");
            const b = bySource.get(source) ?? { source, leads: 0, totalHours: 0, avgHours: 0, medianHours: 0 };
            b.leads++;
            b.totalHours += hours;
            bySource.set(source, b);
        }
        for (const b of bySource.values())
            b.avgHours = b.leads > 0 ? b.totalHours / b.leads : 0;
        const rows = [...bySource.values()].sort((a, b) => a.avgHours - b.avgHours);
        return {
            columns: [
                { field: "source", label: "Source", fieldtype: "enum" },
                { field: "leads", label: "Conversions", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "avgHours", label: "Avg hours", fieldtype: "number", align: "right" },
                { field: "totalHours", label: "Total hours", fieldtype: "number", align: "right", totaling: "sum" },
            ],
            rows,
            totals: {
                leads: rows.reduce((a, r) => a + r.leads, 0),
                totalHours: Math.round(rows.reduce((a, r) => a + r.totalHours, 0)),
            },
            chart: {
                kind: "bar",
                label: "Average conversion time (hours)",
                from: (rs) => rs.map((r) => ({ label: r.source, value: Math.round(r.avgHours) })),
            },
        };
    },
};
/* ------------------------------------------------------------------- */
/* 3. Lead Owner Efficiency                                             */
/* ------------------------------------------------------------------- */
export const leadOwnerEfficiencyReport = {
    id: "crm-lead-owner-efficiency",
    label: "Lead Owner Efficiency",
    description: "Conversion rates and response times per owner.",
    icon: "Trophy",
    resource: "crm.lead",
    filters: [],
    async execute({ resources }) {
        const leads = await fetchAll(resources, "crm.lead");
        const byOwner = new Map();
        for (const l of leads) {
            const owner = str(l.owner, "unassigned");
            const b = byOwner.get(owner) ?? {
                owner,
                total: 0,
                contacted: 0,
                qualified: 0,
                converted: 0,
                lost: 0,
                avgScore: 0,
                conversionPct: 0,
            };
            b.total++;
            if (l.status === "contacted")
                b.contacted++;
            if (l.status === "qualified")
                b.qualified++;
            if (l.status === "converted")
                b.converted++;
            if (l.status === "lost")
                b.lost++;
            b.avgScore += num(l.score);
            byOwner.set(owner, b);
        }
        for (const b of byOwner.values()) {
            b.avgScore = b.total > 0 ? Math.round(b.avgScore / b.total) : 0;
            b.conversionPct = b.total > 0 ? Math.round((b.converted / b.total) * 100) : 0;
        }
        const rows = [...byOwner.values()].sort((a, b) => b.conversionPct - a.conversionPct);
        return {
            columns: [
                { field: "owner", label: "Owner", fieldtype: "text" },
                { field: "total", label: "Leads", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "contacted", label: "Contacted", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "qualified", label: "Qualified", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "converted", label: "Converted", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "lost", label: "Lost", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "conversionPct", label: "Conv %", fieldtype: "percent", align: "right" },
                { field: "avgScore", label: "Avg score", fieldtype: "number", align: "right" },
            ],
            rows,
            totals: {
                total: rows.reduce((a, r) => a + r.total, 0),
                converted: rows.reduce((a, r) => a + r.converted, 0),
            },
            chart: {
                kind: "bar",
                label: "Conversion % by owner",
                format: "percent",
                from: (rs) => rs.map((r) => ({ label: r.owner, value: r.conversionPct })),
            },
        };
    },
};
/* ------------------------------------------------------------------- */
/* 4. Opportunity Summary by Stage                                      */
/* ------------------------------------------------------------------- */
export const opportunitySummaryReport = {
    id: "crm-opportunity-summary",
    label: "Opportunity Summary by Stage",
    description: "Count and value of opportunities in each sales stage.",
    icon: "Layers",
    resource: "crm.opportunity",
    filters: [],
    async execute({ resources }) {
        const STAGE_ORDER = ["discovery", "qualification", "proposal", "negotiation", "won", "lost"];
        const opps = await fetchAll(resources, "crm.opportunity");
        const byStage = new Map();
        for (const s of STAGE_ORDER) {
            byStage.set(s, { stage: s, count: 0, amount: 0, weighted: 0, avgProbability: 0 });
        }
        for (const o of opps) {
            const stage = str(o.stage);
            const b = byStage.get(stage);
            if (!b)
                continue;
            b.count++;
            b.amount += num(o.amount);
            b.weighted += num(o.weightedAmount);
            b.avgProbability += num(o.probability);
        }
        const rows = [...byStage.values()].map((b) => ({
            ...b,
            avgProbability: b.count > 0 ? Math.round(b.avgProbability / b.count) : 0,
        }));
        return {
            columns: [
                { field: "stage", label: "Stage", fieldtype: "enum" },
                { field: "count", label: "Opportunities", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "amount", label: "Total value", fieldtype: "currency", align: "right", options: "USD", totaling: "sum" },
                { field: "weighted", label: "Weighted value", fieldtype: "currency", align: "right", options: "USD", totaling: "sum" },
                { field: "avgProbability", label: "Avg prob %", fieldtype: "percent", align: "right" },
            ],
            rows,
            totals: {
                count: rows.reduce((a, r) => a + r.count, 0),
                amount: rows.reduce((a, r) => a + r.amount, 0),
                weighted: rows.reduce((a, r) => a + r.weighted, 0),
            },
            chart: {
                kind: "funnel",
                label: "Open pipeline by stage",
                from: (rs) => rs
                    .filter((r) => r.stage !== "won" && r.stage !== "lost")
                    .map((r) => ({ label: r.stage, value: r.count })),
            },
        };
    },
};
/* ------------------------------------------------------------------- */
/* 5. Sales Pipeline Analytics                                          */
/* ------------------------------------------------------------------- */
export const pipelineAnalyticsReport = {
    id: "crm-pipeline-analytics",
    label: "Sales Pipeline Analytics",
    description: "Monthly opened vs closed pipeline value.",
    icon: "TrendingUp",
    resource: "crm.opportunity",
    filters: [],
    async execute({ resources }) {
        const opps = await fetchAll(resources, "crm.opportunity");
        const byMonth = new Map();
        for (const o of opps) {
            const createdDate = parseDate(o.createdAt);
            if (!createdDate)
                continue;
            const k = monthKey(createdDate);
            const b = byMonth.get(k) ?? { month: k, opened: 0, won: 0, lost: 0, netPipeline: 0 };
            b.opened += num(o.amount);
            if (o.stage === "won")
                b.won += num(o.amount);
            if (o.stage === "lost")
                b.lost += num(o.amount);
            byMonth.set(k, b);
        }
        const rows = [...byMonth.values()]
            .map((b) => ({ ...b, netPipeline: b.opened - b.won - b.lost }))
            .sort((a, b) => a.month.localeCompare(b.month));
        return {
            columns: [
                { field: "month", label: "Month", fieldtype: "text", width: 110 },
                { field: "opened", label: "Opened $", fieldtype: "currency", align: "right", options: "USD", totaling: "sum" },
                { field: "won", label: "Won $", fieldtype: "currency", align: "right", options: "USD", totaling: "sum" },
                { field: "lost", label: "Lost $", fieldtype: "currency", align: "right", options: "USD", totaling: "sum" },
                { field: "netPipeline", label: "Net pipeline", fieldtype: "currency", align: "right", options: "USD", totaling: "sum" },
            ],
            rows,
            totals: {
                opened: rows.reduce((a, r) => a + r.opened, 0),
                won: rows.reduce((a, r) => a + r.won, 0),
                lost: rows.reduce((a, r) => a + r.lost, 0),
            },
            chart: {
                kind: "line",
                label: "Monthly pipeline velocity",
                format: "currency",
                currency: "USD",
                from: (rs) => rs.map((r) => ({ label: r.month, value: r.opened })),
            },
        };
    },
};
/* ------------------------------------------------------------------- */
/* 6. Campaign Efficiency                                               */
/* ------------------------------------------------------------------- */
export const campaignEfficiencyReport = {
    id: "crm-campaign-efficiency",
    label: "Campaign Efficiency",
    description: "Cost per lead and ROI for each campaign.",
    icon: "Megaphone",
    resource: "crm.campaign",
    filters: [
        {
            field: "status",
            label: "Status",
            kind: "enum",
            options: [
                { value: "active", label: "Active" },
                { value: "scheduled", label: "Scheduled" },
                { value: "paused", label: "Paused" },
                { value: "completed", label: "Completed" },
                { value: "archived", label: "Archived" },
            ],
        },
    ],
    async execute({ filters, resources }) {
        const camps = await fetchAll(resources, "crm.campaign");
        const rows = camps
            .filter((c) => !filters.status || c.status === filters.status)
            .map((c) => {
            const spent = num(c.spent);
            const leads = num(c.leadsGenerated);
            const opps = num(c.opportunitiesGenerated);
            const revenue = num(c.revenueGenerated);
            return {
                name: str(c.name),
                type: str(c.type),
                status: str(c.status),
                budget: num(c.budget),
                spent,
                leads,
                opps,
                revenue,
                cpl: leads > 0 ? Math.round(spent / leads) : 0,
                roi: spent > 0 ? Math.round(((revenue - spent) / spent) * 100) : 0,
            };
        })
            .sort((a, b) => b.roi - a.roi);
        return {
            columns: [
                { field: "name", label: "Campaign", fieldtype: "text" },
                { field: "type", label: "Type", fieldtype: "enum" },
                { field: "status", label: "Status", fieldtype: "enum" },
                { field: "spent", label: "Spent", fieldtype: "currency", align: "right", options: "USD", totaling: "sum" },
                { field: "leads", label: "Leads", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "opps", label: "Opportunities", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "revenue", label: "Revenue", fieldtype: "currency", align: "right", options: "USD", totaling: "sum" },
                { field: "cpl", label: "CPL", fieldtype: "currency", align: "right", options: "USD" },
                { field: "roi", label: "ROI %", fieldtype: "percent", align: "right" },
            ],
            rows,
            totals: {
                spent: rows.reduce((a, r) => a + r.spent, 0),
                leads: rows.reduce((a, r) => a + r.leads, 0),
                revenue: rows.reduce((a, r) => a + r.revenue, 0),
            },
            chart: {
                kind: "bar",
                label: "ROI % by campaign",
                format: "percent",
                from: (rs) => rs.slice(0, 12).map((r) => ({ label: r.name, value: r.roi })),
            },
        };
    },
};
/* ------------------------------------------------------------------- */
/* 7. Lost Opportunity                                                  */
/* ------------------------------------------------------------------- */
export const lostOpportunityReport = {
    id: "crm-lost-opportunity",
    label: "Lost Opportunity",
    description: "Why did we lose? Aggregates reasons and $ impact.",
    icon: "TrendingDown",
    resource: "crm.opportunity",
    filters: [],
    async execute({ resources }) {
        const opps = await fetchAll(resources, "crm.opportunity");
        const lost = opps.filter((o) => o.stage === "lost");
        const byReason = new Map();
        for (const o of lost) {
            const r = str(o.lostReason, "unspecified");
            const b = byReason.get(r) ?? { reason: r, count: 0, value: 0 };
            b.count++;
            b.value += num(o.amount);
            byReason.set(r, b);
        }
        const rows = [...byReason.values()].sort((a, b) => b.value - a.value);
        return {
            columns: [
                { field: "reason", label: "Lost reason", fieldtype: "text" },
                { field: "count", label: "Count", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "value", label: "Total value lost", fieldtype: "currency", align: "right", options: "USD", totaling: "sum" },
            ],
            rows,
            totals: {
                count: rows.reduce((a, r) => a + r.count, 0),
                value: rows.reduce((a, r) => a + r.value, 0),
            },
            chart: {
                kind: "donut",
                label: "Lost value by reason",
                format: "currency",
                currency: "USD",
                from: (rs) => rs.map((r) => ({ label: r.reason, value: r.value })),
            },
        };
    },
};
/* ------------------------------------------------------------------- */
/* 8. First Response Time                                               */
/* ------------------------------------------------------------------- */
export const firstResponseTimeReport = {
    id: "crm-first-response-time",
    label: "First Response Time",
    description: "Minutes from lead creation to first response, by owner.",
    icon: "Stopwatch",
    resource: "crm.lead",
    filters: [],
    async execute({ resources }) {
        const leads = await fetchAll(resources, "crm.lead");
        const responded = leads.filter((l) => l.firstResponseAt && l.createdAt);
        const byOwner = new Map();
        for (const l of responded) {
            const created = parseDate(l.createdAt);
            const resp = parseDate(l.firstResponseAt);
            if (!created || !resp)
                continue;
            const min = (resp.getTime() - created.getTime()) / 60_000;
            const o = str(l.owner, "unassigned");
            const b = byOwner.get(o) ?? { owner: o, count: 0, totalMin: 0, avgMin: 0 };
            b.count++;
            b.totalMin += min;
            byOwner.set(o, b);
        }
        const rows = [...byOwner.values()]
            .map((b) => ({ ...b, avgMin: Math.round(b.count > 0 ? b.totalMin / b.count : 0) }))
            .sort((a, b) => a.avgMin - b.avgMin);
        return {
            columns: [
                { field: "owner", label: "Owner", fieldtype: "text" },
                { field: "count", label: "Responded leads", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "avgMin", label: "Avg minutes", fieldtype: "number", align: "right" },
                { field: "totalMin", label: "Total minutes", fieldtype: "number", align: "right", totaling: "sum" },
            ],
            rows,
            totals: { count: rows.reduce((a, r) => a + r.count, 0) },
            chart: {
                kind: "bar",
                label: "Avg first-response (minutes) — lower is better",
                from: (rs) => rs.map((r) => ({ label: r.owner, value: r.avgMin })),
            },
        };
    },
};
/* ------------------------------------------------------------------- */
/* Registry + discovery + detail pages                                  */
/* ------------------------------------------------------------------- */
export const CRM_REPORTS = [
    leadDetailsReport,
    leadConversionTimeReport,
    leadOwnerEfficiencyReport,
    opportunitySummaryReport,
    pipelineAnalyticsReport,
    campaignEfficiencyReport,
    lostOpportunityReport,
    firstResponseTimeReport,
];
function Icon({ name }) {
    if (!name)
        return null;
    const C = Icons[name];
    if (!C)
        return null;
    return _jsx(C, { className: "h-4 w-4 text-accent" });
}
export const crmReportsIndexView = defineCustomView({
    id: "crm.reports.view",
    title: "CRM Reports",
    description: "Full CRM analytical library.",
    resource: "crm.contact",
    render: () => (_jsxs("div", { className: "flex flex-col gap-4", children: [_jsx(PageHeader, { title: "CRM Reports", description: "Lead conversion, pipeline health, campaign ROI, win-loss analysis \u2014 all live from the record set." }), _jsx("div", { className: "grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3", children: CRM_REPORTS.map((r) => (_jsx(Card, { className: "cursor-pointer hover:border-accent/60 transition-colors", onClick: () => (window.location.hash = `/crm/reports/${r.id}`), children: _jsxs(CardContent, { className: "py-4 flex items-start gap-3", children: [_jsx("div", { className: "h-8 w-8 rounded-md bg-accent-subtle flex items-center justify-center shrink-0", children: _jsx(Icon, { name: r.icon }) }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("div", { className: "text-sm font-medium text-text-primary", children: r.label }), r.description && (_jsx("div", { className: "text-xs text-text-muted mt-0.5 line-clamp-2", children: r.description }))] })] }) }, r.id))) })] })),
});
export const crmReportDetailView = defineCustomView({
    id: "crm.reports-detail.view",
    title: "CRM Report",
    description: "Live CRM report — filterable, exportable.",
    resource: "crm.contact",
    render: () => {
        const hash = useHash();
        const match = hash.match(/^\/crm\/reports\/([^/?]+)/);
        const id = match?.[1];
        const report = id ? CRM_REPORTS.find((r) => r.id === id) : undefined;
        if (!report) {
            return (_jsx(EmptyStateFramework, { kind: "no-results", title: "Report not found", description: `No CRM report with id "${id}".`, primary: { label: "Back to reports", href: "/crm/reports" } }));
        }
        return _jsx(ReportBuilder, { definition: report });
    },
});
