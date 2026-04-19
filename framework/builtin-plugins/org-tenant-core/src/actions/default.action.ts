import { defineAction } from "@platform/schema";
import { z } from "zod";
import { activateTenant } from "../services/main.service";

export const activateTenantAction = defineAction({
  id: "org.tenants.activate",
  input: z.object({
    id: z.string().uuid(),
    tenantId: z.string().uuid(),
    slug: z.string().min(2),
    billingPlan: z.enum(["trial", "standard", "enterprise"]),
    reason: z.string().min(3).optional()
  }),
  output: z.object({
    ok: z.literal(true),
    nextStatus: z.enum(["active", "suspended"]),
    resolvedSlug: z.string()
  }),
  permission: "org.tenants.activate",
  idempotent: true,
  audit: true,
  handler: ({ input }) => activateTenant(input)
});
