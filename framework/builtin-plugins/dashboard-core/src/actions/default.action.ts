import { defineAction } from "@platform/schema";
import { z } from "zod";
import { publishDashboardView } from "../services/main.service";

export const publishDashboardViewAction = defineAction({
  id: "dashboard.views.publish",
  input: z.object({
    id: z.string().uuid(),
    tenantId: z.string().uuid(),
    reason: z.string().min(3).optional()
  }),
  output: z.object({
    ok: z.literal(true),
    nextStatus: z.enum(["active", "inactive"])
  }),
  permission: "dashboard.views.publish",
  idempotent: true,
  audit: true,
  handler: ({ input }) => publishDashboardView(input)
});