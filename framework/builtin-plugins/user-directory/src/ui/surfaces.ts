import { defineUiSurface } from "@platform/ui-shell";
import { UserDirectoryAdminPage } from "./admin/main.page";

export const uiSurface = defineUiSurface({
  embeddedPages: [
    {
      shell: "admin",
      route: "/admin/user-directory",
      component: UserDirectoryAdminPage,
      permission: "directory.people.read"
    }
  ],
  widgets: []
});