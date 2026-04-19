import { defineAction } from "@platform/schema";
import { z } from "zod";
import { assignGrant } from "../services/main.service";

export const assignGrantAction = defineAction({
  id: "roles.grants.assign",
  input: z.object({
    grantId: z.string().uuid(),
    tenantId: z.string().uuid(),
    subjectId: z.string().uuid(),
    permission: z.string().min(3),
    effect: z.enum(["allow", "deny"]),
    reason: z.string().min(3).optional()
  }),
  output: z.object({
    ok: z.literal(true),
    nextStatus: z.enum(["active", "revoked"]),
    grantKey: z.string()
  }),
  permission: "roles.grants.assign",
  idempotent: true,
  audit: true,
  handler: ({ input }) => assignGrant(input)
});
