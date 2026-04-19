import { defineUiSurface } from "@platform/ui-shell";
import { AdminShellWorkbenchPluginPage } from "./admin/main.page";

export const uiSurface = defineUiSurface({
  embeddedPages: [
    {
      shell: "admin",
      route: "/admin/desk-status",
      component: AdminShellWorkbenchPluginPage,
      permission: "ui.shell.admin"
    }
  ],
  widgets: []
});
