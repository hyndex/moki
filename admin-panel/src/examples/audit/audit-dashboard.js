import { buildControlRoom } from "../_factory/controlRoomHelper";
import { buildReportLibrary } from "../_factory/reportLibraryHelper";
const workspace = {
    id: "audit.control-room",
    label: "Audit Control Room",
    filterBar: [
        {
            field: "level",
            label: "Level",
            kind: "enum",
            options: [
                { value: "info", label: "Info" },
                { value: "warn", label: "Warn" },
                { value: "error", label: "Error" },
                { value: "critical", label: "Critical" },
            ],
        },
        { field: "actor", label: "Actor", kind: "text", placeholder: "Actor id or email" },
        { field: "action", label: "Action", kind: "text" },
    ],
    widgets: [
        { id: "h1", type: "header", col: 12, label: "Audit pulse", level: 2 },
        { id: "k-events", type: "number_card", col: 3, label: "Events (24h)",
            aggregation: { resource: "audit.event", fn: "count",
                range: { kind: "last", days: 1 } } },
        { id: "k-error", type: "number_card", col: 3, label: "Errors (24h)",
            aggregation: { resource: "audit.event", fn: "count",
                filter: { field: "level", op: "eq", value: "error" },
                range: { kind: "last", days: 1 } },
            warnAbove: 5, dangerAbove: 20 },
        { id: "k-auth-failures", type: "number_card", col: 3, label: "Auth failures (7d)",
            aggregation: { resource: "audit.event", fn: "count",
                filter: { and: [{ field: "action", op: "eq", value: "auth.failed" }, { field: "level", op: "eq", value: "error" }] },
                range: { kind: "last", days: 7 } } },
        { id: "k-actors", type: "number_card", col: 3, label: "Events (7d)",
            aggregation: { resource: "audit.event", fn: "count",
                range: { kind: "last", days: 7 } } },
        { id: "h2", type: "header", col: 12, label: "Charts", level: 2 },
        { id: "c-level", type: "chart", col: 6, label: "Events by level", chart: "donut",
            aggregation: { resource: "audit.event", fn: "count", groupBy: "level" } },
        { id: "c-resource", type: "chart", col: 6, label: "Events by resource", chart: "bar",
            aggregation: { resource: "audit.event", fn: "count", groupBy: "resource" } },
        { id: "c-volume", type: "chart", col: 12, label: "Event volume (30d)", chart: "area",
            aggregation: { resource: "audit.event", fn: "count", period: "day", range: { kind: "last", days: 30 } } },
        { id: "h3", type: "header", col: 12, label: "Attention", level: 2 },
        { id: "ql-errors", type: "quick_list", col: 6, label: "Recent errors",
            resource: "audit.event", sort: { field: "occurredAt", dir: "desc" }, limit: 10,
            primary: "action", secondary: "actor",
            filter: { field: "level", op: "eq", value: "error" } },
        { id: "ql-signins", type: "quick_list", col: 6, label: "Recent sign-ins",
            resource: "audit.event", sort: { field: "occurredAt", dir: "desc" }, limit: 10,
            primary: "actor", secondary: "ip",
            filter: { field: "action", op: "eq", value: "auth.login" } },
    ],
};
export const auditControlRoomView = buildControlRoom({
    viewId: "audit.control-room.view",
    resource: "audit.event",
    title: "Audit Control Room",
    description: "Security + compliance pulse: errors, auth failures, activity.",
    workspace,
});
async function fetchAll(r, resource) {
    return (await r.list(resource, { page: 1, pageSize: 10_000 })).rows;
}
const num = (v) => (typeof v === "number" ? v : 0);
const str = (v, d = "") => (typeof v === "string" ? v : d);
const topActorsReport = {
    id: "top-actors", label: "Top Actors",
    description: "Users by event volume in the last 30 days.",
    icon: "Users", resource: "audit.event", filters: [],
    async execute({ resources }) {
        const events = await fetchAll(resources, "audit.event");
        const cutoff = Date.now() - 30 * 86_400_000;
        const by = new Map();
        for (const e of events) {
            const t = Date.parse(str(e.occurredAt));
            if (Number.isNaN(t) || t < cutoff)
                continue;
            const a = str(e.actor);
            const r = by.get(a) ?? { actor: a, total: 0, errors: 0 };
            r.total++;
            if (e.level === "error")
                r.errors++;
            by.set(a, r);
        }
        const rows = [...by.values()].sort((a, b) => b.total - a.total);
        return {
            columns: [
                { field: "actor", label: "Actor", fieldtype: "text" },
                { field: "total", label: "Events", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "errors", label: "Errors", fieldtype: "number", align: "right", totaling: "sum" },
            ],
            rows,
        };
    },
};
const actionBreakdownReport = {
    id: "action-breakdown", label: "Action Breakdown",
    description: "Volume per action type.",
    icon: "BarChart", resource: "audit.event", filters: [],
    async execute({ resources }) {
        const events = await fetchAll(resources, "audit.event");
        const by = new Map();
        for (const e of events) {
            const a = str(e.action);
            const r = by.get(a) ?? { action: a, count: 0, level: str(e.level) };
            r.count++;
            by.set(a, r);
        }
        const rows = [...by.values()].sort((a, b) => b.count - a.count);
        return {
            columns: [
                { field: "action", label: "Action", fieldtype: "text" },
                { field: "level", label: "Level", fieldtype: "enum" },
                { field: "count", label: "Count", fieldtype: "number", align: "right", totaling: "sum" },
            ],
            rows,
        };
    },
};
const failedAuthReport = {
    id: "failed-auth", label: "Failed Authentication",
    description: "Failed sign-in attempts per IP + actor.",
    icon: "ShieldAlert", resource: "audit.event", filters: [],
    async execute({ resources }) {
        const events = await fetchAll(resources, "audit.event");
        const by = new Map();
        for (const e of events) {
            if (e.action !== "auth.failed" && e.level !== "error")
                continue;
            const k = `${str(e.actor)}|${str(e.ip)}`;
            const r = by.get(k) ?? { actor: str(e.actor), ip: str(e.ip), failures: 0, lastAt: "" };
            r.failures++;
            if (str(e.occurredAt) > r.lastAt)
                r.lastAt = str(e.occurredAt);
            by.set(k, r);
        }
        const rows = [...by.values()].sort((a, b) => b.failures - a.failures);
        return {
            columns: [
                { field: "actor", label: "Actor", fieldtype: "text" },
                { field: "ip", label: "IP", fieldtype: "text" },
                { field: "failures", label: "Failures", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "lastAt", label: "Last at", fieldtype: "datetime" },
            ],
            rows,
        };
    },
};
const complianceReport = {
    id: "compliance-snapshot", label: "Compliance Snapshot",
    description: "Key compliance signals: admin actions, role changes, settings changes.",
    icon: "ClipboardCheck", resource: "audit.event", filters: [],
    async execute({ resources }) {
        const events = await fetchAll(resources, "audit.event");
        const tracked = ["role.assigned", "role.revoked", "settings.changed", "user.deleted", "policy.updated", "key.rotated"];
        const by = new Map();
        for (const e of events) {
            if (!tracked.includes(str(e.action)))
                continue;
            const a = str(e.action);
            const r = by.get(a) ?? { action: a, count: 0 };
            r.count++;
            by.set(a, r);
        }
        const rows = tracked.map((a) => by.get(a) ?? { action: a, count: 0 });
        return {
            columns: [
                { field: "action", label: "Action", fieldtype: "text" },
                { field: "count", label: "Count", fieldtype: "number", align: "right", totaling: "sum" },
            ],
            rows,
        };
    },
};
export const AUDIT_REPORTS = [
    topActorsReport, actionBreakdownReport, failedAuthReport, complianceReport,
];
const { indexView, detailView } = buildReportLibrary({
    indexViewId: "audit.reports.view",
    detailViewId: "audit.reports-detail.view",
    resource: "audit.event",
    title: "Audit Reports",
    description: "Top actors, action breakdown, failed auth, compliance snapshot.",
    basePath: "/audit/reports",
    reports: AUDIT_REPORTS,
});
export const auditReportsIndexView = indexView;
export const auditReportsDetailView = detailView;
