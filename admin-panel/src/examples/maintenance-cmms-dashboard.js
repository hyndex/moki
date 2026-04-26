import { buildControlRoom } from "./_factory/controlRoomHelper";
import { buildReportLibrary } from "./_factory/reportLibraryHelper";
const workspace = {
    id: "maintenance-cmms.control-room",
    label: "CMMS Control Room",
    filterBar: [
        {
            field: "status",
            label: "Status",
            kind: "enum",
            options: [
                { value: "open", label: "Open" },
                { value: "in_progress", label: "In progress" },
                { value: "on_hold", label: "On hold" },
                { value: "completed", label: "Completed" },
                { value: "cancelled", label: "Cancelled" },
            ],
        },
        {
            field: "priority",
            label: "Priority",
            kind: "enum",
            options: [
                { value: "critical", label: "Critical" },
                { value: "high", label: "High" },
                { value: "medium", label: "Medium" },
                { value: "low", label: "Low" },
            ],
        },
        { field: "technician", label: "Technician", kind: "text" },
        { field: "asset", label: "Asset", kind: "text" },
    ],
    widgets: [
        { id: "h1", type: "header", col: 12, label: "Maintenance pulse", level: 2 },
        { id: "k-open", type: "number_card", col: 3, label: "Open WOs",
            aggregation: { resource: "maintenance-cmms.work-order", fn: "count",
                filter: { or: [{ field: "status", op: "eq", value: "open" }, { field: "status", op: "eq", value: "in_progress" }] } },
            drilldown: "/cmms/work-orders" },
        { id: "k-overdue", type: "number_card", col: 3, label: "Overdue WOs",
            aggregation: { resource: "maintenance-cmms.work-order", fn: "count",
                filter: { field: "overdue", op: "eq", value: true } },
            warnAbove: 3, dangerAbove: 10 },
        { id: "k-pm-due", type: "number_card", col: 3, label: "PM due (30d)",
            aggregation: { resource: "maintenance-cmms.pm-schedule", fn: "count",
                filter: { field: "dueSoon", op: "eq", value: true } } },
        { id: "k-mtbf", type: "number_card", col: 3, label: "Avg MTBF (days)",
            aggregation: { resource: "maintenance-cmms.asset-kpi", fn: "avg", field: "mtbfDays" } },
        { id: "h2", type: "header", col: 12, label: "Charts", level: 2 },
        { id: "c-status", type: "chart", col: 6, label: "WOs by status", chart: "donut",
            aggregation: { resource: "maintenance-cmms.work-order", fn: "count", groupBy: "status" } },
        { id: "c-type", type: "chart", col: 6, label: "WOs by type", chart: "donut",
            aggregation: { resource: "maintenance-cmms.work-order", fn: "count", groupBy: "workType" } },
        { id: "c-volume", type: "chart", col: 6, label: "WO volume (30d)", chart: "area",
            aggregation: { resource: "maintenance-cmms.work-order", fn: "count", period: "day", range: { kind: "last", days: 30 } } },
        { id: "c-asset", type: "chart", col: 6, label: "WOs by asset", chart: "bar",
            aggregation: { resource: "maintenance-cmms.work-order", fn: "count", groupBy: "asset" } },
        { id: "h3", type: "header", col: 12, label: "Shortcuts", level: 2 },
        { id: "sc-new", type: "shortcut", col: 3, label: "New WO", icon: "Plus", href: "/cmms/work-orders/new" },
        { id: "sc-pm", type: "shortcut", col: 3, label: "PM schedule", icon: "CalendarClock", href: "/cmms/pm-schedules" },
        { id: "sc-downtime", type: "shortcut", col: 3, label: "Downtime log", icon: "PowerOff", href: "/cmms/downtimes" },
        { id: "sc-reports", type: "shortcut", col: 3, label: "Reports", icon: "BarChart3", href: "/cmms/reports" },
    ],
};
export const cmmsControlRoomView = buildControlRoom({
    viewId: "maintenance-cmms.control-room.view",
    resource: "maintenance-cmms.work-order",
    title: "CMMS Control Room",
    description: "Maintenance pulse, PM queue, reliability metrics.",
    workspace,
});
async function fetchAll(r, resource) {
    return (await r.list(resource, { page: 1, pageSize: 10_000 })).rows;
}
const num = (v) => (typeof v === "number" ? v : 0);
const str = (v, d = "") => (typeof v === "string" ? v : d);
const workOrderReport = {
    id: "work-order-summary", label: "Work Order Summary",
    description: "WO counts + average resolution time by type.",
    icon: "ClipboardList", resource: "maintenance-cmms.work-order", filters: [],
    async execute({ resources }) {
        const wos = await fetchAll(resources, "maintenance-cmms.work-order");
        const by = new Map();
        for (const w of wos) {
            const t = str(w.workType, "unknown");
            const r = by.get(t) ?? { type: t, total: 0, open: 0, avgHrs: 0, sumHrs: 0, completed: 0 };
            r.total++;
            if (w.status === "resolved" || w.status === "closed") {
                r.completed++;
                const c = Date.parse(str(w.createdAt));
                const f = Date.parse(str(w.completedAt));
                if (!Number.isNaN(c) && !Number.isNaN(f))
                    r.sumHrs += (f - c) / 3_600_000;
            }
            else
                r.open++;
            by.set(t, r);
        }
        const rows = [...by.values()].map((r) => ({
            ...r,
            avgHrs: r.completed > 0 ? Math.round((r.sumHrs / r.completed) * 10) / 10 : 0,
        }));
        return {
            columns: [
                { field: "type", label: "Type", fieldtype: "enum" },
                { field: "total", label: "Total", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "open", label: "Open", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "completed", label: "Completed", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "avgHrs", label: "Avg hrs", fieldtype: "number", align: "right" },
            ],
            rows,
        };
    },
};
const pmComplianceReport = {
    id: "pm-compliance", label: "PM Compliance",
    description: "On-time preventive-maintenance completion rate by asset.",
    icon: "CheckCircle2", resource: "maintenance-cmms.pm-schedule", filters: [],
    async execute({ resources }) {
        const schedules = await fetchAll(resources, "maintenance-cmms.pm-schedule");
        const by = new Map();
        for (const s of schedules) {
            const a = str(s.asset);
            const r = by.get(a) ?? { asset: a, scheduled: 0, onTime: 0, missed: 0, rate: 0 };
            r.scheduled++;
            if (s.lastCompletedOnTime)
                r.onTime++;
            if (s.missed)
                r.missed++;
            by.set(a, r);
        }
        const rows = [...by.values()]
            .map((r) => ({ ...r, rate: r.scheduled > 0 ? Math.round((r.onTime / r.scheduled) * 100) : 0 }))
            .sort((a, b) => a.rate - b.rate);
        return {
            columns: [
                { field: "asset", label: "Asset", fieldtype: "text" },
                { field: "scheduled", label: "Scheduled", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "onTime", label: "On time", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "missed", label: "Missed", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "rate", label: "Compliance %", fieldtype: "percent", align: "right" },
            ],
            rows,
        };
    },
};
const downtimeReport = {
    id: "downtime", label: "Downtime Log",
    description: "Equipment downtime + cost impact.",
    icon: "PowerOff", resource: "maintenance-cmms.downtime", filters: [],
    async execute({ resources }) {
        const downtimes = await fetchAll(resources, "maintenance-cmms.downtime");
        const by = new Map();
        for (const d of downtimes) {
            const a = str(d.asset);
            const r = by.get(a) ?? { asset: a, incidents: 0, hours: 0, costImpact: 0 };
            r.incidents++;
            r.hours += num(d.durationHours);
            r.costImpact += num(d.costImpact);
            by.set(a, r);
        }
        const rows = [...by.values()].sort((a, b) => b.hours - a.hours);
        return {
            columns: [
                { field: "asset", label: "Asset", fieldtype: "text" },
                { field: "incidents", label: "Incidents", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "hours", label: "Hours", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "costImpact", label: "Cost", fieldtype: "currency", align: "right", options: "USD", totaling: "sum" },
            ],
            rows,
        };
    },
};
const reliabilityReport = {
    id: "reliability", label: "Reliability (MTBF/MTTR)",
    description: "Mean time between failures + mean time to repair per asset.",
    icon: "Activity", resource: "maintenance-cmms.asset-kpi", filters: [],
    async execute({ resources }) {
        const kpis = await fetchAll(resources, "maintenance-cmms.asset-kpi");
        const rows = kpis.map((k) => ({
            asset: str(k.asset),
            mtbfDays: num(k.mtbfDays),
            mttrHours: num(k.mttrHours),
            availabilityPct: num(k.availabilityPct),
            failures: num(k.failures),
        })).sort((a, b) => b.availabilityPct - a.availabilityPct);
        return {
            columns: [
                { field: "asset", label: "Asset", fieldtype: "text" },
                { field: "mtbfDays", label: "MTBF (d)", fieldtype: "number", align: "right" },
                { field: "mttrHours", label: "MTTR (hr)", fieldtype: "number", align: "right" },
                { field: "availabilityPct", label: "Availability %", fieldtype: "percent", align: "right" },
                { field: "failures", label: "Failures", fieldtype: "number", align: "right", totaling: "sum" },
            ],
            rows,
        };
    },
};
const technicianProductivityReport = {
    id: "tech-productivity", label: "Technician Productivity",
    description: "Completed WOs + hours per technician.",
    icon: "Users", resource: "maintenance-cmms.work-order", filters: [],
    async execute({ resources }) {
        const wos = await fetchAll(resources, "maintenance-cmms.work-order");
        const by = new Map();
        for (const w of wos) {
            if (w.status !== "resolved" && w.status !== "closed")
                continue;
            const t = str(w.technician, "Unassigned");
            const r = by.get(t) ?? { technician: t, completed: 0, hours: 0 };
            r.completed++;
            r.hours += num(w.actualHours);
            by.set(t, r);
        }
        const rows = [...by.values()].sort((a, b) => b.completed - a.completed);
        return {
            columns: [
                { field: "technician", label: "Technician", fieldtype: "text" },
                { field: "completed", label: "Completed", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "hours", label: "Hours", fieldtype: "number", align: "right", totaling: "sum" },
            ],
            rows,
        };
    },
};
export const CMMS_REPORTS = [
    workOrderReport, pmComplianceReport, downtimeReport, reliabilityReport, technicianProductivityReport,
];
const { indexView, detailView } = buildReportLibrary({
    indexViewId: "maintenance-cmms.reports.view",
    detailViewId: "maintenance-cmms.reports-detail.view",
    resource: "maintenance-cmms.work-order",
    title: "CMMS Reports",
    description: "Work order summary, PM compliance, downtime, reliability, technician productivity.",
    basePath: "/cmms/reports",
    reports: CMMS_REPORTS,
});
export const cmmsReportsIndexView = indexView;
export const cmmsReportsDetailView = detailView;
