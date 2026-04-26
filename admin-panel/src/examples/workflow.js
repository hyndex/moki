import { buildDomainPlugin } from "./_factory/buildDomainPlugin";
import { SECTIONS } from "./_factory/sections";
import { STATUS_ACTIVE } from "./_factory/options";
import { daysAgo, pick } from "./_factory/seeds";
import { buildCompactControlRoom } from "./_factory/compactDashboard";
import { buildReportLibrary } from "./_factory/reportLibraryHelper";
const controlRoomView = buildCompactControlRoom({
    viewId: "workflow.control-room.view",
    resource: "workflow.workflow",
    title: "Workflows Control Room",
    description: "Definitions, instances, approval queue.",
    kpis: [
        { label: "Active workflows", resource: "workflow.workflow",
            filter: { field: "status", op: "eq", value: "active" } },
        { label: "Instances (30d)", resource: "workflow.instance", range: "last-30" },
        { label: "Approvals pending", resource: "workflow.approval-task",
            filter: { field: "status", op: "eq", value: "pending" }, warnAbove: 3 },
    ],
    charts: [
        { label: "Workflows by kind", resource: "workflow.workflow", chart: "donut", groupBy: "kind" },
        { label: "Instances (30d)", resource: "workflow.instance", chart: "area", period: "day", lastDays: 30 },
    ],
    shortcuts: [
        { label: "New workflow", icon: "Plus", href: "/automation/workflows/new" },
        { label: "Instances", icon: "PlayCircle", href: "/automation/workflows/instances" },
        { label: "Approvals", icon: "ClipboardCheck", href: "/automation/workflows/approvals" },
        { label: "Reports", icon: "BarChart3", href: "/automation/workflows/reports" },
    ],
});
async function fetchAll(r, resource) {
    return (await r.list(resource, { page: 1, pageSize: 10_000 })).rows;
}
const num = (v) => (typeof v === "number" ? v : 0);
const str = (v, d = "") => (typeof v === "string" ? v : d);
const workflowStatsReport = {
    id: "workflow-stats", label: "Workflow Stats",
    description: "Instance counts + avg duration per workflow.",
    icon: "Activity", resource: "workflow.workflow", filters: [],
    async execute({ resources }) {
        const workflows = await fetchAll(resources, "workflow.workflow");
        const instances = await fetchAll(resources, "workflow.instance");
        const by = new Map();
        for (const w of workflows) {
            by.set(str(w.name), { name: str(w.name), instances: 0, avgDurationHrs: 0, sum: 0 });
        }
        for (const i of instances) {
            const k = str(i.workflow);
            const r = by.get(k);
            if (!r)
                continue;
            r.instances++;
            r.sum += num(i.durationHrs);
        }
        const rows = [...by.values()]
            .map((r) => ({ ...r, avgDurationHrs: r.instances > 0 ? Math.round((r.sum / r.instances) * 10) / 10 : 0 }))
            .sort((a, b) => b.instances - a.instances);
        return {
            columns: [
                { field: "name", label: "Workflow", fieldtype: "text" },
                { field: "instances", label: "Instances", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "avgDurationHrs", label: "Avg hrs", fieldtype: "number", align: "right" },
            ],
            rows,
        };
    },
};
const { indexView: reportsIndex, detailView: reportsDetail } = buildReportLibrary({
    indexViewId: "workflow.reports.view",
    detailViewId: "workflow.reports-detail.view",
    resource: "workflow.workflow",
    title: "Workflow Reports",
    description: "Workflow stats.",
    basePath: "/automation/workflows/reports",
    reports: [workflowStatsReport],
});
export const workflowPlugin = buildDomainPlugin({
    id: "workflow",
    label: "Workflows",
    icon: "GitBranch",
    section: SECTIONS.automation,
    order: 2,
    resources: [
        {
            id: "workflow",
            singular: "Workflow",
            plural: "Workflows",
            icon: "GitBranch",
            path: "/automation/workflows",
            fields: [
                { name: "name", kind: "text", required: true, sortable: true },
                { name: "description", kind: "text" },
                { name: "kind", label: "Type", kind: "enum", options: [
                        { value: "approval", label: "Approval" }, { value: "automation", label: "Automation" },
                        { value: "integration", label: "Integration" }, { value: "human", label: "Human process" },
                    ] },
                { name: "steps", kind: "number", align: "right" },
                { name: "runCount", kind: "number", align: "right" },
                { name: "status", kind: "enum", options: STATUS_ACTIVE, sortable: true },
                { name: "lastRun", kind: "datetime", sortable: true },
            ],
            seedCount: 16,
            seed: (i) => ({
                name: pick(["Onboard customer", "Close month-end", "Ship order", "Process refund", "Approve expense", "New hire onboarding", "Vendor onboarding"], i),
                description: "",
                kind: pick(["approval", "automation", "integration", "human"], i),
                steps: 3 + (i % 6),
                runCount: 100 + (i * 37) % 2000,
                status: pick(["active", "active", "inactive"], i),
                lastRun: daysAgo(i),
            }),
        },
        {
            id: "instance",
            singular: "Workflow Instance",
            plural: "Instances",
            icon: "PlayCircle",
            path: "/automation/workflows/instances",
            readOnly: true,
            defaultSort: { field: "startedAt", dir: "desc" },
            fields: [
                { name: "id", kind: "text" },
                { name: "workflow", kind: "text", sortable: true },
                { name: "currentStep", kind: "text" },
                { name: "status", kind: "enum", options: [
                        { value: "running", label: "Running", intent: "info" },
                        { value: "completed", label: "Completed", intent: "success" },
                        { value: "failed", label: "Failed", intent: "danger" },
                        { value: "cancelled", label: "Cancelled", intent: "neutral" },
                        { value: "waiting", label: "Waiting", intent: "warning" },
                    ] },
                { name: "durationHrs", kind: "number", align: "right" },
                { name: "startedAt", kind: "datetime", sortable: true },
                { name: "completedAt", kind: "datetime" },
            ],
            seedCount: 40,
            seed: (i) => ({
                id: `wfi_${i + 1}`,
                workflow: pick(["Onboard customer", "Close month-end", "Ship order"], i),
                currentStep: pick(["Approval", "Notify", "Wait", "Complete"], i),
                status: pick(["completed", "completed", "running", "waiting", "failed"], i),
                durationHrs: 0.5 + (i * 0.3) % 24,
                startedAt: daysAgo(i),
                completedAt: daysAgo(i - 0.2),
            }),
        },
        {
            id: "approval-task",
            singular: "Approval Task",
            plural: "Approval Tasks",
            icon: "ClipboardCheck",
            path: "/automation/workflows/approvals",
            defaultSort: { field: "createdAt", dir: "desc" },
            fields: [
                { name: "code", kind: "text", required: true, sortable: true },
                { name: "workflow", kind: "text" },
                { name: "approver", kind: "text" },
                { name: "subject", kind: "text" },
                { name: "createdAt", kind: "datetime", sortable: true },
                { name: "dueAt", kind: "date" },
                { name: "decidedAt", kind: "datetime" },
                { name: "status", kind: "enum", options: [
                        { value: "pending", label: "Pending", intent: "warning" },
                        { value: "approved", label: "Approved", intent: "success" },
                        { value: "rejected", label: "Rejected", intent: "danger" },
                        { value: "delegated", label: "Delegated", intent: "info" },
                    ] },
            ],
            seedCount: 20,
            seed: (i) => ({
                code: `APR-${String(1000 + i).slice(-4)}`,
                workflow: pick(["Approve expense", "Approve PO", "Approve time off"], i),
                approver: "sam@gutu.dev",
                subject: pick(["Expense #EXP-1004", "PO-2200", "Leave 2026-06"], i),
                createdAt: daysAgo(i),
                dueAt: daysAgo(i - 3),
                decidedAt: i < 15 ? daysAgo(i - 2) : "",
                status: pick(["approved", "approved", "rejected", "pending"], i),
            }),
        },
    ],
    extraNav: [
        { id: "workflow.control-room.nav", label: "Workflow Control Room", icon: "LayoutDashboard", path: "/automation/workflows/control-room", view: "workflow.control-room.view", order: 0 },
        { id: "workflow.reports.nav", label: "Reports", icon: "BarChart3", path: "/automation/workflows/reports", view: "workflow.reports.view" },
    ],
    extraViews: [controlRoomView, reportsIndex, reportsDetail],
    commands: [
        { id: "wf.go.control-room", label: "Workflows: Control Room", icon: "LayoutDashboard", run: () => { window.location.hash = "/automation/workflows/control-room"; } },
        { id: "wf.new", label: "New workflow", icon: "Plus", run: () => { window.location.hash = "/automation/workflows/new"; } },
    ],
});
