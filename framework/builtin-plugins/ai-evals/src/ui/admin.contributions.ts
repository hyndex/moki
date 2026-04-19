import {
  defineAdminNav,
  defineCommand,
  definePage,
  defineReport,
  defineSearchProvider,
  defineWidget,
  type AdminContributionRegistry
} from "@platform/admin-contracts";

import { AiEvalsAdminPage } from "./admin/main.page";
import { EvalRegressionWidget } from "./admin/regression.widget";

export const adminContributions: Pick<
  AdminContributionRegistry,
  "workspaces" | "nav" | "pages" | "widgets" | "reports" | "commands" | "searchProviders"
> = {
  workspaces: [],
  nav: [
    defineAdminNav({
      workspace: "ai",
      group: "quality",
      items: [
        {
          id: "ai.evals",
          label: "Eval Runs",
          icon: "beaker",
          to: "/admin/ai/evals",
          permission: "ai.evals.read"
        }
      ]
    })
  ],
  pages: [
    definePage({
      id: "ai.evals.page",
      kind: "report",
      route: "/admin/ai/evals",
      label: "Eval Runs",
      workspace: "ai",
      group: "quality",
      permission: "ai.evals.read",
      component: AiEvalsAdminPage
    })
  ],
  widgets: [
    defineWidget({
      id: "ai.eval-regressions",
      kind: "status",
      shell: "admin",
      slot: "dashboard.ai",
      permission: "ai.evals.read",
      title: "Eval Gate",
      component: EvalRegressionWidget,
      drillTo: "/admin/ai/evals"
    })
  ],
  reports: [
    defineReport({
      id: "ai.eval-regressions.report",
      kind: "audit",
      route: "/admin/reports/ai-regressions",
      label: "AI Eval Regressions",
      permission: "ai.reports.read",
      query: "ai.evals.regressions",
      filters: [
        { key: "datasetId", type: "text" },
        { key: "completedAt", type: "date-range" }
      ],
      export: ["csv", "json", "pdf"]
    })
  ],
  commands: [
    defineCommand({
      id: "ai.open.evals",
      label: "Open AI Eval Runs",
      permission: "ai.evals.read",
      href: "/admin/ai/evals",
      keywords: ["evals", "judge", "regression"]
    })
  ],
  searchProviders: [
    defineSearchProvider({
      id: "ai-evals.search",
      scopes: ["evals"],
      permission: "ai.evals.read",
      search(query, ctx) {
        const items = [
          {
            id: "ai-evals-search:runs",
            label: "Eval Runs",
            href: "/admin/ai/evals",
            kind: "page" as const,
            description: "Golden datasets, judges, baselines, and regression gates.",
            permission: "ai.evals.read"
          },
          {
            id: "ai-evals-search:report",
            label: "AI Eval Regressions",
            href: "/admin/reports/ai-regressions",
            kind: "report" as const,
            description: "Regression deltas and release-gate decisions.",
            permission: "ai.reports.read"
          }
        ];

        return items.filter(
          (item) =>
            (!item.permission || ctx.permissions.has(item.permission)) &&
            `${item.label} ${item.description}`.toLowerCase().includes(query.toLowerCase())
        );
      }
    })
  ]
};
