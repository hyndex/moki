import { definePolicy } from "@platform/permissions";

export const aiPolicy = definePolicy({
  id: "ai-evals.default",
  rules: [
    {
      permission: "ai.evals.read",
      allowIf: ["role:admin", "role:operator", "role:support"]
    },
    {
      permission: "ai.evals.run",
      allowIf: ["role:admin"],
      requireReason: true,
      audit: true
    },
    {
      permission: "ai.reports.read",
      allowIf: ["role:admin", "role:operator", "role:support"]
    }
  ]
});
