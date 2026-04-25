import { buildDomainPlugin } from "./_factory/buildDomainPlugin";
import { SECTIONS } from "./_factory/sections";
import { daysAgo, pick } from "./_factory/seeds";
import { analyticsDashboardView } from "./analytics-bi-pages";
import { analyticsBiProductViews } from "./analytics-bi/workbench";
import { buildCompactControlRoom } from "./_factory/compactDashboard";
import { buildReportLibrary } from "./_factory/reportLibraryHelper";
import type { ReportDefinition, ReportResult } from "@/contracts/widgets";

const controlRoomView = buildCompactControlRoom({
  viewId: "analytics-bi.control-room.view",
  resource: "analytics-bi.report",
  title: "Analytics & BI Control Room",
  description: "Reports, dashboards, datasets, usage.",
  kpis: [
    { label: "Saved charts", resource: "analytics-bi.chart" },
    { label: "Dashboards", resource: "analytics-bi.dashboard-content" },
    { label: "Explores", resource: "analytics-bi.explore" },
    { label: "Schedules", resource: "analytics-bi.schedule" },
  ],
  charts: [
    { label: "Charts by space", resource: "analytics-bi.chart", chart: "bar", groupBy: "spaceId" },
    { label: "Dashboards by space", resource: "analytics-bi.dashboard-content", chart: "donut", groupBy: "spaceId" },
  ],
  shortcuts: [
    { label: "Explore", icon: "Search", href: "/analytics/explore" },
    { label: "Charts", icon: "BarChart3", href: "/analytics/charts" },
    { label: "Dashboards", icon: "PieChart", href: "/analytics/dashboards" },
    { label: "Executive", icon: "LineChart", href: "/analytics/executive" },
  ],
});

async function fetchAll(r: import("@/runtime/resourceClient").ResourceClient, resource: string) {
  return (await r.list(resource, { page: 1, pageSize: 10_000 })).rows as Record<string, unknown>[];
}
const num = (v: unknown) => (typeof v === "number" ? v : 0);
const str = (v: unknown, d = "") => (typeof v === "string" ? v : d);

const topReportsReport: ReportDefinition = {
  id: "top-reports", label: "Top Reports by Views",
  description: "Most-viewed reports in the last 30 days.",
  icon: "Eye", resource: "analytics-bi.report", filters: [],
  async execute({ resources }): Promise<ReportResult> {
    const reports = await fetchAll(resources, "analytics-bi.report");
    const rows = reports.map((r) => ({
      name: str(r.name),
      dataset: str(r.dataset),
      owner: str(r.owner),
      views: num(r.views),
      lastViewedAt: str(r.lastViewedAt),
    })).sort((a, b) => b.views - a.views);
    return {
      columns: [
        { field: "name", label: "Report", fieldtype: "text" },
        { field: "dataset", label: "Dataset", fieldtype: "text" },
        { field: "owner", label: "Owner", fieldtype: "text" },
        { field: "views", label: "Views", fieldtype: "number", align: "right", totaling: "sum" },
        { field: "lastViewedAt", label: "Last viewed", fieldtype: "datetime" },
      ],
      rows,
    };
  },
};

const { indexView: reportsIndex, detailView: reportsDetail } = buildReportLibrary({
  indexViewId: "analytics-bi.reports-library.view",
  detailViewId: "analytics-bi.reports-library-detail.view",
  resource: "analytics-bi.report",
  title: "Analytics Reports",
  description: "Top reports by views.",
  basePath: "/analytics/reports-library",
  reports: [topReportsReport],
});

