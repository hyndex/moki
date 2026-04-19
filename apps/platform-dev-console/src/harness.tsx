/* eslint-disable react-refresh/only-export-components */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  AdminWorkbenchShell,
  composeAdminRegistry,
  createMemoryAdminPreferenceStore,
  resolveAdminDeskRoute,
  searchAdminRegistry,
  type AdminFavorite,
  type AdminPreferenceScope
} from "@platform/admin-shell-workbench";
import { definePackage } from "@platform/kernel";
import { createInstallReviewPlan } from "@platform/permissions";
import { solvePackageGraph } from "@platform/plugin-solver";
import {
  PortalShell,
  SiteShell,
  createShellProviders,
  createUiRegistry,
  defineUiSurface,
  registerUiSurface,
  registerZone,
  type SessionSnapshot,
  type ShellKind,
  type ShellProviderContract,
  type UiRegistry
} from "@platform/ui-shell";
import { adminContributions as aiCoreAdminContributions } from "@plugins/ai-core";
import { adminContributions as aiEvalsAdminContributions } from "@plugins/ai-evals";
import { adminContributions as aiRagAdminContributions } from "@plugins/ai-rag";
import { adminContributions as dashboardAdminContributions } from "@plugins/dashboard-core";
import { adminContributions as pageBuilderAdminContributions, pageBuilderZone } from "@plugins/page-builder-core";

type ProfileName = "admin" | "viewer" | "support";
type WorkbenchSkin = "lagoon" | "slate" | "sand";

type RestrictedPreviewScenario = {
  mode: string;
  effectiveIsolation: string;
  strippedCapabilities: string[];
  strippedHosts: string[];
  orderedActivation: string[];
  warnings: string[];
  requiredApprovals: string[];
};

const preferenceStore = createMemoryAdminPreferenceStore({
  "admin-shell-workbench:tenant-platform:actor-admin": {
    favorites: [
      {
        id: "dashboard.home",
        label: "Desk Home",
        href: "/admin",
        kind: "page"
      },
      {
        id: "ai.runs.page",
        label: "Agent Runs",
        href: "/admin/ai/runs",
        kind: "page"
      }
    ],
    recentItems: [],
    savedViews: [
      {
        id: "dashboard.exports.processing",
        label: "Processing Exports",
        filterState: {
          status: "processing"
        },
        sortState: [{ id: "createdAt", desc: true }],
        columnVisibility: {
          name: true,
          owner: true
        }
      }
    ],
    dashboards: [
      {
        id: "overview.default",
        label: "Overview",
        widgetIds: [
          "dashboard.active-views",
          "dashboard.export-health",
          "dashboard.workflow-inbox",
          "dashboard.plugin-health",
          "ai.active-runs",
          "ai.pending-approvals",
          "ai.retrieval-health",
          "ai.eval-regressions"
        ]
      }
    ],
    activeWorkspace: "overview"
  }
});

const profileSessions = {
  admin: {
    sessionId: "session-admin-001",
    tenantId: "tenant-platform",
    actorId: "actor-admin",
    userId: "actor-admin",
    claims: ["admin"]
  },
  viewer: {
    sessionId: "session-viewer-001",
    tenantId: "tenant-platform",
    actorId: "actor-viewer",
    userId: "actor-viewer",
    claims: ["viewer"]
  },
  support: {
    sessionId: "session-support-001",
    tenantId: "tenant-platform",
    actorId: "support-agent",
    userId: "actor-admin",
    claims: ["support", "impersonation"]
  }
} as const satisfies Record<ProfileName, SessionSnapshot>;

