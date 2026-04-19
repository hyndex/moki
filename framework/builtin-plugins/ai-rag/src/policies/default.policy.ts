import { definePolicy } from "@platform/permissions";

export const aiPolicy = definePolicy({
  id: "ai-rag.default",
  rules: [
    {
      permission: "ai.memory.read",
      allowIf: ["role:admin", "role:operator", "role:support"]
    },
    {
      permission: "ai.memory.ingest",
      allowIf: ["role:admin"],
      requireReason: true,
      audit: true
    },
    {
      permission: "ai.memory.reindex",
      allowIf: ["role:admin"],
      requireReason: true,
      audit: true
    },
    {
      permission: "ai.reports.read",
      allowIf: ["role:admin", "role:operator", "role:support"]
    }
  ]
});
