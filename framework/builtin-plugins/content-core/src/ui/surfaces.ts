import { defineUiSurface } from "@platform/ui-shell";
import { ContentCoreAdminPage } from "./admin/main.page";

export const uiSurface = defineUiSurface({
  embeddedPages: [
    {
      shell: "admin",
      route: "/admin/content-core",
      component: ContentCoreAdminPage,
      permission: "content.entries.read"
    }
  ],
  widgets: []
});