import { defineAction } from "@platform/schema";
import { z } from "zod";
import { finalizeDocumentRecord } from "../services/main.service";

export const finalizeDocumentRecordAction = defineAction({
  id: "document.records.finalize",
  input: z.object({
    id: z.string().uuid(),
    tenantId: z.string().uuid(),
    reason: z.string().min(3).optional()
  }),
  output: z.object({
    ok: z.literal(true),
    nextStatus: z.enum(["active", "inactive"])
  }),
  permission: "document.records.finalize",
  idempotent: true,
  audit: true,
  handler: ({ input }) => finalizeDocumentRecord(input)
});