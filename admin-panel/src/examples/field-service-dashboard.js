import { buildControlRoom } from "./_factory/controlRoomHelper";
import { buildReportLibrary } from "./_factory/reportLibraryHelper";
const workspace = {
    id: "field-service.control-room",
    label: "Field Service Control Room",
    filterBar: [
        {
            field: "status",
            label: "Status",
            kind: "enum",
            options: [
                { value: "open", label: "Open" },
                { value: "scheduled", label: "Scheduled" },
                { value: "in_progress", label: "In progress" },
                { value: "completed", label: "Completed" },
                { value: "cancelled", label: "Cancelled" },
            ],
        },
        { field: "technician", label: "Technician", kind: "text" },
        { field: "region", label: "Region", kind: "text" },
    ],
    widgets: [
        { id: "h1", type: "header", col: 12, label: "Dispatch pulse", level: 2 },
        { id: "k-open", type: "number_card", col: 3, label: "Open jobs",
            aggregation: { resource: "field-service.job", fn: "count",
                filter: { or: [{ field: "status", op: "eq", value: "open" }, { field: "status", op: "eq", value: "in_progress" }] } },
            drilldown: "/field-service/jobs" },
        { id: "k-today", type: "number_card", col: 3, label: "Scheduled today",
            aggregation: { resource: "field-service.job", fn: "count",
                range: { kind: "mtd" } },
            drilldown: "/field-service/jobs" },
        { id: "k-overdue", type: "number_card", col: 3, label: "Overdue",
            aggregation: { resource: "field-service.job", fn: "count",
                filter: { field: "overdue", op: "eq", value: true } },
            warnAbove: 3, dangerAbove: 10 },
        { id: "k-techs", type: "number_card", col: 3, label: "Active technicians",
            aggregation: { resource: "field-service.technician", fn: "count",
                filter: { field: "status", op: "eq", value: "on-duty" } },
            drilldown: "/field-service/technicians" },
        { id: "h2", type: "header", col: 12, label: "Charts", level: 2 },
        { id: "c-status", type: "chart", col: 6, label: "Jobs by status", chart: "donut",
            aggregation: { resource: "field-service.job", fn: "count", groupBy: "status" } },
        { id: "c-priority", type: "chart", col: 6, label: "Jobs by priority", chart: "donut",
            aggregation: { resource: "field-service.job", fn: "count", groupBy: "priority" } },
        { id: "c-volume", type: "chart", col: 6, label: "Jobs (30d)", chart: "area",
            aggregation: { resource: "field-service.job", fn: "count", period: "day", range: { kind: "last", days: 30 } } },
        { id: "c-tech", type: "chart", col: 6, label: "Jobs by technician", chart: "bar",
            aggregation: { resource: "field-service.job", fn: "count", groupBy: "technician" } },
        { id: "h3", type: "header", col: 12, label: "Shortcuts", level: 2 },
        { id: "sc-new", type: "shortcut", col: 3, label: "New job", icon: "Plus", href: "/field-service/jobs/new" },
        { id: "sc-cal", type: "shortcut", col: 3, label: "Calendar", icon: "Calendar", href: "/field-service/calendar" },
        { id: "sc-techs", type: "shortcut", col: 3, label: "Technicians", icon: "HardHat", href: "/field-service/technicians" },
        { id: "sc-reports", type: "shortcut", col: 3, label: "Reports", icon: "BarChart3", href: "/field-service/reports" },
        { id: "h4", type: "header", col: 12, label: "Attention", level: 2 },
        { id: "ql-urgent", type: "quick_list", col: 6, label: "Urgent open",
            resource: "field-service.job", sort: { field: "scheduledAt", dir: "asc" }, limit: 10,
            primary: "code", secondary: "customer",
            filter: { and: [
                    { field: "priority", op: "eq", value: "urgent" },
                    { or: [{ field: "status", op: "eq", value: "open" }, { field: "status", op: "eq", value: "in_progress" }] },
                ] },
            href: (r) => `/field-service/jobs/${r.id}` },
        { id: "ql-parts", type: "quick_list", col: 6, label: "Pending parts requests",
            resource: "field-service.parts-request", sort: { field: "requestedAt", dir: "desc" }, limit: 10,
            primary: "code", secondary: "partSku",
            filter: { field: "status", op: "eq", value: "pending" },
            href: (r) => `/field-service/parts-requests/${r.id}` },
    ],
};
export const fieldServiceControlRoomView = buildControlRoom({
    viewId: "field-service.control-room.view",
    resource: "field-service.job",
    title: "Field Service Control Room",
    description: "Dispatch, technician load, parts + SLA pulse.",
    workspace,
});
async function fetchAll(r, resource) {
    return (await r.list(resource, { page: 1, pageSize: 10_000 })).rows;
}
const num = (v) => (typeof v === "number" ? v : 0);
const str = (v, d = "") => (typeof v === "string" ? v : d);
const dailyDispatchReport = {
    id: "daily-dispatch", label: "Daily Dispatch",
    description: "Today's scheduled work per technician.",
    icon: "ClipboardList", resource: "field-service.job", filters: [],
    async execute({ resources }) {
        const jobs = await fetchAll(resources, "field-service.job");
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const by = new Map();
        for (const j of jobs) {
            const d = j.scheduledAt ? new Date(str(j.scheduledAt)) : null;
            if (!d || Number.isNaN(d.getTime()))
                continue;
            d.setHours(0, 0, 0, 0);
            if (d.getTime() !== today.getTime())
                continue;
            const t = str(j.technician, "Unassigned");
            const r = by.get(t) ?? { technician: t, scheduled: 0, inProgress: 0, completed: 0 };
            r.scheduled++;
            if (j.status === "in_progress")
                r.inProgress++;
            if (j.status === "resolved")
                r.completed++;
            by.set(t, r);
        }
        const rows = [...by.values()].sort((a, b) => b.scheduled - a.scheduled);
        return {
            columns: [
                { field: "technician", label: "Technician", fieldtype: "text" },
                { field: "scheduled", label: "Scheduled", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "inProgress", label: "In progress", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "completed", label: "Completed", fieldtype: "number", align: "right", totaling: "sum" },
            ],
            rows,
        };
    },
};
const techUtilizationReport = {
    id: "tech-utilization", label: "Technician Utilization",
    description: "Jobs + estimated hours per technician.",
    icon: "Users", resource: "field-service.job", filters: [],
    async execute({ resources }) {
        const jobs = await fetchAll(resources, "field-service.job");
        const by = new Map();
        for (const j of jobs) {
            const t = str(j.technician, "Unassigned");
            const r = by.get(t) ?? { technician: t, jobs: 0, hours: 0 };
            r.jobs++;
            r.hours += num(j.estimatedHours) || 2;
            by.set(t, r);
        }
        const rows = [...by.values()].sort((a, b) => b.hours - a.hours);
        return {
            columns: [
                { field: "technician", label: "Technician", fieldtype: "text" },
                { field: "jobs", label: "Jobs", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "hours", label: "Est. hours", fieldtype: "number", align: "right", totaling: "sum" },
            ],
            rows,
            chart: { kind: "bar", label: "Hours by technician",
                from: (rs) => rs.map((r) => ({ label: r.technician, value: r.hours })) },
        };
    },
};
const firstTimeFixReport = {
    id: "first-time-fix", label: "First-Time Fix Rate",
    description: "% of jobs resolved on first visit.",
    icon: "Target", resource: "field-service.job", filters: [],
    async execute({ resources }) {
        const jobs = await fetchAll(resources, "field-service.job");
        const by = new Map();
        for (const j of jobs) {
            if (j.status !== "resolved")
                continue;
            const t = str(j.technician, "Unassigned");
            const r = by.get(t) ?? { technician: t, completed: 0, firstTime: 0, rate: 0 };
            r.completed++;
            if (num(j.visits) <= 1)
                r.firstTime++;
            by.set(t, r);
        }
        const rows = [...by.values()]
            .map((r) => ({ ...r, rate: r.completed > 0 ? Math.round((r.firstTime / r.completed) * 100) : 0 }))
            .sort((a, b) => b.rate - a.rate);
        return {
            columns: [
                { field: "technician", label: "Technician", fieldtype: "text" },
                { field: "completed", label: "Completed", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "firstTime", label: "First-time fix", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "rate", label: "Rate %", fieldtype: "percent", align: "right" },
            ],
            rows,
        };
    },
};
const routeEfficiencyReport = {
    id: "route-efficiency", label: "Route Efficiency",
    description: "Travel distance + on-site time per technician (today).",
    icon: "Map", resource: "field-service.job", filters: [],
    async execute({ resources }) {
        const jobs = await fetchAll(resources, "field-service.job");
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const by = new Map();
        for (const j of jobs) {
            const d = j.scheduledAt ? new Date(str(j.scheduledAt)) : null;
            if (!d || Number.isNaN(d.getTime()))
                continue;
            d.setHours(0, 0, 0, 0);
            if (d.getTime() !== today.getTime())
                continue;
            const t = str(j.technician, "Unassigned");
            const r = by.get(t) ?? { technician: t, jobs: 0, travelKm: 0, onSiteHours: 0 };
            r.jobs++;
            r.travelKm += num(j.travelKm) || 15;
            r.onSiteHours += num(j.estimatedHours) || 2;
            by.set(t, r);
        }
        const rows = [...by.values()].sort((a, b) => b.travelKm - a.travelKm);
        return {
            columns: [
                { field: "technician", label: "Technician", fieldtype: "text" },
                { field: "jobs", label: "Jobs", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "travelKm", label: "Travel (km)", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "onSiteHours", label: "On-site hrs", fieldtype: "number", align: "right", totaling: "sum" },
            ],
            rows,
        };
    },
};
const partsUsageReport = {
    id: "parts-usage", label: "Parts Usage",
    description: "Parts consumed per job + inventory impact.",
    icon: "Cog", resource: "field-service.parts-usage", filters: [],
    async execute({ resources }) {
        const usage = await fetchAll(resources, "field-service.parts-usage");
        const by = new Map();
        for (const u of usage) {
            const k = str(u.partSku);
            const r = by.get(k) ?? { partSku: k, partName: str(u.partName), qty: 0, cost: 0 };
            r.qty += num(u.qty);
            r.cost += num(u.qty) * num(u.unitCost);
            by.set(k, r);
        }
        const rows = [...by.values()].sort((a, b) => b.cost - a.cost);
        return {
            columns: [
                { field: "partSku", label: "SKU", fieldtype: "text" },
                { field: "partName", label: "Part", fieldtype: "text" },
                { field: "qty", label: "Qty used", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "cost", label: "Cost", fieldtype: "currency", align: "right", options: "USD", totaling: "sum" },
            ],
            rows,
        };
    },
};
const slaComplianceReport = {
    id: "fs-sla", label: "SLA Compliance",
    description: "% of jobs completed within SLA window.",
    icon: "ShieldCheck", resource: "field-service.job", filters: [],
    async execute({ resources }) {
        const jobs = await fetchAll(resources, "field-service.job");
        const by = new Map();
        for (const j of jobs) {
            const p = str(j.priority);
            const r = by.get(p) ?? { priority: p, total: 0, onTime: 0, breached: 0, rate: 0 };
            r.total++;
            if (j.slaBreached)
                r.breached++;
            else
                r.onTime++;
            by.set(p, r);
        }
        const rows = [...by.values()].map((r) => ({
            ...r,
            rate: r.total > 0 ? Math.round((r.onTime / r.total) * 100) : 100,
        }));
        return {
            columns: [
                { field: "priority", label: "Priority", fieldtype: "enum" },
                { field: "total", label: "Total", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "onTime", label: "On time", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "breached", label: "Breached", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "rate", label: "Compliance %", fieldtype: "percent", align: "right" },
            ],
            rows,
        };
    },
};
export const FIELD_SERVICE_REPORTS = [
    dailyDispatchReport,
    techUtilizationReport,
    firstTimeFixReport,
    routeEfficiencyReport,
    partsUsageReport,
    slaComplianceReport,
];
const { indexView, detailView } = buildReportLibrary({
    indexViewId: "field-service.reports.view",
    detailViewId: "field-service.reports-detail.view",
    resource: "field-service.job",
    title: "Field Service Reports",
    description: "Dispatch, technician utilization, first-time fix rate, route efficiency, parts usage, SLA.",
    basePath: "/field-service/reports",
    reports: FIELD_SERVICE_REPORTS,
});
export const fieldServiceReportsIndexView = indexView;
export const fieldServiceReportsDetailView = detailView;
