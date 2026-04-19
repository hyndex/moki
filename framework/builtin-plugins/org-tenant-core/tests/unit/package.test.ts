import { describe, expect, it } from "bun:test";
import { executeAction } from "@platform/schema";
import manifest from "../../package";
import { activateTenantAction } from "../../src/actions/default.action";
import { activateTenant } from "../../src/services/main.service";

describe("plugin manifest", () => {
  it("keeps a stable package id and primary capability", () => {
    expect(manifest.id).toBe("org-tenant-core");
    expect(manifest.providesCapabilities).toContain("org.tenants");
  });

  it("normalizes tenant slugs during activation", () => {
    expect(
      activateTenant({
        id: "57dfac7b-152c-4d70-8dbc-f8ecb7be24af",
        tenantId: "57dfac7b-152c-4d70-8dbc-f8ecb7be24af",
        slug: "Acme Health",
        billingPlan: "enterprise",
        reason: "initial activation"
      })
    ).toEqual({
      ok: true,
      nextStatus: "active",
      resolvedSlug: "acme-health"
    });
  });

  it("keeps the action contract stable", async () => {
    const result = await executeAction(activateTenantAction, {
      id: "57dfac7b-152c-4d70-8dbc-f8ecb7be24af",
      tenantId: "57dfac7b-152c-4d70-8dbc-f8ecb7be24af",
      slug: "Acme Health",
      billingPlan: "trial",
      reason: "suspend after billing review"
    });

    expect(result).toEqual({
      ok: true,
      nextStatus: "suspended",
      resolvedSlug: "acme-health"
    });
  });
});
