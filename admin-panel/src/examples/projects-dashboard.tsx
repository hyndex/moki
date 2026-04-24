import type { WorkspaceDescriptor, ReportDefinition, ReportResult } from "@/contracts/widgets";
import { buildControlRoom } from "./_factory/controlRoomHelper";
import { buildReportLibrary } from "./_factory/reportLibraryHelper";

const workspace: WorkspaceDescriptor = {
  id: "projects.control-room",
  label: "Projects Control Room",
  widgets: [
    { id: "h1", type: "header", col: 12, label: "Delivery pulse", level: 2 },
    { id: "k-active", type: "number_card", col: 3, label: "Active projects",
      aggregation: { resource: "projects.project", fn: "count",
        filter: { field: "status", op: "eq", value: "in_progress" } },
      drilldown: "/projects" },
    { id: "k-atrisk", type: "number_card", col: 3, label: "At risk",
      aggregation: { resource: "projects.project", fn: "count",
        filter: { field: "riskLevel", op: "eq", value: "high" } },
      warnAbove: 2, dangerAbove: 5 },
    { id: "k-overdue", type: "number_card", col: 3, label: "Overdue tasks",
      aggregation: { resource: "projects.task", fn: "count",
        filter: { field: "overdue", op: "eq", value: true } },
      drilldown: "/projects/tasks" },
    { id: "k-hours", type: "number_card", col: 3, label: "Logged hrs (30d)",
      aggregation: { resource: "projects.time-log", fn: "sum", field: "hours",
        range: { kind: "last", days: 30 } } },
    { id: "h2", type: "header", col: 12, label: "Charts", level: 2 },
    { id: "c-status", type: "chart", col: 6, label: "Projects by status", chart: "donut",
      aggregation: { resource: "projects.project", fn: "count", groupBy: "status" } },
    { id: "c-owner", type: "chart", col: 6, label: "Projects by owner", chart: "bar",
      aggregation: { resource: "projects.project", fn: "count", groupBy: "owner" } },
    { id: "c-burndown", type: "chart", col: 6, label: "Tasks completed (30d)", chart: "area",
      aggregation: { resource: "projects.task", fn: "count", period: "day", range: { kind: "last", days: 30 },
        filter: { field: "status", op: "eq", value: "done" } } },
    { id: "c-hours", type: "chart", col: 6, label: "Hours by project (30d)", chart: "bar",
      aggregation: { resource: "projects.time-log", fn: "sum", field: "hours", groupBy: "projectCode",
        range: { kind: "last", days: 30 } } },
    { id: "h3", type: "header", col: 12, label: "Shortcuts", level: 2 },
    { id: "sc-new", type: "shortcut", col: 3, label: "New project", icon: "Plus", href: "/projects/new" },
    { id: "sc-board", type: "shortcut", col: 3, label: "Board", icon: "LayoutGrid", href: "/projects/board" },
    { id: "sc-sprints", type: "shortcut", col: 3, label: "Sprints", icon: "Timer", href: "/projects/sprints" },
    { id: "sc-reports", type: "shortcut", col: 3, label: "Reports", icon: "BarChart3", href: "/projects/reports" },
    { id: "h4", type: "header", col: 12, label: "Attention", level: 2 },
    { id: "ql-risk", type: "quick_list", col: 6, label: "High-risk projects",
      resource: "projects.project", sort: { field: "riskScore", dir: "desc" }, limit: 10,
      primary: "name", secondary: "owner",
      filter: { field: "riskLevel", op: "eq", value: "high" },
      href: (r) => `/projects/${r.id}` },
    { id: "ql-overdue", type: "quick_list", col: 6, label: "Overdue tasks",
      resource: "projects.task", sort: { field: "dueAt", dir: "asc" }, limit: 10,
      primary: "title", secondary: "assignee",
      filter: { field: "overdue", op: "eq", value: true },
      href: (r) => `/projects/tasks/${r.id}` },
  ],
};

export const projectsControlRoomView = buildControlRoom({
  viewId: "projects.control-room.view",
  resource: "projects.project",
  title: "Projects Control Room",
  description: "Delivery pulse: active, at-risk, overdue, time logs.",
  workspace,
});

async function fetchAll(r: import("@/runtime/resourceClient").ResourceClient, resource: string) {
  return (await r.list(resource, { page: 1, pageSize: 10_000 })).rows as Record<string, unknown>[];
}
const num = (v: unknown) => (typeof v === "number" ? v : 0);
const str = (v: unknown, d = "") => (typeof v === "string" ? v : d);