const profilePermissions = {
  admin: [
    "dashboard.views.read",
    "dashboard.inbox.read",
    "dashboard.exports.read",
    "dashboard.builders.use",
    "jobs.monitor.read",
    "page-builder.use",
    "plugins.health.read",
    "plugins.review.read",
    "admin.settings.read",
    "ai.runs.read",
    "ai.runs.submit",
    "ai.prompts.read",
    "ai.prompts.publish",
    "ai.approvals.read",
    "ai.approvals.approve",
    "ai.replay.read",
    "ai.memory.read",
    "ai.memory.ingest",
    "ai.memory.reindex",
    "ai.evals.read",
    "ai.evals.run",
    "ai.reports.read",
    "ui.shell.admin",
    "portal.profile.read",
    "site.help.read"
  ],
  viewer: [
    "dashboard.views.read",
    "dashboard.inbox.read",
    "dashboard.exports.read",
    "portal.profile.read",
    "site.help.read"
  ],
  support: [
    "dashboard.views.read",
    "dashboard.inbox.read",
    "dashboard.exports.read",
    "dashboard.builders.use",
    "jobs.monitor.read",
    "page-builder.use",
    "plugins.health.read",
    "plugins.review.read",
    "admin.settings.read",
    "ai.runs.read",
    "ai.prompts.read",
    "ai.approvals.read",
    "ai.replay.read",
    "ai.memory.read",
    "ai.evals.read",
    "ai.reports.read",
    "ui.shell.admin",
    "portal.profile.read",
    "site.help.read"
  ]
} as const satisfies Record<ProfileName, readonly string[]>;

export function createShellHarnessRegistry(): UiRegistry {
  let registry = createUiRegistry();
  registry = registerUiSurface(
    registry,
    defineUiSurface({
      embeddedPages: [
        {
          shell: "admin",
          route: "/admin/plugins/restricted-preview",
          component: RestrictedPreviewPage,
          permission: "plugins.review.read"
        },
        {
          shell: "admin",
          route: "/admin/settings",
          component: AdminSettingsPage,
          permission: "admin.settings.read"
        },
        {
          shell: "portal",
          route: "/portal/profile",
          component: PortalProfilePage,
          permission: "portal.profile.read"
        },
        {
          shell: "site",
          route: "/site/help",
          component: SiteHelpPage,
          permission: "site.help.read"
        }
      ],
      widgets: []
    })
  );

  return registerZone(registry, pageBuilderZone);
}

function createAdminRegistry(legacyRegistry: UiRegistry) {
  return composeAdminRegistry({
    base: {
      workspaces: [
        ...dashboardAdminContributions.workspaces,
        ...aiCoreAdminContributions.workspaces,
        ...pageBuilderAdminContributions.workspaces
      ],
      nav: [
        ...dashboardAdminContributions.nav,
        ...aiCoreAdminContributions.nav,
        ...aiRagAdminContributions.nav,
        ...aiEvalsAdminContributions.nav,
        ...pageBuilderAdminContributions.nav
      ],
      pages: [
        ...dashboardAdminContributions.pages,
        ...aiCoreAdminContributions.pages,
        ...aiRagAdminContributions.pages,
        ...aiEvalsAdminContributions.pages,
        ...pageBuilderAdminContributions.pages
      ],
      widgets: [
        ...dashboardAdminContributions.widgets,
        ...aiCoreAdminContributions.widgets,
        ...aiRagAdminContributions.widgets,
        ...aiEvalsAdminContributions.widgets
      ],
      reports: [
        ...dashboardAdminContributions.reports,
        ...aiCoreAdminContributions.reports,
        ...aiRagAdminContributions.reports,
        ...aiEvalsAdminContributions.reports
      ],
      commands: [
        ...dashboardAdminContributions.commands,
        ...aiCoreAdminContributions.commands,
        ...aiRagAdminContributions.commands,
        ...aiEvalsAdminContributions.commands,
        ...pageBuilderAdminContributions.commands
      ],
      searchProviders: [
        ...dashboardAdminContributions.searchProviders,
        ...aiCoreAdminContributions.searchProviders,
        ...aiRagAdminContributions.searchProviders,
        ...aiEvalsAdminContributions.searchProviders
      ],
      builders: [
        ...dashboardAdminContributions.builders,
        ...pageBuilderAdminContributions.builders
      ],
      zoneLaunchers: [...pageBuilderAdminContributions.zoneLaunchers]
    },
    legacyUiRegistry: legacyRegistry
  });
}

