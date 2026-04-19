import { defineAction } from "@platform/schema";
import { z } from "zod";
import { publishContentEntry } from "../services/main.service";

export const publishContentEntryAction = defineAction({
  id: "content.entries.publish",
  input: z.object({
    id: z.string().uuid(),
    tenantId: z.string().uuid(),
    reason: z.string().min(3).optional()
  }),
  output: z.object({
    ok: z.literal(true),
    nextStatus: z.enum(["active", "inactive"])
  }),
  permission: "content.entries.publish",
  idempotent: true,
  audit: true,
  handler: ({ input }) => publishContentEntry(input)
});