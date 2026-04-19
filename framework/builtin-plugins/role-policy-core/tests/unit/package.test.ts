import { describe, expect, it } from "bun:test";
import { executeAction } from "@platform/schema";
import manifest from "../../package";
import { assignGrantAction } from "../../src/actions/default.action";
import { assignGrant } from "../../src/services/main.service";

describe("plugin manifest", () => {
  it("keeps a stable package id and primary capability", () => {
    expect(manifest.id).toBe("role-policy-core");
    expect(manifest.providesCapabilities).toContain("roles.grants");
  });

  it("creates deterministic grant keys", () => {
    expect(
      assignGrant({
        grantId: "9642f9b7-2383-4188-8702-cf4cdbd48fd7",
        tenantId: "f7386e45-6a45-40e1-b491-3bf4f6826b95",
        subjectId: "9642f9b7-2383-4188-8702-cf4cdbd48fd7",
        permission: "crm.contacts.read",
        effect: "allow",
        reason: "baseline role seed"
      })
    ).toEqual({
      ok: true,
      nextStatus: "active",
      grantKey: "f7386e45-6a45-40e1-b491-3bf4f6826b95:9642f9b7-2383-4188-8702-cf4cdbd48fd7:crm.contacts.read"
    });
  });

  it("validates the role-policy action contract", async () => {
    const result = await executeAction(assignGrantAction, {
      grantId: "9642f9b7-2383-4188-8702-cf4cdbd48fd7",
      tenantId: "f7386e45-6a45-40e1-b491-3bf4f6826b95",
      subjectId: "9642f9b7-2383-4188-8702-cf4cdbd48fd7",
      permission: "crm.contacts.read",
      effect: "deny",
      reason: "revoke access"
    });

    expect(result).toEqual({
      ok: true,
      nextStatus: "revoked",
      grantKey: "f7386e45-6a45-40e1-b491-3bf4f6826b95:9642f9b7-2383-4188-8702-cf4cdbd48fd7:crm.contacts.read"
    });
  });
});
