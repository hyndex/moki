/** Admin-tools plugin — composes admin-shell UI from contributing plugins.
 *
 *  This file is a generic loader: it imports each plugin's
 *  `adminUi: AdminUiContribution` from `@gutu-plugin-ui/<code>` and
 *  composes the resulting nav entries / pages / commands.
 *
 *  Adding a new plugin's settings page:
 *    1. drop a host-plugin/ui/index.ts in the plugin
 *    2. add one line to the PLUGINS list below
 *    3. register the alias in `tsconfig.json` + `vite.config.ts`
 *
 *  No further changes to the shell. Every legacy page (webhooks, API
 *  tokens, workflows) has been migrated to its own plugin. */

import * as React from "react";
import { z } from "zod";
import { defineCustomView, defineResource } from "@/builders";
import { definePlugin } from "@/contracts/plugin-v2";
import { PluginBoundary } from "@/host/PluginBoundary";
import { PluginsSettingsPage } from "@/admin-primitives/PluginsSettingsPage";
import type {
  AdminUiContribution,
  PluginNavEntry,
  PluginCommand,
  PluginPageDescriptor,
} from "@/host/plugin-ui-contract";
import {
  loadPluginUi,
  installPluginUiIfNeeded,
  startPluginUi,
} from "@/host/plugin-ui-loader";
import { archetypesCatalogView } from "./archetypes-catalog";
import { archetypeEventsView } from "./archetype-events";
import { fieldKindsCatalogView } from "./field-kinds-catalog";
import { mcpAgentsView, mcpAgentsNavItem } from "./mcp-agents-page";

// Decentralized discovery: Vite's `import.meta.glob` (eager) walks
// every `host-plugin/ui/index.ts` under `plugins/gutu-plugin-*` at
// build time and inlines them. Add a UI plugin → drop the folder →
// `bun add @acme/gutu-foo` → restart. No edits to this file.
//
// Build-time discovery is correct for SPA bundling (Vite must see the
// import to tree-shake + chunk). For runtime hot-add, we'd need
// dynamic ESM (deferred) — out of scope for v1.
const PLUGIN_MODULES = import.meta.glob<{ adminUi?: AdminUiContribution }>(
  "../../../../plugins/gutu-plugin-*/framework/builtin-plugins/*/src/host-plugin/ui/index.ts",
  { eager: true },
);

const ALL_PLUGINS: AdminUiContribution[] = Object.entries(PLUGIN_MODULES)
  .map(([file, mod]) => {
    if (!mod || !mod.adminUi) {
      console.warn(`[admin-tools] plugin file ${file} has no adminUi export — skipping`);
      return null;
    }
    return mod.adminUi;
  })
  .filter((x): x is AdminUiContribution => x !== null);

console.log(
  `[admin-tools] discovered ${ALL_PLUGINS.length} UI plugin(s):`,
  ALL_PLUGINS.map((p) => p.id).join(", "),
);

// Run the loader: install (one-shot per browser) + start (every mount).
// Quarantined plugins are skipped — their pages won't be registered, but
// the rest of the shell keeps working. Status is exposed via the loader
// so a /_plugins UI can surface it next to the backend records.
const PLUGINS = loadPluginUi(ALL_PLUGINS);
void installPluginUiIfNeeded(PLUGINS);
void startPluginUi(PLUGINS);

/* -- Resolve plugin contributions into a flat shape ----------------------- */

interface ResolvedAdminUi {
  navSections: ReadonlyArray<{ id: string; label: string; order: number }>;
  navEntries: ReadonlyArray<PluginNavEntry>;
  commands: ReadonlyArray<PluginCommand>;
  views: ReadonlyArray<{
    id: string;
    title: string;
    description?: string;
    resourceId: string;
    Component: React.ComponentType;
    /** Page archetype, propagated from the plugin descriptor. */
    archetype?: PluginPageDescriptor["archetype"];
    /** Skip max-width wrapper. */
    fullBleed?: boolean;
    /** Page default density. */
    density?: PluginPageDescriptor["density"];
    /** Permissions requirement, propagated from the descriptor. */
    permissions?: PluginPageDescriptor["permissions"];
  }>;
  resources: ReadonlyArray<{ id: string; singular: string; plural: string; icon?: string }>;
}

type ResolvedView = ResolvedAdminUi["views"][number];
type ResolvedResource = { id: string; singular: string; plural: string; icon?: string };

function resolve(plugins: readonly AdminUiContribution[]): ResolvedAdminUi {
  const navEntries: PluginNavEntry[] = [];
  const commands: PluginCommand[] = [];
  const views: ResolvedView[] = [];
  const resources: ResolvedResource[] = [];
  for (const ui of plugins) {
    for (const e of ui.navEntries ?? []) navEntries.push(e);
    for (const c of ui.commands ?? []) commands.push(c);
    for (const p of ui.pages ?? []) {
      // Wrap each page Component in a PluginBoundary so a buggy
      // plugin's render error doesn't break the shell — the user
      // sees a "Plugin failed" tile with a Retry button instead.
      const Wrapped: React.ComponentType = () => (
        <PluginBoundary pluginId={ui.id} label={p.title}>
          <p.Component />
        </PluginBoundary>
      );
      Wrapped.displayName = `PluginBoundary(${ui.id}/${p.id})`;
      views.push({
        id: pageViewId(p),
        title: p.title,
        description: p.description,
        resourceId: pageResourceId(p),
        Component: Wrapped,
        archetype: p.archetype,
        fullBleed: p.fullBleed,
        density: p.density,
        permissions: p.permissions,
      });
      resources.push({
        id: pageResourceId(p),
        singular: p.title,
        plural: p.title,
        icon: p.icon,
      });
    }
  }
  navEntries.sort(
    (a, b) =>
      (a.order ?? 999) - (b.order ?? 999) ||
      a.label.localeCompare(b.label),
  );
  return {
    navSections: [{ id: "settings", label: "Settings", order: 200 }],
    navEntries,
    commands,
    views,
    resources,
  };
}

