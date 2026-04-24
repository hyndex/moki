# Plugins — Authoring Guide

Drop a folder in this directory to ship a plugin. The shell auto-discovers
every `src/plugins/*/index.{ts,tsx,js,jsx}` at boot via `import.meta.glob` —
**no edits to `App.tsx`, `src/examples/index.ts`, or the shell are needed.**

## Quick start

```bash
# From admin-panel/
node scripts/gutu-plugin.mjs create com.acme.loyalty --label "Loyalty"

# Restart the dev server (or let HMR do it). Visit:
#   /settings/plugins    ← Inspector shows your plugin is Active
```

## Minimal plugin (`index.tsx`)

```ts
import { definePlugin } from "@/contracts/plugin-v2";

export default definePlugin({
  manifest: {
    id: "com.acme.loyalty",
    version: "0.1.0",
    label: "Loyalty",
    icon: "Gift",
    requires: {
      shell: "^2.0.0",
      capabilities: ["nav", "commands"],
    },
    origin: { kind: "filesystem", location: "src/plugins/loyalty" },
  },

  async activate(ctx) {
    ctx.contribute.commands([
      {
        id: "com.acme.loyalty.hello",
        label: "Loyalty: Hello",
        run: () => ctx.runtime.notify({ title: "Hi!", intent: "success" }),
      },
    ]);
  },
});
```

## What a plugin can contribute

Every `ctx.contribute.*` call returns a `Disposable`; all contributions are
revoked automatically when the plugin deactivates.

| Method | Effect |
|---|---|
| `ctx.contribute.nav([...])` | Adds sidebar nav items |
| `ctx.contribute.navSections([...])` | Adds top-level sections |
| `ctx.contribute.resources([...])` | Registers a data resource |
| `ctx.contribute.views([...])` | Registers list/form/detail/custom views |
| `ctx.contribute.widgets([...])` | Contributes widgets to global dashboards |
| `ctx.contribute.actions([...])` | Page-level actions |
| `ctx.contribute.commands([...])` | Command palette entries |
| `ctx.contribute.connections(desc)` | Back-reference panels on detail pages |
| `ctx.contribute.viewExtensions([...])` | Augment another plugin's view (tabs, rails, wrap) |
| `ctx.contribute.routeGuards([...])` | Intercept navigation (auth gates, redirects) |
| `ctx.contribute.shortcuts([...])` | Global keyboard shortcuts |
| `ctx.contribute.jobs([...])` | Scheduled background jobs |
| `ctx.contribute.seeds([...])` | Mock-backend seed data (opt-in) |

## Extending the platform (open registries)

Plugins can **extend the shell itself** — new column kinds, widget types,
view modes, themes, data-source backends:

```ts
ctx.registries.fieldKinds.register("barcode", {
  label: "Barcode",
  cell: BarcodeCell,
  form: BarcodeForm,
  zodType: z.string().regex(/^\d{13}$/),
  filterOperators: ["eq", "contains"],
});

ctx.registries.widgetTypes.register("map", {
  render: MapWidget,
  defaultCol: 6,
  defaultRow: "tall",
});

ctx.registries.themes.register("acme-dark", {
  label: "Acme Dark",
  mode: "dark",
  tokens: { "--accent": "252 84 67", "--surface-0": "17 17 22" },
});
```

| Registry | What it unlocks |
|---|---|
| `fieldKinds` | New column types (auto-used by every list / form / detail) |
| `widgetTypes` | New dashboard widget kinds |
| `viewModes` | New view modes beyond list/form/detail/kanban |
| `chartKinds` | New chart types |
| `exporters` | Export formats (xlsx, pdf, parquet, …) |
| `importers` | File-type adapters for bulk import |
| `authProviders` | OIDC, SAML, magic-link providers |
| `dataSources` | Alternate backends (Salesforce, BigQuery, GraphQL, …) |
| `themes` | CSS-var palettes, light/dark |
| `layouts` | Sidebar position, density presets |
| `filterOps` | Custom filter operators |
| `expressionFunctions` | Functions usable in `expr:` calculated columns |
| `notificationChannels` | Email, Slack, webhook delivery |

## Capabilities

Declare in the manifest what your plugin needs. The shell enforces them
at runtime — calling something your plugin didn't declare throws
`CapabilityError`.

- `resources:read` / `:write` / `:delete` — data mutations
- `nav`, `topbar`, `commands`, `shortcuts`, `theme`, `layout`
- `register:field-kind`, `register:widget-type`, `register:view-mode`, …
- `fetch:external`, `clipboard`, `storage`
- Fine-grained: `resource:com.gutu.sales.deal:write`

## Scoped runtime services

Inside `activate(ctx)`, `ctx.runtime.*` gives you:

```ts
ctx.runtime.resources.create("com.acme.loyalty.card", { … });
ctx.runtime.storage.set("lastSync", Date.now());  // namespaced
ctx.runtime.logger.info("hello");                 // prefixed
ctx.runtime.i18n.t("welcome");
ctx.runtime.bus.on("deal:won", handler);          // tagged events
ctx.runtime.notify({ title: "Done!", intent: "success" });
ctx.runtime.assets.url("icons/logo.svg");
ctx.runtime.permissions.has("fetch:external");
ctx.runtime.analytics.emit("card.redeemed", { … });
```

## Inter-plugin composition

### Augment another plugin's detail page

```ts
ctx.contribute.viewExtensions([
  {
    target: "com.gutu.sales.order-detail.view",
    tab: {
      id: "loyalty.rewards",
      label: "Rewards earned",
      render: (record) => <LoyaltyRewardsTab orderId={record.id} />,
    },
  },
]);
```

### Call another plugin's API

```ts
const warehouse = ctx.peers.get<WarehouseApi>("com.gutu.warehouse");
await warehouse?.api.reorder("SKU-001", 50);
```

### Declare dependencies

```ts
manifest: {
  requires: {
    shell: "^2.0.0",
    plugins: {
      "com.gutu.auth": "^1.0.0",
      "com.gutu.sales": ">=1.2.0 <3.0.0",
    },
  },
}
```

The shell topologically sorts the activation graph. Cycles and missing
deps quarantine the plugin with a clear error in the Inspector.

## Lazy activation

Heavy plugins can defer loading until they're needed:

```ts
manifest: {
  activationEvents: [
    { kind: "onNav", path: "/warehouse" },    // load on first visit
    { kind: "onCommand", command: "warehouse.reorder" },
    { kind: "onPluginActivate", plugin: "com.gutu.procurement" },
  ],
}
```

## Publishing

### Filesystem (dev / self-hosted)
Commit `src/plugins/<slug>/` to your shell repo. That's it.

### npm
Publish `@acme/gutu-plugin-warehouse`. Consumers:
```json
// package.json
{
  "gutuPlugins": ["@acme/gutu-plugin-warehouse"]
}
```

### Remote URL
Host `manifest.json` + a signed ESM bundle on a CDN. Users install via
*Settings → Plugins → Install from URL*.

## Testing

Every plugin is isolated in a `<PluginBoundary>` so a crash in your code
only affects your tiles — the rest of the dashboard keeps working. Errors
are surfaced in the Inspector with a Retry button.

## CLI reference

```
gutu-plugin create <id>          Scaffold a new plugin
gutu-plugin list                 List discovered plugins
gutu-plugin validate <folder>    Sanity-check a plugin
gutu-plugin help
```
