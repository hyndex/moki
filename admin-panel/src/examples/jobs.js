import { buildDomainPlugin } from "./_factory/buildDomainPlugin";
import { SECTIONS } from "./_factory/sections";
import { SEVERITY } from "./_factory/options";
import { daysAgo, pick } from "./_factory/seeds";
import { buildCompactControlRoom } from "./_factory/compactDashboard";
import { buildReportLibrary } from "./_factory/reportLibraryHelper";
const controlRoomView = buildCompactControlRoom({
    viewId: "jobs.control-room.view",
    resource: "jobs.job",
    title: "Jobs Control Room",
    description: "Queues, jobs, failures, throughput.",
    kpis: [
        { label: "Queued", resource: "jobs.job",
            filter: { field: "state", op: "eq", value: "queued" } },
        { label: "Running", resource: "jobs.job",
            filter: { field: "state", op: "eq", value: "running" } },
        { label: "Failed (24h)", resource: "jobs.job",
            filter: { field: "state", op: "eq", value: "failed" }, range: "last-30",
            warnAbove: 10, dangerAbove: 50 },
        { label: "Completed (24h)", resource: "jobs.job",
            filter: { field: "state", op: "eq", value: "completed" }, range: "last-30" },
    ],
    charts: [
        { label: "Jobs by queue", resource: "jobs.job", chart: "donut", groupBy: "queue" },
        { label: "Jobs by severity", resource: "jobs.job", chart: "donut", groupBy: "severity" },
    ],
    shortcuts: [
        { label: "Job details", icon: "History", href: "/automation/jobs" },
        { label: "Queues", icon: "Layers", href: "/automation/queues" },
        { label: "Scheduled", icon: "CalendarClock", href: "/automation/jobs/scheduled" },
        { label: "Reports", icon: "BarChart3", href: "/automation/jobs/reports" },
    ],
});
async function fetchAll(r, resource) {
    return (await r.list(resource, { page: 1, pageSize: 10_000 })).rows;
}
const num = (v) => (typeof v === "number" ? v : 0);
const str = (v, d = "") => (typeof v === "string" ? v : d);
const queueHealthReport = {
    id: "queue-health", label: "Queue Health",
    description: "Throughput + failure rate per queue.",
    icon: "Activity", resource: "jobs.job", filters: [],
    async execute({ resources }) {
        const jobs = await fetchAll(resources, "jobs.job");
        const by = new Map();
        for (const j of jobs) {
            const q = str(j.queue);
            const r = by.get(q) ?? { queue: q, total: 0, failed: 0, avgDuration: 0, sum: 0 };
            r.total++;
            if (j.severity === "error")
                r.failed++;
            r.sum += num(j.durationMs);
            by.set(q, r);
        }
        const rows = [...by.values()]
            .map((r) => ({ ...r, avgDuration: r.total > 0 ? Math.round(r.sum / r.total) : 0 }))
            .sort((a, b) => b.total - a.total);
        return {
            columns: [
                { field: "queue", label: "Queue", fieldtype: "text" },
                { field: "total", label: "Total", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "failed", label: "Failed", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "avgDuration", label: "Avg ms", fieldtype: "number", align: "right" },
            ],
            rows,
        };
    },
};
const { indexView: reportsIndex, detailView: reportsDetail } = buildReportLibrary({
    indexViewId: "jobs.reports.view",
    detailViewId: "jobs.reports-detail.view",
    resource: "jobs.job",
    title: "Jobs Reports",
    description: "Queue health.",
    basePath: "/automation/jobs/reports",
    reports: [queueHealthReport],
});
export const jobsPlugin = buildDomainPlugin({
    id: "jobs",
    label: "Jobs",
    icon: "Timer",
    section: SECTIONS.automation,
    order: 3,
    resources: [
        {
            id: "job",
            singular: "Job",
            plural: "Jobs",
            icon: "Timer",
            path: "/automation/jobs",
            displayField: "name",
            readOnly: true,
            defaultSort: { field: "runAt", dir: "desc" },
            fields: [
                { name: "name", kind: "text", required: true, sortable: true },
                { name: "queue", kind: "text", sortable: true },
                { name: "severity", kind: "enum", options: SEVERITY },
                { name: "state", kind: "enum", options: [
                        { value: "queued", label: "Queued", intent: "warning" },
                        { value: "running", label: "Running", intent: "info" },
                        { value: "completed", label: "Completed", intent: "success" },
                        { value: "failed", label: "Failed", intent: "danger" },
                        { value: "cancelled", label: "Cancelled", intent: "neutral" },
                    ] },
                { name: "attempts", kind: "number", align: "right" },
                { name: "maxAttempts", kind: "number", align: "right" },
                { name: "durationMs", label: "Duration (ms)", kind: "number", align: "right" },
                { name: "runAt", kind: "datetime", sortable: true },
                { name: "completedAt", kind: "datetime" },
            ],
            seedCount: 40,
            seed: (i) => ({
                name: pick(["nightly-invoice", "sync-inventory", "send-digests", "reindex-search", "expire-tokens", "cleanup", "generate-report"], i),
                queue: pick(["default", "critical", "low", "scheduled"], i),
                severity: pick(["info", "info", "warn", "error"], i),
                state: pick(["queued", "running", "completed", "completed", "completed", "failed"], i),
                attempts: 1 + (i % 4),
                maxAttempts: 3,
                durationMs: 80 + ((i * 193) % 4000),
                runAt: daysAgo(i * 0.2),
                completedAt: daysAgo(i * 0.2 - 0.01),
            }),
        },
        {
            id: "queue",
            singular: "Queue",
            plural: "Queues",
            icon: "Layers",
            path: "/automation/queues",
            fields: [
                { name: "name", kind: "text", required: true, sortable: true },
                { name: "priority", kind: "enum", options: [
                        { value: "critical", label: "Critical" }, { value: "high", label: "High" },
                        { value: "default", label: "Default" }, { value: "low", label: "Low" },
                    ] },
                { name: "concurrency", kind: "number", align: "right" },
                { name: "backlog", kind: "number", align: "right" },
                { name: "throughputPerMin", kind: "number", align: "right" },
            ],
            seedCount: 6,
            seed: (i) => ({
                name: pick(["default", "critical", "low", "scheduled", "webhooks", "exports"], i),
                priority: pick(["default", "critical", "low", "default", "high", "low"], i),
                concurrency: pick([10, 50, 5, 5, 20, 3], i),
                backlog: (i * 7) % 50,
                throughputPerMin: 100 + (i * 30) % 500,
            }),
        },
        {
            id: "scheduled",
            singular: "Scheduled Job",
            plural: "Scheduled Jobs",
            icon: "CalendarClock",
            path: "/automation/jobs/scheduled",
            fields: [
                { name: "name", kind: "text", required: true, sortable: true },
                { name: "cron", kind: "text" },
                { name: "queue", kind: "text" },
                { name: "lastRunAt", kind: "datetime" },
                { name: "nextRunAt", kind: "datetime", sortable: true },
                { name: "active", kind: "boolean" },
            ],
            seedCount: 12,
            seed: (i) => ({
                name: pick(["Nightly invoice gen", "Hourly sync", "Daily digest", "Weekly reindex"], i),
                cron: pick(["0 0 * * *", "0 * * * *", "0 9 * * *", "0 0 * * 0"], i),
                queue: pick(["default", "critical", "low"], i),
                lastRunAt: daysAgo(i * 0.5),
                nextRunAt: daysAgo(-i * 0.5),
                active: true,
            }),
        },
    ],
    extraNav: [
        { id: "jobs.control-room.nav", label: "Jobs Control Room", icon: "LayoutDashboard", path: "/automation/jobs/control-room", view: "jobs.control-room.view", order: 0 },
        { id: "jobs.reports.nav", label: "Reports", icon: "BarChart3", path: "/automation/jobs/reports", view: "jobs.reports.view" },
    ],
    extraViews: [controlRoomView, reportsIndex, reportsDetail],
    commands: [
        { id: "jobs.go.control-room", label: "Jobs: Control Room", icon: "LayoutDashboard", run: () => { window.location.hash = "/automation/jobs/control-room"; } },
    ],
});
