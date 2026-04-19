import { defineUiSurface } from "@platform/ui-shell";
import { DashboardCoreAdminPage } from "./admin/main.page";

export const uiSurface = defineUiSurface({
  embeddedPages: [
    {
      shell: "admin",
      route: "/admin/dashboard-core",
      component: DashboardCoreAdminPage,
      permission: "dashboard.views.read"
    }
  ],
  widgets: []
});