function normalizePathname(pathname: string): string {
  if (!pathname || pathname === "/") {
    return "/";
  }
  return pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
}

function inferShell(pathname: string): ShellKind {
  if (pathname === "/portal" || pathname.startsWith("/portal/")) {
    return "portal";
  }
  if (pathname === "/site" || pathname.startsWith("/site/")) {
    return "site";
  }
  return "admin";
}

function parseCookie(header: string | null, key: string): string | undefined {
  if (!header) {
    return undefined;
  }

  const values = header.split(";").map((entry) => entry.trim());
  for (const entry of values) {
    const [cookieKey, ...cookieValue] = entry.split("=");
    if (cookieKey === key) {
      return cookieValue.join("=");
    }
  }

  return undefined;
}

function resolveProfile(request: Request): ProfileName {
  const url = new URL(request.url);
  const requestedProfile = url.searchParams.get("profile");
  if (requestedProfile === "admin" || requestedProfile === "viewer" || requestedProfile === "support") {
    return requestedProfile;
  }

  const cookieProfile = parseCookie(request.headers.get("cookie"), "platform-profile");
  return cookieProfile === "viewer" || cookieProfile === "support" ? cookieProfile : "admin";
}

function buildRestrictedPreviewScenario(): RestrictedPreviewScenario {
  const unknownPlugin = definePackage({
    id: "unknown-marketplace-widget",
    kind: "feature-pack",
    version: "0.1.0",
    displayName: "Unknown Marketplace Widget",
    description: "Unsigned marketplace widget.",
    compatibility: {
      framework: "^0.1.0",
      runtime: "bun>=1.3.12",
      db: ["sqlite"]
    },
    trustTier: "unknown",
    isolationProfile: "sidecar",
    requestedHosts: ["api.example.com"],
    requestedCapabilities: ["data.export.dashboard", "ui.register.admin"]
  });

  const installReview = createInstallReviewPlan(unknownPlugin, {
    allowRestrictedPreview: true
  });
  const solved = solvePackageGraph({
    requested: [unknownPlugin.id],
    manifests: [unknownPlugin],
    platformVersion: "0.1.0",
    runtimeVersion: "1.3.12",
    dbEngine: "sqlite",
    allowRestrictedPreviewForUnknownPlugins: true
  });

  return {
    mode: installReview.mode,
    effectiveIsolation: installReview.effectiveManifest.isolationProfile,
    strippedCapabilities: [...installReview.strippedCapabilities],
    strippedHosts: [...installReview.strippedHosts],
    orderedActivation: [...solved.orderedActivation],
    warnings: [...solved.warnings],
    requiredApprovals: [...installReview.requiredApprovals]
  };
}

function featureLinksForProfile(providers: ShellProviderContract): Array<{ href: string; label: string }> {
  const links = [
    { href: "/admin", label: "Desk Home", permission: "dashboard.views.read" },
    { href: "/admin/overview/inbox", label: "Operations Inbox", permission: "dashboard.inbox.read" },
    { href: "/admin/reports/export-center", label: "Export Center", permission: "dashboard.exports.read" },
    { href: "/admin/workspace/ai", label: "AI Workspace", permission: "ai.runs.read" },
    { href: "/admin/ai/runs", label: "Agent Runs", permission: "ai.runs.read" },
    { href: "/admin/reports/ai-run-usage", label: "AI Usage Report", permission: "ai.reports.read" },
    { href: "/admin/tools/report-builder", label: "Report Builder", permission: "dashboard.builders.use" },
    { href: "/admin/tools/chart-studio", label: "Chart Studio", permission: "dashboard.builders.use" },
    { href: "/admin/tools/job-monitor", label: "Job Monitor", permission: "jobs.monitor.read" },
    { href: "/admin/tools/plugin-health", label: "Plugin Health", permission: "plugins.health.read" },
    { href: "/admin/tools/page-builder", label: "Page Builder", permission: "page-builder.use" },
    { href: "/apps/page-builder", label: "Page Builder Zone", permission: "page-builder.use" },
    { href: "/admin/plugins/restricted-preview", label: "Restricted Preview", permission: "plugins.review.read" },
    { href: "/admin/settings", label: "Admin Settings", permission: "admin.settings.read" },
    { href: "/portal/profile", label: "Portal Profile", permission: "portal.profile.read" },
    { href: "/site/help", label: "Site Help", permission: "site.help.read" }
  ];

  return links.filter((link) => providers.permissions.has(link.permission));
}

