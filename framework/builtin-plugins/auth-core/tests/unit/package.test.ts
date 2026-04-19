import { describe, expect, it } from "bun:test";
import { executeAction } from "@platform/schema";
import manifest from "../../package";
import { provisionIdentityAction } from "../../src/actions/default.action";
import { provisionIdentity } from "../../src/services/main.service";

describe("plugin manifest", () => {
  it("keeps a stable package id and primary capability", () => {
    expect(manifest.id).toBe("auth-core");
    expect(manifest.providesCapabilities).toContain("auth.identities");
  });

  it("provisions identities with provider-aware defaults", () => {
    expect(
      provisionIdentity({
        identityId: "c95d39fb-d8b7-4e6d-9338-b1c0d962c6d2",
        tenantId: "a18c5c16-5fd3-41fe-9f3b-4ac203b9f5fd",
        email: "owner@example.com",
        authProvider: "saml",
        activate: false,
        reason: "invite"
      })
    ).toEqual({
      ok: true,
      nextStatus: "invited",
      secretRefs: ["AUTH_SAML_METADATA_URL"]
    });
  });

  it("validates the public action contract", async () => {
    const result = await executeAction(provisionIdentityAction, {
      identityId: "c95d39fb-d8b7-4e6d-9338-b1c0d962c6d2",
      tenantId: "a18c5c16-5fd3-41fe-9f3b-4ac203b9f5fd",
      email: "owner@example.com",
      authProvider: "password",
      activate: true,
      reason: "initial setup"
    });

    expect(result).toEqual({
      ok: true,
      nextStatus: "active",
      secretRefs: []
    });
  });
});
