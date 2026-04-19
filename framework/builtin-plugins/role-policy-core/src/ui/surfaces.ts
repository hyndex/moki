import { defineUiSurface } from "@platform/ui-shell";
import { RolePolicyCoreAdminPage } from "./admin/main.page";

export const uiSurface = defineUiSurface({
  embeddedPages: [
    {
      shell: "admin",
      route: "/admin/role-policy-core",
      component: RolePolicyCoreAdminPage,
      permission: "roles.grants.read"
    }
  ],
  widgets: []
});