import { defineAction } from "@platform/schema";
import { z } from "zod";
import { registerPerson } from "../services/main.service";

export const registerPersonAction = defineAction({
  id: "directory.people.register",
  input: z.object({
    personId: z.string().uuid(),
    tenantId: z.string().uuid(),
    fullName: z.string().min(2),
    email: z.string().email(),
    employmentType: z.enum(["employee", "contractor", "member"]),
    reason: z.string().min(3).optional()
  }),
  output: z.object({
    ok: z.literal(true),
    nextStatus: z.enum(["invited", "active"]),
    directoryKey: z.string()
  }),
  permission: "directory.people.register",
  idempotent: true,
  audit: true,
  handler: ({ input }) => registerPerson(input)
});
