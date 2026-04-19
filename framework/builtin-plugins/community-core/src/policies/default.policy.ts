import { definePolicy } from "@platform/permissions";

export const communityPolicy = definePolicy({
  id: "community-core.default",
  rules: [
    {
      permission: "community.memberships.read",
      allowIf: ["role:admin", "role:operator"]
    },
    {
      permission: "community.memberships.enroll",
      allowIf: ["role:admin"],
      requireReason: true,
      audit: true
    }
  ]
});