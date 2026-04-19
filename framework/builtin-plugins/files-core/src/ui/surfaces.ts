import { defineUiSurface } from "@platform/ui-shell";
import { FilesCoreAdminPage } from "./admin/main.page";

export const uiSurface = defineUiSurface({
  embeddedPages: [
    {
      shell: "admin",
      route: "/admin/files-core",
      component: FilesCoreAdminPage,
      permission: "files.assets.read"
    }
  ],
  widgets: []
});