function preferenceScopeFor(providers: ShellProviderContract): AdminPreferenceScope {
  return {
    shellId: "admin-shell-workbench",
    tenantId: providers.session.tenantId,
    actorId: providers.session.actorId
  };
}

function recordAdminVisit(scope: AdminPreferenceScope, pathname: string): void {
  if (pathname === "/admin/ai/runs") {
    const existing = preferenceStore.load(scope).favorites.some((entry) => entry.href === pathname);
    if (!existing) {
      const favorite: AdminFavorite = {
        id: "ai.runs.page",
        label: "Agent Runs",
        href: pathname,
        kind: "page"
      };
      preferenceStore.toggleFavorite(scope, favorite);
    }
  }

  preferenceStore.remember(scope, {
    id: pathname,
    label: pathname === "/admin" ? "Desk Home" : pathname.split("/").filter(Boolean).at(-1) ?? pathname,
    href: pathname,
    kind: pathname.startsWith("/apps/") ? "zone" : pathname.startsWith("/admin/reports/") ? "report" : pathname.startsWith("/admin/tools/") ? "builder" : "page",
    at: new Date().toISOString()
  });
}

function resolveWorkbenchSkin(searchParams: URLSearchParams): WorkbenchSkin {
  const requested = searchParams.get("skin");
  if (requested === "slate" || requested === "sand") {
    return requested;
  }
  return "lagoon";
}

function resolveWorkbenchDensity(searchParams: URLSearchParams): "compact" | "comfortable" {
  return searchParams.get("density") === "comfortable" ? "comfortable" : "compact";
}

function buildWorkbenchHref(pathname: string, query: Record<string, string | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value) {
      params.set(key, value);
    }
  }
  const queryString = params.toString();
  return queryString ? `${pathname}?${queryString}` : pathname;
}

function themeForSkin(skin: WorkbenchSkin) {
  if (skin === "slate") {
    return {
      accent: "#1d4ed8",
      accentSoft: "rgba(29, 78, 216, 0.14)",
      sidebar: "#111827",
      sidebarAccent: "#1d4ed8",
      canvas: "#eef2ff",
      surface: "#ffffff",
      text: "#172033",
      muted: "#607086"
    };
  }

  if (skin === "sand") {
    return {
      accent: "#b45309",
      accentSoft: "rgba(180, 83, 9, 0.15)",
      sidebar: "#292524",
      sidebarAccent: "#b45309",
      canvas: "#f7f3ed",
      surface: "#fffdf8",
      text: "#231815",
      muted: "#786b61"
    };
  }

  return {
    accent: "#0f766e",
    accentSoft: "rgba(15, 118, 110, 0.15)",
    sidebar: "#1e293b",
    sidebarAccent: "#0f766e",
    canvas: "#eef2f7",
    surface: "#ffffff",
    text: "#172033",
    muted: "#607086"
  };
}