export const analyticsBiPlugin = buildDomainPlugin({
  id: "analytics-bi",
  label: "Analytics & BI",
  icon: "BarChart3",
  section: SECTIONS.analytics,
  order: 1,
  resources: [
    {
      id: "report",
      singular: "Report",
      plural: "Reports",
      icon: "BarChart3",
      path: "/analytics/reports",
      fields: [
        { name: "name", kind: "text", required: true, sortable: true },
        { name: "description", kind: "text" },
        { name: "dataset", kind: "text", sortable: true },
        { name: "owner", kind: "text", sortable: true },
        { name: "kind", label: "Type", kind: "enum", options: [
          { value: "table", label: "Table" }, { value: "chart", label: "Chart" },
          { value: "pivot", label: "Pivot" }, { value: "sql", label: "SQL" },
        ] },
        { name: "views", kind: "number", align: "right", sortable: true },
        { name: "scheduled", kind: "boolean" },
        { name: "lastViewedAt", kind: "datetime" },
        { name: "updatedAt", kind: "datetime", sortable: true },
      ],
      seedCount: 20,
      seed: (i) => ({
        name: pick(["Weekly MRR", "Pipeline snapshot", "Ticket aging", "Inventory turns", "NPS by segment", "Cohort retention", "Churn analysis", "Revenue by region"], i),
        description: "",
        dataset: pick(["subscriptions", "sales", "support", "inventory", "community"], i),
        owner: pick(["sam@gutu.dev", "alex@gutu.dev", "taylor@gutu.dev"], i),
        kind: pick(["table", "chart", "pivot", "sql"], i),
        views: 50 + (i * 137) % 2000,
        scheduled: i % 3 === 0,
        lastViewedAt: daysAgo(i),
        updatedAt: daysAgo(i),
      }),
    },
    {
      id: "dashboard",
      singular: "BI Dashboard",
      plural: "BI Dashboard Records",
      icon: "PieChart",
      path: "/analytics/dashboard-records",
      fields: [
        { name: "name", kind: "text", required: true, sortable: true },
        { name: "owner", kind: "text", sortable: true },
        { name: "widgets", kind: "number", align: "right" },
        { name: "views", kind: "number", align: "right" },
        { name: "shared", kind: "boolean" },
        { name: "updatedAt", kind: "datetime", sortable: true },
      ],
      seedCount: 12,
      seed: (i) => ({
        name: pick(["Exec overview", "Finance", "Ops", "Product", "Customer", "Sales", "Engineering", "Marketing"], i),
        owner: pick(["sam@gutu.dev", "alex@gutu.dev", "taylor@gutu.dev"], i),
        widgets: 6 + (i % 8),
        views: 100 + (i * 73) % 500,
        shared: i % 2 === 0,
        updatedAt: daysAgo(i),
      }),
    },
    {
      id: "dataset",
      singular: "Dataset",
      plural: "Datasets",
      icon: "Database",
      path: "/analytics/datasets",
      fields: [
        { name: "name", kind: "text", required: true, sortable: true },
        { name: "source", kind: "enum", options: [
          { value: "postgres", label: "Postgres" }, { value: "bigquery", label: "BigQuery" },
          { value: "snowflake", label: "Snowflake" }, { value: "csv", label: "CSV" },
        ] },
        { name: "rowCount", kind: "number", align: "right", sortable: true },
        { name: "lastRefreshedAt", kind: "datetime" },
        { name: "refreshSchedule", kind: "text" },
      ],
      seedCount: 8,
      seed: (i) => ({
        name: pick(["subscriptions", "sales", "support", "inventory", "community", "users", "orders", "events"], i),
        source: pick(["postgres", "bigquery", "snowflake", "csv"], i),
        rowCount: 10_000 + (i * 77_337) % 5_000_000,
        lastRefreshedAt: daysAgo(i * 0.2),
        refreshSchedule: pick(["hourly", "daily", "weekly"], i),
      }),
    },
    {
      id: "query",
      singular: "Saved Query",
      plural: "Saved Queries",
      icon: "FileCode",
      path: "/analytics/queries",
      fields: [
        { name: "name", kind: "text", required: true, sortable: true },
        { name: "language", kind: "enum", options: [
          { value: "sql", label: "SQL" }, { value: "kql", label: "KQL" },
        ] },
        { name: "owner", kind: "text" },
        { name: "dataset", kind: "text" },
        { name: "runCount", kind: "number", align: "right" },
        { name: "lastRunAt", kind: "datetime" },
      ],
      seedCount: 14,
      seed: (i) => ({
        name: pick(["MRR per plan", "Top customers", "Agent response avg", "Slow reports", "Active users 7d"], i),
        language: pick(["sql", "kql"], i),
        owner: pick(["sam@gutu.dev", "alex@gutu.dev"], i),
        dataset: pick(["subscriptions", "sales", "support"], i),
        runCount: (i * 17) % 500,
        lastRunAt: daysAgo(i),
      }),
    },
  ],
  extraNav: [
    { id: "analytics-bi.control-room.nav", label: "Control Room", icon: "LayoutDashboard", path: "/analytics/control-room", view: "analytics-bi.control-room.view", order: 0 },
    { id: "analytics-bi.explore.nav", label: "Explore", icon: "Search", path: "/analytics/explore", view: "analytics-bi.explore.view", order: 1 },
    { id: "analytics-bi.charts.nav", label: "Charts", icon: "BarChart3", path: "/analytics/charts", view: "analytics-bi.charts.view", order: 2 },
    { id: "analytics-bi.dashboards.nav", label: "Dashboards", icon: "PieChart", path: "/analytics/dashboards", view: "analytics-bi.dashboards.view", order: 3 },
    { id: "analytics-bi.spaces.nav", label: "Spaces", icon: "FolderTree", path: "/analytics/spaces", view: "analytics-bi.spaces.view", order: 4 },
    { id: "analytics-bi.metrics.nav", label: "Metrics", icon: "Library", path: "/analytics/metrics", view: "analytics-bi.metrics.view", order: 5 },
    { id: "analytics-bi.sql.nav", label: "SQL Runner", icon: "Database", path: "/analytics/sql-runner", view: "analytics-bi.sql-runner.view", order: 6 },
    { id: "analytics-bi.schedules.nav", label: "Schedules", icon: "Clock", path: "/analytics/schedules", view: "analytics-bi.schedules.view", order: 7 },
    { id: "analytics-bi.validation.nav", label: "Validation", icon: "ShieldCheck", path: "/analytics/validation", view: "analytics-bi.validation.view", order: 8 },
    { id: "analytics-bi.share.nav", label: "Shared links", icon: "Share2", path: "/analytics/share", view: "analytics-bi.share.view", order: 9 },
    { id: "analytics-bi.reports-library.nav", label: "Prebuilt reports", icon: "BarChart3", path: "/analytics/reports-library", view: "analytics-bi.reports-library.view", order: 20 },
    { id: "analytics.executive.nav", label: "Executive", icon: "LineChart", path: "/analytics/executive", view: "analytics-bi.dashboard.view", order: 21 },
  ],
  extraViews: [controlRoomView, ...analyticsBiProductViews, reportsIndex, reportsDetail, analyticsDashboardView],
  commands: [
    { id: "analytics.go.control-room", label: "Analytics: Control Room", icon: "LayoutDashboard", run: () => { window.location.hash = "/analytics/control-room"; } },
    { id: "analytics.go.explore", label: "Analytics: Explore", icon: "Search", run: () => { window.location.hash = "/analytics/explore"; } },
    { id: "analytics.go.charts", label: "Analytics: Charts", icon: "BarChart3", run: () => { window.location.hash = "/analytics/charts"; } },
    { id: "analytics.go.dashboards", label: "Analytics: Dashboards", icon: "PieChart", run: () => { window.location.hash = "/analytics/dashboards"; } },
  ],
});
