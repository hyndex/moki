# Plugin-host contract

After the migration in this session every domain primitive (GL, sales, stock,
HRMS, FX, regional, …) lives in **its own plugin under `plugins/gutu-plugin-*`**.
The shell at `admin-panel/backend` is now a small plugin host: it owns
cross-cutting concerns (`records`, `users`, `sessions`, `audit_events`, `meta`,
ACL, saved-views, workflow engine, webhooks, API tokens, field-metadata,
i18n, awesome-bar, ERP-actions infrastructure, generic resource CRUD) and
mounts every plugin's contributions at boot.

## What changed (file-level)

```
admin-panel/backend/src/
├── host/                    ← NEW: plugin SDK
│   ├── index.ts             ← @gutu-host: db, nowIso, uuid, recordAudit,
│   │                          getTenantContext, requireAuth, currentUser,
│   │                          Hono, Context
│   ├── field-metadata.ts    ← @gutu-host/field-metadata
│   ├── acl.ts               ← @gutu-host/acl
│   ├── event-bus.ts         ← @gutu-host/event-bus
│   └── plugin-contract.ts   ← HostPlugin type + topo sort + migrate/mount/start/stop
├── lib/                     ← shell-only: id, audit, acl, auth, totp,
│                              event-bus, field-metadata, i18n, awesome-bar,
│                              ws, yjs-room, query, timeline, workflow, …
├── routes/                  ← shell-only: auth, resources, audit, files,
│                              tenants, search, webhooks, api-tokens,
│                              field-metadata, i18n, awesome-search,
│                              connections, timeline, record-links, favorites,
│                              erp-actions, …
├── server.ts                ← only mounts shell routes; plugin routes are
│                              mounted by main.ts after createApp()
├── main.ts                  ← imports every plugin's hostPlugin and runs
│                              runPluginMigrations → mountPluginRoutes →
│                              startPlugins; SIGTERM/SIGINT calls stopPlugins
└── migrations.ts            ← shell-owned tables only (records, users,
                               sessions, audit_events, meta, ACL, saved_views,
                               workflows, webhooks, api_tokens, field_metadata,
                               record_links, timeline_events, user_favorites,
                               connected_accounts, erp_document_mappings,
                               erp_posting_batches, erp_posting_entries,
                               erp_portal_links, i18n_strings, roles,
                               user_roles)

plugins/gutu-plugin-<code>/framework/builtin-plugins/<folder>/src/
├── (existing plugin files: model.ts, services/, actions/, resources/,
│   jobs/catalog.ts, workflows/catalog.ts, ui/, …)
└── host-plugin/             ← NEW: plugin's contribution to the host
    ├── index.ts             ← exports `hostPlugin: HostPlugin`
    ├── lib/                 ← domain implementation files
    │   ├── <name>.ts
    │   └── index.ts         ← barrel re-exporter
    ├── routes/              ← Hono routers
    │   └── <name>.ts
    └── db/migrate.ts        ← plugin-owned CREATE TABLE statements
```

## The HostPlugin contract

```ts
import type { Hono } from "hono";

export interface HostPlugin {
  /** Stable id, e.g. "accounting-core". */
  id: string;
  /** Semantic-ish version. */
  version: string;
  /** Plugins whose `migrate()` must run before this one. */
  dependsOn?: string[];
  /** Apply this plugin's schema. Idempotent across boots. */
  migrate?: () => void | Promise<void>;
  /** HTTP routes mounted at `/api/<mountPath>`. */
  routes?: Array<{ mountPath: string; router: Hono }>;
  /** Called once after migrations + mounts, before HTTP listens. */
  start?: () => void | Promise<void>;
  /** Called on SIGTERM/SIGINT, in reverse load order. */
  stop?: () => void | Promise<void>;
}
```

The shell's `host/plugin-contract.ts` exports four helpers that operate on a
list of plugins:

