import { defineUiSurface } from "@platform/ui-shell";
import { JobsCoreAdminPage } from "./admin/main.page";

export const uiSurface = defineUiSurface({
  embeddedPages: [
    {
      shell: "admin",
      route: "/admin/jobs-core",
      component: JobsCoreAdminPage,
      permission: "jobs.executions.read"
    }
  ],
  widgets: []
});