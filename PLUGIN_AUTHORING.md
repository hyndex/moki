# Plugin authoring guide

How to ship a plugin for the Gutu ecosystem.

## TL;DR

```bash
bun run scaffold:plugin fleet-core --ui --worker
# follow printed steps to wire it into the host
bun run dev:api
# /api/_plugins now lists "fleet-core"
```

## Anatomy of a plugin

```
plugins/gutu-plugin-fleet-core/
├── package.json                       # name: @gutu-plugin/fleet-core
├── README.md
├── tsconfig.base.json
└── framework/builtin-plugins/fleet-core/
    ├── tsconfig.json
    └── src/host-plugin/
        ├── index.ts                   # exports `hostPlugin: HostPlugin`
        ├── db/migrate.ts              # CREATE TABLE IF NOT EXISTS
        ├── routes/fleet-core.ts       # Hono router
        ├── lib/index.ts               # cross-plugin barrel
        └── ui/                        # admin UI (--ui flag)
            ├── index.ts               # exports `adminUi: AdminUiContribution`
            └── pages/HomePage.tsx
```

## The HostPlugin contract

```ts
import type { HostPlugin } from "@gutu-host/plugin-contract";
import { withLeadership } from "@gutu-host/leader";

export const hostPlugin: HostPlugin = {
  id: "fleet-core",
  version: "1.0.0",

  manifest: {
    label: "Fleet management",
    description: "Vehicles, drivers, routes, telematics.",
    icon: "Truck",
    vendor: "acme",
    homepage: "https://acme.example.com/gutu/fleet",
    permissions: ["db.read", "db.write", "audit.write", "events.subscribe"],
  },

  // Other plugins this depends on (topologically sorted at load time).
  dependsOn: [
    { id: "accounting-core", versionRange: "^1.0.0" },
  ],

  // Capabilities this plugin exposes via the registry.
  provides: ["fleet.dispatch"],
  // Capabilities this plugin needs (boot fails if missing).
  consumes: ["notifications.dispatch"],

  // Schema. Idempotent — runs every boot.
  migrate,

  // One-shot per (plugin, version). Tracked in `meta` table.
  install: async (ctx) => {
    // seed default templates, register a default cron, etc.
  },

  // Demo data — only when operator triggers `seedAll({force:true})`.
  seed: async (opts) => { /* ... */ },

  // HTTP routes — auto-mounted at /api/<mountPath>.
  routes: [
    { mountPath: "/fleet", router: fleetRoutes },
  ],

  // WebSocket handlers — auto-mounted at /api/ws/<path>.
  ws: [
    {
      path: "telemetry/:vehicle",
      authorize: async (req) => /* ... */,
      onOpen, onMessage, onClose,
    },
  ],

  // Workers + cluster-singleton coordination.
  start: (ctx) => {
    const dispatch = ctx.registries
      .ns<{ send(args: any): Promise<void> }>("notifications.dispatch")
      .lookup("default");
    // use `dispatch` from your action steps

    stopWorker = withLeadership("fleet:dispatcher", () => {
      const interval = setInterval(tick, 30_000);
      return () => clearInterval(interval);
    });
  },
  stop: () => { stopWorker?.(); },

  // Operator-triggered erasure.
  uninstall: async () => {
    // drop tables, remove orphaned files, …
  },

  // GDPR plumbing.
  exportSubjectData: async ({ tenantId, subjectId }) => {
    return { vehicles: [/* … */], routes: [/* … */] };
  },
  deleteSubjectData: async ({ tenantId, subjectId }) => {
    const { changes } = db.prepare(
      "DELETE FROM fleet_vehicles WHERE tenant_id = ? AND assigned_to = ?",
    ).run(tenantId, subjectId);
    return { deleted: changes };
  },

  // Cheap liveness probe surfaced in /api/_plugins.
  health: async () => ({ ok: true, details: { connectedTelematics: 42 } }),
};
```

## The host SDK (`@gutu-host`)

Plugins import platform services from a stable, versioned surface.
Direct imports across plugins are an anti-pattern — use `provides` /
`consumes` + the registry instead.

```ts
import {
  // core platform
  db, nowIso, uuid, token, recordAudit, Hono, type Context,
  // request scope
  getTenantContext, requireAuth, currentUser,
} from "@gutu-host";

import { withLeadership, acquireOnce } from "@gutu-host/leader";
import { pluginGate, isPluginEnabled } from "@gutu-host";
import type { HostPlugin } from "@gutu-host";
```

## Cross-plugin: registry pattern

Provide:
```ts
start: (ctx) => {
  ctx.registries.ns<DispatchCapability>("notifications.dispatch")
    .register("default", myDispatcher);
},
provides: ["notifications.dispatch"],
```

Consume:
```ts
consumes: ["notifications.dispatch"],
start: (ctx) => {
  const dispatch = ctx.registries
    .ns<DispatchCapability>("notifications.dispatch")
    .lookup("default");
  if (dispatch) {
    // your action steps call dispatch.send(...)
  }
},
```

Boot fails fast if a `consumes` ID isn't `provided` by any loaded plugin.
Swap implementations without touching consumer code.

## Permissions

Manifest `permissions` are recorded at load time and enforced at host
SDK call sites when `GUTU_PERMISSIONS=enforce`. Declare every permission
your plugin uses; missing permissions throw a `PermissionDeniedError`.

```ts
manifest: {
  permissions: ["db.read", "db.write", "events.subscribe", "net.outbound"],
}
```

Available permissions:
- `db.read`, `db.write` — direct DB access
- `audit.write` — append to `audit_events`
- `events.publish`, `events.subscribe` — record event bus
- `fs.read`, `fs.write` — filesystem
- `net.outbound` — outbound HTTP / SMTP / etc.
- `ws.upgrade` — accept WebSocket upgrades

## Testing

Plugin tests run inside the shell harness:

```ts
// In your plugin's tests/
import { hostPlugin } from "../src/host-plugin";

test("fleet-core mounts routes", () => {
  expect(hostPlugin.routes?.[0]?.mountPath).toBe("/fleet");
});
```

Run end-to-end + visual + adversarial suites against your plugin:

```bash
cd admin-panel
bun run scripts/{e2e-crud,visual-smoke,visual-interactions,bug-hunt}.ts
```

## Distribution

Push to npm:
```bash
cd plugins/gutu-plugin-fleet-core
bun publish
```

Customers install:
```bash
cd customer-host
bun add @acme/gutu-fleet-core
# add "@acme/gutu-fleet-core" to package.json["gutuPlugins"]
# (no other changes needed)
bun run start
```

Ship a UI?
```bash
# add "@acme/gutu-fleet-core" to admin-panel/package.json["gutuPlugins"]
# Vite's import.meta.glob picks it up automatically
bun run dev:ui
```

## Lifecycle order

```
boot:     loadPlugins → migrate → installIfNeeded → mountRoutes → start
runtime:  request → drain check → trace → security → body cap → rate limit → metrics → CORS → tenant → plugin route
SIGTERM:  /api/ready flips 503 → drainMiddleware refuses new → wait inflight → stopPlugins → exit
```

## Health + observability

Every plugin should implement `health()` if it has a non-trivial
worker; the result surfaces in `/api/_plugins` and `/api/_metrics`.

```ts
health: async () => {
  const lastDispatch = db.prepare(
    "SELECT MAX(delivered_at) as t FROM webhook_deliveries"
  ).get();
  return {
    ok: lastDispatch?.t && Date.now() - new Date(lastDispatch.t).getTime() < 5 * 60_000,
    details: { lastDispatchAt: lastDispatch?.t },
  };
},
```