function pageViewId(p: PluginPageDescriptor): string {
  return `admin-tools.${p.id}.view`;
}

function pageResourceId(p: PluginPageDescriptor): string {
  return `plugin-ui.${p.id}`;
}

const resolved = resolve(PLUGINS);

/* -- Wrap each plugin-contributed page as a defineCustomView -------------- */

const pluginResources = resolved.resources.map((r) =>
  defineResource({
    id: r.id,
    singular: r.singular,
    plural: r.plural,
    schema: z.object({ id: z.string() }).passthrough(),
    displayField: "id",
    icon: r.icon,
  }),
);

const pluginViews = resolved.views.map((v) =>
  defineCustomView({
    id: v.id,
    title: v.title,
    description: v.description,
    resource: v.resourceId,
    render: () => <v.Component />,
    archetype: v.archetype,
    fullBleed: v.fullBleed,
    density: v.density,
    permissions: v.permissions,
  }),
);

// Built-in operator console for plugins. Lives in the shell because
// it's about plugins themselves — not a plugin-contributed page.
const pluginsConsoleResource = defineResource({
  id: "platform.plugins-console",
  singular: "Plugin",
  plural: "Plugins",
  schema: z.object({ id: z.string() }).passthrough(),
  displayField: "id",
  icon: "Boxes",
});

const archetypesCatalogResource = defineResource({
  id: "platform.archetypes-catalog",
  singular: "Archetype",
  plural: "Archetypes",
  schema: z.object({ id: z.string() }).passthrough(),
  displayField: "id",
  icon: "Layout",
});

const pluginsConsoleView = defineCustomView({
  id: "admin-tools.plugins-console.view",
  title: "Plugins",
  description:
    "Loaded plugins, manifests, status, per-tenant enablement, quarantine errors.",
  resource: pluginsConsoleResource.id,
  render: () => (
    <PluginBoundary pluginId="admin-tools" label="Plugins console">
      <PluginsSettingsPage />
    </PluginBoundary>
  ),
});

/* -- Build nav entries from plugin contributions only --------------------- */

const adminToolsNav = resolved.navEntries.map((e) => {
  const matchingPage = PLUGINS.flatMap((p) => [...(p.pages ?? [])]).find((p) => p.path === e.path);
  const viewId = matchingPage ? `admin-tools.${matchingPage.id}.view` : undefined;
  return {
    id: e.id,
    label: e.label,
    icon: e.icon ?? "Settings",
    path: e.path,
    view: viewId ?? "",
    section: e.section ?? "settings",
    order: e.order ?? 100,
  };
});

const adminToolsCommands = [
  ...resolved.commands.map((c) => ({
    id: c.id,
    label: c.label,
    icon: c.icon ?? "Settings",
    keywords: c.keywords ?? [],
    run: c.run,
  })),
  {
    id: "admin-tools.cmd.plugins-console",
    label: "Open Plugins console",
    icon: "Boxes",
    keywords: ["plugin", "plugins", "manifest", "enablement", "quarantine"],
    run: () => { window.location.hash = "/settings/plugins"; },
  },
];

// Built-in nav entry for the operator console (always present).
const builtInNav = [
  {
    id: "admin-tools.nav.plugins-console",
    label: "Plugins",
    icon: "Boxes",
    path: "/settings/plugins",
    view: "admin-tools.plugins-console.view",
    section: "settings",
    order: 5,
  },
  {
    id: "admin-tools.nav.archetypes-catalog",
    label: "Archetypes catalog",
    icon: "Layout",
    path: "/settings/archetypes",
    view: "admin-tools.archetypes-catalog.view",
    section: "settings",
    order: 6,
  },
  {
    id: "admin-tools.nav.archetype-events",
    label: "Archetype events",
    icon: "Activity",
    path: "/settings/archetype-events",
    view: "admin-tools.archetype-events.view",
    section: "settings",
    order: 7,
  },
  {
    id: "admin-tools.nav.field-kinds",
    label: "Field kinds",
    icon: "Sparkles",
    path: "/settings/field-kinds",
    view: "tools.field-kinds-catalog.view",
    section: "settings",
    order: 8,
  },
  mcpAgentsNavItem,
];

/* -- The plugin surface itself ------------------------------------------- */

export const adminToolsPlugin = definePlugin({
  manifest: {
    id: "admin-tools",
    version: "0.3.0",
    label: "Admin Tools",
    description:
      "Composes Settings-side admin UI entirely from contributing plugins. The shell ships zero hardcoded admin pages.",
    icon: "Settings",
    requires: {
      shell: "*",
      capabilities: ["nav", "commands", "fetch:external", "resources:read"],
    },
    activationEvents: [{ kind: "onStart" }],
    origin: { kind: "explicit" },
  },
  async activate(ctx) {
    ctx.contribute.navSections([{ id: "settings", label: "Settings", order: 200 }]);
    ctx.contribute.nav([...builtInNav, ...adminToolsNav]);
    ctx.contribute.resources([pluginsConsoleResource, archetypesCatalogResource, ...pluginResources]);
    ctx.contribute.views([pluginsConsoleView, archetypesCatalogView, archetypeEventsView, fieldKindsCatalogView, mcpAgentsView, ...pluginViews]);
    if (adminToolsCommands.length > 0) ctx.contribute.commands(adminToolsCommands);
  },
});
