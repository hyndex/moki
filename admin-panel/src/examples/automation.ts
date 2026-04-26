import { buildDomainPlugin } from "./_factory/buildDomainPlugin";
import { SECTIONS } from "./_factory/sections";
import { STATUS_ACTIVE, SEVERITY } from "./_factory/options";
import { daysAgo, hoursAgo, pick } from "./_factory/seeds";
import { automationRunDetailView } from "./automation-pages";
import { buildCompactControlRoom } from "./_factory/compactDashboard";
import { buildReportLibrary } from "./_factory/reportLibraryHelper";
import type { ReportDefinition, ReportResult } from "@/contracts/widgets";

const controlRoomView = buildCompactControlRoom({
  viewId: "automation.control-room.view",
  resource: "automation.trigger",
  title: "Automation Control Room",
  description: "Triggers, runs, failure rate.",
  kpis: [
    { label: "Active triggers", resource: "automation.trigger",
      filter: { field: "status", op: "eq", value: "active" } },
    { label: "Runs (24h)", resource: "automation.run", range: "last-30" },
    { label: "Errors (24h)", resource: "automation.run",
      filter: { field: "severity", op: "eq", value: "error" }, range: "last-30",
      warnAbove: 5, dangerAbove: 25 },
    { label: "Avg duration (ms)", resource: "automation.run", fn: "avg", field: "durationMs" },
  ],
  charts: [
    { label: "Runs by severity", resource: "automation.run", chart: "donut", groupBy: "severity" },
    { label: "Runs (30d)", resource: "automation.run", chart: "area", period: "day", lastDays: 30 },
  ],
  shortcuts: [
    { label: "New trigger", icon: "Plus", href: "/automation/triggers/new" },
    { label: "Runs log", icon: "History", href: "/automation/runs" },
    { label: "Sample run", icon: "PlayCircle", href: "/automation/run-detail" },
    { label: "Reports", icon: "BarChart3", href: "/automation/reports" },
  ],
});

async function fetchAll(r: import("@/runtime/resourceClient").ResourceClient, resource: string) {
  return (await r.list(resource, { page: 1, pageSize: 10_000 })).rows as Record<string, unknown>[];
}
const num = (v: unknown) => (typeof v === "number" ? v : 0);
const str = (v: unknown, d = "") => (typeof v === "string" ? v : d);

const triggerHealthReport: ReportDefinition = {
  id: "trigger-health", label: "Trigger Health",
  description: "Runs + errors per trigger.",
  icon: "Activity", resource: "automation.run", filters: [],
  async execute({ resources }): Promise<ReportResult> {
    const runs = await fetchAll(resources, "automation.run");
    const by = new Map<string, { trigger: string; runs: number; errors: number; avgMs: number; sumMs: number }>();
    for (const r of runs) {
      const t = str(r.trigger);
      const row = by.get(t) ?? { trigger: t, runs: 0, errors: 0, avgMs: 0, sumMs: 0 };
      row.runs++;
      if (r.severity === "error") row.errors++;
      row.sumMs += num(r.durationMs);
      by.set(t, row);
    }
    const rows = [...by.values()]
      .map((r) => ({ ...r, avgMs: r.runs > 0 ? Math.round(r.sumMs / r.runs) : 0 }))
      .sort((a, b) => b.runs - a.runs);
    return {
      columns: [
        { field: "trigger", label: "Trigger", fieldtype: "text" },
        { field: "runs", label: "Runs", fieldtype: "number", align: "right", totaling: "sum" },
        { field: "errors", label: "Errors", fieldtype: "number", align: "right", totaling: "sum" },
        { field: "avgMs", label: "Avg ms", fieldtype: "number", align: "right" },
      ],
      rows,
    };
  },
};

const { indexView: reportsIndex, detailView: reportsDetail } = buildReportLibrary({
  indexViewId: "automation.reports.view",
  detailViewId: "automation.reports-detail.view",
  resource: "automation.trigger",
  title: "Automation Reports",
  description: "Trigger health.",
  basePath: "/automation/reports",
  reports: [triggerHealthReport],
});

