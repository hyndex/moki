import { describe, expect, it } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  AdminShell,
  PortalShell,
  SiteShell,
  createPermissionIntrospector,
  createShellEventBus,
  createShellProviders,
  createUiRegistry,
  defineUiSurface,
  defineZone,
  listDeepLinks,
  packageId,
  registerUiSurface,
  registerZone,
  resolveNavigationTarget
} from "../../src";

function EmptyPage() {
  return React.createElement("div", null, "page");
}

describe("ui-shell", () => {
  it("exposes a stable package id", () => {
    expect(packageId).toBe("ui-shell");
  });

  it("registers UI surfaces and zones with deep-link resolution", () => {
    let registry = createUiRegistry();
    registry = registerUiSurface(
      registry,
      defineUiSurface({
        embeddedPages: [
          {
            shell: "admin",
            route: "/admin/crm",
            component: EmptyPage,
            permission: "crm.contacts.read"
          }
        ],
        widgets: [
          {
            shell: "admin",
            slot: "dashboard.hero",
            component: EmptyPage,
            permission: "crm.contacts.read"
          }
        ]
      })
    );
    registry = registerZone(
      registry,
      defineZone({
        id: "crm-portal",
        adapter: "nextjs",
        mountPath: "/portal/crm",
        assetPrefix: "/portal/crm/_next",
        authMode: "platform-session",
        telemetryNamespace: "crm-portal",
        deepLinks: ["/portal/crm", "/portal/crm/customers"],
        routeOwnership: ["/portal/crm/*"]
      })
    );

    expect(listDeepLinks(registry)).toEqual(["/admin/crm", "/portal/crm", "/portal/crm/customers"]);
    expect(resolveNavigationTarget(registry, "/portal/crm/customers")?.sourceId).toBe("crm-portal");
  });

  it("rejects duplicate widget slots and zone route ownership collisions", () => {
    expect(() =>
      registerUiSurface(
        createUiRegistry(),
        defineUiSurface({
          embeddedPages: [
            {
              shell: "admin",
              route: "/admin/crm",
              component: EmptyPage,
              permission: "crm.contacts.read"
            }
          ],
          widgets: [
            {
              shell: "admin",
              slot: "dashboard.hero",
              component: EmptyPage,
              permission: "crm.contacts.read"
            },
            {
              shell: "admin",
              slot: "dashboard.hero",
              component: EmptyPage,
              permission: "crm.contacts.read"
            }
          ]
        })
      )
    ).toThrow("duplicate widget slot registration");
    expect(() =>
      registerZone(
        registerUiSurface(
          createUiRegistry(),
          defineUiSurface({
            embeddedPages: [
              {
                shell: "admin",
                route: "/admin/crm",
                component: EmptyPage,
                permission: "crm.contacts.read"
              }
            ],
            widgets: []
          })
        ),
        defineZone({
          id: "crm-portal",
          adapter: "nextjs",
          mountPath: "/portal/crm",
          assetPrefix: "/portal/crm/_next",
          authMode: "platform-session",
          telemetryNamespace: "crm-portal",
          deepLinks: ["/portal/crm"],
          routeOwnership: ["/admin/crm"]
        })
      )
    ).toThrow("zone route ownership collides with embedded route");
  });

  it("provides permission-aware navigation and event buses", () => {
    const commandBus = createShellEventBus<{ type: string }>();
    const received: string[] = [];
    const unsubscribe = commandBus.subscribe((event) => {
      received.push(event.type);
    });

    const providers = createShellProviders({
      registry: registerZone(
        registerUiSurface(
          createUiRegistry(),
          defineUiSurface({
            embeddedPages: [
              {
                shell: "admin",
                route: "/admin/crm",
                component: EmptyPage,
                permission: "crm.contacts.read"
              }
            ],
            widgets: []
          })
        ),
        defineZone({
          id: "crm-portal",
          adapter: "nextjs",
          mountPath: "/portal/crm",
          assetPrefix: "/portal/crm/_next",
          authMode: "platform-session",
          telemetryNamespace: "crm-portal",
          deepLinks: ["/portal/crm/customers"],
          routeOwnership: ["/portal/crm/*"]
        })
      ),
      session: {
        sessionId: "session-1",
        tenantId: "tenant-a",
        actorId: "actor-1",
        claims: ["crm.contacts.read"]
      },
      grantedPermissions: ["crm.contacts.read"],
      commandBus
    });

    expect(providers.navigation.resolve("/admin/crm")?.kind).toBe("embedded-page");
    expect(providers.navigation.resolve("/portal/crm/customers")?.kind).toBe("zone");
    expect(createPermissionIntrospector(["crm.contacts.read"]).hasEvery(["crm.contacts.read"])).toBe(true);

    commandBus.publish({ type: "refresh" });
    unsubscribe();
    expect(received).toEqual(["refresh"]);
  });

  it("renders admin, portal, and site shells with provider wiring intact", () => {
    const registry = registerUiSurface(
      createUiRegistry(),
      defineUiSurface({
        embeddedPages: [
          {
            shell: "admin",
            route: "/admin/crm",
            component: EmptyPage,
            permission: "crm.contacts.read"
          },
          {
            shell: "portal",
            route: "/portal/bookings",
            component: EmptyPage,
            permission: "booking.read"
          },
          {
            shell: "site",
            route: "/site/home",
            component: EmptyPage,
            permission: "site.read"
          }
        ],
        widgets: []
      })
    );

    const providers = createShellProviders({
      registry,
      session: {
        sessionId: "session-1",
        tenantId: "tenant-a",
        actorId: "actor-1",
        claims: ["crm.contacts.read"]
      },
      grantedPermissions: ["crm.contacts.read"]
    });

    expect(renderToStaticMarkup(React.createElement(AdminShell, { registry, providers }))).toContain("1 route(s) registered");
    expect(renderToStaticMarkup(React.createElement(PortalShell, { registry, providers }))).toContain("1 route(s) registered");
    expect(renderToStaticMarkup(React.createElement(SiteShell, { registry, providers }))).toContain("1 route(s) registered");
  });
});
