import { defineUiSurface } from "@platform/ui-shell";
import { DocumentCoreAdminPage } from "./admin/main.page";

export const uiSurface = defineUiSurface({
  embeddedPages: [
    {
      shell: "admin",
      route: "/admin/document-core",
      component: DocumentCoreAdminPage,
      permission: "document.records.read"
    }
  ],
  widgets: []
});