import { describe, test, expect } from "bun:test";
import {
  adoptAllLegacyContributions,
  adoptLegacyContributions,
  LEGACY_RESOURCE,
  type AdminContributionRegistry,
  type PermissionIntrospector,
} from "../src/index";

const StubPage = function StubPage() { return null; } as unknown as React.ComponentType;

function regFixture(): Partial<AdminContributionRegistry> {
  return {
    workspaces: [
      {
        id: "crm",
        label: "CRM",
        icon: "network",
        permission: "crm.leads.read",
        homePath: "/admin/business/crm",
      },
    ],
    nav: [
      {
        workspace: "crm",
        group: "control-room",
        items: [
          {
            id: "crm-core.overview",
            label: "Control Room",
            icon: "network",
            to: "/admin/business/crm",
            permission: "crm.leads.read",
          },
        ],
      },
    ],
    pages: [
      {
        id: "crm-core.page",
        kind: "dashboard",
        route: "/admin/business/crm",
        label: "CRM Control Room",
        workspace: "crm",
        permission: "crm.leads.read",
        component: StubPage,
      },
      {
        id: "crm-core.missing-component",
        kind: "list",
        route: "/admin/business/crm/listviewless",
        label: "No component page",
        workspace: "crm",
        permission: "crm.leads.read",
        listViewId: "crm.contacts",
      },
    ],
    commands: [
      {
        id: "crm-core.open.control-room",
        label: "Open CRM Core",
        permission: "crm.leads.read",
        href: "/admin/business/crm",
        keywords: ["crm core", "crm", "business"],
      },
    ],
  };
}

