import { definePolicy } from "@platform/permissions";

export const rolesPolicy = definePolicy({
  id: "role-policy-core.default",
  rules: [
    {
      permission: "roles.grants.read",
      allowIf: ["role:admin", "role:operator"]
    },
    {
      permission: "roles.grants.assign",
      allowIf: ["role:admin"],
      requireReason: true,
      audit: true
    }
  ]
});