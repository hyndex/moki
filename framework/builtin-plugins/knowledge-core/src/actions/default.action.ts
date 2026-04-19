import { defineAction } from "@platform/schema";
import { z } from "zod";
import { publishKnowledgeArticle } from "../services/main.service";

export const publishKnowledgeArticleAction = defineAction({
  id: "knowledge.articles.publish",
  input: z.object({
    id: z.string().uuid(),
    tenantId: z.string().uuid(),
    reason: z.string().min(3).optional()
  }),
  output: z.object({
    ok: z.literal(true),
    nextStatus: z.enum(["active", "inactive"])
  }),
  permission: "knowledge.articles.publish",
  idempotent: true,
  audit: true,
  handler: ({ input }) => publishKnowledgeArticle(input)
});