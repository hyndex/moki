import { defineAction } from "@platform/schema";
import { z } from "zod";
import { enablePortalAccount } from "../services/main.service";

export const enablePortalAccountAction = defineAction({
  id: "portal.accounts.enable",
  input: z.object({
    accountId: z.string().uuid(),
    tenantId: z.string().uuid(),
    accountType: z.enum(["customer", "member", "vendor", "patient", "student"]),
    subjectId: z.string().min(3),
    primaryIdentityId: z.string().uuid(),
    activateNow: z.boolean().default(false),
    enableSelfService: z.array(z.enum(["cases", "documents", "billing", "bookings", "learning"])).min(1),
    preferredHome: z.enum(["overview", "billing", "cases", "appointments", "learning"]).default("overview"),
    reason: z.string().min(3).optional()
  }),
  output: z.object({
    ok: z.literal(true),
    nextStatus: z.enum(["invited", "active"]),
    homeRoute: z.string(),
    widgets: z.array(z.string())
  }),
  permission: "portal.accounts.enable",
  idempotent: true,
  audit: true,
  handler: ({ input }) => enablePortalAccount(input)
});
