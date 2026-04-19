import { definePolicy } from "@platform/permissions";

export const documentPolicy = definePolicy({
  id: "document-core.default",
  rules: [
    {
      permission: "document.records.read",
      allowIf: ["role:admin", "role:operator"]
    },
    {
      permission: "document.records.finalize",
      allowIf: ["role:admin"],
      requireReason: true,
      audit: true
    }
  ]
});