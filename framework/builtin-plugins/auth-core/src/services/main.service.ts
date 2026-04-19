import { normalizeActionInput } from "@platform/schema";

export type DomainActionInput = {
  identityId: string;
  tenantId: string;
  email: string;
  authProvider: "password" | "oidc" | "saml";
  activate: boolean;
  reason?: string | undefined;
};

export function provisionIdentity(input: DomainActionInput): {
  ok: true;
  nextStatus: "invited" | "active";
  secretRefs: string[];
} {
  normalizeActionInput(input);
  const nextStatus = input.activate ? "active" : "invited";
  const secretRefs = input.authProvider === "saml" ? ["AUTH_SAML_METADATA_URL"] : [];
  return { ok: true, nextStatus, secretRefs };
}