- `runPluginMigrations(plugins)` — topologically sort and call `migrate()` on
  each, recording the version into the `meta` table for each successful run.
- `mountPluginRoutes(plugins, app)` — for each plugin, mount its routers
  under `/api/<mountPath>`.
- `startPlugins(plugins)` — fire `start()` hooks in topological order; an
  exception aborts boot.
- `stopPlugins(plugins)` — fire `stop()` hooks in reverse topological order;
  exceptions in one plugin's stop don't block subsequent plugins from
  shutting down.

## How the shell loads plugins

`admin-panel/backend/src/main.ts`:

```ts
import { hostPlugin as accountingCore } from "@gutu-plugin/accounting-core";
import { hostPlugin as salesCore } from "@gutu-plugin/sales-core";
// … all 13 plugins

const HOST_PLUGINS = [
  templateCore,        // base — naming series, print, templates
  notificationsCore,   // base — rules, dispatcher, scheduler
  pricingTaxCore,      // base — tax templates, pricing rules
  accountingCore,      // depended on by sales/treasury/hr/invoicing/analytics
  inventoryCore,
  manufacturingCore,
  salesCore,
  treasuryCore,
  hrPayrollCore,
  eInvoicingCore,
  formsCore,
  integrationCore,
  analyticsBiCore,
];

await runPluginMigrations(HOST_PLUGINS);
const app = createApp();
mountPluginRoutes(HOST_PLUGINS, app);
startWorkflowEngine();
await startPlugins(HOST_PLUGINS);

const shutdown = async (sig: string) => {
  console.log(`[gutu-backend] received ${sig}, shutting down`);
  await stopPlugins(HOST_PLUGINS);
  process.exit(0);
};
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
```

## tsconfig path mapping

Bun resolves `@gutu-host` and `@gutu-plugin/*` aliases via tsconfig paths.
The aliases are configured in three places so resolution works wherever the
source file lives:

- `admin-panel/backend/tsconfig.json` — for shell tests and the main entry.
- `plugins/gutu-plugin-*/tsconfig.base.json` — extended by every per-plugin
  tsconfig.
- `plugins/gutu-plugin-*/framework/builtin-plugins/*/tsconfig.json` — the
  per-plugin tsconfig also lists the same paths so Bun picks them up
  regardless of which tsconfig is closest to the source file.

## What each plugin owns (post-migration)

| Plugin | Lib files | Routes mounted at | Tables |
|---|---|---|---|
| `accounting-core` | `gl-ledger` | `/api/gl/*` | gl_accounts, gl_periods, gl_journals, gl_entries |
| `sales-core` | `sales-invoice` | `/api/sales-invoices/*` | sales_invoices, sales_invoice_items |
| `inventory-core` | `stock-ledger`, `fulfillment` | `/api/stock/*`, `/api/fulfillment/*` | warehouses, stock_items, stock_ledger_entries, stock_fifo_layers, stock_bins, stock_reservations, pick_lists, pick_list_items, shipments, shipment_lines |
| `manufacturing-core` | `bom` | `/api/manufacturing/*` | boms, bom_lines |
| `pricing-tax-core` | `pricing-rules` | `/api/pricing-rules/*` | pricing_rules, tax_templates, tax_template_components |
| `treasury-core` | `bank-reconciliation` | `/api/bank-reconciliation/*` | bank_statements, bank_statement_lines |
| `e-invoicing-core` | `fx-intercompany` (FX + intercompany + regional packs) | `/api/fx-intercompany/*` | fx_rates, intercompany_mappings, regional_packs |
| `hr-payroll-core` | `hrms` | `/api/hrms/*` | hr_employees, hr_attendance, hr_leave_types, hr_leave_entries, hr_payroll_runs, hr_payroll_lines |
| `notifications-core` | `notification-rules`, `notification-dispatcher`, `notification-scheduler` | `/api/notification-rules/*` | notification_rules, notification_deliveries; **start hook**: dispatcher + scheduler workers |
| `template-core` | `naming-series`, `print-format`, `print-pdf`, `template-engine` | `/api/naming-series/*`, `/api/print-formats/*`, `/api/print/*` | naming_series, naming_series_counters, print_formats, letter_heads |
| `forms-core` | `property-setters`, `web-forms` | `/api/property-setters/*`, `/api/web-forms/*` | property_setters, web_forms, web_form_submissions |
| `integration-core` | `bulk-import` | `/api/bulk-import/*` | bulk_import_jobs (lazy) |
| `analytics-bi-core` | `auto-email-reports` | `/api/auto-email-reports/*` | auto_email_reports; **start hook**: auto-email scheduler worker |

