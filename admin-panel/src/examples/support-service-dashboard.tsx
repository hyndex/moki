import type { WorkspaceDescriptor, ReportDefinition, ReportResult } from "@/contracts/widgets";
import { buildControlRoom } from "./_factory/controlRoomHelper";
import { buildReportLibrary } from "./_factory/reportLibraryHelper";

const workspace: WorkspaceDescriptor = {
  id: "support-service.control-room",
  label: "Support Control Room",
  widgets: [
    { id: "h1", type: "header", col: 12, label: "Queue pulse", level: 2 },
    { id: "k-open", type: "number_card", col: 3, label: "Open tickets",
      aggregation: { resource: "support-service.ticket", fn: "count",
        filter: { or: [{ field: "status", op: "eq", value: "open" }, { field: "status", op: "eq", value: "in_progress" }] } },
      drilldown: "/support/tickets", warnAbove: 50, dangerAbove: 150 },
    { id: "k-sla-breached", type: "number_card", col: 3, label: "SLA breached",
      aggregation: { resource: "support-service.ticket", fn: "count",
        filter: { field: "slaBreached", op: "eq", value: true } },
      drilldown: "/support/tickets", warnAbove: 2, dangerAbove: 5 },
    { id: "k-resolved-today", type: "number_card", col: 3, label: "Resolved (MTD)",
      aggregation: { resource: "support-service.ticket", fn: "count",
        filter: { field: "status", op: "eq", value: "resolved" },
        range: { kind: "mtd" } },
      trend: true },
    { id: "k-csat", type: "number_card", col: 3, label: "CSAT (30d)",
      aggregation: { resource: "support-service.csat-response", fn: "avg", field: "score",
        range: { kind: "last", days: 30 } },
      trend: true },
    { id: "h2", type: "header", col: 12, label: "Charts", level: 2 },
    { id: "c-status", type: "chart", col: 6, label: "Tickets by status", chart: "donut",
      aggregation: { resource: "support-service.ticket", fn: "count", groupBy: "status" } },
    { id: "c-priority", type: "chart", col: 6, label: "Tickets by priority", chart: "donut",
      aggregation: { resource: "support-service.ticket", fn: "count", groupBy: "priority" } },
    { id: "c-volume", type: "chart", col: 6, label: "Ticket volume (30d)", chart: "area",
      aggregation: { resource: "support-service.ticket", fn: "count", period: "day", range: { kind: "last", days: 30 } } },
    { id: "c-channel", type: "chart", col: 6, label: "Tickets by channel", chart: "bar",
      aggregation: { resource: "support-service.ticket", fn: "count", groupBy: "channel" } },
    { id: "h3", type: "header", col: 12, label: "Shortcuts", level: 2 },
    { id: "sc-new", type: "shortcut", col: 3, label: "New ticket", icon: "Plus", href: "/support/tickets/new" },
    { id: "sc-board", type: "shortcut", col: 3, label: "Board", icon: "LayoutGrid", href: "/support/board" },
    { id: "sc-reports", type: "shortcut", col: 3, label: "Reports", icon: "BarChart3", href: "/support/reports" },
    { id: "sc-kb", type: "shortcut", col: 3, label: "Knowledge base", icon: "BookOpen", href: "/support/articles" },
    { id: "h4", type: "header", col: 12, label: "Attention", level: 2 },
    { id: "ql-urgent", type: "quick_list", col: 6, label: "Urgent open",
      resource: "support-service.ticket", sort: { field: "updatedAt", dir: "desc" }, limit: 10,
      primary: "code", secondary: "subject",
      filter: { and: [
        { field: "priority", op: "eq", value: "urgent" },
        { or: [{ field: "status", op: "eq", value: "open" }, { field: "status", op: "eq", value: "in_progress" }] },
      ] },
      href: (r) => `/support/tickets/${r.id}` },
    { id: "ql-sla", type: "quick_list", col: 6, label: "SLA-at-risk",
      resource: "support-service.ticket", sort: { field: "slaDueAt", dir: "asc" }, limit: 10,
      primary: "code", secondary: "assignee",
      filter: { field: "slaAtRisk", op: "eq", value: true },
      href: (r) => `/support/tickets/${r.id}` },
  ],
};

export const supportControlRoomView = buildControlRoom({
  viewId: "support-service.control-room.view",
  resource: "support-service.ticket",
  title: "Support Control Room",
  description: "Queue pulse, SLA breaches, CSAT, agent leaderboard.",
  workspace,
});

