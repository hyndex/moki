import { definePolicy } from "@platform/permissions";

export const contentPolicy = definePolicy({
  id: "content-core.default",
  rules: [
    {
      permission: "content.entries.read",
      allowIf: ["role:admin", "role:operator"]
    },
    {
      permission: "content.entries.publish",
      allowIf: ["role:admin"],
      requireReason: true,
      audit: true
    }
  ]
});