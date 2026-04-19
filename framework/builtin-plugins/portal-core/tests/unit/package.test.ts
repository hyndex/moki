import { describe, expect, it } from "bun:test";
import { executeAction } from "@platform/schema";
import manifest from "../../package";
import { enablePortalAccountAction } from "../../src/actions/default.action";
import { enablePortalAccount } from "../../src/services/main.service";

describe("plugin manifest", () => {
  it("keeps a stable package id and primary capability", () => {
    expect(manifest.id).toBe("portal-core");
    expect(manifest.providesCapabilities).toContain("portal.accounts");
  });

  it("derives default routes and widgets for portal actors", () => {
    expect(
      enablePortalAccount({
        accountId: "276efb5d-c62f-4c4d-9939-0fea0c179421",
        tenantId: "0b4efec6-573c-4be6-b4b6-00444d08b4fb",
        accountType: "patient",
        subjectId: "patient:42",
        primaryIdentityId: "4a4e0e87-1cca-4f46-89a2-4d5f17d32b8a",
        activateNow: false,
        enableSelfService: ["bookings", "documents"],
        preferredHome: "overview",
        reason: "patient onboarding"
      })
    ).toEqual({
      ok: true,
      nextStatus: "invited",
      homeRoute: "/portal/appointments",
      widgets: ["portal.bookings.summary", "portal.documents.summary"]
    });
  });

  it("validates the public action contract for active student portal access", async () => {
    const result = await executeAction(enablePortalAccountAction, {
      accountId: "276efb5d-c62f-4c4d-9939-0fea0c179421",
      tenantId: "0b4efec6-573c-4be6-b4b6-00444d08b4fb",
      accountType: "student",
      subjectId: "student:42",
      primaryIdentityId: "4a4e0e87-1cca-4f46-89a2-4d5f17d32b8a",
      activateNow: true,
      enableSelfService: ["learning", "billing"],
      preferredHome: "learning",
      reason: "activate portal"
    });

    expect(result).toEqual({
      ok: true,
      nextStatus: "active",
      homeRoute: "/portal/learning",
      widgets: ["portal.billing.summary", "portal.learning.progress"]
    });
  });
});
