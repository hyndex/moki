import { defineUiSurface } from "@platform/ui-shell";
import { PortalCoreAdminPage } from "./admin/main.page";
import { PortalCoreHomePage } from "./portal/home.page";
import { PortalSummaryWidget } from "./portal/summary.widget";

export const uiSurface = defineUiSurface({
  embeddedPages: [
    {
      shell: "admin",
      route: "/admin/portal-core",
      component: PortalCoreAdminPage,
      permission: "portal.accounts.read"
    },
    {
      shell: "portal",
      route: "/portal/home",
      component: PortalCoreHomePage,
      permission: "portal.accounts.read"
    }
  ],
  widgets: [
    {
      shell: "portal",
      slot: "portal.overview.summary",
      component: PortalSummaryWidget,
      permission: "portal.accounts.read"
    }
  ]
});