describe("adoptLegacyContributions", () => {
  test("converts a workspace into a nav section + landing nav item", () => {
    const plugin = adoptLegacyContributions(regFixture(), { sourceId: "crm-core" });
    expect(plugin.admin.navSections.map((s) => s.id)).toContain("legacy.crm");
    const landing = plugin.admin.nav.find((n) => n.id === "legacy.crm.home");
    expect(landing).toBeDefined();
    expect(landing?.path).toBe("/admin/business/crm");
  });

  test("converts nav contributions into flattened nav items with section assignment", () => {
    const plugin = adoptLegacyContributions(regFixture(), { sourceId: "crm-core" });
    const navItem = plugin.admin.nav.find((n) => n.id === "crm-core.nav.crm-core.overview");
    expect(navItem).toBeDefined();
    expect(navItem?.section).toBe("legacy.crm");
    expect(navItem?.path).toBe("/admin/business/crm");
  });

  test("converts pages with components into custom views + nav items", () => {
    const plugin = adoptLegacyContributions(regFixture(), { sourceId: "crm-core" });
    const view = plugin.admin.views.find((v) => v.id === "crm-core.crm-core.page.legacy.view");
    expect(view).toBeDefined();
    expect(view?.type).toBe("custom");
    expect(view?.resource).toBe(LEGACY_RESOURCE);
    const pageNav = plugin.admin.nav.find((n) => n.view === view?.id);
    expect(pageNav).toBeDefined();
  });

  test("skips pages without a component (warns to console)", () => {
    const spy = { calls: 0 };
    const originalWarn = console.warn;
    console.warn = () => { spy.calls++; };
    const plugin = adoptLegacyContributions(regFixture(), { sourceId: "crm-core" });
    console.warn = originalWarn;

    const missing = plugin.admin.views.find((v) =>
      v.id.includes("crm-core.missing-component"),
    );
    expect(missing).toBeUndefined();
    expect(spy.calls).toBeGreaterThan(0);
  });

  test("converts commands and preserves keywords", () => {
    const plugin = adoptLegacyContributions(regFixture(), { sourceId: "crm-core" });
    const cmd = plugin.admin.commands.find((c) => c.id === "crm-core.cmd.crm-core.open.control-room");
    expect(cmd).toBeDefined();
    expect(cmd?.keywords).toEqual(["crm core", "crm", "business"]);
  });

  test("command.run navigates via runtime when supplied", async () => {
    const plugin = adoptLegacyContributions(regFixture(), { sourceId: "crm-core" });
    const cmd = plugin.admin.commands[0]!;
    let visited: string | null = null;
    await cmd.run({ runtime: { navigate: (p) => { visited = p; } } });
    expect(visited).toBe("/admin/business/crm");
  });

  test("permission introspector filters out denied nav + pages", () => {
    const denying: PermissionIntrospector = { has: () => false };
    const plugin = adoptLegacyContributions(regFixture(), {
      sourceId: "crm-core",
      permissions: denying,
    });
    expect(plugin.admin.navSections.length).toBe(0);
    expect(plugin.admin.nav.length).toBe(0);
    expect(plugin.admin.views.length).toBe(0);
    expect(plugin.admin.commands.length).toBe(0);
  });

  test("permission introspector allows matching permissions", () => {
    const gating: PermissionIntrospector = {
      has: (p) => p === "crm.leads.read",
    };
    const plugin = adoptLegacyContributions(regFixture(), {
      sourceId: "crm-core",
      permissions: gating,
    });
    expect(plugin.admin.navSections.length).toBe(1);
    expect(plugin.admin.views.length).toBe(1); // only the one with a component
    expect(plugin.admin.commands.length).toBe(1);
  });

  test("partial registries do not throw", () => {
    const plugin = adoptLegacyContributions({}, { sourceId: "empty" });
    expect(plugin.admin.navSections.length).toBe(0);
    expect(plugin.admin.nav.length).toBe(0);
    expect(plugin.admin.views.length).toBe(0);
    expect(plugin.admin.commands.length).toBe(0);
  });

  test("plugin metadata flows through", () => {
    const plugin = adoptLegacyContributions(regFixture(), {
      sourceId: "crm-core",
      plugin: {
        id: "gutu-plugin-crm-core",
        label: "CRM Core",
        version: "1.4.0",
        icon: "Users",
      },
    });
    expect(plugin.id).toBe("gutu-plugin-crm-core");
    expect(plugin.label).toBe("CRM Core");
    expect(plugin.version).toBe("1.4.0");
    expect(plugin.icon).toBe("Users");
  });

  test("wrap() replaces the default render strategy", () => {
    const plugin = adoptLegacyContributions(regFixture(), {
      sourceId: "crm-core",
      wrap: (Component, ctx) => ({ __wrapped: true, ctx, Component } as unknown as React.ReactNode),
    });
    const view = plugin.admin.views[0]!;
    const rendered = view.render() as unknown as { __wrapped: boolean; ctx: { pageId: string } };
    expect(rendered.__wrapped).toBe(true);
    expect(rendered.ctx.pageId).toBe("crm-core.page");
  });

  test("duplicate nav ids are de-duplicated", () => {
    const reg = regFixture();
    // Introduce a duplicate landing + nav contribution pointing at the same legacy id.
    reg.nav!.push({
      workspace: "crm",
      group: "control-room",
      items: [
        {
          id: "crm-core.overview",
          label: "Duplicate Control Room",
          to: "/admin/business/crm",
          permission: "crm.leads.read",
        },
      ],
    });
    const plugin = adoptLegacyContributions(reg, { sourceId: "crm-core" });
    const count = plugin.admin.nav.filter((n) => n.id === "crm-core.nav.crm-core.overview").length;
    expect(count).toBe(1);
  });
});

describe("adoptAllLegacyContributions", () => {
  test("converts multiple registries into distinct plugins", () => {
    const plugins = adoptAllLegacyContributions([
      { sourceId: "crm-core", registry: regFixture() },
      { sourceId: "accounting-core", registry: regFixture() },
    ]);
    expect(plugins).toHaveLength(2);
    expect(plugins[0].id).toBe("crm-core");
    expect(plugins[1].id).toBe("accounting-core");
    // IDs must be namespaced per sourceId to avoid collisions:
    const crmNavIds = plugins[0].admin.nav.map((n) => n.id);
    const acctNavIds = plugins[1].admin.nav.map((n) => n.id);
    for (const id of crmNavIds) {
      expect(acctNavIds.includes(id.replace("crm-core", "accounting-core"))).toBe(true);
    }
  });
});

declare namespace React {
  type ReactNode = unknown;
  type ComponentType = () => ReactNode;
}
