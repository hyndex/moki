# @gutu/admin-shell-bridge

Surfaces `@platform/admin-contracts` contributions inside `@gutu/admin-shell-next`. Zero changes required in existing plugins — you call the adapter in your AdminRoot host, and your legacy plugins render in the new shell.

## Why this exists

The Gutu ecosystem today has two coexisting admin APIs:

- **`@platform/admin-contracts`** — 55+ plugins already ship against it (`defineAdminNav`, `definePage`, `defineCommand`, `defineWorkspace`).
- **`@gutu/admin-shell-next`** — schema-driven API introduced for richer list/form/detail rendering, realtime invalidation, saved views, widgets, multi-tenancy.

This bridge lets both live in one shell. Plugin authors migrate only when there's a concrete upside for their domain.

## Usage

```tsx
import { AdminRoot, AuthGuard } from "@gutu/admin-shell-next/host";
import { adoptLegacyContributions } from "@gutu/admin-shell-bridge";
import { adminContributions as crmLegacy } from "gutu-plugin-crm-core";
import { nativePlugins } from "./my-native-plugins";

const plugins = [
  ...nativePlugins,
  adoptLegacyContributions(crmLegacy, {
    sourceId: "crm-core",
    plugin: { id: "gutu-plugin-crm-core", label: "CRM Core", version: "1.4.0", icon: "Users" },
  }),
];

export default function App() {
  return (
    <AuthGuard>
      <AdminRoot plugins={plugins} />
    </AuthGuard>
  );
}
```

## What the adapter does

| Legacy shape | Next shape |
|---|---|
| `WorkspaceContribution` | `NavSection` + optional landing `NavItem` |
| `AdminNavContribution` | Flattened `NavItem[]` with `section = "legacy.<workspace>"` |
| `PageContribution` (has `component`) | `CustomView` + `NavItem` |
| `PageContribution` (no component, only `listViewId`) | Skipped with a console warning |
| `CommandContribution` | `CommandDescriptor` with `run` invoking `navigate` or the original `run` |
| `ReportContribution` (has `component`) | `CustomView` at the report route |
| `BuilderContribution` (has `component`) | `CustomView` at the builder route |
| `ZoneLaunchContribution` | `NavItem` as a plain deep-link |
| `WidgetContribution` | Pass-through on `plugin.admin.widgets` (shell consumer decides) |

## Options

```ts
adoptLegacyContributions(registry, {
  sourceId: "crm-core",                          // used in synthesized ids
  permissions: {                                 // optional gating
    has: (perm) => actor.permissions.includes(perm),
  },
  wrap: (Component, ctx) => <Boundary>           // optional wrapper
    <PageShell title={ctx.label}>
      <Component />
    </PageShell>
  </Boundary>,
  plugin: {                                      // optional plugin metadata
    id: "gutu-plugin-crm-core",
    label: "CRM Core",
    version: "1.4.0",
    icon: "Users",
    description: "Pre-sales pipeline & forecasting.",
  },
});
```

## Caveats

1. **`listViewId` / `formViewId` / `detailViewId` indirection is not auto-resolved.** The legacy registry allows a page to reference view-ids registered elsewhere; the bridge can't synthesize a view it does not have. In practice all real plugins supply `component`.
2. **Widgets pass through as raw shapes.** `@gutu/admin-shell-next` has its own widget descriptors; integrating legacy widgets into the new dashboard workspace requires a second-level mapping per widget kind. The bridge surfaces them as opaque items on `plugin.admin.widgets` so the application shell can decide how to render them (or ignore them, preserving legacy behaviour).
3. **Permission denials filter at adapter time, not render time.** Callers can still change the permission set dynamically by re-invoking `adoptLegacyContributions()` and re-mounting. Realtime permission changes should re-invoke.
4. **Legacy workspace homePath vs nav contributions.** If both are present, both nav entries are emitted; the landing sits at `order: 0`, nav items follow. Duplicate ids are de-duplicated.

## Migrating off the bridge (opt-in, per plugin)

Once a plugin is ready for the next-gen API, its author replaces `adminContributions` with a native `Plugin`:

```ts
// Before (legacy)
export const adminContributions: AdminContributionRegistry = {
  workspaces: [defineWorkspace({ id: "crm", label: "CRM", permission: "crm.leads.read", homePath: "/admin/business/crm" })],
  nav: [defineAdminNav({ workspace: "crm", group: "control-room", items: [/* ... */] })],
  pages: [definePage({ id: "crm-core.page", kind: "dashboard", route: "/admin/business/crm", label: "CRM Control Room", workspace: "crm", permission: "crm.leads.read", component: BusinessAdminPage })],
  commands: [defineCommand({ id: "crm-core.open.control-room", label: "Open CRM Core", href: "/admin/business/crm", permission: "crm.leads.read" })],
};

// After (next-gen)
export const crmPlugin = definePlugin({
  id: "crm-core",
  label: "CRM Core",
  icon: "Users",
  version: "2.0.0",
  admin: {
    navSections: [{ id: "crm", label: "CRM", order: 30 }],
    nav: [{ id: "crm.overview", label: "Control Room", icon: "Users", path: "/admin/business/crm", view: "crm.overview.view", section: "crm" }],
    resources: [defineResource({ id: "crm.contact", schema: ContactSchema, fields: [/* ... */] })],
    views: [
      defineCustomView({ id: "crm.overview.view", title: "CRM Control Room", resource: "crm.contact", render: () => <BusinessAdminPage /> }),
      defineListView({ id: "crm.contacts.list", resource: "crm.contact", columns: [/* ... */], filters: [/* ... */] }),
      // ...
    ],
    commands: [defineCommand({ id: "crm.open", label: "Open CRM", run: ({ runtime }) => runtime.navigate("/admin/business/crm") })],
  },
});
```

You can migrate page-by-page — leave some legacy contributions in place while adding native ones. Both coexist in the same plugin if you keep both exports.

## Tests

```
bun test
```

Covers: workspace conversion, nav flattening, page→view conversion with component, page skip without component, command conversion + navigate, permission filtering, partial registries, metadata flow, custom `wrap()`, id deduplication, multi-registry aggregation.
