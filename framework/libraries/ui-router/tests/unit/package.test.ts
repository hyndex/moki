import { describe, expect, it } from "bun:test";
import {
  buildRouteHref,
  createAdminRouteTaxonomy,
  createDeepLink,
  createRouteManifest,
  defineRoute,
  extractRouteParams,
  matchRoute,
  packageId
} from "../../src";

describe("ui-router", () => {
  it("exposes a stable package id", () => {
    expect(packageId).toBe("ui-router");
  });

  it("builds hrefs from params and search state", () => {
    const route = defineRoute({
      id: "crm.contact.detail",
      path: "/admin/crm/contacts/:id",
      shell: "admin"
    });

    expect(
      buildRouteHref(route, {
        params: { id: "c1" },
        search: { tab: "activity" }
      })
    ).toBe("/admin/crm/contacts/c1?tab=activity");
  });

  it("matches routes and extracts params", () => {
    const manifest = createRouteManifest([
      defineRoute({
        id: "crm.contact.detail",
        path: "/admin/crm/contacts/:id",
        shell: "admin"
      })
    ]);

    const route = matchRoute(manifest, "/admin/crm/contacts/c1");
    expect(route?.id).toBe("crm.contact.detail");
    expect(extractRouteParams(route!, "/admin/crm/contacts/c1")).toEqual({ id: "c1" });
  });

  it("creates deep-link contracts", () => {
    const route = defineRoute({
      id: "portal.booking.detail",
      path: "/portal/bookings/:id",
      shell: "portal"
    });

    expect(createDeepLink(route, { params: { id: "b1" } })).toEqual({
      routeId: "portal.booking.detail",
      href: "/portal/bookings/b1"
    });
  });

  it("provides the standard admin route taxonomy", () => {
    const taxonomy = createAdminRouteTaxonomy("crm", "contacts");
    expect(taxonomy.resourceList.path).toBe("/admin/crm/contacts");
    expect(taxonomy.resourceDetail.path).toBe("/admin/crm/contacts/:id");
    expect(taxonomy.resourceEdit.path).toBe("/admin/crm/contacts/:id/edit");
    expect(taxonomy.report.path).toBe("/admin/reports/:reportId");
    expect(taxonomy.builder.path).toBe("/admin/tools/:builderId");
    expect(taxonomy.zone.path).toBe("/apps/:zone");
  });
});