const budgetReport: ReportDefinition = {
  id: "budget-variance", label: "Project Budget vs Actual",
  description: "Budgeted hours/$ vs actual per project.",
  icon: "Gauge", resource: "projects.project", filters: [],
  async execute({ resources }): Promise<ReportResult> {
    const projects = await fetchAll(resources, "projects.project");
    const rows = projects.map((p) => ({
      name: str(p.name),
      owner: str(p.owner),
      budgetHours: num(p.budgetHours),
      actualHours: num(p.actualHours),
      budgetCost: num(p.budgetCost),
      actualCost: num(p.actualCost),
      hourVariance: num(p.budgetHours) - num(p.actualHours),
      costVariance: num(p.budgetCost) - num(p.actualCost),
    })).sort((a, b) => a.costVariance - b.costVariance);
    return {
      columns: [
        { field: "name", label: "Project", fieldtype: "text" },
        { field: "owner", label: "Owner", fieldtype: "text" },
        { field: "budgetHours", label: "Budget hrs", fieldtype: "number", align: "right", totaling: "sum" },
        { field: "actualHours", label: "Actual hrs", fieldtype: "number", align: "right", totaling: "sum" },
        { field: "budgetCost", label: "Budget $", fieldtype: "currency", align: "right", options: "USD", totaling: "sum" },
        { field: "actualCost", label: "Actual $", fieldtype: "currency", align: "right", options: "USD", totaling: "sum" },
        { field: "hourVariance", label: "Hr var", fieldtype: "number", align: "right" },
        { field: "costVariance", label: "Cost var", fieldtype: "currency", align: "right", options: "USD" },
      ],
      rows,
    };
  },
};

const taskCompletionReport: ReportDefinition = {
  id: "task-completion", label: "Task Completion Rate",
  description: "Completed vs open tasks per project.",
  icon: "CheckCircle2", resource: "projects.task", filters: [],
  async execute({ resources }) {
    const tasks = await fetchAll(resources, "projects.task");
    const by = new Map<string, { projectCode: string; total: number; done: number; inProgress: number; todo: number; rate: number }>();
    for (const t of tasks) {
      const p = str(t.projectCode);
      const r = by.get(p) ?? { projectCode: p, total: 0, done: 0, inProgress: 0, todo: 0, rate: 0 };
      r.total++;
      if (t.status === "done") r.done++;
      else if (t.status === "in_progress") r.inProgress++;
      else r.todo++;
      by.set(p, r);
    }
    const rows = [...by.values()]
      .map((r) => ({ ...r, rate: r.total > 0 ? Math.round((r.done / r.total) * 100) : 0 }))
      .sort((a, b) => b.rate - a.rate);
    return {
      columns: [
        { field: "projectCode", label: "Project", fieldtype: "text" },
        { field: "total", label: "Total", fieldtype: "number", align: "right", totaling: "sum" },
        { field: "done", label: "Done", fieldtype: "number", align: "right", totaling: "sum" },
        { field: "inProgress", label: "In progress", fieldtype: "number", align: "right", totaling: "sum" },
        { field: "todo", label: "Todo", fieldtype: "number", align: "right", totaling: "sum" },
        { field: "rate", label: "Rate %", fieldtype: "percent", align: "right" },
      ],
      rows,
    };
  },
};

const timeLogsReport: ReportDefinition = {
  id: "time-logs", label: "Time Logs",
  description: "Hours logged by team member (30d).",
  icon: "Clock", resource: "projects.time-log", filters: [],
  async execute({ resources }) {
    const logs = await fetchAll(resources, "projects.time-log");
    const cutoff = Date.now() - 30 * 86_400_000;
    const by = new Map<string, { user: string; hours: number; billable: number; entries: number }>();
    for (const l of logs) {
      const d = Date.parse(str(l.loggedAt));
      if (Number.isNaN(d) || d < cutoff) continue;
      const u = str(l.user);
      const r = by.get(u) ?? { user: u, hours: 0, billable: 0, entries: 0 };
      r.hours += num(l.hours);
      r.billable += l.billable ? num(l.hours) : 0;
      r.entries++;
      by.set(u, r);
    }
    const rows = [...by.values()].sort((a, b) => b.hours - a.hours);
    return {
      columns: [
        { field: "user", label: "User", fieldtype: "text" },
        { field: "entries", label: "Entries", fieldtype: "number", align: "right", totaling: "sum" },
        { field: "hours", label: "Hours", fieldtype: "number", align: "right", totaling: "sum" },
        { field: "billable", label: "Billable", fieldtype: "number", align: "right", totaling: "sum" },
      ],
      rows,
    };
  },
};

