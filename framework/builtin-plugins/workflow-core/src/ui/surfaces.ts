import { defineUiSurface } from "@platform/ui-shell";
import { WorkflowCoreAdminPage } from "./admin/main.page";

export const uiSurface = defineUiSurface({
  embeddedPages: [
    {
      shell: "admin",
      route: "/admin/workflow-core",
      component: WorkflowCoreAdminPage,
      permission: "workflow.instances.read"
    }
  ],
  widgets: []
});