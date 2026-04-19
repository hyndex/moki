import { definePolicy } from "@platform/permissions";

export const filesPolicy = definePolicy({
  id: "files-core.default",
  rules: [
    {
      permission: "files.assets.read",
      allowIf: ["role:admin", "role:operator"]
    },
    {
      permission: "files.assets.register",
      allowIf: ["role:admin"],
      requireReason: true,
      audit: true
    }
  ]
});