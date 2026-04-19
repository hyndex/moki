import { defineAction } from "@platform/schema";
import { z } from "zod";
import { composeLayout } from "../services/main.service";

export const composeLayoutAction = defineAction({
  id: "page-builder.layouts.compose",
  input: z.object({
    id: z.string().uuid(),
    tenantId: z.string().uuid(),
    reason: z.string().min(3).optional()
  }),
  output: z.object({
    ok: z.literal(true),
    nextStatus: z.enum(["active", "inactive"])
  }),
  permission: "page-builder.layouts.compose",
  idempotent: true,
  audit: true,
  handler: ({ input }) => composeLayout(input)
});