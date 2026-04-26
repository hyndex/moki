import { buildControlRoom } from "./_factory/controlRoomHelper";
import { buildReportLibrary } from "./_factory/reportLibraryHelper";
const workspace = {
    id: "accounting.control-room",
    label: "Accounting Control Room",
    filterBar: [
        {
            field: "status",
            label: "Status",
            kind: "enum",
            options: [
                { value: "draft", label: "Draft" },
                { value: "open", label: "Open" },
                { value: "paid", label: "Paid" },
                { value: "overdue", label: "Overdue" },
                { value: "void", label: "Void" },
            ],
        },
        { field: "customer", label: "Customer", kind: "text" },
    ],
    widgets: [
        { id: "h1", type: "header", col: 12, label: "Cash flow pulse", level: 2 },
        { id: "k-ar", type: "number_card", col: 3, label: "AR open",
            aggregation: { resource: "accounting.invoice", fn: "sum", field: "amount",
                filter: { or: [{ field: "status", op: "eq", value: "open" }, { field: "status", op: "eq", value: "overdue" }] } },
            format: "currency", drilldown: "/accounting/invoices" },
        { id: "k-overdue", type: "number_card", col: 3, label: "Overdue",
            aggregation: { resource: "accounting.invoice", fn: "sum", field: "amount",
                filter: { field: "status", op: "eq", value: "overdue" } },
            format: "currency", drilldown: "/accounting/invoices", warnAbove: 50000, dangerAbove: 200000 },
        { id: "k-collected", type: "number_card", col: 3, label: "Collected MTD",
            aggregation: { resource: "accounting.invoice", fn: "sum", field: "amount",
                filter: { field: "status", op: "eq", value: "paid" }, range: { kind: "mtd" } },
            format: "currency", trend: true },
        { id: "k-journals", type: "number_card", col: 3, label: "Journal entries MTD",
            aggregation: { resource: "accounting.journal-entry", fn: "count", range: { kind: "mtd" } },
            drilldown: "/accounting/journal-entries" },
        { id: "h2", type: "header", col: 12, label: "Charts", level: 2 },
        { id: "c-inv-status", type: "chart", col: 6, label: "Invoices by status", chart: "donut",
            aggregation: { resource: "accounting.invoice", fn: "count", groupBy: "status" }, drilldown: "/accounting/invoices" },
        { id: "c-ap-status", type: "chart", col: 6, label: "Bills by status", chart: "donut",
            aggregation: { resource: "accounting.bill", fn: "count", groupBy: "status" }, drilldown: "/accounting/bills" },
        { id: "c-payments", type: "chart", col: 6, label: "Payments (30d)", chart: "area",
            aggregation: { resource: "accounting.payment-entry", fn: "sum", field: "amount", period: "day", range: { kind: "last", days: 30 } }, format: "currency" },
        { id: "c-budget", type: "chart", col: 6, label: "Budget vs Actual", chart: "bar",
            aggregation: { resource: "accounting.budget", fn: "sum", field: "actual", groupBy: "department" }, format: "currency" },
        { id: "h3", type: "header", col: 12, label: "Shortcuts", level: 2 },
        { id: "sc-invoice", type: "shortcut", col: 3, label: "New invoice", icon: "FileText", href: "/accounting/invoices/new" },
        { id: "sc-payment", type: "shortcut", col: 3, label: "Record payment", icon: "CreditCard", href: "/accounting/payment-entries/new" },
        { id: "sc-journal", type: "shortcut", col: 3, label: "Journal entry", icon: "BookOpen", href: "/accounting/journal-entries/new" },
        { id: "sc-reports", type: "shortcut", col: 3, label: "Reports", icon: "BarChart3", href: "/accounting/reports" },
        { id: "h4", type: "header", col: 12, label: "Attention", level: 2 },
        { id: "ql-overdue", type: "quick_list", col: 6, label: "Overdue invoices",
            resource: "accounting.invoice", sort: { field: "dueAt", dir: "asc" }, limit: 10,
            primary: "number", secondary: "customer", href: (r) => `/accounting/invoices/${r.id}` },
        { id: "ql-bills", type: "quick_list", col: 6, label: "Bills due",
            resource: "accounting.bill", sort: { field: "dueAt", dir: "asc" }, limit: 10,
            primary: "number", secondary: "vendor", href: (r) => `/accounting/bills/${r.id}` },
    ],
};
export const accountingControlRoomView = buildControlRoom({
    viewId: "accounting.control-room.view",
    resource: "accounting.invoice",
    title: "Accounting Control Room",
    description: "AR/AP pulse, cash flow, journals, budget variance.",
    workspace,
});
async function fetchAll(r, resource) {
    return (await r.list(resource, { page: 1, pageSize: 10_000 })).rows;
}
const num = (v) => typeof v === "number" ? v : 0;
const str = (v, d = "") => typeof v === "string" ? v : d;
const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const arAgingReport = {
    id: "ar-aging", label: "Accounts Receivable Aging",
    description: "Outstanding invoices bucketed by days overdue.",
    icon: "Receipt", resource: "accounting.invoice", filters: [],
    async execute({ resources }) {
        const inv = await fetchAll(resources, "accounting.invoice");
        const now = Date.now();
        const buckets = [
            { label: "Current", min: -Infinity, max: 0 },
            { label: "1-30 days", min: 1, max: 30 },
            { label: "31-60 days", min: 31, max: 60 },
            { label: "61-90 days", min: 61, max: 90 },
            { label: "90+ days", min: 91, max: Infinity },
        ];
        const rows = buckets.map((b) => ({ bucket: b.label, count: 0, outstanding: 0 }));
        for (const i of inv) {
            if (i.status === "paid" || i.status === "cancelled")
                continue;
            const due = i.dueAt ? new Date(str(i.dueAt)) : null;
            if (!due || Number.isNaN(due.getTime()))
                continue;
            const days = Math.floor((now - due.getTime()) / 86_400_000);
            const idx = buckets.findIndex((b) => days >= b.min && days <= b.max);
            if (idx >= 0) {
                rows[idx].count++;
                rows[idx].outstanding += num(i.amount);
            }
        }
        return {
            columns: [
                { field: "bucket", label: "Bucket", fieldtype: "text" },
                { field: "count", label: "Invoices", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "outstanding", label: "Outstanding", fieldtype: "currency", align: "right", options: "USD", totaling: "sum" },
            ],
            rows,
            totals: { count: rows.reduce((a, r) => a + r.count, 0), outstanding: rows.reduce((a, r) => a + r.outstanding, 0) },
            chart: { kind: "donut", label: "Outstanding by bucket", format: "currency", currency: "USD",
                from: (rs) => rs.map((r) => ({ label: r.bucket, value: r.outstanding })) },
        };
    },
};
const apAgingReport = {
    id: "ap-aging", label: "Accounts Payable Aging",
    description: "Bills outstanding bucketed by days overdue.",
    icon: "FileText", resource: "accounting.bill", filters: [],
    async execute({ resources }) {
        const bills = await fetchAll(resources, "accounting.bill");
        const now = Date.now();
        const buckets = [
            { label: "Current", min: -Infinity, max: 0 },
            { label: "1-30", min: 1, max: 30 },
            { label: "31-60", min: 31, max: 60 },
            { label: "61-90", min: 61, max: 90 },
            { label: "90+", min: 91, max: Infinity },
        ];
        const rows = buckets.map((b) => ({ bucket: b.label, count: 0, owed: 0 }));
        for (const b of bills) {
            if (b.status === "paid" || b.status === "cancelled")
                continue;
            const due = b.dueAt ? new Date(str(b.dueAt)) : null;
            if (!due || Number.isNaN(due.getTime()))
                continue;
            const days = Math.floor((now - due.getTime()) / 86_400_000);
            const idx = buckets.findIndex((x) => days >= x.min && days <= x.max);
            if (idx >= 0) {
                rows[idx].count++;
                rows[idx].owed += num(b.amount);
            }
        }
        return {
            columns: [
                { field: "bucket", label: "Bucket", fieldtype: "text" },
                { field: "count", label: "Bills", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "owed", label: "Owed", fieldtype: "currency", align: "right", options: "USD", totaling: "sum" },
            ],
            rows, totals: { count: rows.reduce((a, r) => a + r.count, 0), owed: rows.reduce((a, r) => a + r.owed, 0) },
        };
    },
};
const invoiceTrendsReport = {
    id: "invoice-trends", label: "Invoice Trends",
    description: "Monthly invoice volume + collection.",
    icon: "TrendingUp", resource: "accounting.invoice", filters: [],
    async execute({ resources }) {
        const inv = await fetchAll(resources, "accounting.invoice");
        const byMonth = new Map();
        for (const i of inv) {
            const d = i.issuedAt ? new Date(str(i.issuedAt)) : null;
            if (!d || Number.isNaN(d.getTime()))
                continue;
            const k = monthKey(d);
            const b = byMonth.get(k) ?? { month: k, count: 0, billed: 0, collected: 0 };
            b.count++;
            b.billed += num(i.amount);
            if (i.status === "paid")
                b.collected += num(i.amount);
            byMonth.set(k, b);
        }
        const rows = [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month));
        return {
            columns: [
                { field: "month", label: "Month", fieldtype: "text" },
                { field: "count", label: "Invoices", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "billed", label: "Billed", fieldtype: "currency", align: "right", options: "USD", totaling: "sum" },
                { field: "collected", label: "Collected", fieldtype: "currency", align: "right", options: "USD", totaling: "sum" },
            ],
            rows,
            chart: { kind: "line", label: "Billed vs collected", format: "currency", currency: "USD",
                from: (rs) => rs.map((r) => ({ label: r.month, value: r.collected })) },
        };
    },
};
const budgetVarianceReport = {
    id: "budget-variance", label: "Budget Variance",
    description: "Budget vs actual spend by department.",
    icon: "Gauge", resource: "accounting.budget", filters: [],
    async execute({ resources }) {
        const rs = await fetchAll(resources, "accounting.budget");
        const rows = rs.map((b) => {
            const bud = num(b.budget), act = num(b.actual);
            return { department: str(b.department), period: str(b.period),
                budget: bud, actual: act, variance: bud - act,
                variancePct: bud > 0 ? Math.round(((bud - act) / bud) * 100) : 0 };
        }).sort((a, b) => a.variance - b.variance);
        return {
            columns: [
                { field: "department", label: "Department", fieldtype: "text" },
                { field: "period", label: "Period", fieldtype: "text" },
                { field: "budget", label: "Budget", fieldtype: "currency", align: "right", options: "USD", totaling: "sum" },
                { field: "actual", label: "Actual", fieldtype: "currency", align: "right", options: "USD", totaling: "sum" },
                { field: "variance", label: "Variance", fieldtype: "currency", align: "right", options: "USD" },
                { field: "variancePct", label: "Var %", fieldtype: "percent", align: "right" },
            ],
            rows,
            chart: { kind: "bar", label: "Variance % by department", format: "percent",
                from: (rs2) => rs2.map((r) => ({ label: r.department, value: r.variancePct })) },
        };
    },
};
const cashFlowReport = {
    id: "cash-flow", label: "Cash Flow",
    description: "Inflows (collections) vs outflows (bills paid) by month.",
    icon: "Waves", resource: "accounting.payment-entry", filters: [],
    async execute({ resources }) {
        const pays = await fetchAll(resources, "accounting.payment-entry");
        const byMonth = new Map();
        for (const p of pays) {
            const d = p.postedAt ? new Date(str(p.postedAt)) : null;
            if (!d || Number.isNaN(d.getTime()))
                continue;
            const k = monthKey(d);
            const b = byMonth.get(k) ?? { month: k, in: 0, out: 0, net: 0 };
            if (p.direction === "receive")
                b.in += num(p.amount);
            else
                b.out += num(p.amount);
            b.net = b.in - b.out;
            byMonth.set(k, b);
        }
        const rows = [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month));
        return {
            columns: [
                { field: "month", label: "Month", fieldtype: "text" },
                { field: "in", label: "Inflows", fieldtype: "currency", align: "right", options: "USD", totaling: "sum" },
                { field: "out", label: "Outflows", fieldtype: "currency", align: "right", options: "USD", totaling: "sum" },
                { field: "net", label: "Net", fieldtype: "currency", align: "right", options: "USD" },
            ],
            rows,
            chart: { kind: "line", label: "Net cash flow", format: "currency", currency: "USD",
                from: (rs) => rs.map((r) => ({ label: r.month, value: r.net })) },
        };
    },
};
const taxSummaryReport = {
    id: "tax-summary", label: "Tax Summary",
    description: "Tax rules with effective rate + applicability.",
    icon: "Scale", resource: "accounting.tax-rule", filters: [],
    async execute({ resources }) {
        const rs = await fetchAll(resources, "accounting.tax-rule");
        return {
            columns: [
                { field: "name", label: "Rule", fieldtype: "text" },
                { field: "rate", label: "Rate %", fieldtype: "percent", align: "right" },
                { field: "jurisdiction", label: "Jurisdiction", fieldtype: "text" },
                { field: "category", label: "Category", fieldtype: "enum" },
                { field: "active", label: "Active", fieldtype: "text" },
            ],
            rows: rs.map((r) => ({
                name: str(r.name), rate: num(r.rate), jurisdiction: str(r.jurisdiction),
                category: str(r.category), active: r.active ? "Yes" : "No",
            })),
        };
    },
};
export const ACCOUNTING_REPORTS = [
    arAgingReport, apAgingReport, invoiceTrendsReport, budgetVarianceReport, cashFlowReport, taxSummaryReport,
];
const { indexView, detailView } = buildReportLibrary({
    indexViewId: "accounting.reports.view", detailViewId: "accounting.reports-detail.view",
    resource: "accounting.invoice", title: "Accounting Reports",
    description: "AR/AP aging, trends, cash flow, budget variance, tax.",
    basePath: "/accounting/reports", reports: ACCOUNTING_REPORTS,
});
export const accountingReportsIndexView = indexView;
export const accountingReportsDetailView = detailView;
