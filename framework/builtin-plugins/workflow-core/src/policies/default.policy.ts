import { definePolicy } from "@platform/permissions";

export const workflowPolicy = definePolicy({
  id: "workflow-core.default",
  rules: [
    {
      permission: "workflow.instances.read",
      allowIf: ["role:admin", "role:operator", "role:approver"]
    },
    {
      permission: "workflow.instances.transition",
      allowIf: ["role:admin", "role:approver"],
      requireReason: true,
      audit: true
    }
  ]
});