## What stays in the shell

The shell still owns concerns that can't sensibly belong to a single plugin:

- **Records table** — generic CRUD substrate every plugin's frontend reads from.
- **Users / sessions / auth** — owns the identity layer.
- **Audit events** — append-only across every mutation in the system.
- **ACL / roles / saved views** — cross-plugin permission and view state.
- **Workflows / webhooks / API tokens** — runtime infrastructure shared across plugins.
- **Field metadata / property-setters table read** — the metadata layer is consumed by every plugin's UI.
- **i18n strings** — translations are cross-cutting; moving them into a plugin would create a boot-order cycle (every plugin's UI depends on them).
- **Awesome-bar global search** — federates across every plugin's data.
- **ERP-actions infrastructure** — document-mappings, posting-batches, portal links predate the plugin split and are referenced by routes that haven't moved into a plugin.
- **Connections, record-links, favorites, timeline, ERP portal** — generic infrastructure consumed by every plugin's detail pages.
- **Generic resource CRUD** (`/api/resources/:resource`) — wires plugin events (notification-rules `fireEvent`, naming-series `nextNameForResource`) into every record write.

The shell's `routes/resources.ts` cross-imports plugin libs via the
`@gutu-plugin/*` aliases:

```ts
import { fireEvent } from "@gutu-plugin/notifications-core";
import { nextNameForResource } from "@gutu-plugin/template-core";
```

This is intentional: the shell's generic CRUD path is the one place where
multiple plugins compose to deliver the runtime behaviour the user expects
(plugin-installed naming series and notification rules apply on every
record write).

## How a new plugin contributes

Step 1 — create `plugins/gutu-plugin-<code>/framework/builtin-plugins/<name>/src/host-plugin/`:

```
host-plugin/
├── index.ts            # exports `hostPlugin: HostPlugin`
├── lib/
│   ├── <feature>.ts    # uses `@gutu-host` for db/uuid/audit/auth/Hono
│   └── index.ts        # barrel: export * from "./<feature>";
├── routes/
│   └── <feature>.ts    # exports e.g. `featureRoutes` Hono router
└── db/migrate.ts       # exports `migrate(): void`
```

Step 2 — `host-plugin/index.ts`:

```ts
import type { HostPlugin } from "@gutu-host/plugin-contract";
import { migrate } from "./db/migrate";
import { featureRoutes } from "./routes/<feature>";

export const hostPlugin: HostPlugin = {
  id: "<code>",
  version: "1.0.0",
  dependsOn: ["accounting-core"],   // optional
  migrate,
  routes: [
    { mountPath: "/<feature>", router: featureRoutes },
  ],
  // start, stop optional
};

export * from "./lib";
```

Step 3 — register in `admin-panel/backend/src/main.ts`:

```ts
import { hostPlugin as myPlugin } from "@gutu-plugin/<code>";
const HOST_PLUGINS = [..., myPlugin];
```

Step 4 — add the path mapping (already automated for the 13 migrated plugins; for new plugins add to:
- `admin-panel/backend/tsconfig.json`
- `plugins/gutu-plugin-<code>/tsconfig.base.json` (extended by per-plugin tsconfig)
- `plugins/gutu-plugin-<code>/framework/builtin-plugins/<name>/tsconfig.json`).

That's it. The plugin's tables are migrated at boot, its routes are mounted,
and its start/stop hooks fire on the right lifecycle events.

## Per-plugin UI shape (the original ask)

The plugin owns:
- its **schema** (`db/migrate.ts`)
- its **server-side domain logic** (`lib/`)
- its **HTTP routes** (`routes/`)
- its **bespoke React UI** — under `host-plugin/ui/pages/`, `host-plugin/ui/cards/`, etc., free to use whatever layout/UX the plugin wants. The existing `src/ui/admin.contributions.ts` declares nav entries / commands; the new `host-plugin/ui/` folder is where plugin-specific React pages live.
- its **start/stop hooks** for workers (notification-dispatcher in
  `notifications-core`, auto-email scheduler in `analytics-bi-core`)
- its **dependencies** on other plugins (`dependsOn: [...]`)

No plugin is forced into a single layout. The shell exposes generic primitives
(CommandPalette, LinkPreview, ConnectionsCard, NotificationDeliveriesCard,
BulkEditDialog, RichDetailPage factory) that plugins **can** use, but a
plugin is free to build entirely bespoke pages and skip every shell
primitive — it's the plugin author's call.

## Verification

```bash
cd admin-panel/backend
bun test                          # 98/98 passing across 8 files

cd admin-panel
bunx tsc --noEmit -p tsconfig.json  # clean
```

Across the four domain phases plus this migration:

- 13 plugins now own their domain code, schema, routes, and (optionally) workers.
- 1 plugin host SDK (~300 LOC) plus path mappings across ~80 tsconfig files.
- Shell `migrations.ts` slimmed from ~1,330 lines back to its original cross-cutting tables, plus a few that stay shell-owned (i18n_strings, erp_*).
- Shell `server.ts` slimmed from 130 lines to 95 lines — only cross-cutting routes.
- Shell `main.ts` boots through the plugin loader; one new plugin = one new import + one new entry in `HOST_PLUGINS`.

## Frontend plugin-UI contract

After the second pass, every admin Settings page that pairs with a migrated
backend plugin **also lives inside the plugin**. The shell's
`admin-tools/plugin.tsx` is now a generic loader that imports each plugin's
`adminUi: AdminUiContribution` and composes nav entries, pages, commands,
and detail-page rail cards from them.

### What moved

```
admin-panel/src/                                     plugins/gutu-plugin-<X>/.../host-plugin/ui/
├── examples/admin-tools/                            ├── pages/
│   ├── custom-fields-page.tsx        ──→ forms-core │   ├── CustomFieldsPage.tsx
│   ├── property-setters-page.tsx     ──→ forms-core │   ├── PropertySettersPage.tsx
│   ├── naming-series-page.tsx        ──→ template-core ├── pages/NamingSeriesPage.tsx
│   ├── print-formats-page.tsx        ──→ template-core ├── pages/PrintFormatsPage.tsx
│   ├── notification-rules-page.tsx   ──→ notifications-core ├── pages/NotificationRulesPage.tsx
│   └── bulk-import-page.tsx          ──→ integration-core ├── pages/BulkImportPage.tsx
└── admin-primitives/
    ├── PrintAction.tsx               ──→ template-core ├── primitives/PrintAction.tsx
    └── NotificationDeliveriesCard.tsx──→ notifications-core ├── primitives/NotificationDeliveriesCard.tsx
```

The shell's `admin-tools/plugin.tsx` no longer hardcodes any of these
imports. It composes from `@gutu-plugin-ui/<code>` aliases instead.

### `AdminUiContribution`

```ts
export interface AdminUiContribution {
  id: string;
  pages?: readonly PluginPageDescriptor[];
  navEntries?: readonly PluginNavEntry[];
  commands?: readonly PluginCommand[];
  detailRails?: readonly PluginDetailRail[];
}

export interface PluginPageDescriptor {
  id: string;                           // "forms-core.custom-fields"
  path: string;                         // "/settings/custom-fields"
  title: string;
  description?: string;
  Component: ComponentType;             // The React page itself
  icon?: string;                        // Lucide icon name
}

export interface PluginNavEntry {
  id: string;
  label: string;
  icon?: string;
  path: string;
  section?: string;                     // default: "settings"
  order?: number;                       // sort within section
}

export interface PluginCommand {
  id: string;
  label: string;
  icon?: string;
  keywords?: string[];                  // Cmd+K fuzzy match
  run: () => void;
}

export interface PluginDetailRail {
  id: string;
  resourcePattern: string;              // exact id, "*", or "<prefix>.*"
  Component: ComponentType<{
    resource: string;
    recordId: string;
    record?: Record<string, unknown>;
  }>;
  priority?: number;
}
```

### How a plugin contributes UI

1. Create `host-plugin/ui/pages/<MyPage>.tsx`. The page can use any UI
   primitives it likes — `@/admin-primitives/*` for shell primitives,
   `@/runtime/*` for runtime hooks, plugin-local files, or its own
   bespoke components. The plugin is **not** locked to any layout.

2. Optionally, drop primitives in `host-plugin/ui/primitives/` (e.g.
   `PrintAction.tsx`, `NotificationDeliveriesCard.tsx`) so they live next
   to the engine that powers them.

3. Write `host-plugin/ui/index.ts`:

   ```ts
   import { defineAdminUi } from "@gutu-host/plugin-ui-contract";
   import { MyPage } from "./pages/MyPage";

   export const adminUi = defineAdminUi({
     id: "<plugin-code>",
     pages: [{
       id: "<plugin-code>.my-page",
       path: "/settings/my-page",
       title: "My page",
       Component: MyPage,
       icon: "Sparkles",
     }],
     navEntries: [{
       id: "<plugin-code>.nav.my-page",
       label: "My page",
       path: "/settings/my-page",
       icon: "Sparkles",
       section: "settings",
       order: 20,
     }],
     commands: [{
       id: "<plugin-code>.cmd.my-page",
       label: "Open My page",
       keywords: ["my", "page"],
       run: () => { window.location.hash = "/settings/my-page"; },
     }],
   });
   export { MyPage } from "./pages/MyPage";
   ```

4. Add the plugin to the shell's import list in
   `admin-panel/src/examples/admin-tools/plugin.tsx`:

   ```ts
   import { adminUi as myPluginUi } from "@gutu-plugin-ui/<plugin-code>";
   const PLUGINS: AdminUiContribution[] = [..., myPluginUi];
   ```

5. Add the alias to `admin-panel/tsconfig.json` and `vite.config.ts`:

   ```jsonc
   // tsconfig.json
   "@gutu-plugin-ui/<plugin-code>": [
     "../plugins/gutu-plugin-<code>/framework/builtin-plugins/<folder>/src/host-plugin/ui/index.ts"
   ],
   ```

   ```ts
   // vite.config.ts
   "@gutu-plugin-ui/<plugin-code>": path.resolve(
     __dirname,
     "../plugins/gutu-plugin-<code>/framework/builtin-plugins/<folder>/src/host-plugin/ui/index.ts",
   ),
   ```

That's it. The plugin's pages render in Settings, its commands appear in
Cmd-K, and its rail cards render on every record-detail page that
matches the resource pattern.

### Why each plugin can have its own layout

The `Component` field is just a React component reference. Plugins are
free to use:

- **Shell primitives** (Card, Button, Dialog, Spinner, …) for visual
  consistency.
- **Bespoke layouts** (custom grids, embedded iframes, full-screen
  canvases) by skipping shell primitives entirely.
- **Per-page layout** that differs across pages within the same plugin —
  every page is its own React component.

The shell only mounts the route. Layout is the plugin's call.

### Cross-cutting notes

- `RichDetailPage` (the shell's generic detail-page primitive) imports
  `PrintAction` from `@gutu-plugin-ui/template-core` so the print menu
  is available on every record without each domain plugin re-implementing
  it. If template-core isn't installed, the import fails at build time —
  a deliberate signal that the print primitive is part of the
  template-core plugin's surface.

- `NotificationDeliveriesCard` is registered as a detail rail with
  `resourcePattern: "*"` so any record-detail page that opts in to plugin
  rails (a future shell feature) gets it for free.

- The plugin tsconfig at
  `plugins/gutu-plugin-<code>/framework/builtin-plugins/<folder>/tsconfig.json`
  carries the `@/*` path alias pointing at `admin-panel/src/*` so plugin
  UI pages can import shell primitives via the same `@/admin-primitives/...`
  syntax the shell uses internally.

- For UI-only third-party deps (e.g. `@dnd-kit/*` used by
  `CustomFieldsPage`), add a path alias in the plugin's tsconfig pointing
  at `admin-panel/node_modules/`. Plugins typecheck against the same
  `node_modules` the shell uses; runtime bundling still happens through
  Vite's resolver.

### What's still in the shell, and why

The shell still owns:

- **Cross-plugin primitives**: `CommandPalette` (federates over plugin
  contributions and the awesome-bar API), `LinkPreview` (works against
  any record via the generic resources API), `ConnectionsCard` (auto-
  derives from `record_links` + GL journals — cross-plugin by design),
  `BulkEditDialog`, `RichDetailPage`, `CustomFieldsSection`, `FormView`,
  `ListView`, `DetailView`, the resource client, auth/session/tenancy
  context, the resource client. None of these belong to a single
  domain plugin.

- **Legacy admin pages** that haven't been moved into a plugin yet:
  `webhooks-page`, `api-tokens-page`, `workflows-page`, `workflow-detail`.
  These belong with `notifications-core`/`integration-core`/`workflow-core`
  but the migration follow-up is mechanical (same pattern as the four
  plugins migrated in this pass).

The shell is now genuinely **plugin-independent for the migrated
domains** — installing or removing forms-core, template-core,
notifications-core, or integration-core changes the user-visible surface
without any shell changes beyond the import list.

## Honest scope notes

What IS migrated:

- Every backend lib I added in phases 1-4 (gl-ledger, sales-invoice, stock-ledger, fulfillment, bom, pricing-rules, bank-reconciliation, fx-intercompany, hrms, notification-rules/dispatcher/scheduler, naming-series, print-format, print-pdf, template-engine, property-setters, web-forms, bulk-import, auto-email-reports).
- Every backend route I added in phases 1-4.
- Every plugin's tables now live in its own `db/migrate.ts`.
- The shell's `main.ts` loads them via the plugin-host loader.
- Tests are updated to import from `@gutu-plugin/*` aliases.

What is NOT yet moved out of the shell (deliberately, because they're cross-cutting):

- The frontend admin pages I built under `admin-panel/src/examples/admin-tools/*` (custom-fields-page, property-setters-page, naming-series-page, print-formats-page, notification-rules-page, bulk-import-page). The original ask was about backend code being plugin-owned; the corresponding plugin-side admin pages — under each plugin's `host-plugin/ui/` — are the natural next pass. The pages would import from `@gutu-host` / `@gutu-plugin/*` and the shell's admin-tools/plugin.tsx would mount them by importing each plugin's UI contributions instead of the current static React-component imports.

The plugin contract supports that next pass cleanly: a plugin's
`HostPlugin` could optionally export `adminUi: { pages, navEntries, commands }`
and the shell's admin-panel frontend would compose the same way the backend
already does. That refactor is mechanical (no new architecture needed) and
follows the same pattern this session established.
