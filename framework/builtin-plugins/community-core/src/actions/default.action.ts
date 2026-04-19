import { defineAction } from "@platform/schema";
import { z } from "zod";
import { enrollMembership } from "../services/main.service";

export const enrollMembershipAction = defineAction({
  id: "community.memberships.enroll",
  input: z.object({
    id: z.string().uuid(),
    tenantId: z.string().uuid(),
    reason: z.string().min(3).optional()
  }),
  output: z.object({
    ok: z.literal(true),
    nextStatus: z.enum(["active", "inactive"])
  }),
  permission: "community.memberships.enroll",
  idempotent: true,
  audit: true,
  handler: ({ input }) => enrollMembership(input)
});