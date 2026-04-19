import { defineAction } from "@platform/schema";
import { z } from "zod";
import { indexSearchDocument } from "../services/main.service";

export const indexSearchDocumentAction = defineAction({
  id: "search.documents.index",
  input: z.object({
    id: z.string().uuid(),
    tenantId: z.string().uuid(),
    reason: z.string().min(3).optional()
  }),
  output: z.object({
    ok: z.literal(true),
    nextStatus: z.enum(["active", "inactive"])
  }),
  permission: "search.documents.index",
  idempotent: true,
  audit: true,
  handler: ({ input }) => indexSearchDocument(input)
});