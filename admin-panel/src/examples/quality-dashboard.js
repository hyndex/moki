import { buildControlRoom } from "./_factory/controlRoomHelper";
import { buildReportLibrary } from "./_factory/reportLibraryHelper";
const workspace = {
    id: "quality.control-room",
    label: "Quality Control Room",
    filterBar: [
        {
            field: "status",
            label: "Status",
            kind: "enum",
            options: [
                { value: "open", label: "Open" },
                { value: "in_progress", label: "In progress" },
                { value: "passed", label: "Passed" },
                { value: "failed", label: "Failed" },
                { value: "closed", label: "Closed" },
            ],
        },
        { field: "inspector", label: "Inspector", kind: "text" },
    ],
    widgets: [
        { id: "h1", type: "header", col: 12, label: "Quality pulse", level: 2 },
        { id: "k-pending", type: "number_card", col: 3, label: "Pending inspections",
            aggregation: { resource: "quality.inspection", fn: "count",
                filter: { field: "status", op: "eq", value: "open" } },
            drilldown: "/quality/inspections", warnAbove: 10 },
        { id: "k-ncr", type: "number_card", col: 3, label: "Open NCRs",
            aggregation: { resource: "quality.ncr", fn: "count",
                filter: { field: "status", op: "neq", value: "closed" } },
            drilldown: "/quality/ncrs", warnAbove: 3, dangerAbove: 10 },
        { id: "k-capa", type: "number_card", col: 3, label: "Active CAPAs",
            aggregation: { resource: "quality.capa", fn: "count",
                filter: { field: "status", op: "neq", value: "closed" } },
            drilldown: "/quality/capas" },
        { id: "k-passrate", type: "number_card", col: 3, label: "Pass rate (30d)",
            aggregation: { resource: "quality.inspection", fn: "avg", field: "passRate",
                range: { kind: "last", days: 30 } } },
        { id: "h2", type: "header", col: 12, label: "Charts", level: 2 },
        { id: "c-sev", type: "chart", col: 6, label: "Inspections by severity", chart: "donut",
            aggregation: { resource: "quality.inspection", fn: "count", groupBy: "severity" } },
        { id: "c-product", type: "chart", col: 6, label: "NCRs by product", chart: "bar",
            aggregation: { resource: "quality.ncr", fn: "count", groupBy: "product" } },
        { id: "c-volume", type: "chart", col: 6, label: "Inspections (30d)", chart: "area",
            aggregation: { resource: "quality.inspection", fn: "count", period: "day", range: { kind: "last", days: 30 } } },
        { id: "c-defects", type: "chart", col: 6, label: "Defects by type", chart: "donut",
            aggregation: { resource: "quality.defect", fn: "count", groupBy: "defectType" } },
        { id: "h3", type: "header", col: 12, label: "Shortcuts", level: 2 },
        { id: "sc-new", type: "shortcut", col: 3, label: "New inspection", icon: "Plus", href: "/quality/inspections/new" },
        { id: "sc-ncr", type: "shortcut", col: 3, label: "New NCR", icon: "AlertOctagon", href: "/quality/ncrs/new" },
        { id: "sc-capa", type: "shortcut", col: 3, label: "New CAPA", icon: "ClipboardCheck", href: "/quality/capas/new" },
        { id: "sc-reports", type: "shortcut", col: 3, label: "Reports", icon: "BarChart3", href: "/quality/reports" },
    ],
};
export const qualityControlRoomView = buildControlRoom({
    viewId: "quality.control-room.view",
    resource: "quality.inspection",
    title: "Quality Control Room",
    description: "Inspection pulse, NCRs, CAPAs, defect hotspots.",
    workspace,
});
async function fetchAll(r, resource) {
    return (await r.list(resource, { page: 1, pageSize: 10_000 })).rows;
}
const num = (v) => (typeof v === "number" ? v : 0);
const str = (v, d = "") => (typeof v === "string" ? v : d);
const passRateReport = {
    id: "pass-rate", label: "Inspection Pass Rate",
    description: "Pass/fail rate per product + inspector.",
    icon: "CheckCircle2", resource: "quality.inspection", filters: [],
    async execute({ resources }) {
        const inspections = await fetchAll(resources, "quality.inspection");
        const by = new Map();
        for (const ins of inspections) {
            const p = str(ins.product);
            const r = by.get(p) ?? { product: p, total: 0, passed: 0, failed: 0, rate: 0 };
            r.total++;
            if (ins.result === "pass")
                r.passed++;
            else if (ins.result === "fail")
                r.failed++;
            by.set(p, r);
        }
        const rows = [...by.values()]
            .map((r) => ({ ...r, rate: r.total > 0 ? Math.round((r.passed / r.total) * 100) : 0 }))
            .sort((a, b) => a.rate - b.rate);
        return {
            columns: [
                { field: "product", label: "Product", fieldtype: "text" },
                { field: "total", label: "Total", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "passed", label: "Passed", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "failed", label: "Failed", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "rate", label: "Pass %", fieldtype: "percent", align: "right" },
            ],
            rows,
        };
    },
};
const ncrAgingReport = {
    id: "ncr-aging", label: "NCR Aging",
    description: "Open NCRs bucketed by days open.",
    icon: "Clock", resource: "quality.ncr", filters: [],
    async execute({ resources }) {
        const ncrs = await fetchAll(resources, "quality.ncr");
        const now = Date.now();
        const buckets = [
            { label: "0-7 days", min: 0, max: 7 },
            { label: "8-30", min: 8, max: 30 },
            { label: "31-60", min: 31, max: 60 },
            { label: "60+", min: 61, max: Infinity },
        ];
        const rows = buckets.map((b) => ({ bucket: b.label, count: 0 }));
        for (const n of ncrs) {
            if (n.status === "closed")
                continue;
            const d = Date.parse(str(n.openedAt));
            if (Number.isNaN(d))
                continue;
            const age = Math.floor((now - d) / 86_400_000);
            const idx = buckets.findIndex((b) => age >= b.min && age <= b.max);
            if (idx >= 0)
                rows[idx].count++;
        }
        return {
            columns: [
                { field: "bucket", label: "Bucket", fieldtype: "text" },
                { field: "count", label: "Open NCRs", fieldtype: "number", align: "right", totaling: "sum" },
            ],
            rows,
            chart: { kind: "bar", label: "NCR aging",
                from: (rs) => rs.map((r) => ({ label: r.bucket, value: r.count })) },
        };
    },
};
const defectParetoReport = {
    id: "defect-pareto", label: "Defect Pareto",
    description: "Top defect types by frequency + cost impact.",
    icon: "BarChart", resource: "quality.defect", filters: [],
    async execute({ resources }) {
        const defects = await fetchAll(resources, "quality.defect");
        const by = new Map();
        for (const d of defects) {
            const t = str(d.defectType);
            const r = by.get(t) ?? { defectType: t, count: 0, cost: 0 };
            r.count++;
            r.cost += num(d.cost);
            by.set(t, r);
        }
        const rows = [...by.values()].sort((a, b) => b.count - a.count);
        return {
            columns: [
                { field: "defectType", label: "Defect type", fieldtype: "text" },
                { field: "count", label: "Count", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "cost", label: "Cost $", fieldtype: "currency", align: "right", options: "USD", totaling: "sum" },
            ],
            rows,
            chart: { kind: "bar", label: "Defects by type",
                from: (rs) => rs.map((r) => ({ label: r.defectType, value: r.count })) },
        };
    },
};
const capaEffectivenessReport = {
    id: "capa-effectiveness", label: "CAPA Effectiveness",
    description: "% of CAPAs closed on-time and verified.",
    icon: "ClipboardCheck", resource: "quality.capa", filters: [],
    async execute({ resources }) {
        const capas = await fetchAll(resources, "quality.capa");
        const by = new Map();
        for (const c of capas) {
            const s = str(c.status);
            const r = by.get(s) ?? { status: s, count: 0, verified: 0 };
            r.count++;
            if (c.verified)
                r.verified++;
            by.set(s, r);
        }
        const rows = [...by.values()].sort((a, b) => b.count - a.count);
        return {
            columns: [
                { field: "status", label: "Status", fieldtype: "enum" },
                { field: "count", label: "Count", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "verified", label: "Verified", fieldtype: "number", align: "right", totaling: "sum" },
            ],
            rows,
        };
    },
};
const supplierQualityReport = {
    id: "supplier-quality", label: "Supplier Quality",
    description: "Defect rate by supplier.",
    icon: "Handshake", resource: "quality.defect", filters: [],
    async execute({ resources }) {
        const defects = await fetchAll(resources, "quality.defect");
        const by = new Map();
        for (const d of defects) {
            const s = str(d.supplier, "Unknown");
            const r = by.get(s) ?? { supplier: s, defects: 0, cost: 0 };
            r.defects++;
            r.cost += num(d.cost);
            by.set(s, r);
        }
        const rows = [...by.values()].sort((a, b) => b.defects - a.defects);
        return {
            columns: [
                { field: "supplier", label: "Supplier", fieldtype: "text" },
                { field: "defects", label: "Defects", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "cost", label: "Cost $", fieldtype: "currency", align: "right", options: "USD", totaling: "sum" },
            ],
            rows,
        };
    },
};
const auditFindingsReport = {
    id: "audit-findings", label: "Audit Findings",
    description: "Quality audit findings by severity + open/closed.",
    icon: "ClipboardList", resource: "quality.audit", filters: [],
    async execute({ resources }) {
        const audits = await fetchAll(resources, "quality.audit");
        const by = new Map();
        for (const a of audits) {
            const s = str(a.severity);
            const r = by.get(s) ?? { severity: s, total: 0, open: 0, closed: 0 };
            r.total++;
            if (a.status === "closed")
                r.closed++;
            else
                r.open++;
            by.set(s, r);
        }
        const rows = [...by.values()].sort((a, b) => b.total - a.total);
        return {
            columns: [
                { field: "severity", label: "Severity", fieldtype: "enum" },
                { field: "total", label: "Total", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "open", label: "Open", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "closed", label: "Closed", fieldtype: "number", align: "right", totaling: "sum" },
            ],
            rows,
        };
    },
};
export const QUALITY_REPORTS = [
    passRateReport, ncrAgingReport, defectParetoReport, capaEffectivenessReport, supplierQualityReport, auditFindingsReport,
];
const { indexView, detailView } = buildReportLibrary({
    indexViewId: "quality.reports.view",
    detailViewId: "quality.reports-detail.view",
    resource: "quality.inspection",
    title: "Quality Reports",
    description: "Pass rate, NCR aging, defect pareto, CAPA effectiveness, supplier quality, audit findings.",
    basePath: "/quality/reports",
    reports: QUALITY_REPORTS,
});
export const qualityReportsIndexView = indexView;
export const qualityReportsDetailView = detailView;
