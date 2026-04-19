import { definePolicy } from "@platform/permissions";

export const auditPolicy = definePolicy({
  id: "audit-core.default",
  rules: [
    {
      permission: "audit.events.read",
      allowIf: ["role:admin", "role:operator"]
    },
    {
      permission: "audit.events.record",
      allowIf: ["role:admin"],
      requireReason: true,
      audit: true
    }
  ]
});