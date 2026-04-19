import { definePolicy } from "@platform/permissions";

export const jobsPolicy = definePolicy({
  id: "jobs-core.default",
  rules: [
    {
      permission: "jobs.executions.read",
      allowIf: ["role:admin", "role:operator"]
    },
    {
      permission: "jobs.executions.schedule",
      allowIf: ["role:admin"],
      requireReason: true,
      audit: true
    }
  ]
});