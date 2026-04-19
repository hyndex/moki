import {
  defineAdminNav,
  defineBuilder,
  defineCommand,
  definePage,
  defineReport,
  defineSearchProvider,
  defineWidget,
  defineWorkspace,
  type AdminContributionRegistry
} from "@platform/admin-contracts";

import { ChartStudioPage } from "./admin/chart-studio.page";
import { DashboardCoreAdminPage } from "./admin/main.page";
import { ExportCenterReportPage } from "./admin/export-center.report";
import { InboxSummaryWidget } from "./admin/inbox-summary.widget";
import { JobMonitorPage } from "./admin/job-monitor.page";
import { OperationsInboxPage } from "./admin/operations-inbox.page";
import { PluginHealthPage } from "./admin/plugin-health.page";
import { PluginHealthWidget } from "./admin/plugin-health.widget";
import { ReportBuilderPage } from "./admin/report-builder.page";

export const adminContributions: Pick<
  AdminContributionRegistry,
  "workspaces" | "nav" | "pages" | "widgets" | "reports" | "commands" | "builders" | "searchProviders"
> = {
  workspaces: [
    defineWorkspace({
      id: "overview",
      label: "Overview",
      icon: "layout-grid",
      description: "Universal desk landing space for cross-domain operations.",
      permission: "dashboard.views.read",
      homePath: "/admin/workspace/overview",
      cards: [
        "dashboard.active-views",
        "dashboard.export-health",
        "dashboard.workflow-inbox",
        "dashboard.plugin-health"
      ],
      reports: ["dashboard.activity", "dashboard.export-center"],
      quickActions: ["dashboard.open.home", "dashboard.open.inbox", "dashboard.open.export-center"]
    }),
    defineWorkspace({
      id: "reports",
      label: "Reports",
      icon: "bar-chart-3",
      description: "Saved analytics, exports, and semantic reporting surfaces.",
      permission: "dashboard.views.read",
      homePath: "/admin/workspace/reports",
      cards: ["dashboard.export-health"],
      reports: ["dashboard.activity", "dashboard.export-center"],
      quickActions: ["dashboard.open.export-center", "dashboard.open.report-builder"]
    })
  ],
  nav: [
    defineAdminNav({
      workspace: "overview",
      group: "operations",
      items: [
        {
          id: "overview.inbox",
          label: "Operations Inbox",
          icon: "inbox",
          to: "/admin/overview/inbox",
          permission: "dashboard.inbox.read"
        }
      ]
    }),
    defineAdminNav({
      workspace: "reports",
      group: "analytics",
      items: [
        {
          id: "reports.activity",
          label: "Dashboard Activity",
          icon: "activity",
          to: "/admin/reports/dashboard-activity",
          permission: "dashboard.views.read"
        },
        {
          id: "reports.export-center",
          label: "Export Center",
          icon: "file-output",
          to: "/admin/reports/export-center",
          permission: "dashboard.exports.read"
        }
      ]
    }),
    defineAdminNav({
      workspace: "tools",
      group: "builders",
      items: [
        {
          id: "tools.report-builder",
          label: "Report Builder",
          icon: "layout-panel-top",
          to: "/admin/tools/report-builder",
          permission: "dashboard.builders.use"
        },
        {
          id: "tools.chart-studio",
          label: "Chart Studio",
          icon: "chart-line",
          to: "/admin/tools/chart-studio",
          permission: "dashboard.builders.use"
        }
      ]
    }),
    defineAdminNav({
      workspace: "tools",
      group: "operations",
      items: [
        {
          id: "tools.job-monitor",
          label: "Job Monitor",
          icon: "cpu",
          to: "/admin/tools/job-monitor",
          permission: "jobs.monitor.read"
        },
        {
          id: "tools.plugin-health",
          label: "Plugin Health",
          icon: "shield-check",
          to: "/admin/tools/plugin-health",
          permission: "plugins.health.read"
        }
      ]
    })
  ],
  pages: [
    definePage({
      id: "dashboard.home",
      kind: "dashboard",
      route: "/admin",
      label: "Operations Overview",
      workspace: "overview",
      permission: "dashboard.views.read",
      component: DashboardCoreAdminPage
    }),
    definePage({
      id: "dashboard.inbox",
      kind: "queue",
      route: "/admin/overview/inbox",
      label: "Operations Inbox",
      workspace: "overview",
      group: "operations",
      permission: "dashboard.inbox.read",
      component: OperationsInboxPage
    }),
    definePage({
      id: "dashboard.report-builder.page",
      kind: "builder",
      route: "/admin/tools/report-builder",
      label: "Report Builder",
      workspace: "tools",
      group: "builders",
      permission: "dashboard.builders.use",
      component: ReportBuilderPage,
      builderId: "report-builder"
    }),
    definePage({
      id: "dashboard.chart-studio.page",
      kind: "builder",
      route: "/admin/tools/chart-studio",
      label: "Chart Studio",
      workspace: "tools",
      group: "builders",
      permission: "dashboard.builders.use",
      component: ChartStudioPage,
      builderId: "chart-studio"
    }),
    definePage({
      id: "dashboard.job-monitor",
      kind: "console",
      route: "/admin/tools/job-monitor",
      label: "Job Monitor",
      workspace: "tools",
      group: "operations",
      permission: "jobs.monitor.read",
      component: JobMonitorPage
    }),
    definePage({
      id: "dashboard.plugin-health",
      kind: "console",
      route: "/admin/tools/plugin-health",
      label: "Plugin Health",
      workspace: "tools",
      group: "operations",
      permission: "plugins.health.read",
      component: PluginHealthPage
    })
  ],
  widgets: [
    defineWidget({
      id: "dashboard.active-views",
      kind: "kpi",
      shell: "admin",
      slot: "dashboard.overview",
      permission: "dashboard.views.read",
      title: "Active Dashboards",
      query: "dashboard.activeViews"
    }),
    defineWidget({
      id: "dashboard.export-health",
      kind: "status",
      shell: "admin",
      slot: "dashboard.home",
      permission: "dashboard.exports.read",
      title: "Export Center"
    }),
    defineWidget({
      id: "dashboard.workflow-inbox",
      kind: "inbox",
      shell: "admin",
      slot: "dashboard.overview",
      permission: "dashboard.inbox.read",
      title: "Operations Inbox",
      component: InboxSummaryWidget,
      drillTo: "/admin/overview/inbox"
    }),
    defineWidget({
      id: "dashboard.plugin-health",
      kind: "status",
      shell: "admin",
      slot: "dashboard.overview",
      permission: "plugins.health.read",
      title: "Plugin Health",
      component: PluginHealthWidget,
      drillTo: "/admin/tools/plugin-health"
    })
  ],
  reports: [
    defineReport({
      id: "dashboard.activity",
      kind: "metric",
      route: "/admin/reports/dashboard-activity",
      label: "Dashboard Activity",
      permission: "dashboard.views.read",
      query: "dashboard.activity.summary",
      filters: [{ key: "range", type: "date-range" }],
      export: ["csv", "pdf"]
    }),
    defineReport({
      id: "dashboard.export-center",
      kind: "audit",
      route: "/admin/reports/export-center",
      label: "Export Center",
      permission: "dashboard.exports.read",
      query: "dashboard.exports.audit",
      filters: [
        { key: "status", type: "select" },
        { key: "requestedAt", type: "date-range" }
      ],
      export: ["csv", "json", "pdf"],
      component: ExportCenterReportPage
    })
  ],
  commands: [
    defineCommand({
      id: "dashboard.open.home",
      label: "Open Operations Overview",
      permission: "dashboard.views.read",
      href: "/admin",
      keywords: ["dashboard", "overview", "home"]
    }),
    defineCommand({
      id: "dashboard.open.inbox",
      label: "Open Operations Inbox",
      permission: "dashboard.inbox.read",
      href: "/admin/overview/inbox",
      keywords: ["approvals", "inbox", "queue", "workflow"]
    }),
    defineCommand({
      id: "dashboard.open.export-center",
      label: "Open Export Center",
      permission: "dashboard.exports.read",
      href: "/admin/reports/export-center",
      keywords: ["exports", "downloads", "audit"]
    }),
    defineCommand({
      id: "dashboard.open.report-builder",
      label: "Open Report Builder",
      permission: "dashboard.builders.use",
      href: "/admin/tools/report-builder",
      keywords: ["report", "builder", "semantic"]
    }),
    defineCommand({
      id: "dashboard.open.chart-studio",
      label: "Open Chart Studio",
      permission: "dashboard.builders.use",
      href: "/admin/tools/chart-studio",
      keywords: ["chart", "dashboard", "builder"]
    }),
    defineCommand({
      id: "dashboard.open.job-monitor",
      label: "Open Job Monitor",
      permission: "jobs.monitor.read",
      href: "/admin/tools/job-monitor",
      keywords: ["jobs", "queues", "workers"]
    }),
    defineCommand({
      id: "dashboard.open.plugin-health",
      label: "Open Plugin Health",
      permission: "plugins.health.read",
      href: "/admin/tools/plugin-health",
      keywords: ["plugins", "health", "trust"]
    })
  ],
  builders: [
    defineBuilder({
      id: "report-builder",
      label: "Report Builder",
      host: "admin",
      route: "/admin/tools/report-builder",
      permission: "dashboard.builders.use",
      mode: "embedded",
      component: ReportBuilderPage
    }),
    defineBuilder({
      id: "chart-studio",
      label: "Chart Studio",
      host: "admin",
      route: "/admin/tools/chart-studio",
      permission: "dashboard.builders.use",
      mode: "embedded",
      component: ChartStudioPage
    })
  ],
  searchProviders: [
    defineSearchProvider({
      id: "dashboard-operations-search",
      scopes: ["reports", "tools", "inbox"],
      permission: "dashboard.views.read",
      search(query) {
        const normalized = query.trim().toLowerCase();
        const results = [
          {
            id: "dashboard-search:inbox",
            label: "Operations Inbox",
            href: "/admin/overview/inbox",
            kind: "page" as const,
            description: "Queue of approvals, retries, and follow-ups",
            permission: "dashboard.inbox.read"
          },
          {
            id: "dashboard-search:exports",
            label: "Export Center",
            href: "/admin/reports/export-center",
            kind: "report" as const,
            description: "Audit-backed export jobs and delivery history",
            permission: "dashboard.exports.read"
          },
          {
            id: "dashboard-search:report-builder",
            label: "Report Builder",
            href: "/admin/tools/report-builder",
            kind: "command" as const,
            description: "Compose approved semantic reports",
            permission: "dashboard.builders.use"
          },
          {
            id: "dashboard-search:job-monitor",
            label: "Job Monitor",
            href: "/admin/tools/job-monitor",
            kind: "page" as const,
            description: "Inspect queues, retries, and worker health",
            permission: "jobs.monitor.read"
          }
        ];

        if (!normalized) {
          return results;
        }

        return results.filter((result) =>
          `${result.label} ${result.description ?? ""}`.toLowerCase().includes(normalized)
        );
      }
    })
  ]
};
