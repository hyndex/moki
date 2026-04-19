import { defineUiSurface } from "@platform/ui-shell";
import { SearchCoreAdminPage } from "./admin/main.page";

export const uiSurface = defineUiSurface({
  embeddedPages: [
    {
      shell: "admin",
      route: "/admin/search-core",
      component: SearchCoreAdminPage,
      permission: "search.documents.read"
    }
  ],
  widgets: []
});