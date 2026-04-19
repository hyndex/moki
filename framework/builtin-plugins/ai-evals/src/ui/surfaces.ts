import { defineUiSurface } from "@platform/ui-shell";
import { AiEvalsAdminPage } from "./admin/main.page";

export const uiSurface = defineUiSurface({
  embeddedPages: [
    {
      shell: "admin",
      route: "/admin/ai-evals",
      component: AiEvalsAdminPage,
      permission: "ai.evals.read"
    }
  ],
  widgets: []
});
