import { defineUiSurface } from "@platform/ui-shell";
import { AuditCoreAdminPage } from "./admin/main.page";

export const uiSurface = defineUiSurface({
  embeddedPages: [
    {
      shell: "admin",
      route: "/admin/audit-core",
      component: AuditCoreAdminPage,
      permission: "audit.events.read"
    }
  ],
  widgets: []
});