function createWorkbenchCustomization(input: {
  profile: ProfileName;
  providers: ShellProviderContract;
  pathname: string;
  searchParams: URLSearchParams;
}) {
  const featureLinks = featureLinksForProfile(input.providers);
  const utilityLinks = featureLinks.filter((link) => link.href.startsWith("/admin/"));
  const helpItems = featureLinks.filter((link) => link.href.startsWith("/portal/") || link.href.startsWith("/site/"));
  const skin = resolveWorkbenchSkin(input.searchParams);
  const density = resolveWorkbenchDensity(input.searchParams);
  const stickyQuery = {
    profile: input.profile,
    skin,
    density
  };

  return {
    brandTitle: "Admin Shell Workbench",
    brandSubtitle: "Configurable operational desk with governed pages, reports, builders, and product launches.",
    density,
    theme: themeForSkin(skin),
    tenantOptions: [
      {
        id: "tenant-platform",
        label: "Platform",
        active: true
      },
      {
        id: "tenant-preview",
        label: "Preview",
        href: buildWorkbenchHref("/admin", {
          ...stickyQuery,
          profile: "viewer"
        })
      }
    ],
    userMenuItems: [
      {
        id: "profile",
        label: input.profile === "support" ? "Support profile" : "Operator profile",
        href: buildWorkbenchHref("/portal/profile", {
          profile: input.profile
        })
      }
    ],
    utilityLinks: utilityLinks.map((link) => ({
      id: link.href,
      label: link.label,
      href: buildWorkbenchHref(link.href, stickyQuery)
    })),
    helpItems: helpItems.map((link) => ({
      id: link.href,
      label: link.label,
      href: buildWorkbenchHref(link.href, {
        profile: input.profile
      })
    })),
    notificationItems: [
      {
        id: "exports",
        title: "Export center",
        detail: "Two exports are processing with audit-backed delivery.",
        tone: "default" as const
      },
      {
        id: "approvals",
        title: "Plugin approvals",
        detail: "One restricted preview review still needs admin acknowledgement.",
        tone: input.providers.permissions.has("plugins.review.read") ? ("warning" as const) : ("default" as const)
      }
    ],
    appearancePresets: [
      {
        id: "lagoon",
        label: "Lagoon",
        href: buildWorkbenchHref(input.pathname, {
          ...stickyQuery,
          skin: "lagoon",
          density: "compact"
        }),
        active: skin === "lagoon"
      },
      {
        id: "slate",
        label: "Slate",
        href: buildWorkbenchHref(input.pathname, {
          ...stickyQuery,
          skin: "slate",
          density: "comfortable"
        }),
        active: skin === "slate"
      },
      {
        id: "sand",
        label: "Sand",
        href: buildWorkbenchHref(input.pathname, {
          ...stickyQuery,
          skin: "sand",
          density: "compact"
        }),
        active: skin === "sand"
      }
    ],
    shortcutHints: [
      {
        id: "command",
        label: "Command palette",
        keys: "Cmd+K"
      },
      {
        id: "search",
        label: "Global search",
        keys: "/"
      },
      {
        id: "refresh",
        label: "Refresh current surface",
        keys: "R"
      }
    ]
  };
}

