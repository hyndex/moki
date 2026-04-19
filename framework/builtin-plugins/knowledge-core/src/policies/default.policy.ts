import { definePolicy } from "@platform/permissions";

export const knowledgePolicy = definePolicy({
  id: "knowledge-core.default",
  rules: [
    {
      permission: "knowledge.articles.read",
      allowIf: ["role:admin", "role:operator"]
    },
    {
      permission: "knowledge.articles.publish",
      allowIf: ["role:admin"],
      requireReason: true,
      audit: true
    }
  ]
});