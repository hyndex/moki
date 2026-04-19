import { definePolicy } from "@platform/permissions";

export const dashboardPolicy = definePolicy({
  id: "dashboard-core.default",
  rules: [
    {
      permission: "dashboard.views.read",
      allowIf: ["role:admin", "role:operator"]
    },
    {
      permission: "dashboard.views.publish",
      allowIf: ["role:admin"],
      requireReason: true,
      audit: true
    }
  ]
});