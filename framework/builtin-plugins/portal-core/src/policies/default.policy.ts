import { definePolicy } from "@platform/permissions";

export const portalPolicy = definePolicy({
  id: "portal-core.default",
  rules: [
    {
      permission: "portal.accounts.read",
      allowIf: ["role:admin", "role:operator", "role:portal-member"]
    },
    {
      permission: "portal.accounts.enable",
      allowIf: ["role:admin"],
      requireReason: true,
      audit: true
    }
  ]
});
