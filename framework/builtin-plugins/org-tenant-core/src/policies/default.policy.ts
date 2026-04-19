import { definePolicy } from "@platform/permissions";

export const orgPolicy = definePolicy({
  id: "org-tenant-core.default",
  rules: [
    {
      permission: "org.tenants.read",
      allowIf: ["role:admin", "role:operator"]
    },
    {
      permission: "org.tenants.activate",
      allowIf: ["role:admin"],
      requireReason: true,
      audit: true
    }
  ]
});