import {
  defineAdminNav,
  defineCommand,
  definePage,
  defineReport,
  defineSearchProvider,
  defineWidget,
  type AdminContributionRegistry
} from "@platform/admin-contracts";

import { AiRagAdminPage } from "./admin/main.page";
import { RetrievalDiagnosticsPage } from "./admin/retrieval.page";
import { RetrievalHealthWidget } from "./admin/retrieval-health.widget";

export const adminContributions: Pick<
  AdminContributionRegistry,
  "workspaces" | "nav" | "pages" | "widgets" | "reports" | "commands" | "searchProviders"
> = {
  workspaces: [],
  nav: [
    defineAdminNav({
      workspace: "ai",
      group: "knowledge",
      items: [
        {
          id: "ai.memory",
          label: "Memory Collections",
          icon: "database",
          to: "/admin/ai/memory",
          permission: "ai.memory.read"
        },
        {
          id: "ai.retrieval",
          label: "Retrieval Diagnostics",
          icon: "search",
          to: "/admin/ai/retrieval",
          permission: "ai.memory.read"
        }
      ]
    })
  ],
  pages: [
    definePage({
      id: "ai.memory.page",
      kind: "detail",
      route: "/admin/ai/memory",
      label: "Memory Collections",
      workspace: "ai",
      group: "knowledge",
      permission: "ai.memory.read",
      component: AiRagAdminPage
    }),
    definePage({
      id: "ai.retrieval.page",
      kind: "timeline",
      route: "/admin/ai/retrieval",
      label: "Retrieval Diagnostics",
      workspace: "ai",
      group: "knowledge",
      permission: "ai.memory.read",
      component: RetrievalDiagnosticsPage
    })
  ],
  widgets: [
    defineWidget({
      id: "ai.retrieval-health",
      kind: "status",
      shell: "admin",
      slot: "dashboard.ai",
      permission: "ai.memory.read",
      title: "Retrieval Health",
      component: RetrievalHealthWidget,
      drillTo: "/admin/ai/retrieval"
    })
  ],
  reports: [
    defineReport({
      id: "ai.retrieval-report",
      kind: "audit",
      route: "/admin/reports/ai-retrieval",
      label: "AI Retrieval Diagnostics",
      permission: "ai.reports.read",
      query: "ai.memory.retrieval",
      filters: [
        { key: "collectionId", type: "text" },
        { key: "updatedAt", type: "date-range" }
      ],
      export: ["csv", "json", "pdf"]
    })
  ],
  commands: [
    defineCommand({
      id: "ai.open.memory",
      label: "Open AI Memory Collections",
      permission: "ai.memory.read",
      href: "/admin/ai/memory",
      keywords: ["memory", "corpus", "collections"]
    }),
    defineCommand({
      id: "ai.open.retrieval",
      label: "Open Retrieval Diagnostics",
      permission: "ai.memory.read",
      href: "/admin/ai/retrieval",
      keywords: ["retrieval", "citations", "grounding"]
    })
  ],
  searchProviders: [
    defineSearchProvider({
      id: "ai-rag.search",
      scopes: ["memory", "retrieval"],
      permission: "ai.memory.read",
      search(query, ctx) {
        const items = [
          {
            id: "ai-rag-search:memory",
            label: "Memory Collections",
            href: "/admin/ai/memory",
            kind: "page" as const,
            description: "Collection health, classifications, and ingestion posture.",
            permission: "ai.memory.read"
          },
          {
            id: "ai-rag-search:retrieval",
            label: "Retrieval Diagnostics",
            href: "/admin/ai/retrieval",
            kind: "page" as const,
            description: "Citations, freshness windows, and retrieval plans.",
            permission: "ai.memory.read"
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
