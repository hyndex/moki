import { describe, expect, it } from "bun:test";

import { assertRouteAccess, createAdminRouteTaxonomy, createZoneSafeHref, packageId } from "../../src";

describe("router", () => {
  it("exposes a stable package id", () => {
    expect(packageId).toBe("router");
  });

  it("creates safe admin routes and zone links", () => {
    const routes = createAdminRouteTaxonomy("crm", "contacts");
    expect(routes.resourceList.path).toBe("/admin/crm/contacts");
    expect(createZoneSafeHref("page-builder", "preview")).toBe("/apps/page-builder/preview");
  });

  it("enforces route access", () => {
    expect(
      assertRouteAccess({
        permission: "crm.contacts.read",
        context: {
          grantedPermissions: ["crm.contacts.read"],
          currentTenantId: "tenant-1",
          tenantId: "tenant-1"
        }
      })
    ).toBe(true);
  });
});
