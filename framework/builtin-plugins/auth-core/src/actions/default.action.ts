import { defineAction } from "@platform/schema";
import { z } from "zod";
import { provisionIdentity } from "../services/main.service";

export const provisionIdentityAction = defineAction({
  id: "auth.identities.provision",
  input: z.object({
    identityId: z.string().uuid(),
    tenantId: z.string().uuid(),
    email: z.string().email(),
    authProvider: z.enum(["password", "oidc", "saml"]),
    activate: z.boolean().default(false),
    reason: z.string().min(3).optional()
  }),
  output: z.object({
    ok: z.literal(true),
    nextStatus: z.enum(["invited", "active"]),
    secretRefs: z.array(z.string())
  }),
  permission: "auth.identities.provision",
  idempotent: true,
  audit: true,
  handler: ({ input }) => provisionIdentity(input)
});
