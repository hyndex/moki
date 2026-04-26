import { buildControlRoom } from "./_factory/controlRoomHelper";
import { buildReportLibrary } from "./_factory/reportLibraryHelper";
const workspace = {
    id: "assets.control-room",
    label: "Assets Control Room",
    filterBar: [
        {
            field: "status",
            label: "Status",
            kind: "enum",
            options: [
                { value: "in_service", label: "In service" },
                { value: "out_of_service", label: "Out of service" },
                { value: "retired", label: "Retired" },
                { value: "disposed", label: "Disposed" },
            ],
        },
        { field: "category", label: "Category", kind: "text" },
        { field: "location", label: "Location", kind: "text" },
    ],
    widgets: [
        { id: "h1", type: "header", col: 12, label: "Fleet pulse", level: 2 },
        { id: "k-total", type: "number_card", col: 3, label: "Total assets",
            aggregation: { resource: "assets.asset", fn: "count" } },
        { id: "k-value", type: "number_card", col: 3, label: "Net book value",
            aggregation: { resource: "assets.asset", fn: "sum", field: "netBookValue" },
            format: "currency" },
        { id: "k-due", type: "number_card", col: 3, label: "Maintenance due (30d)",
            aggregation: { resource: "assets.asset", fn: "count",
                filter: { field: "maintenanceDueSoon", op: "eq", value: true } },
            warnAbove: 5 },
        { id: "k-retired", type: "number_card", col: 3, label: "Retired this year",
            aggregation: { resource: "assets.asset", fn: "count",
                filter: { field: "status", op: "eq", value: "retired" },
                range: { kind: "ytd" } } },
        { id: "h2", type: "header", col: 12, label: "Charts", level: 2 },
        { id: "c-cat", type: "chart", col: 6, label: "Assets by category", chart: "donut",
            aggregation: { resource: "assets.asset", fn: "count", groupBy: "category" } },
        { id: "c-status", type: "chart", col: 6, label: "Assets by status", chart: "donut",
            aggregation: { resource: "assets.asset", fn: "count", groupBy: "status" } },
        { id: "c-location", type: "chart", col: 6, label: "Value by location", chart: "bar",
            aggregation: { resource: "assets.asset", fn: "sum", field: "netBookValue", groupBy: "location" },
            format: "currency" },
        { id: "c-dep", type: "chart", col: 6, label: "Depreciation by year", chart: "line",
            aggregation: { resource: "assets.depreciation-entry", fn: "sum", field: "amount", period: "month", range: { kind: "last", days: 365 } },
            format: "currency" },
        { id: "h3", type: "header", col: 12, label: "Shortcuts", level: 2 },
        { id: "sc-new", type: "shortcut", col: 3, label: "New asset", icon: "Plus", href: "/assets/new" },
        { id: "sc-assign", type: "shortcut", col: 3, label: "Assign asset", icon: "UserCheck", href: "/assets/assignments/new" },
        { id: "sc-audit", type: "shortcut", col: 3, label: "New audit", icon: "ClipboardCheck", href: "/assets/audits/new" },
        { id: "sc-reports", type: "shortcut", col: 3, label: "Reports", icon: "BarChart3", href: "/assets/reports" },
    ],
};
export const assetsControlRoomView = buildControlRoom({
    viewId: "assets.control-room.view",
    resource: "assets.asset",
    title: "Assets Control Room",
    description: "Fleet health, NBV, maintenance queue, depreciation.",
    workspace,
});
async function fetchAll(r, resource) {
    return (await r.list(resource, { page: 1, pageSize: 10_000 })).rows;
}
const num = (v) => (typeof v === "number" ? v : 0);
const str = (v, d = "") => (typeof v === "string" ? v : d);
const registerReport = {
    id: "asset-register", label: "Asset Register",
    description: "Full asset list with cost, depreciation, NBV.",
    icon: "BookOpen", resource: "assets.asset", filters: [],
    async execute({ resources }) {
        const assets = await fetchAll(resources, "assets.asset");
        const rows = assets.map((a) => ({
            tag: str(a.tag),
            name: str(a.name),
            category: str(a.category),
            location: str(a.location),
            status: str(a.status),
            cost: num(a.cost),
            depreciationToDate: num(a.cost) - num(a.netBookValue),
            netBookValue: num(a.netBookValue),
        })).sort((a, b) => b.netBookValue - a.netBookValue);
        return {
            columns: [
                { field: "tag", label: "Tag", fieldtype: "text" },
                { field: "name", label: "Name", fieldtype: "text" },
                { field: "category", label: "Category", fieldtype: "enum" },
                { field: "location", label: "Location", fieldtype: "text" },
                { field: "status", label: "Status", fieldtype: "enum" },
                { field: "cost", label: "Cost", fieldtype: "currency", align: "right", options: "USD", totaling: "sum" },
                { field: "depreciationToDate", label: "Dep. to date", fieldtype: "currency", align: "right", options: "USD", totaling: "sum" },
                { field: "netBookValue", label: "NBV", fieldtype: "currency", align: "right", options: "USD", totaling: "sum" },
            ],
            rows,
        };
    },
};
const depreciationScheduleReport = {
    id: "depreciation-schedule", label: "Depreciation Schedule",
    description: "Depreciation entries per period + asset.",
    icon: "TrendingDown", resource: "assets.depreciation-entry", filters: [],
    async execute({ resources }) {
        const entries = await fetchAll(resources, "assets.depreciation-entry");
        const rows = entries.map((e) => ({
            period: str(e.period),
            assetTag: str(e.assetTag),
            method: str(e.method),
            amount: num(e.amount),
            accumulated: num(e.accumulated),
            postedAt: str(e.postedAt),
        })).sort((a, b) => b.period.localeCompare(a.period));
        return {
            columns: [
                { field: "period", label: "Period", fieldtype: "text" },
                { field: "assetTag", label: "Asset", fieldtype: "text" },
                { field: "method", label: "Method", fieldtype: "enum" },
                { field: "amount", label: "Amount", fieldtype: "currency", align: "right", options: "USD", totaling: "sum" },
                { field: "accumulated", label: "Accumulated", fieldtype: "currency", align: "right", options: "USD" },
                { field: "postedAt", label: "Posted", fieldtype: "date" },
            ],
            rows,
        };
    },
};
const assignmentsReport = {
    id: "asset-assignments", label: "Asset Assignments",
    description: "Who has what — current assignments.",
    icon: "UserCheck", resource: "assets.assignment", filters: [],
    async execute({ resources }) {
        const assignments = await fetchAll(resources, "assets.assignment");
        const rows = assignments
            .filter((a) => a.status === "active")
            .map((a) => ({
            assetTag: str(a.assetTag),
            assignee: str(a.assignee),
            assignedAt: str(a.assignedAt),
            department: str(a.department),
            location: str(a.location),
        }));
        return {
            columns: [
                { field: "assetTag", label: "Asset", fieldtype: "text" },
                { field: "assignee", label: "Assignee", fieldtype: "text" },
                { field: "department", label: "Department", fieldtype: "enum" },
                { field: "location", label: "Location", fieldtype: "text" },
                { field: "assignedAt", label: "Assigned", fieldtype: "date" },
            ],
            rows,
        };
    },
};
const maintenanceDueReport = {
    id: "maintenance-due", label: "Maintenance Due",
    description: "Assets with scheduled service due soon.",
    icon: "AlertTriangle", resource: "assets.asset", filters: [],
    async execute({ resources }) {
        const assets = await fetchAll(resources, "assets.asset");
        const now = Date.now();
        const rows = assets
            .filter((a) => a.nextServiceAt)
            .map((a) => ({
            tag: str(a.tag),
            name: str(a.name),
            location: str(a.location),
            nextServiceAt: str(a.nextServiceAt),
            daysUntil: Math.ceil((Date.parse(str(a.nextServiceAt)) - now) / 86_400_000),
        }))
            .filter((r) => r.daysUntil <= 60)
            .sort((a, b) => a.daysUntil - b.daysUntil);
        return {
            columns: [
                { field: "tag", label: "Tag", fieldtype: "text" },
                { field: "name", label: "Name", fieldtype: "text" },
                { field: "location", label: "Location", fieldtype: "text" },
                { field: "nextServiceAt", label: "Next service", fieldtype: "date" },
                { field: "daysUntil", label: "Days until", fieldtype: "number", align: "right" },
            ],
            rows,
        };
    },
};
const warrantyReport = {
    id: "warranty-register", label: "Warranty Register",
    description: "Active warranties + expiring soon.",
    icon: "Shield", resource: "assets.asset", filters: [],
    async execute({ resources }) {
        const assets = await fetchAll(resources, "assets.asset");
        const now = Date.now();
        const rows = assets
            .filter((a) => a.warrantyEndsAt)
            .map((a) => ({
            tag: str(a.tag),
            name: str(a.name),
            vendor: str(a.vendor),
            warrantyEndsAt: str(a.warrantyEndsAt),
            daysUntil: Math.ceil((Date.parse(str(a.warrantyEndsAt)) - now) / 86_400_000),
            inWarranty: Date.parse(str(a.warrantyEndsAt)) > now,
        }))
            .sort((a, b) => a.daysUntil - b.daysUntil);
        return {
            columns: [
                { field: "tag", label: "Tag", fieldtype: "text" },
                { field: "name", label: "Name", fieldtype: "text" },
                { field: "vendor", label: "Vendor", fieldtype: "text" },
                { field: "warrantyEndsAt", label: "Ends", fieldtype: "date" },
                { field: "daysUntil", label: "Days until", fieldtype: "number", align: "right" },
                { field: "inWarranty", label: "In warranty", fieldtype: "text" },
            ],
            rows,
        };
    },
};
export const ASSETS_REPORTS = [
    registerReport, depreciationScheduleReport, assignmentsReport, maintenanceDueReport, warrantyReport,
];
const { indexView, detailView } = buildReportLibrary({
    indexViewId: "assets.reports.view",
    detailViewId: "assets.reports-detail.view",
    resource: "assets.asset",
    title: "Asset Reports",
    description: "Register, depreciation, assignments, maintenance due, warranty.",
    basePath: "/assets/reports",
    reports: ASSETS_REPORTS,
});
export const assetsReportsIndexView = indexView;
export const assetsReportsDetailView = detailView;
