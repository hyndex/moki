import { describe, expect, it } from "bun:test";

import { createUiRegistry, defineUiSurface, defineZone, registerUiSurface, registerZone } from "@platform/ui-shell";

import {
  adaptLegacyUiRegistry,
  canLaunchZone,
  canSeeField,
  canViewPage,
  createAdminContributionRegistry,
  defineAdminNav,
  definePage,
  defineWidget,
  defineWorkspace,
  packageId,
  registerAdminNav,
  registerPage,
  registerWidget,
  registerWorkspace,
  type AdminAccessContext
} from "../../src";

function DummyComponent() {
  return null;
}

describe("admin-contracts", () => {
  it("exposes a stable package id", () => {
    expect(packageId).toBe("admin-contracts");
  });

  it("registers governed workspaces, nav, pages, and widgets", () => {
    let registry = createAdminContributionRegistry();
    registry = registerWorkspace(
      registry,
      defineWorkspace({
        id: "crm",
        label: "CRM",
        permission: "crm.contacts.read",
        homePath: "/admin/workspace/crm"
      })
    );
    registry = registerAdminNav(
      registry,
      defineAdminNav({
        workspace: "crm",
        group: "customers",
        items: [
          {
            id: "crm.contacts",
            label: "Contacts",
            to: "/admin/crm/contacts",
            permission: "crm.contacts.read"
          }
        ]
      })
    );
    registry = registerPage(
      registry,
      definePage({
        id: "crm.contacts.list",
        kind: "list",
        route: "/admin/crm/contacts",
        label: "Contacts",
        workspace: "crm",
        group: "customers",
        permission: "crm.contacts.read",
        component: DummyComponent
      })
    );
    registry = registerWidget(
      registry,
      defineWidget({
        id: "crm.pipeline",
        kind: "kpi",
        shell: "admin",
        slot: "dashboard.crm",
        permission: "crm.contacts.read",
        component: DummyComponent
      })
    );

    expect(registry.workspaces).toHaveLength(1);
    expect(registry.nav[0]?.items[0]?.id).toBe("crm.contacts");
    expect(registry.pages[0]?.route).toBe("/admin/crm/contacts");
    expect(registry.widgets[0]?.slot).toBe("dashboard.crm");
  });

  it("rejects permissionless or conflicting contributions deterministically", () => {
    expect(() =>
      registerPage(
        createAdminContributionRegistry(),
        definePage({
          id: "bad.page",
          kind: "list",
          route: "/admin/bad",
          label: "Bad",
          workspace: "bad",
          permission: ""
        })
      )
    ).toThrow("permissionless admin contribution rejected");

    const registry = registerWorkspace(
      createAdminContributionRegistry(),
      defineWorkspace({
        id: "crm",
        label: "CRM",
        permission: "crm.contacts.read"
      })
    );

    expect(() =>
      registerPage(
        registerPage(
          registry,
          definePage({
            id: "crm.contacts.list",
            kind: "list",
            route: "/admin/crm/contacts",
            label: "Contacts",
            workspace: "crm",
            permission: "crm.contacts.read"
          })
        ),
        definePage({
          id: "crm.contacts.duplicate",
          kind: "detail",
          route: "/admin/crm/contacts",
          label: "Contacts detail",
          workspace: "crm",
          permission: "crm.contacts.read"
        })
      )
    ).toThrow("conflicting admin route");
  });

  it("lifts legacy ui-shell surfaces into admin desk contributions", () => {
    let legacyRegistry = createUiRegistry();
    legacyRegistry = registerUiSurface(
      legacyRegistry,
      defineUiSurface({
        embeddedPages: [
          {
            shell: "admin",
            route: "/admin/crm/contacts",
            component: DummyComponent,
            permission: "crm.contacts.read"
          }
        ],
        widgets: [
          {
            shell: "admin",
            slot: "dashboard.crm",
            component: DummyComponent,
            permission: "crm.contacts.read"
          }
        ]
      })
    );
    legacyRegistry = registerZone(
      legacyRegistry,
      defineZone({
        id: "page-builder-zone",
        adapter: "ui-zone-static",
        mountPath: "/apps/page-builder",
        assetPrefix: "/_assets/plugins/page-builder",
        authMode: "platform-session",
        telemetryNamespace: "page.builder",
        deepLinks: ["/apps/page-builder"],
        routeOwnership: ["/apps/page-builder/*"]
      })
    );

    const adapted = adaptLegacyUiRegistry(legacyRegistry);
    expect(adapted.workspaces.map((workspace) => workspace.id)).toContain("crm");
    expect(adapted.pages[0]?.route).toBe("/admin/crm/contacts");
    expect(adapted.widgets[0]?.slot).toBe("dashboard.crm");
    expect(adapted.zoneLaunchers[0]?.route).toBe("/apps/page-builder");
  });

  it("evaluates permission-bound visibility helpers", () => {
    const ctx: AdminAccessContext = {
      has: (permission) => permission === "crm.contacts.read",
      hasEvery: (permissions) => permissions.every((permission) => permission === "crm.contacts.read"),
      hasSome: (permissions) => permissions.some((permission) => permission === "crm.contacts.read")
    };

    expect(canViewPage(ctx, "crm.contacts.read")).toBe(true);
    expect(canSeeField(ctx, { field: "mqlScore", permission: "crm.contacts.read" })).toBe(true);
    expect(canLaunchZone(ctx, { permission: "page-builder.use" })).toBe(false);
  });
});
