import { defineUiSurface } from "@platform/ui-shell";
import { OrgTenantCoreAdminPage } from "./admin/main.page";

export const uiSurface = defineUiSurface({
  embeddedPages: [
    {
      shell: "admin",
      route: "/admin/org-tenant-core",
      component: OrgTenantCoreAdminPage,
      permission: "org.tenants.read"
    }
  ],
  widgets: []
});