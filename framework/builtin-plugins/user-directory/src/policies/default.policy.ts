import { definePolicy } from "@platform/permissions";

export const directoryPolicy = definePolicy({
  id: "user-directory.default",
  rules: [
    {
      permission: "directory.people.read",
      allowIf: ["role:admin", "role:operator"]
    },
    {
      permission: "directory.people.register",
      allowIf: ["role:admin"],
      requireReason: true,
      audit: true
    }
  ]
});