async function fetchAll(r: import("@/runtime/resourceClient").ResourceClient, resource: string) {
  return (await r.list(resource, { page: 1, pageSize: 10_000 })).rows as Record<string, unknown>[];
}
const num = (v: unknown) => (typeof v === "number" ? v : 0);
const str = (v: unknown, d = "") => (typeof v === "string" ? v : d);
const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

const issueAnalyticsReport: ReportDefinition = {
  id: "issue-analytics", label: "Issue Analytics",
  description: "Tickets by status, priority, channel — full slice + dice.",
  icon: "PieChart", resource: "support-service.ticket", filters: [],
  async execute({ resources }): Promise<ReportResult> {
    const tickets = await fetchAll(resources, "support-service.ticket");
    const by = new Map<string, { status: string; priority: string; channel: string; count: number }>();
    for (const t of tickets) {
      const k = `${str(t.status)}|${str(t.priority)}|${str(t.channel, "email")}`;
      const r = by.get(k) ?? { status: str(t.status), priority: str(t.priority), channel: str(t.channel, "email"), count: 0 };
      r.count++;
      by.set(k, r);
    }
    const rows = [...by.values()].sort((a, b) => b.count - a.count);
    return {
      columns: [
        { field: "status", label: "Status", fieldtype: "enum" },
        { field: "priority", label: "Priority", fieldtype: "enum" },
        { field: "channel", label: "Channel", fieldtype: "enum" },
        { field: "count", label: "Count", fieldtype: "number", align: "right", totaling: "sum" },
      ],
      rows,
    };
  },
};

const firstResponseReport: ReportDefinition = {
  id: "first-response", label: "First Response Time",
  description: "Average time to first public reply — overall + by agent.",
  icon: "Timer", resource: "support-service.ticket", filters: [],
  async execute({ resources }) {
    const tickets = await fetchAll(resources, "support-service.ticket");
    const by = new Map<string, { assignee: string; tickets: number; totalMs: number; avgHrs: number }>();
    for (const t of tickets) {
      const created = t.createdAt ? Date.parse(str(t.createdAt)) : NaN;
      const first = t.firstResponseAt ? Date.parse(str(t.firstResponseAt)) : NaN;
      if (Number.isNaN(created) || Number.isNaN(first)) continue;
      const ms = first - created;
      if (ms < 0) continue;
      const a = str(t.assignee, "unassigned");
      const r = by.get(a) ?? { assignee: a, tickets: 0, totalMs: 0, avgHrs: 0 };
      r.tickets++;
      r.totalMs += ms;
      by.set(a, r);
    }
    const rows = [...by.values()]
      .map((r) => ({ ...r, avgHrs: Math.round((r.totalMs / r.tickets / 3_600_000) * 10) / 10 }))
      .sort((a, b) => a.avgHrs - b.avgHrs);
    return {
      columns: [
        { field: "assignee", label: "Assignee", fieldtype: "text" },
        { field: "tickets", label: "Tickets", fieldtype: "number", align: "right", totaling: "sum" },
        { field: "avgHrs", label: "Avg hrs to first response", fieldtype: "number", align: "right" },
      ],
      rows,
      chart: { kind: "bar", label: "Avg first-response by agent",
        from: (rs) => (rs as typeof rows).map((r) => ({ label: r.assignee, value: r.avgHrs })) },
    };
  },
};

const slaComplianceReport: ReportDefinition = {
  id: "sla-compliance", label: "SLA Compliance",
  description: "Breach rate + at-risk counts per SLA policy.",
  icon: "ShieldCheck", resource: "support-service.ticket", filters: [],
  async execute({ resources }) {
    const tickets = await fetchAll(resources, "support-service.ticket");
    const by = new Map<string, { policy: string; total: number; breached: number; atRisk: number; compliant: number; rate: number }>();
    for (const t of tickets) {
      const policy = str(t.slaPolicy, "default");
      const r = by.get(policy) ?? { policy, total: 0, breached: 0, atRisk: 0, compliant: 0, rate: 0 };
      r.total++;
      if (t.slaBreached) r.breached++;
      else if (t.slaAtRisk) r.atRisk++;
      else r.compliant++;
      by.set(policy, r);
    }
    const rows = [...by.values()].map((r) => ({
      ...r,
      rate: r.total > 0 ? Math.round(((r.total - r.breached) / r.total) * 100) : 100,
    }));
    return {
      columns: [
        { field: "policy", label: "SLA Policy", fieldtype: "text" },
        { field: "total", label: "Total", fieldtype: "number", align: "right", totaling: "sum" },
        { field: "breached", label: "Breached", fieldtype: "number", align: "right", totaling: "sum" },
        { field: "atRisk", label: "At risk", fieldtype: "number", align: "right", totaling: "sum" },
        { field: "compliant", label: "Compliant", fieldtype: "number", align: "right", totaling: "sum" },
        { field: "rate", label: "Compliance %", fieldtype: "percent", align: "right" },
      ],
      rows,
    };
  },
};