async function renderAdminDocument(input: {
  request: Request;
  profile: ProfileName;
  registry: UiRegistry;
  providers: ShellProviderContract;
}): Promise<Response> {
  const url = new URL(input.request.url);
  const fullAdminRegistry = createAdminRegistry(input.registry);
  const scope = preferenceScopeFor(input.providers);
  const preferences = preferenceStore.invalidateMissing(scope, fullAdminRegistry);
  const path = normalizePathname(url.pathname);
  const requestedZoneState = url.searchParams.get("zoneState");
  const zoneAvailability: Record<string, boolean> = {};
  if (requestedZoneState === "degraded") {
    zoneAvailability["page-builder-zone"] = false;
  } else if (requestedZoneState === "healthy") {
    zoneAvailability["page-builder-zone"] = true;
  }
  const resolved = resolveAdminDeskRoute({
    pathname: path,
    registry: fullAdminRegistry,
    providers: input.providers,
    zoneAvailability
  });

  if (resolved.status === 200) {
    recordAdminVisit(scope, path);
  }

  input.providers.audit.record({
    type: "desk.viewed",
    shell: "admin",
    route: path,
    tenantId: input.providers.session.tenantId,
    actorId: input.providers.session.actorId,
    details: {
      status: resolved.status,
      kind: resolved.kind
    }
  });
  input.providers.telemetry.track({
    name: "desk.viewed",
    shell: "admin",
    route: path,
    namespace: `desk.${resolved.kind}`,
    dimensions: {
      profile: input.profile,
      status: resolved.status
    }
  });

  const searchQuery = url.searchParams.get("search") ?? undefined;
  const search = await searchAdminRegistry({
    registry: fullAdminRegistry,
    providers: input.providers,
    query: searchQuery ?? ""
  });

  const headers = new Headers({
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store"
  });
  if (url.searchParams.has("profile")) {
    headers.append("set-cookie", `platform-profile=${input.profile}; Path=/; SameSite=Lax`);
  }

  return new Response(
    `<!DOCTYPE html>${renderToStaticMarkup(
      <html lang="en">
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>Platform Dev Console Admin Desk</title>
        </head>
        <body
          data-shell="admin"
          data-profile={input.profile}
          data-session-id={input.providers.session.sessionId}
          data-tenant-id={input.providers.session.tenantId}
          data-actor-id={input.providers.session.actorId}
        >
          <AdminWorkbenchShell
            registry={fullAdminRegistry}
            providers={input.providers}
            pathname={path}
            queryState={Object.fromEntries(url.searchParams.entries())}
            preferences={preferences}
            searchQuery={searchQuery}
            searchResults={search.results}
            searchErrors={search.errors}
            zoneAvailability={zoneAvailability}
            environmentLabel="dev-console"
            customization={createWorkbenchCustomization({
              profile: input.profile,
              providers: input.providers,
              pathname: path,
              searchParams: url.searchParams
            })}
          />
        </body>
      </html>
    )}`,
    {
      status: resolved.status,
      headers
    }
  );
}

function renderPortalOrSiteDocument(input: {
  shell: "portal" | "site";
  profile: ProfileName;
  pathname: string;
  providers: ShellProviderContract;
  registry: UiRegistry;
}): Response {
  const shellFrame =
    input.shell === "portal" ? (
      <PortalShell registry={input.registry} providers={input.providers}>
        <section aria-label="portal-shell">
          <p data-testid="profile">Profile: {input.profile}</p>
          <p data-testid="session-id">Session: {input.providers.session.sessionId}</p>
          <p>Portal profile and support entrypoint.</p>
        </section>
      </PortalShell>
    ) : (
      <SiteShell registry={input.registry} providers={input.providers}>
        <section aria-label="site-shell">
          <p data-testid="profile">Profile: {input.profile}</p>
          <p data-testid="session-id">Session: {input.providers.session.sessionId}</p>
          <p>Site help and public support content.</p>
        </section>
      </SiteShell>
    );

  return new Response(
    `<!DOCTYPE html>${renderToStaticMarkup(
      <html lang="en">
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>Platform Dev Console</title>
        </head>
        <body
          data-shell={input.shell}
          data-profile={input.profile}
          data-session-id={input.providers.session.sessionId}
          data-tenant-id={input.providers.session.tenantId}
          data-actor-id={input.providers.session.actorId}
        >
          {shellFrame}
        </body>
      </html>
    )}`,
    {
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store"
      }
    }
  );
}

export async function renderShellHarnessResponse(
  request: Request,
  registry: UiRegistry = createShellHarnessRegistry()
): Promise<Response> {
  const profile = resolveProfile(request);
  const providers = createShellProviders({
    registry,
    session: profileSessions[profile],
    grantedPermissions: [...profilePermissions[profile]]
  });
  const pathname = normalizePathname(new URL(request.url).pathname);
  const shell = inferShell(pathname);

  if (shell === "portal" || shell === "site") {
    return renderPortalOrSiteDocument({
      shell,
      profile,
      pathname,
      providers,
      registry
    });
  }

  return renderAdminDocument({
    request,
    profile,
    registry,
    providers
  });
}

