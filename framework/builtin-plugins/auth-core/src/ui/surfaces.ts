import { defineUiSurface } from "@platform/ui-shell";
import { AuthCoreAdminPage } from "./admin/main.page";

export const uiSurface = defineUiSurface({
  embeddedPages: [
    {
      shell: "admin",
      route: "/admin/auth-core",
      component: AuthCoreAdminPage,
      permission: "auth.identities.read"
    }
  ],
  widgets: []
});