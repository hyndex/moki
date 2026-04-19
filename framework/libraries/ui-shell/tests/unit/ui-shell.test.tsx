import { describe, expect, it } from "bun:test";

import {
  createShellProviders,
  createUiRegistry,
  defineUiSurface,
  defineZone,
  listShellRoutes,
  registerUiSurface,
  registerZone,
  resolveNavigationTarget
} from "../../src";

function DummyComponent() {
  return <div>dummy</div>;
}

describe("ui shell contracts", () => {
  it("registers embedded pages and lists shell routes", () => {
    const surface = defineUiSurface({
      embeddedPages: [
        {
          shell: "admin",
          route: "/admin/crm",
          component: DummyComponent,
          permission: "crm.contacts.read"
        }
      ],
      widgets: []
    });

    const registry = registerUiSurface(createUiRegistry(), surface);
    expect(listShellRoutes(registry, "admin")).toEqual(["/admin/crm"]);
  });

  it("prevents conflicting zone mounts and asset prefixes", () => {
    const registry = registerZone(
      createUiRegistry(),
      defineZone({
        id: "crm-studio",
        adapter: "next-zone",
        mountPath: "/apps/crm-studio",
        assetPrefix: "/_assets/plugins/crm-studio",
        authMode: "platform-session",
        telemetryNamespace: "crm.studio",
        deepLinks: ["/apps/crm-studio"],
        routeOwnership: ["/apps/crm-studio/*"]
      })
    );

    expect(() =>
      registerZone(
        registry,
        defineZone({
          id: "crm-studio-duplicate",
          adapter: "next-zone",
          mountPath: "/apps/crm-studio",
          assetPrefix: "/_assets/plugins/crm-studio-2",
          authMode: "platform-session",
          telemetryNamespace: "crm.studio.duplicate",
          deepLinks: ["/apps/crm-studio-2"],
          routeOwnership: ["/apps/crm-studio-2/*"]
        })
      )
    ).toThrow("duplicate zone mount path");
  });

  it("resolves deep links and filters protected routes through shared providers", () => {
    const registry = registerZone(
      registerUiSurface(
        createUiRegistry(),
        defineUiSurface({
          embeddedPages: [
            {
              shell: "admin",
              route: "/admin/crm",
              component: DummyComponent,
              permission: "crm.contacts.read"
            }
          ],
          widgets: []
        })
      ),
      defineZone({
        id: "crm-studio",
        adapter: "next-zone",
        mountPath: "/apps/crm-studio",
        assetPrefix: "/_assets/plugins/crm-studio",
        authMode: "platform-session",
        telemetryNamespace: "crm.studio",
        deepLinks: ["/apps/crm-studio", "/apps/crm-studio/reports"],
        routeOwnership: ["/apps/crm-studio/*"]
      })
    );

    expect(resolveNavigationTarget(registry, "/apps/crm-studio/reports?tab=summary")?.sourceId).toBe("crm-studio");

    const providers = createShellProviders({
      registry,
      session: {
        sessionId: "session-1",
        tenantId: "tenant-1",
        actorId: "actor-1",
        claims: ["role:admin"]
      },
      grantedPermissions: ["crm.contacts.read"]
    });

    expect(providers.navigation.resolve("/admin/crm")?.kind).toBe("embedded-page");
    expect(providers.navigation.resolve("/admin/finance")).toBeUndefined();
    expect(providers.navigation.resolve("/apps/crm-studio/reports")?.telemetryNamespace).toBe("crm.studio");
    expect(providers.navigation.deepLinks).toEqual([
      "/admin/crm",
      "/apps/crm-studio",
      "/apps/crm-studio/reports"
    ]);
  });

  it("records audit and telemetry activity and delivers command notifications", () => {
    const providers = createShellProviders({
      registry: createUiRegistry(),
      session: {
        sessionId: "session-1",
        tenantId: "tenant-1",
        actorId: "actor-1",
        claims: ["role:admin"]
      },
      grantedPermissions: ["ui.register.admin"],
      designTokens: {
        accent: "#123456"
      }
    });

    const seenCommands: string[] = [];
    const seenNotifications: string[] = [];
    const unsubscribeCommands = providers.commandBus.subscribe((event) => {
      seenCommands.push(event.type);
    });
    const unsubscribeNotifications = providers.notificationBus.subscribe((event) => {
      seenNotifications.push(event.id);
    });

    providers.commandBus.publish({
      type: "refresh",
      payload: { scope: "admin" }
    });
    providers.notificationBus.publish({
      id: "notice-1",
      title: "Ready",
      body: "UI contracts are online",
      severity: "info",
      createdAt: "2026-01-01T00:00:00.000Z"
    });

    const auditEvent = providers.audit.record({
      type: "shell.audit",
      shell: "admin",
      route: "/admin/crm",
      actorId: "actor-1",
      tenantId: "tenant-1"
    });
    const telemetryEvent = providers.telemetry.track({
      name: "shell.navigation",
      shell: "admin",
      route: "/admin/crm",
      namespace: "crm.admin"
    });

    unsubscribeCommands();
    unsubscribeNotifications();

    expect(seenCommands).toEqual(["refresh"]);
    expect(seenNotifications).toEqual(["notice-1"]);
    expect(typeof auditEvent.at).toBe("string");
    expect(typeof telemetryEvent.at).toBe("string");
    expect(providers.designTokens).toEqual({ accent: "#123456" });
  });
});
