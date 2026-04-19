import { definePolicy } from "@platform/permissions";

export const searchPolicy = definePolicy({
  id: "search-core.default",
  rules: [
    {
      permission: "search.documents.read",
      allowIf: ["role:admin", "role:operator"]
    },
    {
      permission: "search.documents.index",
      allowIf: ["role:admin"],
      requireReason: true,
      audit: true
    }
  ]
});