const resolutionTimeReport: ReportDefinition = {
  id: "resolution-time", label: "Resolution Time",
  description: "Average resolution time per priority.",
  icon: "Clock", resource: "support-service.ticket", filters: [],
  async execute({ resources }) {
    const tickets = await fetchAll(resources, "support-service.ticket");
    const by = new Map<string, { priority: string; count: number; sumHrs: number; avgHrs: number }>();
    for (const t of tickets) {
      if (t.status !== "resolved" && t.status !== "closed") continue;
      const created = t.createdAt ? Date.parse(str(t.createdAt)) : NaN;
      const resolved = t.resolvedAt ? Date.parse(str(t.resolvedAt)) : NaN;
      if (Number.isNaN(created) || Number.isNaN(resolved)) continue;
      const hrs = (resolved - created) / 3_600_000;
      if (hrs < 0) continue;
      const p = str(t.priority);
      const r = by.get(p) ?? { priority: p, count: 0, sumHrs: 0, avgHrs: 0 };
      r.count++;
      r.sumHrs += hrs;
      by.set(p, r);
    }
    const rows = [...by.values()]
      .map((r) => ({ ...r, avgHrs: Math.round((r.sumHrs / r.count) * 10) / 10 }))
      .sort((a, b) => a.avgHrs - b.avgHrs);
    return {
      columns: [
        { field: "priority", label: "Priority", fieldtype: "enum" },
        { field: "count", label: "Count", fieldtype: "number", align: "right", totaling: "sum" },
        { field: "avgHrs", label: "Avg hrs to resolve", fieldtype: "number", align: "right" },
      ],
      rows,
    };
  },
};

const agentLeaderboardReport: ReportDefinition = {
  id: "agent-leaderboard", label: "Agent Leaderboard",
  description: "Tickets resolved per agent (30d).",
  icon: "Trophy", resource: "support-service.ticket", filters: [],
  async execute({ resources }) {
    const tickets = await fetchAll(resources, "support-service.ticket");
    const cutoff = Date.now() - 30 * 86_400_000;
    const by = new Map<string, { assignee: string; opened: number; resolved: number; breached: number }>();
    for (const t of tickets) {
      const a = str(t.assignee, "unassigned");
      const r = by.get(a) ?? { assignee: a, opened: 0, resolved: 0, breached: 0 };
      const updated = t.updatedAt ? Date.parse(str(t.updatedAt)) : 0;
      if (updated < cutoff) continue;
      r.opened++;
      if (t.status === "resolved" || t.status === "closed") r.resolved++;
      if (t.slaBreached) r.breached++;
      by.set(a, r);
    }
    const rows = [...by.values()].sort((a, b) => b.resolved - a.resolved);
    return {
      columns: [
        { field: "assignee", label: "Agent", fieldtype: "text" },
        { field: "opened", label: "Opened", fieldtype: "number", align: "right", totaling: "sum" },
        { field: "resolved", label: "Resolved", fieldtype: "number", align: "right", totaling: "sum" },
        { field: "breached", label: "SLA Breached", fieldtype: "number", align: "right", totaling: "sum" },
      ],
      rows,
    };
  },
};

const csatReport: ReportDefinition = {
  id: "csat", label: "CSAT Summary",
  description: "CSAT responses grouped by agent + score buckets.",
  icon: "Smile", resource: "support-service.csat-response", filters: [],
  async execute({ resources }) {
    const responses = await fetchAll(resources, "support-service.csat-response");
    const by = new Map<string, { agent: string; count: number; avg: number; promoters: number; detractors: number }>();
    for (const c of responses) {
      const a = str(c.agent, "unassigned");
      const score = num(c.score);
      const r = by.get(a) ?? { agent: a, count: 0, avg: 0, promoters: 0, detractors: 0 };
      r.count++;
      r.avg += score;
      if (score >= 4) r.promoters++;
      else if (score <= 2) r.detractors++;
      by.set(a, r);
    }
    const rows = [...by.values()].map((r) => ({
      ...r,
      avg: r.count > 0 ? Math.round((r.avg / r.count) * 10) / 10 : 0,
    })).sort((a, b) => b.avg - a.avg);
    return {
      columns: [
        { field: "agent", label: "Agent", fieldtype: "text" },
        { field: "count", label: "Responses", fieldtype: "number", align: "right", totaling: "sum" },
        { field: "avg", label: "Avg score", fieldtype: "number", align: "right" },
        { field: "promoters", label: "Promoters (4-5)", fieldtype: "number", align: "right", totaling: "sum" },
        { field: "detractors", label: "Detractors (1-2)", fieldtype: "number", align: "right", totaling: "sum" },
      ],
      rows,
    };
  },
};

