import {
  defineAdminNav,
  defineBuilder,
  defineCommand,
  definePage,
  defineWorkspace,
  defineZoneLaunch,
  type AdminContributionRegistry
} from "@platform/admin-contracts";

import { PageBuilderCoreAdminPage } from "./admin/main.page";

export const adminContributions: Pick<
  AdminContributionRegistry,
  "workspaces" | "nav" | "pages" | "builders" | "zoneLaunchers" | "commands"
> = {
  workspaces: [
    defineWorkspace({
      id: "tools",
      label: "Tools",
      icon: "wrench",
      description: "Studios, builders, and operator tooling surfaces.",
      permission: "page-builder.use",
      homePath: "/admin/workspace/tools",
      quickActions: ["page-builder.open"]
    })
  ],
  nav: [
    defineAdminNav({
      workspace: "tools",
      group: "builders",
      items: [
        {
          id: "tools.page-builder",
          label: "Page Builder",
          icon: "layout-template",
          to: "/admin/tools/page-builder",
          permission: "page-builder.use"
        }
      ]
    })
  ],
  pages: [
    definePage({
      id: "page-builder.overview",
      kind: "builder",
      route: "/admin/tools/page-builder",
      label: "Page Builder",
      workspace: "tools",
      group: "builders",
      permission: "page-builder.use",
      component: PageBuilderCoreAdminPage,
      builderId: "page-builder"
    })
  ],
  builders: [
    defineBuilder({
      id: "page-builder",
      label: "Page Builder",
      host: "admin",
      route: "/admin/tools/page-builder",
      permission: "page-builder.use",
      mode: "embedded-or-zone",
      zoneId: "page-builder-zone"
    })
  ],
  zoneLaunchers: [
    defineZoneLaunch({
      id: "page-builder.zone",
      zoneId: "page-builder-zone",
      route: "/apps/page-builder",
      label: "Page Builder Zone",
      permission: "page-builder.use",
      workspace: "tools",
      group: "builders",
      description: "Dense studio zone for layout and preview workflows."
    })
  ],
  commands: [
    defineCommand({
      id: "page-builder.open",
      label: "Open Page Builder",
      permission: "page-builder.use",
      href: "/admin/tools/page-builder",
      keywords: ["builder", "layout", "page"]
    })
  ]
};
