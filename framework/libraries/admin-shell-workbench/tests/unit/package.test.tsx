import { describe, expect, it } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  defineAdminNav,
  defineBuilder,
  defineCommand,
  definePage,
  defineReport,
  defineSearchProvider,
  defineWidget,
  defineWorkspace,
  defineZoneLaunch
} from "@platform/admin-contracts";
import { createShellProviders, createUiRegistry, defineUiSurface, registerUiSurface } from "@platform/ui-shell";

import {
  AdminWorkbenchShell,
  composeAdminRegistry,
  createMemoryAdminPreferenceStore,
  filterAdminRegistryForPermissions,
  packageId,
  resolveAdminDeskRoute,
  searchAdminRegistry
} from "../../src";

function DummyPage() {
  return React.createElement("div", { "data-testid": "dummy-page" }, "Dummy page");
}

function createRegistry() {
  return {
    workspaces: [
      defineWorkspace({
        id: "crm",
        label: "CRM",
        permission: "crm.contacts.read",
        homePath: "/admin/workspace/crm"
      }),
      defineWorkspace({
        id: "reports",
        label: "Reports",
        permission: "admin.reports.read",
        homePath: "/admin/workspace/reports"
      }),
      defineWorkspace({
        id: "tools",
        label: "Tools",
        permission: "page-builder.use",
        homePath: "/admin/workspace/tools"
      })
    ],
    nav: [
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
    ],
    pages: [
      definePage({
        id: "crm.contacts.list",
        kind: "list",
        route: "/admin/crm/contacts",
        label: "Contacts",
        workspace: "crm",
        permission: "crm.contacts.read",
        component: DummyPage
      })
    ],
    widgets: [
      defineWidget({
        id: "crm.pipeline",
        kind: "kpi",
        shell: "admin",
        slot: "dashboard.crm",
        permission: "crm.contacts.read",
        title: "Pipeline"
      })
    ],
    reports: [
      defineReport({
        id: "crm.pipeline.report",
        kind: "tabular",
        route: "/admin/reports/crm-pipeline",
        label: "CRM Pipeline",
        permission: "admin.reports.read",
        query: "crm.pipeline.report",
        filters: [{ key: "ownerUserId", type: "user-select" }],
        export: ["csv", "pdf"]
      })
    ],
    commands: [
      defineCommand({
        id: "crm.account.new",
        label: "Create Account",
        permission: "crm.contacts.read",
        href: "/admin/crm/contacts/new",
        keywords: ["create", "account"]
      })
    ],
    searchProviders: [
      defineSearchProvider({
        id: "crm-search",
        scopes: ["contacts"],
        permission: "crm.contacts.read",
        search(query) {
          return [
            {
              id: `crm-search:${query}`,
              label: `Contact ${query}`,
              href: "/admin/crm/contacts",
              kind: "resource"
            }
          ];
        }
      })
    ],
    builders: [
      defineBuilder({
        id: "page-builder",
        label: "Page Builder",
        host: "admin",
        route: "/admin/tools/page-builder",
        permission: "page-builder.use",
        mode: "embedded-or-zone"
      })
    ],
    zoneLaunchers: [
      defineZoneLaunch({
        id: "page-builder-zone",
        zoneId: "page-builder-zone",
        route: "/apps/page-builder",
        label: "Page Builder Zone",
        permission: "page-builder.use",
        workspace: "tools"
      })
    ]
  };
}

describe("admin-shell-workbench", () => {
  it("exposes a stable package id", () => {
    expect(packageId).toBe("admin-shell-workbench");
  });

  it("composes legacy ui surfaces into the desk registry", () => {
    let legacyRegistry = createUiRegistry();
    legacyRegistry = registerUiSurface(
      legacyRegistry,
      defineUiSurface({
        embeddedPages: [
          {
            shell: "admin",
            route: "/admin/legacy/support",
            component: DummyPage,
            permission: "support.read"
          }
        ],
        widgets: []
      })
    );

    const registry = composeAdminRegistry({
      base: createRegistry(),
      legacyUiRegistry: legacyRegistry
    });

    expect(registry.pages.some((page) => page.route === "/admin/legacy/support")).toBe(true);
  });

  it("filters visibility, resolves routes, and isolates search-provider failures", async () => {
    const baseRegistry = createRegistry();
    const registry = {
      ...baseRegistry,
      searchProviders: [
        ...baseRegistry.searchProviders,
        defineSearchProvider({
          id: "broken-search",
          scopes: ["broken"],
          permission: "crm.contacts.read",
          search() {
            throw new Error("provider offline");
          }
        })
      ]
    };
    const providers = createShellProviders({
      registry: createUiRegistry(),
      session: {
        sessionId: "session-1",
        tenantId: "tenant-1",
        actorId: "user-1",
        userId: "user-1",
        claims: ["crm.contacts.read", "admin.reports.read", "page-builder.use"]
      },
      grantedPermissions: ["crm.contacts.read", "admin.reports.read", "page-builder.use"]
    });

    const visible = filterAdminRegistryForPermissions(registry, providers);
    expect(visible.pages).toHaveLength(1);

    const resolved = resolveAdminDeskRoute({
      pathname: "/apps/page-builder",
      registry: visible,
      providers,
      zoneAvailability: {
        "page-builder-zone": false
      }
    });
    expect(resolved.kind).toBe("zone-degraded");

    const search = await searchAdminRegistry({
      registry: visible,
      providers,
      query: "contact"
    });
    expect(search.results.some((result) => result.label.includes("Contact"))).toBe(true);
    expect(search.errors).toContain("provider offline");
  });

  it("renders the desk with workspace nav, widgets, and permission-aware route states", () => {
    const providers = createShellProviders({
      registry: createUiRegistry(),
      session: {
        sessionId: "session-1",
        tenantId: "tenant-1",
        actorId: "support-agent",
        userId: "owner-user",
        claims: ["crm.contacts.read", "admin.reports.read", "page-builder.use"]
      },
      grantedPermissions: ["crm.contacts.read", "admin.reports.read", "page-builder.use"]
    });
    const store = createMemoryAdminPreferenceStore();
    const scope = {
      shellId: "admin-shell-workbench",
      tenantId: "tenant-1",
      actorId: "support-agent"
    };
    store.toggleFavorite(scope, {
      id: "crm.contacts.list",
      label: "Contacts",
      href: "/admin/crm/contacts",
      kind: "page"
    });

    const markup = renderToStaticMarkup(
      React.createElement(AdminWorkbenchShell, {
        registry: createRegistry(),
        providers,
        pathname: "/admin/workspace/crm",
        preferences: store.load(scope),
        searchQuery: "contact",
        searchResults: [
          {
            id: "contact-1",
            label: "Contact Ada Lovelace",
            href: "/admin/crm/contacts",
            kind: "resource"
          }
        ]
      })
    );

    expect(markup).toContain("Admin Shell");
    expect(markup).toContain("CRM");
    expect(markup).toContain("Impersonating as support-agent");
    expect(markup).toContain("Contact Ada Lovelace");
    expect(markup).toContain("Pipeline");
  });
});