const volumeTrendReport: ReportDefinition = {
  id: "volume-trend", label: "Volume Trend",
  description: "Tickets created vs resolved per month.",
  icon: "TrendingUp", resource: "support-service.ticket", filters: [],
  async execute({ resources }) {
    const tickets = await fetchAll(resources, "support-service.ticket");
    const by = new Map<string, { month: string; created: number; resolved: number }>();
    for (const t of tickets) {
      const c = t.createdAt ? new Date(str(t.createdAt)) : null;
      const r = t.resolvedAt ? new Date(str(t.resolvedAt)) : null;
      if (c && !Number.isNaN(c.getTime())) {
        const k = monthKey(c);
        const row = by.get(k) ?? { month: k, created: 0, resolved: 0 };
        row.created++;
        by.set(k, row);
      }
      if (r && !Number.isNaN(r.getTime())) {
        const k = monthKey(r);
        const row = by.get(k) ?? { month: k, created: 0, resolved: 0 };
        row.resolved++;
        by.set(k, row);
      }
    }
    const rows = [...by.values()].sort((a, b) => a.month.localeCompare(b.month));
    return {
      columns: [
        { field: "month", label: "Month", fieldtype: "text" },
        { field: "created", label: "Created", fieldtype: "number", align: "right", totaling: "sum" },
        { field: "resolved", label: "Resolved", fieldtype: "number", align: "right", totaling: "sum" },
      ],
      rows,
      chart: { kind: "line", label: "Created vs resolved",
        from: (rs) => (rs as typeof rows).map((r) => ({ label: r.month, value: r.resolved })) },
    };
  },
};

const warrantyReport: ReportDefinition = {
  id: "warranty-claims", label: "Warranty Claims",
  description: "Pending + resolved warranty claims by product.",
  icon: "ShieldAlert", resource: "support-service.warranty-claim", filters: [],
  async execute({ resources }) {
    const claims = await fetchAll(resources, "support-service.warranty-claim");
    const by = new Map<string, { product: string; pending: number; resolved: number; rejected: number; cost: number }>();
    for (const c of claims) {
      const p = str(c.product);
      const r = by.get(p) ?? { product: p, pending: 0, resolved: 0, rejected: 0, cost: 0 };
      const s = str(c.status);
      if (s === "pending" || s === "in-progress") r.pending++;
      else if (s === "resolved") r.resolved++;
      else if (s === "rejected") r.rejected++;
      r.cost += num(c.repairCost);
      by.set(p, r);
    }
    const rows = [...by.values()].sort((a, b) => b.cost - a.cost);
    return {
      columns: [
        { field: "product", label: "Product", fieldtype: "text" },
        { field: "pending", label: "Pending", fieldtype: "number", align: "right", totaling: "sum" },
        { field: "resolved", label: "Resolved", fieldtype: "number", align: "right", totaling: "sum" },
        { field: "rejected", label: "Rejected", fieldtype: "number", align: "right", totaling: "sum" },
        { field: "cost", label: "Repair cost", fieldtype: "currency", align: "right", options: "USD", totaling: "sum" },
      ],
      rows,
    };
  },
};

export const SUPPORT_REPORTS: readonly ReportDefinition[] = [
  issueAnalyticsReport,
  firstResponseReport,
  slaComplianceReport,
  resolutionTimeReport,
  agentLeaderboardReport,
  csatReport,
  volumeTrendReport,
  warrantyReport,
];

const { indexView, detailView } = buildReportLibrary({
  indexViewId: "support-service.reports.view",
  detailViewId: "support-service.reports-detail.view",
  resource: "support-service.ticket",
  title: "Support Reports",
  description: "Issue analytics, first-response, SLA compliance, resolution time, agent leaderboard, CSAT, volume trend, warranty claims.",
  basePath: "/support/reports",
  reports: SUPPORT_REPORTS,
});

export const supportReportsIndexView = indexView;
export const supportReportsDetailView = detailView;
