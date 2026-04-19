import { defineUiSurface } from "@platform/ui-shell";
import { AiRagAdminPage } from "./admin/main.page";

export const uiSurface = defineUiSurface({
  embeddedPages: [
    {
      shell: "admin",
      route: "/admin/ai-rag",
      component: AiRagAdminPage,
      permission: "ai.memory.read"
    }
  ],
  widgets: []
});