const sprintVelocityReport: ReportDefinition = {
  id: "sprint-velocity", label: "Sprint Velocity",
  description: "Story points completed per sprint.",
  icon: "Zap", resource: "projects.sprint", filters: [],
  async execute({ resources }) {
    const sprints = await fetchAll(resources, "projects.sprint");
    const rows = sprints.map((s) => ({
      name: str(s.name),
      team: str(s.team),
      plannedPoints: num(s.plannedPoints),
      completedPoints: num(s.completedPoints),
      velocity: num(s.completedPoints),
      startAt: str(s.startAt),
      endAt: str(s.endAt),
    })).sort((a, b) => a.startAt.localeCompare(b.startAt));
    return {
      columns: [
        { field: "name", label: "Sprint", fieldtype: "text" },
        { field: "team", label: "Team", fieldtype: "text" },
        { field: "plannedPoints", label: "Planned", fieldtype: "number", align: "right", totaling: "sum" },
        { field: "completedPoints", label: "Completed", fieldtype: "number", align: "right", totaling: "sum" },
        { field: "velocity", label: "Velocity", fieldtype: "number", align: "right" },
      ],
      rows,
      chart: { kind: "line", label: "Velocity trend",
        from: (rs) => (rs as typeof rows).map((r) => ({ label: r.name, value: r.velocity })) },
    };
  },
};

const milestoneReport: ReportDefinition = {
  id: "milestones", label: "Milestones",
  description: "Upcoming + overdue project milestones.",
  icon: "Flag", resource: "projects.milestone", filters: [],
  async execute({ resources }) {
    const ms = await fetchAll(resources, "projects.milestone");
    const rows = ms.map((m) => ({
      name: str(m.name),
      projectCode: str(m.projectCode),
      dueAt: str(m.dueAt),
      status: str(m.status),
      owner: str(m.owner),
    })).sort((a, b) => a.dueAt.localeCompare(b.dueAt));
    return {
      columns: [
        { field: "projectCode", label: "Project", fieldtype: "text" },
        { field: "name", label: "Milestone", fieldtype: "text" },
        { field: "dueAt", label: "Due", fieldtype: "date" },
        { field: "status", label: "Status", fieldtype: "enum" },
        { field: "owner", label: "Owner", fieldtype: "text" },
      ],
      rows,
    };
  },
};

const burndownReport: ReportDefinition = {
  id: "burndown", label: "Burndown",
  description: "Open vs closed task count over time.",
  icon: "TrendingDown", resource: "projects.task", filters: [],
  async execute({ resources }) {
    const tasks = await fetchAll(resources, "projects.task");
    const by = new Map<string, { day: string; open: number; done: number }>();
    for (const t of tasks) {
      if (!t.createdAt) continue;
      const day = str(t.createdAt).slice(0, 10);
      const r = by.get(day) ?? { day, open: 0, done: 0 };
      if (t.status === "done") r.done++;
      else r.open++;
      by.set(day, r);
    }
    const rows = [...by.values()].sort((a, b) => a.day.localeCompare(b.day));
    return {
      columns: [
        { field: "day", label: "Day", fieldtype: "date" },
        { field: "open", label: "Open", fieldtype: "number", align: "right", totaling: "sum" },
        { field: "done", label: "Done", fieldtype: "number", align: "right", totaling: "sum" },
      ],
      rows,
      chart: { kind: "line", label: "Burndown",
        from: (rs) => (rs as typeof rows).map((r) => ({ label: r.day, value: r.open })) },
    };
  },
};

export const PROJECTS_REPORTS: readonly ReportDefinition[] = [
  budgetReport, taskCompletionReport, timeLogsReport, sprintVelocityReport, milestoneReport, burndownReport,
];

const { indexView, detailView } = buildReportLibrary({
  indexViewId: "projects.reports.view",
  detailViewId: "projects.reports-detail.view",
  resource: "projects.project",
  title: "Project Reports",
  description: "Budget variance, task completion, time logs, sprint velocity, milestones, burndown.",
  basePath: "/projects/reports",
  reports: PROJECTS_REPORTS,
});

export const projectsReportsIndexView = indexView;
export const projectsReportsDetailView = detailView;
