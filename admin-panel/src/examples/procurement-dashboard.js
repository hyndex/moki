import { buildControlRoom } from "./_factory/controlRoomHelper";
import { buildReportLibrary } from "./_factory/reportLibraryHelper";
const workspace = {
    id: "procurement.control-room",
    label: "Procurement Control Room",
    filterBar: [
        {
            field: "status",
            label: "Status",
            kind: "enum",
            options: [
                { value: "draft", label: "Draft" },
                { value: "submitted", label: "Submitted" },
                { value: "pending", label: "Pending" },
                { value: "approved", label: "Approved" },
                { value: "rejected", label: "Rejected" },
                { value: "closed", label: "Closed" },
            ],
        },
        { field: "supplier", label: "Supplier", kind: "text" },
        { field: "buyer", label: "Buyer", kind: "text", placeholder: "Buyer id" },
    ],
    widgets: [
        { id: "h1", type: "header", col: 12, label: "Procurement pulse", level: 2 },
        { id: "k-open", type: "number_card", col: 3, label: "Open POs",
            aggregation: { resource: "procurement.purchase-order", fn: "count",
                filter: { or: [{ field: "status", op: "eq", value: "pending" }, { field: "status", op: "eq", value: "approved" }] } },
            drilldown: "/procurement/pos" },
        { id: "k-spend", type: "number_card", col: 3, label: "Spend MTD",
            aggregation: { resource: "procurement.purchase-order", fn: "sum", field: "total",
                range: { kind: "mtd" } },
            format: "currency" },
        { id: "k-prs", type: "number_card", col: 3, label: "PRs pending approval",
            aggregation: { resource: "procurement.requisition", fn: "count",
                filter: { field: "status", op: "eq", value: "submitted" } },
            warnAbove: 5 },
        { id: "k-suppliers", type: "number_card", col: 3, label: "Active suppliers",
            aggregation: { resource: "procurement.supplier", fn: "count",
                filter: { field: "status", op: "eq", value: "active" } } },
        { id: "h2", type: "header", col: 12, label: "Charts", level: 2 },
        { id: "c-status", type: "chart", col: 6, label: "POs by status", chart: "donut",
            aggregation: { resource: "procurement.purchase-order", fn: "count", groupBy: "status" } },
        { id: "c-supplier", type: "chart", col: 6, label: "Spend by supplier", chart: "bar",
            aggregation: { resource: "procurement.purchase-order", fn: "sum", field: "total", groupBy: "vendor" },
            format: "currency" },
        { id: "c-volume", type: "chart", col: 6, label: "PO volume (30d)", chart: "area",
            aggregation: { resource: "procurement.purchase-order", fn: "count", period: "day", range: { kind: "last", days: 30 } } },
        { id: "c-cat", type: "chart", col: 6, label: "Spend by category", chart: "donut",
            aggregation: { resource: "procurement.purchase-order", fn: "sum", field: "total", groupBy: "category" },
            format: "currency" },
        { id: "h3", type: "header", col: 12, label: "Shortcuts", level: 2 },
        { id: "sc-new-po", type: "shortcut", col: 3, label: "New PO", icon: "Plus", href: "/procurement/pos/new" },
        { id: "sc-new-pr", type: "shortcut", col: 3, label: "New PR", icon: "ClipboardList", href: "/procurement/requisitions/new" },
        { id: "sc-rfq", type: "shortcut", col: 3, label: "New RFQ", icon: "FileQuestion", href: "/procurement/rfqs/new" },
        { id: "sc-reports", type: "shortcut", col: 3, label: "Reports", icon: "BarChart3", href: "/procurement/reports" },
    ],
};
export const procurementControlRoomView = buildControlRoom({
    viewId: "procurement.control-room.view",
    resource: "procurement.purchase-order",
    title: "Procurement Control Room",
    description: "PO pulse, supplier spend, requisition queue.",
    workspace,
});
async function fetchAll(r, resource) {
    return (await r.list(resource, { page: 1, pageSize: 10_000 })).rows;
}
const num = (v) => (typeof v === "number" ? v : 0);
const str = (v, d = "") => (typeof v === "string" ? v : d);
const supplierSpendReport = {
    id: "supplier-spend", label: "Supplier Spend",
    description: "Total spend + PO count per supplier.",
    icon: "DollarSign", resource: "procurement.purchase-order", filters: [],
    async execute({ resources }) {
        const pos = await fetchAll(resources, "procurement.purchase-order");
        const by = new Map();
        for (const p of pos) {
            const s = str(p.vendor);
            const r = by.get(s) ?? { supplier: s, pos: 0, spend: 0, avg: 0 };
            r.pos++;
            r.spend += num(p.total);
            by.set(s, r);
        }
        const rows = [...by.values()]
            .map((r) => ({ ...r, avg: r.pos > 0 ? Math.round(r.spend / r.pos) : 0 }))
            .sort((a, b) => b.spend - a.spend);
        return {
            columns: [
                { field: "supplier", label: "Supplier", fieldtype: "text" },
                { field: "pos", label: "POs", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "spend", label: "Spend", fieldtype: "currency", align: "right", options: "USD", totaling: "sum" },
                { field: "avg", label: "Avg PO", fieldtype: "currency", align: "right", options: "USD" },
            ],
            rows,
            chart: { kind: "bar", label: "Spend", format: "currency", currency: "USD",
                from: (rs) => rs.slice(0, 10).map((r) => ({ label: r.supplier, value: r.spend })) },
        };
    },
};
const poAgingReport = {
    id: "po-aging", label: "PO Aging",
    description: "Open POs bucketed by days open.",
    icon: "Clock", resource: "procurement.purchase-order", filters: [],
    async execute({ resources }) {
        const pos = await fetchAll(resources, "procurement.purchase-order");
        const now = Date.now();
        const buckets = [
            { label: "0-7", min: 0, max: 7 },
            { label: "8-30", min: 8, max: 30 },
            { label: "31-60", min: 31, max: 60 },
            { label: "60+", min: 61, max: Infinity },
        ];
        const rows = buckets.map((b) => ({ bucket: b.label, count: 0, value: 0 }));
        for (const p of pos) {
            if (p.status === "published" || p.status === "archived")
                continue;
            const created = Date.parse(str(p.createdAt));
            if (Number.isNaN(created))
                continue;
            const age = Math.floor((now - created) / 86_400_000);
            const idx = buckets.findIndex((b) => age >= b.min && age <= b.max);
            if (idx >= 0) {
                rows[idx].count++;
                rows[idx].value += num(p.total);
            }
        }
        return {
            columns: [
                { field: "bucket", label: "Bucket", fieldtype: "text" },
                { field: "count", label: "POs", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "value", label: "Value", fieldtype: "currency", align: "right", options: "USD", totaling: "sum" },
            ],
            rows,
        };
    },
};
const supplierPerformanceReport = {
    id: "supplier-performance", label: "Supplier Performance",
    description: "On-time delivery + quality per supplier.",
    icon: "Handshake", resource: "procurement.supplier", filters: [],
    async execute({ resources }) {
        const suppliers = await fetchAll(resources, "procurement.supplier");
        const rows = suppliers.map((s) => ({
            name: str(s.name),
            category: str(s.category),
            onTimeRate: num(s.onTimeRate),
            qualityScore: num(s.qualityScore),
            spend: num(s.totalSpend),
            lastOrderAt: str(s.lastOrderAt),
        })).sort((a, b) => b.qualityScore - a.qualityScore);
        return {
            columns: [
                { field: "name", label: "Supplier", fieldtype: "text" },
                { field: "category", label: "Category", fieldtype: "enum" },
                { field: "onTimeRate", label: "On-time %", fieldtype: "percent", align: "right" },
                { field: "qualityScore", label: "Quality", fieldtype: "number", align: "right" },
                { field: "spend", label: "Spend", fieldtype: "currency", align: "right", options: "USD", totaling: "sum" },
                { field: "lastOrderAt", label: "Last order", fieldtype: "date" },
            ],
            rows,
        };
    },
};
const requisitionReport = {
    id: "requisitions", label: "Purchase Requisitions",
    description: "Requisition funnel: submitted, approved, converted.",
    icon: "ClipboardList", resource: "procurement.requisition", filters: [],
    async execute({ resources }) {
        const reqs = await fetchAll(resources, "procurement.requisition");
        const by = new Map();
        for (const r of reqs) {
            const s = str(r.status);
            const row = by.get(s) ?? { status: s, count: 0, value: 0 };
            row.count++;
            row.value += num(r.estimatedValue);
            by.set(s, row);
        }
        const rows = [...by.values()].sort((a, b) => b.count - a.count);
        return {
            columns: [
                { field: "status", label: "Status", fieldtype: "enum" },
                { field: "count", label: "Count", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "value", label: "Value", fieldtype: "currency", align: "right", options: "USD", totaling: "sum" },
            ],
            rows,
        };
    },
};
const rfqReport = {
    id: "rfq-summary", label: "RFQ Summary",
    description: "RFQs issued + response rate.",
    icon: "FileQuestion", resource: "procurement.rfq", filters: [],
    async execute({ resources }) {
        const rfqs = await fetchAll(resources, "procurement.rfq");
        const rows = rfqs.map((r) => ({
            code: str(r.code),
            title: str(r.title),
            suppliersInvited: num(r.suppliersInvited),
            quotesReceived: num(r.quotesReceived),
            responseRate: num(r.suppliersInvited) > 0 ? Math.round((num(r.quotesReceived) / num(r.suppliersInvited)) * 100) : 0,
            status: str(r.status),
            issuedAt: str(r.issuedAt),
        }));
        return {
            columns: [
                { field: "code", label: "Code", fieldtype: "text" },
                { field: "title", label: "Title", fieldtype: "text" },
                { field: "suppliersInvited", label: "Invited", fieldtype: "number", align: "right" },
                { field: "quotesReceived", label: "Received", fieldtype: "number", align: "right" },
                { field: "responseRate", label: "Response %", fieldtype: "percent", align: "right" },
                { field: "status", label: "Status", fieldtype: "enum" },
                { field: "issuedAt", label: "Issued", fieldtype: "date" },
            ],
            rows,
        };
    },
};
const savingsReport = {
    id: "savings", label: "Cost Savings",
    description: "Savings realized from negotiations + discounts.",
    icon: "PiggyBank", resource: "procurement.purchase-order", filters: [],
    async execute({ resources }) {
        const pos = await fetchAll(resources, "procurement.purchase-order");
        const by = new Map();
        for (const p of pos) {
            const s = str(p.vendor);
            const r = by.get(s) ?? { supplier: s, listTotal: 0, paid: 0, saved: 0, rate: 0 };
            const list = num(p.listTotal) || num(p.total);
            const paid = num(p.total);
            r.listTotal += list;
            r.paid += paid;
            r.saved += Math.max(0, list - paid);
            by.set(s, r);
        }
        const rows = [...by.values()]
            .map((r) => ({ ...r, rate: r.listTotal > 0 ? Math.round((r.saved / r.listTotal) * 100) : 0 }))
            .sort((a, b) => b.saved - a.saved);
        return {
            columns: [
                { field: "supplier", label: "Supplier", fieldtype: "text" },
                { field: "listTotal", label: "List", fieldtype: "currency", align: "right", options: "USD", totaling: "sum" },
                { field: "paid", label: "Paid", fieldtype: "currency", align: "right", options: "USD", totaling: "sum" },
                { field: "saved", label: "Saved", fieldtype: "currency", align: "right", options: "USD", totaling: "sum" },
                { field: "rate", label: "Savings %", fieldtype: "percent", align: "right" },
            ],
            rows,
        };
    },
};
export const PROCUREMENT_REPORTS = [
    supplierSpendReport, poAgingReport, supplierPerformanceReport, requisitionReport, rfqReport, savingsReport,
];
const { indexView, detailView } = buildReportLibrary({
    indexViewId: "procurement.reports.view",
    detailViewId: "procurement.reports-detail.view",
    resource: "procurement.purchase-order",
    title: "Procurement Reports",
    description: "Supplier spend, PO aging, supplier performance, requisitions, RFQs, savings.",
    basePath: "/procurement/reports",
    reports: PROCUREMENT_REPORTS,
});
export const procurementReportsIndexView = indexView;
export const procurementReportsDetailView = detailView;