export const automationPlugin = buildDomainPlugin({
  id: "automation",
  label: "Automation",
  icon: "Zap",
  section: SECTIONS.automation,
  order: 1,
  resources: [
    {
      id: "trigger",
      singular: "Trigger",
      plural: "Triggers",
      icon: "Play",
      path: "/automation/triggers",
      fields: [
        { name: "name", kind: "text", required: true, sortable: true },
        { name: "description", kind: "text" },
        { name: "event", kind: "text", sortable: true },
        { name: "kind", label: "Type", kind: "enum", options: [
          { value: "event", label: "Event-based" }, { value: "schedule", label: "Scheduled" },
          { value: "webhook", label: "Webhook" }, { value: "manual", label: "Manual" },
        ] },
        { name: "schedule", kind: "text" },
        { name: "action", kind: "text" },
        { name: "runCount", kind: "number", align: "right" },
        { name: "errorRate", label: "Error %", kind: "number", align: "right" },
        { name: "status", kind: "enum", options: STATUS_ACTIVE, sortable: true },
        { name: "lastFired", kind: "datetime", sortable: true },
      ],
      seedCount: 20,
      seed: (i) => ({
        name: pick(["Notify on new contact", "Send invoice reminder", "Escalate stale issue", "Sync inventory", "Auto-close ticket", "Invoice reminder", "Daily digest"], i),
        description: "",
        event: pick(["contact.created", "invoice.overdue", "issue.stale", "inventory.low"], i),
        kind: pick(["event", "event", "schedule", "webhook"], i),
        schedule: pick(["0 9 * * *", "*/15 * * * *", ""], i),
        action: pick(["send-email", "create-task", "webhook-call", "update-record"], i),
        runCount: 100 + (i * 37) % 3000,
        errorRate: (i * 2) % 10,
        status: pick(["active", "active", "inactive"], i),
        lastFired: hoursAgo(i),
      }),
    },
    {
      id: "run",
      singular: "Run",
      plural: "Runs",
      icon: "History",
      path: "/automation/runs",
      readOnly: true,
      displayField: "id",
      defaultSort: { field: "startedAt", dir: "desc" },
      fields: [
        { name: "trigger", kind: "text", sortable: true },
        { name: "severity", kind: "enum", options: SEVERITY, sortable: true },
        { name: "startedAt", kind: "datetime", sortable: true },
        { name: "completedAt", kind: "datetime" },
        { name: "durationMs", label: "Duration (ms)", kind: "number", align: "right" },
        { name: "steps", kind: "number", align: "right" },
        { name: "message", kind: "text" },
      ],
      seedCount: 60,
      seed: (i) => ({
        trigger: pick(["Notify on new contact", "Send invoice reminder", "Sync inventory"], i),
        severity: pick(["info", "info", "info", "warn", "error"], i),
        startedAt: daysAgo(i * 0.3),
        completedAt: daysAgo(i * 0.3 - 0.01),
        durationMs: 80 + ((i * 193) % 2400),
        steps: 1 + (i % 8),
        message: i % 5 === 4 ? "Error: connection refused" : "",
      }),
    },
    {
      id: "action",
      singular: "Action",
      plural: "Actions",
      icon: "Sparkles",
      path: "/automation/actions",
      fields: [
        { name: "name", kind: "text", required: true, sortable: true },
        { name: "kind", kind: "enum", options: [
          { value: "send-email", label: "Send email" },
          { value: "webhook", label: "Call webhook" },
          { value: "create-record", label: "Create record" },
          { value: "update-record", label: "Update record" },
          { value: "post-slack", label: "Post to Slack" },
        ] },
        { name: "config", kind: "text" },
        { name: "usageCount", kind: "number", align: "right" },
      ],
      seedCount: 10,
      seed: (i) => ({
        name: pick(["Welcome email", "Slack ops", "Create follow-up task", "Update lead status", "Webhook relay"], i),
        kind: pick(["send-email", "post-slack", "create-record", "update-record", "webhook"], i),
        config: "{…}",
        usageCount: 50 + (i * 37) % 500,
      }),
    },
  ],
  extraNav: [
    { id: "automation.control-room.nav", label: "Automation Control Room", icon: "LayoutDashboard", path: "/automation/control-room", view: "automation.control-room.view", order: 0 },
    { id: "automation.reports.nav", label: "Reports", icon: "BarChart3", path: "/automation/reports", view: "automation.reports.view" },
    { id: "automation.run-detail.nav", label: "Sample run", icon: "PlayCircle", path: "/automation/run-detail", view: "automation.run-detail.view" },
  ],
  extraViews: [controlRoomView, reportsIndex, reportsDetail, automationRunDetailView],
  commands: [
    { id: "auto.go.control-room", label: "Automation: Control Room", icon: "LayoutDashboard", run: () => { window.location.hash = "/automation/control-room"; } },
    { id: "auto.new-trigger", label: "New trigger", icon: "Plus", run: () => { window.location.hash = "/automation/triggers/new"; } },
  ],
});
