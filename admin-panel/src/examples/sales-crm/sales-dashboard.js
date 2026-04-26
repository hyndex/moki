import { buildControlRoom } from "../_factory/controlRoomHelper";
import { buildReportLibrary } from "../_factory/reportLibraryHelper";
const workspace = {
    id: "sales.control-room",
    label: "Sales Control Room",
    // Cross-widget filter bar — selections flow into every widget's aggregation.
    filterBar: [
        {
            field: "owner",
            label: "Owner",
            kind: "text",
            placeholder: "Owner email",
        },
        {
            field: "stage",
            label: "Stage",
            kind: "enum",
            options: [
                { value: "lead", label: "Lead" },
                { value: "qualified", label: "Qualified" },
                { value: "proposal", label: "Proposal" },
                { value: "negotiation", label: "Negotiation" },
                { value: "won", label: "Won" },
                { value: "lost", label: "Lost" },
            ],
        },
    ],
    widgets: [
        { id: "h-pulse", type: "header", col: 12, label: "Pulse", level: 2 },
        { id: "k-pipeline", type: "number_card", col: 3, label: "Open pipeline",
            aggregation: { resource: "sales.deal", fn: "sum", field: "amount",
                filter: { field: "stage", op: "nin", value: ["won", "lost"] } },
            format: "currency", drilldown: "/sales/deals" },
        { id: "k-won-mtd", type: "number_card", col: 3, label: "Won MTD",
            aggregation: { resource: "sales.deal", fn: "sum", field: "amount",
                filter: { field: "stage", op: "eq", value: "won" },
                range: { kind: "mtd" } },
            format: "currency", trend: true, drilldown: "/sales/revenue" },
        { id: "k-win-rate", type: "number_card", col: 3, label: "Active deals",
            aggregation: { resource: "sales.deal", fn: "count",
                filter: { field: "stage", op: "nin", value: ["won", "lost"] } },
            drilldown: "/sales/pipeline" },
        { id: "k-quotes-open", type: "number_card", col: 3, label: "Open quotes",
            aggregation: { resource: "sales.quote", fn: "count" },
            drilldown: "/sales/quotes" },
        { id: "h-pipe", type: "header", col: 12, label: "Pipeline & forecast", level: 2 },
        { id: "c-by-stage", type: "chart", col: 6, label: "Deals by stage", chart: "bar",
            aggregation: { resource: "sales.deal", fn: "sum", field: "amount", groupBy: "stage" },
            format: "currency", drilldown: "/sales/pipeline", height: 220 },
        { id: "c-by-owner", type: "chart", col: 6, label: "Pipeline by owner", chart: "donut",
            aggregation: { resource: "sales.deal", fn: "sum", field: "amount", groupBy: "owner",
                filter: { field: "stage", op: "nin", value: ["won", "lost"] } },
            format: "currency", drilldown: "/sales/leaderboard" },
        { id: "h-territory", type: "header", col: 12, label: "Territory + partners", level: 2 },
        { id: "c-terr-rev", type: "chart", col: 6, label: "Revenue by territory", chart: "bar",
            aggregation: { resource: "sales.territory", fn: "sum", field: "ytdRevenue", groupBy: "name" },
            format: "currency" },
        { id: "c-partner-rev", type: "chart", col: 6, label: "Revenue by partner", chart: "bar",
            aggregation: { resource: "sales.sales-partner", fn: "sum", field: "ytdRevenue", groupBy: "name" },
            format: "currency" },
        { id: "h-sc", type: "header", col: 12, label: "Shortcuts", level: 2 },
        { id: "sc-new-deal", type: "shortcut", col: 3, label: "New deal", icon: "Handshake", href: "/sales/deals/new" },
        { id: "sc-new-quote", type: "shortcut", col: 3, label: "New quote", icon: "FileText", href: "/sales/quotes/new" },
        { id: "sc-forecast", type: "shortcut", col: 3, label: "Forecast", icon: "Target", href: "/sales/forecast" },
        { id: "sc-reports", type: "shortcut", col: 3, label: "Reports library", icon: "BarChart3", href: "/sales/reports" },
        { id: "h-attn", type: "header", col: 12, label: "Attention needed", level: 2 },
        { id: "ql-closing", type: "quick_list", col: 4, label: "Deals closing soon",
            resource: "sales.deal", sort: { field: "closeAt", dir: "asc" }, limit: 8,
            primary: "name", secondary: "account", href: (r) => `/sales/deals/${r.id}` },
        { id: "ql-credit", type: "quick_list", col: 4, label: "Credit limits at risk",
            resource: "sales.customer-credit-limit",
            sort: { field: "utilized", dir: "desc" }, limit: 8,
            primary: "customer", secondary: "status" },
        { id: "ql-delivery", type: "quick_list", col: 4, label: "Upcoming deliveries",
            resource: "sales.delivery-schedule",
            sort: { field: "scheduledAt", dir: "asc" }, limit: 8,
            primary: "orderId", secondary: "item" },
    ],
};
export const salesControlRoomView = buildControlRoom({
    viewId: "sales.control-room.view",
    resource: "sales.deal",
    title: "Sales Control Room",
    description: "Pipeline, attainment, territory, and partner revenue at a glance.",
    workspace,
});
/* Reports */
async function fetchAll(resources, r) {
    return (await resources.list(r, { page: 1, pageSize: 10_000 })).rows;
}
const num = (v, d = 0) => (typeof v === "number" && !Number.isNaN(v) ? v : d);
const str = (v, d = "") => (typeof v === "string" ? v : d);
const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const salesAnalyticsReport = {
    id: "sales-analytics", label: "Sales Analytics",
    description: "Monthly bookings, pipeline velocity, stage distribution.",
    icon: "TrendingUp", resource: "sales.deal", filters: [],
    async execute({ resources }) {
        const deals = await fetchAll(resources, "sales.deal");
        const byMonth = new Map();
        for (const d of deals) {
            const created = d.createdAt ? new Date(str(d.createdAt)) : null;
            if (!created || Number.isNaN(created.getTime()))
                continue;
            const k = monthKey(created);
            const b = byMonth.get(k) ?? { month: k, opened: 0, won: 0, lost: 0, count: 0 };
            const amt = num(d.amount);
            b.count++;
            b.opened += amt;
            if (d.stage === "won")
                b.won += amt;
            if (d.stage === "lost")
                b.lost += amt;
            byMonth.set(k, b);
        }
        const rows = [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month));
        return {
            columns: [
                { field: "month", label: "Month", fieldtype: "text" },
                { field: "count", label: "Deals", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "opened", label: "Opened $", fieldtype: "currency", align: "right", options: "USD", totaling: "sum" },
                { field: "won", label: "Won $", fieldtype: "currency", align: "right", options: "USD", totaling: "sum" },
                { field: "lost", label: "Lost $", fieldtype: "currency", align: "right", options: "USD", totaling: "sum" },
            ],
            rows,
            totals: { count: rows.reduce((a, r) => a + r.count, 0), opened: rows.reduce((a, r) => a + r.opened, 0), won: rows.reduce((a, r) => a + r.won, 0), lost: rows.reduce((a, r) => a + r.lost, 0) },
            chart: { kind: "bar", label: "Bookings by month", format: "currency", currency: "USD",
                from: (rs) => rs.map((r) => ({ label: r.month, value: r.won })) },
        };
    },
};
const territoryVarianceReport = {
    id: "territory-target-variance", label: "Territory Target Variance",
    description: "Territory revenue vs target + attainment %.",
    icon: "Map", resource: "sales.territory", filters: [],
    async execute({ resources }) {
        const ts = await fetchAll(resources, "sales.territory");
        const rows = ts.map((t) => {
            const ytd = num(t.ytdRevenue), tgt = num(t.target);
            return {
                name: str(t.name), manager: str(t.manager),
                ytdRevenue: ytd, target: tgt,
                attainment: tgt > 0 ? Math.round((ytd / tgt) * 100) : 0,
                gap: tgt - ytd,
            };
        }).sort((a, b) => b.attainment - a.attainment);
        return {
            columns: [
                { field: "name", label: "Territory", fieldtype: "text" },
                { field: "manager", label: "Manager", fieldtype: "text" },
                { field: "ytdRevenue", label: "YTD revenue", fieldtype: "currency", align: "right", options: "USD", totaling: "sum" },
                { field: "target", label: "Target", fieldtype: "currency", align: "right", options: "USD", totaling: "sum" },
                { field: "attainment", label: "Attainment %", fieldtype: "percent", align: "right" },
                { field: "gap", label: "Gap to target", fieldtype: "currency", align: "right", options: "USD" },
            ],
            rows,
            totals: { ytdRevenue: rows.reduce((a, r) => a + r.ytdRevenue, 0), target: rows.reduce((a, r) => a + r.target, 0) },
            chart: { kind: "bar", label: "Attainment % by territory", format: "percent",
                from: (rs) => rs.map((r) => ({ label: r.name, value: r.attainment })) },
        };
    },
};
const partnerCommissionReport = {
    id: "partner-commission", label: "Sales Partner Commission",
    description: "Commission earned by each partner from YTD revenue.",
    icon: "Handshake", resource: "sales.sales-partner", filters: [],
    async execute({ resources }) {
        const ps = await fetchAll(resources, "sales.sales-partner");
        const rows = ps.map((p) => {
            const rev = num(p.ytdRevenue), rate = num(p.commissionRate);
            return { name: str(p.name), partnerType: str(p.partnerType), territory: str(p.territory),
                ytdRevenue: rev, commissionRate: rate,
                earned: Math.round(rev * rate / 100) };
        }).sort((a, b) => b.earned - a.earned);
        return {
            columns: [
                { field: "name", label: "Partner", fieldtype: "text" },
                { field: "partnerType", label: "Type", fieldtype: "enum" },
                { field: "territory", label: "Territory", fieldtype: "text" },
                { field: "ytdRevenue", label: "YTD revenue", fieldtype: "currency", align: "right", options: "USD", totaling: "sum" },
                { field: "commissionRate", label: "Rate %", fieldtype: "percent", align: "right" },
                { field: "earned", label: "Earned", fieldtype: "currency", align: "right", options: "USD", totaling: "sum" },
            ],
            rows,
            totals: { ytdRevenue: rows.reduce((a, r) => a + r.ytdRevenue, 0), earned: rows.reduce((a, r) => a + r.earned, 0) },
            chart: { kind: "bar", label: "Commission earned", format: "currency", currency: "USD",
                from: (rs) => rs.map((r) => ({ label: r.name, value: r.earned })) },
        };
    },
};
const creditBalanceReport = {
    id: "customer-credit-balance", label: "Customer Credit Balance",
    description: "Credit utilization per customer; flags near-limit and exceeded.",
    icon: "CreditCard", resource: "sales.customer-credit-limit", filters: [],
    async execute({ resources }) {
        const cs = await fetchAll(resources, "sales.customer-credit-limit");
        const rows = cs.map((c) => ({
            customer: str(c.customer), limit: num(c.limit), utilized: num(c.utilized),
            available: num(c.limit) - num(c.utilized),
            utilizationPct: num(c.limit) > 0 ? Math.round((num(c.utilized) / num(c.limit)) * 100) : 0,
            status: str(c.status),
        })).sort((a, b) => b.utilizationPct - a.utilizationPct);
        return {
            columns: [
                { field: "customer", label: "Customer", fieldtype: "text" },
                { field: "limit", label: "Limit", fieldtype: "currency", align: "right", options: "USD" },
                { field: "utilized", label: "Utilized", fieldtype: "currency", align: "right", options: "USD", totaling: "sum" },
                { field: "available", label: "Available", fieldtype: "currency", align: "right", options: "USD" },
                { field: "utilizationPct", label: "Util %", fieldtype: "percent", align: "right" },
                { field: "status", label: "Status", fieldtype: "enum" },
            ],
            rows,
            totals: { utilized: rows.reduce((a, r) => a + r.utilized, 0) },
        };
    },
};
const quoteTrendsReport = {
    id: "quote-trends", label: "Quotation Trends",
    description: "Monthly quotation volume, value, and conversion.",
    icon: "FileText", resource: "sales.quote", filters: [],
    async execute({ resources }) {
        const qs = await fetchAll(resources, "sales.quote");
        const byMonth = new Map();
        for (const q of qs) {
            const d = q.createdAt ? new Date(str(q.createdAt)) : null;
            if (!d || Number.isNaN(d.getTime()))
                continue;
            const k = monthKey(d);
            const b = byMonth.get(k) ?? { month: k, count: 0, value: 0 };
            b.count++;
            b.value += num(q.amount);
            byMonth.set(k, b);
        }
        const rows = [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month));
        return {
            columns: [
                { field: "month", label: "Month", fieldtype: "text" },
                { field: "count", label: "Quotes", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "value", label: "Total value", fieldtype: "currency", align: "right", options: "USD", totaling: "sum" },
            ],
            rows,
            chart: { kind: "line", label: "Quote value by month", format: "currency", currency: "USD",
                from: (rs) => rs.map((r) => ({ label: r.month, value: r.value })) },
        };
    },
};
const pricingUsageReport = {
    id: "pricing-rule-usage", label: "Pricing Rule Usage",
    description: "Active pricing rules + discount breakdown.",
    icon: "Tag", resource: "sales.pricing-rule", filters: [],
    async execute({ resources }) {
        const rs = await fetchAll(resources, "sales.pricing-rule");
        const byType = new Map();
        for (const r of rs) {
            const t = str(r.discountType);
            const b = byType.get(t) ?? { type: t, count: 0, avgValue: 0, total: 0 };
            b.count++;
            b.total += num(r.discountValue);
            byType.set(t, b);
        }
        const rows = [...byType.values()].map((b) => ({ ...b, avgValue: b.count > 0 ? Math.round(b.total / b.count) : 0 }));
        return {
            columns: [
                { field: "type", label: "Discount type", fieldtype: "enum" },
                { field: "count", label: "Rules", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "avgValue", label: "Avg value", fieldtype: "number", align: "right" },
                { field: "total", label: "Total value", fieldtype: "number", align: "right", totaling: "sum" },
            ],
            rows,
            chart: { kind: "donut", label: "Rules by discount type",
                from: (rs2) => rs2.map((r) => ({ label: r.type, value: r.count })) },
        };
    },
};
export const SALES_REPORTS = [
    salesAnalyticsReport, territoryVarianceReport, partnerCommissionReport,
    creditBalanceReport, quoteTrendsReport, pricingUsageReport,
];
const { indexView, detailView } = buildReportLibrary({
    indexViewId: "sales.reports.view",
    detailViewId: "sales.reports-detail.view",
    resource: "sales.deal",
    title: "Sales Reports",
    description: "Analytics across deals, territories, partners, credit, quotes, pricing.",
    basePath: "/sales/reports",
    reports: SALES_REPORTS,
});
export const salesReportsIndexView = indexView;
export const salesReportsDetailView = detailView;
