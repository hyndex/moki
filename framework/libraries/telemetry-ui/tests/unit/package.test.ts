import { describe, expect, it } from "bun:test";

import { createShellProviders, createUiRegistry } from "@platform/ui-shell";

import { packageId, trackCommandPalette, trackPageView, trackWidgetView } from "../../src";

describe("telemetry-ui", () => {
  it("exposes a stable package id", () => {
    expect(packageId).toBe("telemetry-ui");
  });

  it("tracks page, widget, and command telemetry through the shared shell providers", () => {
    const providers = createShellProviders({
      registry: createUiRegistry(),
      session: {
        sessionId: "session-1",
        tenantId: "tenant-1",
        actorId: "user-1",
        userId: "user-1",
        claims: ["ui.shell.admin"]
      },
      grantedPermissions: ["ui.shell.admin"]
    });

    trackPageView(providers, "/admin");
    trackWidgetView(providers, {
      route: "/admin",
      widgetId: "dashboard.active-views"
    });
    trackCommandPalette(providers, {
      route: "/admin",
      query: "contacts"
    });

    expect(providers.telemetry.history).toHaveLength(3);
    expect(providers.telemetry.history[0]?.namespace).toBe("ui.page");
    expect(providers.telemetry.history[2]?.namespace).toBe("ui.command-palette");
  });
});
