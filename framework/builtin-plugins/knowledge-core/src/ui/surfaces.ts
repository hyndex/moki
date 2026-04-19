import { defineUiSurface } from "@platform/ui-shell";
import { KnowledgeCoreAdminPage } from "./admin/main.page";

export const uiSurface = defineUiSurface({
  embeddedPages: [
    {
      shell: "admin",
      route: "/admin/knowledge-core",
      component: KnowledgeCoreAdminPage,
      permission: "knowledge.articles.read"
    }
  ],
  widgets: []
});