function RestrictedPreviewPage() {
  const scenario = buildRestrictedPreviewScenario();
  return (
    <section data-plugin-page="restricted-preview" data-testid="restricted-preview" className="awb-surface-stack">
      <div className="awb-inline-banner">
        <strong>Unknown Plugin Restricted Preview</strong>
        <span>Unsigned packages stay stripped, isolated, and reviewable before they can enter the trusted graph.</span>
      </div>
      <p data-testid="restricted-preview-mode">Mode: {scenario.mode}</p>
      <p data-testid="restricted-preview-isolation">Effective isolation: {scenario.effectiveIsolation}</p>
      <p data-testid="restricted-preview-capabilities">
        Stripped capabilities: {scenario.strippedCapabilities.join(", ") || "none"}
      </p>
      <p data-testid="restricted-preview-hosts">
        Stripped hosts: {scenario.strippedHosts.join(", ") || "none"}
      </p>
      <p data-testid="restricted-preview-activation">
        Activation order: {scenario.orderedActivation.join(" -> ")}
      </p>
      <p data-testid="restricted-preview-approvals">
        Required approvals: {scenario.requiredApprovals.join(", ") || "none"}
      </p>
      <ul data-testid="restricted-preview-warnings" className="awb-check-list">
        {scenario.warnings.map((warning) => (
          <li key={warning}>{warning}</li>
        ))}
      </ul>
    </section>
  );
}

function AdminSettingsPage() {
  return (
    <section data-plugin-page="admin-settings" data-testid="admin-settings" className="awb-surface-stack">
      <div className="awb-inline-banner">
        <strong>Admin Settings</strong>
        <span>Tenant branding, audit sinks, shell preferences, and governed admin policies.</span>
      </div>
      <div className="awb-inline-grid awb-inline-grid-2">
        <div className="awb-form-card">
          <h3 className="awb-panel-title">Tenant shell controls</h3>
          <ul className="awb-check-list">
            <li>Brand tokens and accent palettes</li>
            <li>Workspace defaults and saved-view policies</li>
            <li>Notification routing and export center retention</li>
          </ul>
          <div className="awb-inline-grid awb-inline-grid-3">
            <a className="awb-pill is-accent" href="/admin/settings?skin=lagoon&density=compact">
              Lagoon
            </a>
            <a className="awb-pill" href="/admin/settings?skin=slate&density=comfortable">
              Slate
            </a>
            <a className="awb-pill" href="/admin/settings?skin=sand&density=compact">
              Sand
            </a>
          </div>
        </div>
        <div className="awb-form-card">
          <h3 className="awb-panel-title">Governance</h3>
          <ul className="awb-check-list">
            <li>Admin approvals and restricted preview rules</li>
            <li>Audit sink registration and retention policies</li>
            <li>Permission-aware shell utilities</li>
            <li>Keyboard shortcuts and right-rail help remain shell-owned</li>
          </ul>
        </div>
      </div>
    </section>
  );
}

function PortalProfilePage() {
  return (
    <section data-plugin-page="portal-profile">
      <h2>Portal Profile</h2>
      <p>Customer-facing account surface using the shared session contract.</p>
    </section>
  );
}

function SiteHelpPage() {
  return (
    <section data-plugin-page="site-help">
      <h2>Site Help</h2>
      <p>Public help, knowledge, and support routing surface.</p>
    </section>
  );
}

export function startShellHarnessServer(registry: UiRegistry = createShellHarnessRegistry()) {
  const server = Bun.serve({
    port: 0,
    async fetch(request) {
      return renderShellHarnessResponse(request, registry);
    }
  });

  return {
    port: server.port,
    url: `http://127.0.0.1:${server.port}`,
    stop() {
      void server.stop(true);
    }
  };
}
