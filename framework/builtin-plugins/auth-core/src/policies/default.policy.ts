import { definePolicy } from "@platform/permissions";

export const authPolicy = definePolicy({
  id: "auth-core.default",
  rules: [
    {
      permission: "auth.identities.read",
      allowIf: ["role:admin", "role:operator"]
    },
    {
      permission: "auth.identities.provision",
      allowIf: ["role:admin"],
      requireReason: true,
      audit: true
    }
  ]
});