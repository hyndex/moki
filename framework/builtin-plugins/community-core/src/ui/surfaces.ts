import { defineUiSurface } from "@platform/ui-shell";
import { CommunityCoreAdminPage } from "./admin/main.page";

export const uiSurface = defineUiSurface({
  embeddedPages: [
    {
      shell: "admin",
      route: "/admin/community-core",
      component: CommunityCoreAdminPage,
      permission: "community.memberships.read"
    }
  ],
  widgets: []
});