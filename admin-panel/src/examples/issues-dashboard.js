import { buildControlRoom } from "./_factory/controlRoomHelper";
import { buildReportLibrary } from "./_factory/reportLibraryHelper";
const workspace = {
    id: "issues.control-room",
    label: "Issues Control Room",
    filterBar: [
        {
            field: "status",
            label: "Status",
            kind: "enum",
            options: [
                { value: "open", label: "Open" },
                { value: "in_progress", label: "In progress" },
                { value: "resolved", label: "Resolved" },
                { value: "closed", label: "Closed" },
            ],
        },
        {
            field: "severity",
            label: "Severity",
            kind: "enum",
            options: [
                { value: "critical", label: "Critical" },
                { value: "high", label: "High" },
                { value: "medium", label: "Medium" },
                { value: "low", label: "Low" },
            ],
        },
        { field: "assignee", label: "Assignee", kind: "text" },
    ],
    widgets: [
        { id: "h1", type: "header", col: 12, label: "Bug pulse", level: 2 },
        { id: "k-open", type: "number_card", col: 3, label: "Open issues",
            aggregation: { resource: "issues.issue", fn: "count",
                filter: { or: [{ field: "status", op: "eq", value: "open" }, { field: "status", op: "eq", value: "in_progress" }] } },
            drilldown: "/issues" },
        { id: "k-urgent", type: "number_card", col: 3, label: "Urgent open",
            aggregation: { resource: "issues.issue", fn: "count",
                filter: { and: [{ field: "priority", op: "eq", value: "urgent" }, { field: "status", op: "neq", value: "resolved" }] } },
            warnAbove: 2, dangerAbove: 5 },
        { id: "k-new-week", type: "number_card", col: 3, label: "New (7d)",
            aggregation: { resource: "issues.issue", fn: "count",
                range: { kind: "last", days: 7 } } },
        { id: "k-resolved-week", type: "number_card", col: 3, label: "Resolved (7d)",
            aggregation: { resource: "issues.issue", fn: "count",
                filter: { field: "status", op: "eq", value: "resolved" },
                range: { kind: "last", days: 7 } } },
        { id: "h2", type: "header", col: 12, label: "Charts", level: 2 },
        { id: "c-status", type: "chart", col: 6, label: "Issues by status", chart: "donut",
            aggregation: { resource: "issues.issue", fn: "count", groupBy: "status" } },
        { id: "c-priority", type: "chart", col: 6, label: "Issues by priority", chart: "donut",
            aggregation: { resource: "issues.issue", fn: "count", groupBy: "priority" } },
        { id: "c-component", type: "chart", col: 6, label: "Issues by component", chart: "bar",
            aggregation: { resource: "issues.issue", fn: "count", groupBy: "component" } },
        { id: "c-volume", type: "chart", col: 6, label: "Issue volume (30d)", chart: "area",
            aggregation: { resource: "issues.issue", fn: "count", period: "day", range: { kind: "last", days: 30 } } },
        { id: "h3", type: "header", col: 12, label: "Shortcuts", level: 2 },
        { id: "sc-new", type: "shortcut", col: 3, label: "New issue", icon: "Plus", href: "/issues/new" },
        { id: "sc-board", type: "shortcut", col: 3, label: "Board", icon: "LayoutGrid", href: "/issues/board" },
        { id: "sc-releases", type: "shortcut", col: 3, label: "Releases", icon: "Package", href: "/issues/releases" },
        { id: "sc-reports", type: "shortcut", col: 3, label: "Reports", icon: "BarChart3", href: "/issues/reports" },
        { id: "h4", type: "header", col: 12, label: "Attention", level: 2 },
        { id: "ql-regression", type: "quick_list", col: 6, label: "Regressions",
            resource: "issues.issue", sort: { field: "updatedAt", dir: "desc" }, limit: 10,
            primary: "code", secondary: "title",
            filter: { field: "kind", op: "eq", value: "regression" },
            href: (r) => `/issues/${r.id}` },
        { id: "ql-customer", type: "quick_list", col: 6, label: "Customer-reported open",
            resource: "issues.issue", sort: { field: "createdAt", dir: "desc" }, limit: 10,
            primary: "code", secondary: "reporter",
            filter: { and: [
                    { field: "reporterKind", op: "eq", value: "customer" },
                    { or: [{ field: "status", op: "eq", value: "open" }, { field: "status", op: "eq", value: "in_progress" }] },
                ] },
            href: (r) => `/issues/${r.id}` },
    ],
};
export const issuesControlRoomView = buildControlRoom({
    viewId: "issues.control-room.view",
    resource: "issues.issue",
    title: "Issues Control Room",
    description: "Bug pulse, regressions, component hotspots, release burndown.",
    workspace,
});
async function fetchAll(r, resource) {
    return (await r.list(resource, { page: 1, pageSize: 10_000 })).rows;
}
const num = (v) => (typeof v === "number" ? v : 0);
const str = (v, d = "") => (typeof v === "string" ? v : d);
const componentHotspotReport = {
    id: "component-hotspots", label: "Component Hotspots",
    description: "Which components receive the most bug reports?",
    icon: "Flame", resource: "issues.issue", filters: [],
    async execute({ resources }) {
        const issues = await fetchAll(resources, "issues.issue");
        const by = new Map();
        const now = Date.now();
        const ageSum = new Map();
        const ageCount = new Map();
        for (const i of issues) {
            const c = str(i.component, "unknown");
            const r = by.get(c) ?? { component: c, total: 0, open: 0, avgAgeDays: 0 };
            r.total++;
            if (i.status !== "resolved" && i.status !== "closed")
                r.open++;
            if (i.createdAt) {
                const days = (now - Date.parse(str(i.createdAt))) / 86_400_000;
                ageSum.set(c, (ageSum.get(c) ?? 0) + days);
                ageCount.set(c, (ageCount.get(c) ?? 0) + 1);
            }
            by.set(c, r);
        }
        const rows = [...by.values()]
            .map((r) => ({
            ...r,
            avgAgeDays: Math.round(((ageSum.get(r.component) ?? 0) / (ageCount.get(r.component) || 1)) * 10) / 10,
        }))
            .sort((a, b) => b.total - a.total);
        return {
            columns: [
                { field: "component", label: "Component", fieldtype: "text" },
                { field: "total", label: "Total", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "open", label: "Open", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "avgAgeDays", label: "Avg age (d)", fieldtype: "number", align: "right" },
            ],
            rows,
        };
    },
};
const mttrReport = {
    id: "mttr", label: "Mean Time To Resolve",
    description: "Average days from open to resolved, per priority.",
    icon: "Timer", resource: "issues.issue", filters: [],
    async execute({ resources }) {
        const issues = await fetchAll(resources, "issues.issue");
        const by = new Map();
        for (const i of issues) {
            if (i.status !== "resolved" && i.status !== "closed")
                continue;
            const created = Date.parse(str(i.createdAt));
            const resolved = Date.parse(str(i.resolvedAt, str(i.updatedAt)));
            if (Number.isNaN(created) || Number.isNaN(resolved))
                continue;
            const days = (resolved - created) / 86_400_000;
            if (days < 0)
                continue;
            const p = str(i.priority);
            const r = by.get(p) ?? { priority: p, count: 0, totalDays: 0, avgDays: 0 };
            r.count++;
            r.totalDays += days;
            by.set(p, r);
        }
        const rows = [...by.values()]
            .map((r) => ({ ...r, avgDays: Math.round((r.totalDays / r.count) * 10) / 10 }))
            .sort((a, b) => a.avgDays - b.avgDays);
        return {
            columns: [
                { field: "priority", label: "Priority", fieldtype: "enum" },
                { field: "count", label: "Resolved", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "avgDays", label: "Avg days", fieldtype: "number", align: "right" },
            ],
            rows,
        };
    },
};
const velocityReport = {
    id: "velocity", label: "Team Velocity",
    description: "Issues opened vs closed per week.",
    icon: "Activity", resource: "issues.issue", filters: [],
    async execute({ resources }) {
        const issues = await fetchAll(resources, "issues.issue");
        const by = new Map();
        const wk = (d) => {
            const onejan = new Date(d.getFullYear(), 0, 1);
            const w = Math.ceil(((d.getTime() - onejan.getTime()) / 86_400_000 + onejan.getDay() + 1) / 7);
            return `${d.getFullYear()}-W${String(w).padStart(2, "0")}`;
        };
        for (const i of issues) {
            if (i.createdAt) {
                const d = new Date(str(i.createdAt));
                if (!Number.isNaN(d.getTime())) {
                    const k = wk(d);
                    const r = by.get(k) ?? { week: k, opened: 0, closed: 0 };
                    r.opened++;
                    by.set(k, r);
                }
            }
            if ((i.status === "resolved" || i.status === "closed") && i.resolvedAt) {
                const d = new Date(str(i.resolvedAt));
                if (!Number.isNaN(d.getTime())) {
                    const k = wk(d);
                    const r = by.get(k) ?? { week: k, opened: 0, closed: 0 };
                    r.closed++;
                    by.set(k, r);
                }
            }
        }
        const rows = [...by.values()].sort((a, b) => a.week.localeCompare(b.week));
        return {
            columns: [
                { field: "week", label: "Week", fieldtype: "text" },
                { field: "opened", label: "Opened", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "closed", label: "Closed", fieldtype: "number", align: "right", totaling: "sum" },
            ],
            rows,
            chart: { kind: "line", label: "Velocity",
                from: (rs) => rs.map((r) => ({ label: r.week, value: r.closed })) },
        };
    },
};
const topReportersReport = {
    id: "top-reporters", label: "Top Reporters",
    description: "Customers/users filing the most issues.",
    icon: "Users", resource: "issues.issue", filters: [],
    async execute({ resources }) {
        const issues = await fetchAll(resources, "issues.issue");
        const by = new Map();
        for (const i of issues) {
            const r = str(i.reporter);
            const key = `${r}|${str(i.reporterKind)}`;
            const row = by.get(key) ?? { reporter: r, kind: str(i.reporterKind, "internal"), issues: 0 };
            row.issues++;
            by.set(key, row);
        }
        const rows = [...by.values()].sort((a, b) => b.issues - a.issues).slice(0, 20);
        return {
            columns: [
                { field: "reporter", label: "Reporter", fieldtype: "text" },
                { field: "kind", label: "Kind", fieldtype: "enum" },
                { field: "issues", label: "Issues", fieldtype: "number", align: "right", totaling: "sum" },
            ],
            rows,
        };
    },
};
const regressionReport = {
    id: "regressions", label: "Regression Rate",
    description: "Releases where regressions appeared.",
    icon: "RotateCcw", resource: "issues.issue", filters: [],
    async execute({ resources }) {
        const issues = await fetchAll(resources, "issues.issue");
        const by = new Map();
        for (const i of issues) {
            const r = str(i.foundInRelease, "untagged");
            const row = by.get(r) ?? { release: r, total: 0, regressions: 0, rate: 0 };
            row.total++;
            if (i.kind === "regression")
                row.regressions++;
            by.set(r, row);
        }
        const rows = [...by.values()]
            .map((r) => ({ ...r, rate: r.total > 0 ? Math.round((r.regressions / r.total) * 100) : 0 }))
            .sort((a, b) => b.rate - a.rate);
        return {
            columns: [
                { field: "release", label: "Release", fieldtype: "text" },
                { field: "total", label: "Issues", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "regressions", label: "Regressions", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "rate", label: "Rate %", fieldtype: "percent", align: "right" },
            ],
            rows,
        };
    },
};
const slaReport = {
    id: "issue-sla", label: "SLA Compliance",
    description: "Resolution SLA compliance by priority.",
    icon: "ShieldCheck", resource: "issues.issue", filters: [],
    async execute({ resources }) {
        const issues = await fetchAll(resources, "issues.issue");
        const by = new Map();
        for (const i of issues) {
            const p = str(i.priority);
            const r = by.get(p) ?? { priority: p, total: 0, breached: 0, rate: 0 };
            r.total++;
            if (i.slaBreached)
                r.breached++;
            by.set(p, r);
        }
        const rows = [...by.values()].map((r) => ({
            ...r,
            rate: r.total > 0 ? Math.round(((r.total - r.breached) / r.total) * 100) : 100,
        }));
        return {
            columns: [
                { field: "priority", label: "Priority", fieldtype: "enum" },
                { field: "total", label: "Total", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "breached", label: "Breached", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "rate", label: "Compliance %", fieldtype: "percent", align: "right" },
            ],
            rows,
        };
    },
};
export const ISSUES_REPORTS = [
    componentHotspotReport, mttrReport, velocityReport, topReportersReport, regressionReport, slaReport,
];
const { indexView, detailView } = buildReportLibrary({
    indexViewId: "issues.reports.view",
    detailViewId: "issues.reports-detail.view",
    resource: "issues.issue",
    title: "Issue Reports",
    description: "Component hotspots, MTTR, velocity, top reporters, regression rate, SLA.",
    basePath: "/issues/reports",
    reports: ISSUES_REPORTS,
});
export const issuesReportsIndexView = indexView;
export const issuesReportsDetailView = detailView;
