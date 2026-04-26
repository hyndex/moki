# Plugin development — end to end

How to ship a plugin: from `bun run scaffold:plugin` to publishing on
npm. Covers backend, frontend, UI/UX, testing, and distribution.

> Pair with `ARCHITECTURE.md` (the system you're plugging into) and
> `HOST-SDK-REFERENCE.md` (every API you can call).

---

## 1. The five-minute walkthrough

Goal: build a plugin with one REST endpoint, one DB table, one admin
page, one Cmd-K command. From scratch.

### 1.1 Scaffold

```bash
cd /path/to/Framework
bun run scaffold:plugin fleet-core --ui --worker
```

Output:
```
✅ Scaffolded plugin at .../plugins/gutu-plugin-fleet-core
Next steps:
  1. Add to admin-panel/backend/package.json["gutuPlugins"]:
     "@gutu-plugin/fleet-core"
  2. Add to admin-panel/backend/tsconfig.json paths
  3. Add to admin-panel/tsconfig.json paths
  4. Add to admin-panel/vite.config.ts (if --ui)
  5. Restart backend; check /api/_plugins for "fleet-core".
```

The `--ui` flag scaffolds `host-plugin/ui/`; `--worker` scaffolds a
leader-elected interval worker in `start()`.

### 1.2 Wire up

```jsonc
// admin-panel/backend/package.json
{
  "gutuPlugins": [
    "...",
    "@gutu-plugin/fleet-core"
  ]
}

// admin-panel/backend/tsconfig.json
{
  "compilerOptions": {
    "paths": {
      "@gutu-plugin/fleet-core": [
        "../../plugins/gutu-plugin-fleet-core/framework/builtin-plugins/fleet-core/src/host-plugin"
      ]
    }
  }
}

// admin-panel/package.json (for UI)
{
  "gutuPlugins": [
    "...",
    "@gutu-plugin/fleet-core"
  ]
}
```

### 1.3 Boot

```bash
cd admin-panel/backend
bun run src/main.ts

# In another terminal
cd admin-panel
bun run dev:ui
```

Visit `http://localhost:5173`, sign in (`chinmoy@gutu.dev` / `password`
in dev), navigate to Settings → Plugins, find "Fleet Core" with status
**loaded**. Your scaffolded `/fleet-core` page appears in the sidebar.

That's the loop. The rest of this doc is depth.

---

## 2. The plugin folder layout

```
plugins/gutu-plugin-fleet-core/
├── package.json                       # name = "@gutu-plugin/fleet-core"
├── README.md
├── tsconfig.base.json                 # extends framework/tsconfig.base
└── framework/builtin-plugins/fleet-core/
    ├── tsconfig.json                  # path mapping to @gutu-host
    └── src/host-plugin/
        ├── index.ts                   # exports `hostPlugin: HostPlugin`
        ├── db/
        │   └── migrate.ts             # owned schema
        ├── routes/
        │   └── fleet-core.ts          # Hono router(s)
        ├── lib/
        │   ├── index.ts               # cross-plugin barrel
        │   └── (workers, helpers).ts
        └── ui/                        # only if --ui flag
            ├── index.ts               # exports `adminUi: AdminUiContribution`
            ├── pages/
            │   └── HomePage.tsx
            └── primitives/            # reusable plugin-local UI
```

### What lives where

| Concern | Path |
|---|---|
| Plugin contract | `host-plugin/index.ts` |
| Schema | `host-plugin/db/migrate.ts` |
| REST routes | `host-plugin/routes/<feature>.ts` |
| Worker code (dispatchers, schedulers) | `host-plugin/lib/<feature>.ts` |
| Cross-plugin exports | `host-plugin/lib/index.ts` |
| Admin pages | `host-plugin/ui/pages/<Page>.tsx` |
| Reusable plugin-local UI | `host-plugin/ui/primitives/<Component>.tsx` |
| UI manifest | `host-plugin/ui/index.ts` |

### What does NOT live in a plugin

- App-level config (env, ports) → that's shell territory
- Shell middleware (rate limit, security headers) → shell
- Auth flow (sign-in, MFA, sessions) → shell (auth-core is just api-tokens)
- The `records` table → shell (plugins use `/api/resources/<resource>`)

---

## 3. The HostPlugin contract — every field

```ts
import type { HostPlugin } from "@gutu-host";

export const hostPlugin: HostPlugin = {
  // ─── Identity ──────────────────────────────────────────────
  id: "fleet-core",
  version: "1.0.0",

  manifest: {
    label: "Fleet management",
    description: "Vehicles, drivers, routes, telematics.",
    icon: "Truck",                    // Lucide icon name
    vendor: "acme",
    homepage: "https://acme.example.com/gutu/fleet",
    permissions: [
      "db.read", "db.write",
      "audit.write",
      "events.subscribe", "events.publish",
      "net.outbound",
    ],
  },

  // ─── Dependencies ──────────────────────────────────────────
  dependsOn: [
    "accounting-core",                   // any version
    { id: "inventory-core", versionRange: "^1.0.0" },  // pinned
  ],

  // ─── Cross-plugin contracts ────────────────────────────────
  provides: ["fleet.dispatch"],
  consumes: ["notifications.dispatch", "workflow.trigger"],

  // ─── Lifecycle hooks (all optional) ────────────────────────

  // Schema. Idempotent. Runs every boot.
  migrate,

  // One-shot setup per (plugin, version). Tracked in `meta`.
  install: async (ctx) => {
    // seed default templates, register a default cron, post welcome
    // notification, etc.
  },

  // Demo data. Only when operator triggers `seedAll({force:true})`.
  seed: async (opts) => { /* ... */ },

  // HTTP routes — auto-mounted at /api/<mountPath>.
  routes: [
    { mountPath: "/fleet", router: fleetRoutes },
    { mountPath: "/vehicles", router: vehicleRoutes },  // multiple OK
  ],

  // WebSocket handlers — auto-mounted at /api/ws/<path>.
  ws: [{
    path: "telemetry/:vehicle",
    authorize: async (req) => /* return { userId, tenantId } or null */,
    onOpen, onMessage, onClose,
  }],

  // Workers + cluster-singleton coordination.
  start: (ctx) => {
    // Get a capability provided by another plugin
    const dispatch = ctx.registries
      .ns<DispatchCapability>("notifications.dispatch")
      .lookup("default");

    // Publish your own capability for other plugins to consume
    ctx.registries.ns<FleetDispatch>("fleet.dispatch")
      .register("default", { schedule: (...) => ... });

    // Cluster-singleton worker via leader election
    stopWorker = withLeadership("fleet:dispatcher", () => {
      const i = setInterval(tick, 30_000);
      return () => clearInterval(i);   // returned to be called on lose/stop
    });
  },

  // Drain workers on shutdown.
  stop: () => { stopWorker?.(); },

  // Operator-triggered erasure. POST /api/_plugins/fleet-core/uninstall.
  uninstall: async () => {
    db.exec(`DROP TABLE IF EXISTS fleet_vehicles`);
    db.exec(`DROP TABLE IF EXISTS fleet_routes`);
    // etc.
  },

  // Cheap liveness probe surfaced on /api/_plugins.
  health: async () => {
    const lastDispatch = db.prepare(
      "SELECT MAX(scheduled_at) as t FROM fleet_routes"
    ).get();
    return {
      ok: lastDispatch?.t && Date.now() - new Date(lastDispatch.t).getTime() < 60 * 60_000,
      details: { lastDispatchAt: lastDispatch?.t },
    };
  },

  // ─── GDPR plumbing ─────────────────────────────────────────

  // Article 20 — return a JSON bag of everything about (tenantId, subjectId).
  exportSubjectData: async ({ tenantId, subjectId }) => {
    return {
      vehicles: db.prepare(
        "SELECT * FROM fleet_vehicles WHERE tenant_id = ? AND assigned_to = ?"
      ).all(tenantId, subjectId),
      routes: db.prepare(
        "SELECT * FROM fleet_routes WHERE tenant_id = ? AND driver_id = ?"
      ).all(tenantId, subjectId),
    };
  },

  // Article 17 — permanently delete every row tied to the subject.
  deleteSubjectData: async ({ tenantId, subjectId }) => {
    const v = db.prepare(
      "DELETE FROM fleet_vehicles WHERE tenant_id = ? AND assigned_to = ?"
    ).run(tenantId, subjectId);
    const r = db.prepare(
      "DELETE FROM fleet_routes WHERE tenant_id = ? AND driver_id = ?"
    ).run(tenantId, subjectId);
    return { deleted: v.changes + r.changes };
  },
};
```

See `HOST-SDK-REFERENCE.md` for type signatures and edge cases of each
field.

---

## 4. Backend: writing routes

### 4.1 The shape

```ts
// host-plugin/routes/fleet-core.ts
import { Hono, requireAuth, currentUser, getTenantContext, db, uuid, nowIso, recordAudit } from "@gutu-host";

export const fleetRoutes = new Hono();
fleetRoutes.use("*", requireAuth);   // all endpoints require auth

fleetRoutes.get("/", (c) => {
  const tenantId = getTenantContext().tenantId;
  const rows = db
    .prepare("SELECT * FROM fleet_vehicles WHERE tenant_id = ? ORDER BY created_at DESC")
    .all(tenantId);
  return c.json({ rows });
});

fleetRoutes.post("/", async (c) => {
  const user = currentUser(c);
  const tenantId = getTenantContext().tenantId;
  const body = (await c.req.json().catch(() => ({}))) as { name?: string };
  if (typeof body.name !== "string" || body.name.length === 0) {
    return c.json({ error: "name required", code: "invalid-argument" }, 400);
  }
  const id = uuid();
  db.prepare(
    `INSERT INTO fleet_vehicles (id, tenant_id, name, created_by, created_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(id, tenantId, body.name, user.email, nowIso());
  recordAudit({
    actor: user.email,
    action: "fleet.vehicle.created",
    resource: "fleet.vehicle",
    recordId: id,
    payload: { name: body.name },
  });
  return c.json({ id, tenantId, name: body.name }, 201);
});
```

### 4.2 Validation

Use Zod for request bodies. The shell already has it as a dep:

```ts
import { z } from "zod";

const CreateVehicleSchema = z.object({
  name: z.string().min(1).max(200),
  make: z.string().optional(),
  model: z.string().optional(),
  year: z.number().int().min(1900).max(2100).optional(),
});

fleetRoutes.post("/", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = CreateVehicleSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({
      error: "invalid body",
      code: "invalid-argument",
      issues: parsed.error.issues,
    }, 400);
  }
  // parsed.data is fully typed
});
```

### 4.3 Per-tenant gating

If your plugin should respect per-tenant enablement (and for non-shell
features, you almost always want this):

```ts
import { pluginGate } from "@gutu-host";

fleetRoutes.use("*", pluginGate("fleet-core"));
```

When a tenant has set `plugin_enablement.enabled = 0` for `fleet-core`,
all your routes return 404 with `code: "plugin-disabled"`. Data is
preserved; flipping the flag back to 1 restores access immediately.

### 4.4 Per-record ACL

If your plugin's data is per-record-shareable (CRM-style), use the
shell's ACL helpers:

```ts
import { effectiveRole, accessibleRecordIds, seedDefaultAcl } from "@gutu-host/acl";

fleetRoutes.get("/", (c) => {
  const user = currentUser(c);
  const tenantId = getTenantContext().tenantId;
  const accessible = accessibleRecordIds({
    resource: "fleet.vehicle",
    userId: user.id,
    tenantId,
  });
  if (accessible.size === 0) return c.json({ rows: [] });

  const placeholders = [...accessible].map(() => "?").join(",");
  const rows = db
    .prepare(`SELECT * FROM fleet_vehicles WHERE id IN (${placeholders})`)
    .all(...accessible);
  return c.json({ rows });
});

fleetRoutes.post("/", (c) => {
  const id = uuid();
  // ... insert ...
  seedDefaultAcl({
    resource: "fleet.vehicle",
    recordId: id,
    creatorUserId: user.id,
    tenantId,
  });
  return c.json({ id }, 201);
});
```

---

## 5. Backend: schema

```ts
// host-plugin/db/migrate.ts
import { db } from "@gutu-host";

export function migrate(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS fleet_vehicles (
      id              TEXT PRIMARY KEY,
      tenant_id       TEXT NOT NULL,
      name            TEXT NOT NULL,
      make            TEXT,
      model           TEXT,
      year            INTEGER,
      assigned_to     TEXT,            -- user id
      status          TEXT NOT NULL DEFAULT 'active',
      created_by      TEXT NOT NULL,
      created_at      TEXT NOT NULL,
      updated_at      TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS fleet_vehicles_tenant_idx
      ON fleet_vehicles(tenant_id);
    CREATE INDEX IF NOT EXISTS fleet_vehicles_assigned_idx
      ON fleet_vehicles(assigned_to);
  `);
}
```

### Conventions

- `id` always `TEXT PRIMARY KEY` (UUID)
- `tenant_id` always `TEXT NOT NULL` + indexed
- `created_at` / `updated_at` always `TEXT NOT NULL` (ISO timestamps)
- `created_by` is the actor's email (matches `audit_events.actor`)
- ALL statements wrapped in `IF NOT EXISTS`
- Use `FOREIGN KEY (...) REFERENCES ... ON DELETE CASCADE` for child tables
- For long-form text, use `TEXT`. For boolean, use `INTEGER NOT NULL DEFAULT 0`.
- For JSON-shaped fields, store as `TEXT` and `JSON.parse` on read.

### Schema evolution

Once a column is in production, never drop it (preserves backups).
Add new columns via `ALTER TABLE`:

```ts
const cols = new Set(
  (db.prepare("PRAGMA table_info(fleet_vehicles)").all() as { name: string }[])
    .map((c) => c.name),
);
if (!cols.has("vin")) {
  db.exec("ALTER TABLE fleet_vehicles ADD COLUMN vin TEXT");
}
```

This is idempotent — `migrate()` runs every boot.

---

## 6. Frontend: writing UI

### 6.1 The contribution

```ts
// host-plugin/ui/index.ts
import { defineAdminUi } from "@gutu-host/plugin-ui-contract";
import { VehiclesPage } from "./pages/VehiclesPage";
import { VehicleDetailRail } from "./primitives/VehicleDetailRail";

export const adminUi = defineAdminUi({
  id: "fleet-core",
  manifest: {
    label: "Fleet",
    description: "Vehicles + telematics",
    icon: "Truck",
    vendor: "acme",
  },

  // Pages: full-page React components mounted at hash routes
  pages: [
    {
      id: "fleet-core.vehicles",
      path: "/fleet/vehicles",
      title: "Vehicles",
      description: "Cars, vans, and trucks.",
      Component: VehiclesPage,
      icon: "Truck",
    },
  ],

  // Sidebar nav
  navEntries: [
    {
      id: "fleet-core.nav.vehicles",
      label: "Vehicles",
      icon: "Truck",
      path: "/fleet/vehicles",
      section: "operations",   // or "settings", "sales", etc.
      order: 50,
    },
  ],

  // Cmd-K palette
  commands: [
    {
      id: "fleet-core.cmd.vehicles",
      label: "Open Vehicles",
      icon: "Truck",
      keywords: ["vehicle", "fleet", "car", "truck"],
      run: () => { window.location.hash = "/fleet/vehicles"; },
    },
  ],

  // Detail-page right-rail cards (optional)
  detailRails: [
    {
      id: "fleet-core.contact-vehicles-rail",
      resourcePattern: "crm.contact",   // or "crm.*", or "*"
      Component: VehicleDetailRail,
      priority: 5,
    },
  ],

  // Lifecycle (optional)
  install: async () => { /* one-shot setup, run once per browser */ },
  start: async () => { /* hot path: subscribe to global events, etc. */ },
  stop: async () => { /* HMR / sign-out cleanup */ },
});

export { VehiclesPage };
```

### 6.2 Writing a page

```tsx
// host-plugin/ui/pages/VehiclesPage.tsx
import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/admin-primitives/Card";
import { Button } from "@/primitives/Button";
import { apiFetch } from "@/runtime/auth";

interface Vehicle { id: string; name: string; status: string; createdAt: string }

export function VehiclesPage() {
  const [rows, setRows] = React.useState<Vehicle[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [creating, setCreating] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      const r = await apiFetch<{ rows: Vehicle[] }>("/fleet");
      setRows(r.rows);
    } finally { setLoading(false); }
  }, []);

  React.useEffect(() => { void load(); }, [load]);

  const create = async () => {
    const name = prompt("Vehicle name?");
    if (!name) return;
    setCreating(true);
    try {
      await apiFetch("/fleet", {
        method: "POST",
        body: JSON.stringify({ name }),
      });
      await load();
    } finally { setCreating(false); }
  };

  if (loading) return <div className="p-6 text-text-muted">Loading…</div>;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Vehicles</h1>
        <Button onClick={create} disabled={creating}>+ New vehicle</Button>
      </div>
      <Card>
        <CardContent className="divide-y">
          {rows.map((v) => (
            <div key={v.id} className="py-3 flex items-center justify-between">
              <div>
                <div className="font-medium">{v.name}</div>
                <div className="text-xs text-text-muted">{v.status}</div>
              </div>
              <a href={`#/fleet/vehicles/${v.id}`} className="text-sm text-accent hover:underline">
                Open →
              </a>
            </div>
          ))}
          {rows.length === 0 && (
            <div className="py-12 text-center text-text-muted">
              No vehicles yet. Click "+ New vehicle" to add one.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

### 6.3 Available imports

```tsx
// Generic primitives
import { Button } from "@/primitives/Button";
import { Badge } from "@/primitives/Badge";
import { Input } from "@/primitives/Input";
import { Select } from "@/primitives/Select";
import { Switch } from "@/primitives/Switch";
import { Tooltip } from "@/primitives/Tooltip";
// ... see admin-panel/src/primitives/

// Detail-page primitives
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/admin-primitives/Card";
import { RichDetailPage } from "@/admin-primitives/RichDetailPage";
import { PrintAction } from "@/admin-primitives/PrintAction";
// ... see admin-panel/src/admin-primitives/

// Runtime helpers
import { apiFetch } from "@/runtime/auth";    // authenticated fetch
import { authStore } from "@/runtime/auth";   // current user / tenant

// Plugin lifecycle (advanced)
import { PluginBoundary } from "@/host/PluginBoundary";
```

Do **not** import directly from sibling plugins — use the registry
pattern (see §8) or the AdminUiContribution surface.

---

## 7. UI/UX guidelines

### 7.1 Page anatomy (settings-style)

```tsx
<div className="p-6 space-y-4">
  {/* Header */}
  <div className="flex items-center justify-between">
    <div>
      <h1 className="text-2xl font-bold">Page title</h1>
      <p className="text-sm text-text-muted">One-line description.</p>
    </div>
    <div className="flex items-center gap-2">
      <Button onClick={primaryAction}>+ Primary action</Button>
    </div>
  </div>

  {/* Filter / search bar */}
  <input className="w-full max-w-md px-3 py-2 border border-border rounded-md text-sm"
         placeholder="Filter…" />

  {/* Content (cards, tables, lists) */}
  <Card>...</Card>
</div>
```

### 7.2 Detail-page anatomy

Use `RichDetailPage` for record detail pages — it provides the standard
header + tabs + rail layout the shell expects:

```tsx
<RichDetailPage
  resource="fleet.vehicle"
  recordId={id}
  record={vehicle}
  title={vehicle.name}
  subtitle={`${vehicle.make} ${vehicle.model} · ${vehicle.year}`}
  actions={[
    { label: "Edit", onClick: ... },
    { label: "Print", component: <PrintAction ... /> },
  ]}
  tabs={[
    { id: "overview", label: "Overview", content: <Overview /> },
    { id: "trips", label: "Trips", count: trips.length, content: <Trips /> },
    { id: "maintenance", label: "Maintenance", content: <Maintenance /> },
  ]}
  rail={[
    /* default rails: Activity, Files, Notes — auto-filled by shell */
    /* plugin-contributed rails injected by detailRails */
  ]}
/>
```

### 7.3 Empty states

Always have an empty state. Pattern:

```tsx
{rows.length === 0 ? (
  <div className="py-12 text-center">
    <Icon className="mx-auto w-12 h-12 text-text-muted opacity-50" />
    <h3 className="mt-4 text-lg font-medium">No vehicles yet</h3>
    <p className="mt-1 text-sm text-text-muted">
      Add your first vehicle to start tracking.
    </p>
    <Button className="mt-4" onClick={create}>+ Add vehicle</Button>
  </div>
) : (
  // table or list
)}
```

### 7.4 Loading states

Skeleton-loaders preferred over spinners:

```tsx
{loading ? (
  <div className="space-y-2">
    {Array.from({ length: 5 }).map((_, i) => (
      <div key={i} className="h-12 bg-bg-muted rounded animate-pulse" />
    ))}
  </div>
) : (
  // real rows
)}
```

### 7.5 Error states

Show, don't hide:

```tsx
{error && (
  <div className="bg-danger-bg border border-danger rounded p-3 text-sm">
    <strong>Couldn't load vehicles:</strong> {error.message}
    <Button variant="ghost" size="sm" onClick={retry} className="ml-2">Retry</Button>
  </div>
)}
```

### 7.6 Forms

Always validate on the client AND server. Client-side: react-hook-form
with zod resolver works well. Server-side: zod schema on the route.

```tsx
const Schema = z.object({
  name: z.string().min(1, "Name is required"),
  year: z.number().int().min(1900).max(2100),
});

function VehicleForm({ onSubmit }) {
  const form = useForm({ resolver: zodResolver(Schema) });
  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <FormField name="name" label="Name" />
      <FormField name="year" label="Year" type="number" />
      <Button type="submit" disabled={form.formState.isSubmitting}>
        Save
      </Button>
    </form>
  );
}
```

### 7.7 Density

Two density modes: `comfortable` (default) and `compact`. Read
`document.documentElement.getAttribute('data-density')` to adapt.

### 7.8 Theme

Dark/light supported. Use semantic Tailwind tokens, not raw colors:

```tsx
// Good
<div className="bg-bg-base text-text-primary border-border">

// Bad — won't theme correctly
<div className="bg-white text-black border-gray-200">
```

Tokens: `bg-base`, `bg-muted`, `bg-elevated`, `text-primary`,
`text-muted`, `text-disabled`, `border`, `border-strong`, `accent`,
`accent-bg`, `success`, `success-bg`, `warning`, `danger`, `danger-bg`.

### 7.9 Accessibility

- Every interactive element must be keyboard-accessible
- Use `<button>` for clickable things, `<a>` for navigation
- Forms need `<label htmlFor="...">` + `id` matching
- Dialogs need `role="dialog"` and `aria-modal="true"` (Radix gives this for free)
- Color is not the only signal — use icons + text together
- Tab order should be logical

### 7.10 Internationalization

Wrap user-facing strings in the i18n helper if the plugin supports
multiple locales:

```tsx
import { t } from "@/runtime/i18n";
<h1>{t("fleet.vehicles.title", "Vehicles")}</h1>
```

The second arg is the fallback (English). i18n_strings table in DB
holds tenant-scoped overrides.

### 7.11 Iconography

Use Lucide icons exclusively (already a dep). Pass icon **names** as
strings in manifest fields; pass icon **components** in JSX:

```tsx
// In manifest
{ icon: "Truck" }

// In JSX
import { Truck } from "lucide-react";
<Truck className="w-4 h-4" />
```

---

## 8. Cross-plugin contracts

### 8.1 The provides/consumes pattern

Plugin A provides a capability; Plugin B consumes it. The host registry
brokers the lookup so neither plugin imports the other directly.

**Provider (notifications-core):**
```ts
provides: ["notifications.dispatch"],

start: (ctx) => {
  ctx.registries.ns<DispatchCapability>("notifications.dispatch")
    .register("default", {
      send: async ({ tenantId, channel, subject, body }) => { ... },
    });
},
```

**Consumer (workflow-core):**
```ts
consumes: ["notifications.dispatch"],

start: (ctx) => {
  const dispatch = ctx.registries
    .ns<DispatchCapability>("notifications.dispatch")
    .lookup("default");
  if (dispatch) {
    // use dispatch.send() in your action steps
  }
},
```

### 8.2 Why not direct imports?

- Direct imports are hard dependencies — removing the provider plugin
  breaks the consumer at build time.
- The registry lets multiple providers register under different keys
  (`"default"` vs `"high-volume"` vs `"twilio"`).
- Boot validates `consumes` against `provides` — fast failure if the
  dependency is missing.
- Tests can stub the registry without intercepting imports.

### 8.3 Convention

Capability namespace = `<domain>.<verb>`:
- `notifications.dispatch`
- `workflow.trigger`
- `templates.render`
- `storage.signedUrl`

Capability shape is the plugin's contract. Document the interface in the
provider's `lib/index.ts` so consumers can import the **type** (not the
implementation).

---

## 9. Workers

### 9.1 The leader-election pattern

```ts
import { withLeadership } from "@gutu-host/leader";

let stopLeader: (() => void) | null = null;

export const hostPlugin: HostPlugin = {
  start: () => {
    stopLeader = withLeadership("fleet:dispatcher", () => {
      // Only one replica in the cluster runs this at a time.
      const interval = setInterval(tick, 30_000);
      // Return a stop fn — called when leadership is lost OR plugin stops.
      return () => clearInterval(interval);
    });
  },
  stop: () => { stopLeader?.(); stopLeader = null; },
};
```

Lease lives in `meta` table under `lease:fleet:dispatcher`. TTL = 30s
(configurable via opts), heartbeat = TTL/3. Crashed leaders' leases
expire naturally and another replica picks up.

### 9.2 The "exactly once" pattern

For one-shot jobs (e.g. "did we send the daily 9am digest today?"):

```ts
import { acquireOnce } from "@gutu-host/leader";

const today = new Date().toISOString().slice(0, 10);
if (acquireOnce(`fleet:daily-digest:${today}`)) {
  await sendDailyDigest();
}
// Other replicas / restarts get false here, won't double-send.
```

### 9.3 Error handling in workers

Workers should never throw uncaught — they'll abort the leader-election
loop and the lease will go stale. Pattern:

```ts
async function tick() {
  try {
    await doWork();
  } catch (err) {
    console.error("[fleet:dispatcher] tick failed:", err);
    // optionally: recordAudit({ level: "error", action: "fleet.dispatcher.failed", ... })
  }
}
setInterval(tick, 30_000);
```

---

## 10. Permissions

Manifest `permissions` are **declared** by the plugin and **enforced**
at host SDK call sites when `GUTU_PERMISSIONS=enforce`.

Available permissions:
- `db.read`, `db.write` — direct SQLite access
- `audit.write` — append to `audit_events` table
- `events.publish`, `events.subscribe` — record event bus
- `fs.read`, `fs.write` — filesystem (rare; usually go through storage adapter)
- `net.outbound` — outbound HTTP / SMTP / etc.
- `ws.upgrade` — accept WebSocket upgrades

**Declare every permission your plugin needs.** Missing permissions throw
`PermissionDeniedError` in enforce mode.

```ts
manifest: {
  permissions: ["db.read", "db.write", "audit.write", "events.subscribe"],
},
```

---

## 11. Testing

### 11.1 The four shell suites

These run against a live shell. Plugin authors can run the same suites
to catch breakages caused by their plugin:

```bash
cd admin-panel
bun run scripts/e2e-crud.ts          # 53 CRUD scenarios
bun run scripts/visual-smoke.ts      # 10 page renders
bun run scripts/visual-interactions.ts # 10 dialogs/palette
bun run scripts/bug-hunt.ts          # 76 adversarial probes
```

Total: 149 probes. If your plugin breaks any of these, fix it.

### 11.2 Plugin-author harness (recommended)

Add a `tests/` directory in your plugin and write Bun tests against
the plugin's lifecycle:

```ts
// plugins/gutu-plugin-fleet-core/tests/lifecycle.test.ts
import { test, expect } from "bun:test";
import { hostPlugin } from "../framework/builtin-plugins/fleet-core/src/host-plugin";

test("manifest declares fleet-core id", () => {
  expect(hostPlugin.id).toBe("fleet-core");
  expect(hostPlugin.version).toMatch(/^\d+\.\d+\.\d+$/);
});

test("declares required permissions", () => {
  expect(hostPlugin.manifest?.permissions).toContain("db.write");
});

test("mounts at least one route", () => {
  expect(hostPlugin.routes?.length).toBeGreaterThan(0);
  expect(hostPlugin.routes![0].mountPath).toMatch(/^\//);
});

test("schema migration is idempotent", () => {
  hostPlugin.migrate?.();
  hostPlugin.migrate?.();   // second call should not throw
});
```

Run with `bun test` from your plugin folder.

### 11.3 Integration testing

Spin up the full shell + your plugin, hit endpoints, assert results:

```ts
// plugins/gutu-plugin-fleet-core/tests/integration.test.ts
import { test, expect, beforeAll, afterAll } from "bun:test";

let server: any;
beforeAll(async () => {
  // Boot the shell with just your plugin
  process.env.GUTU_PLUGINS = "@gutu-plugin/fleet-core";
  const main = await import("../../../admin-panel/backend/src/main");
  server = await main.bootForTest();
});
afterAll(async () => { await server.stop(); });

test("POST /api/fleet creates a vehicle", async () => {
  const token = await getTestBearerToken(server);
  const r = await fetch(`${server.url}/api/fleet`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ name: "F-150" }),
  });
  expect(r.status).toBe(201);
});
```

---

## 12. Distribution

### 12.1 Local development (monorepo)

The plugin lives at `plugins/gutu-plugin-fleet-core/`. Vite's
`import.meta.glob` and the backend's monorepo discovery pick it up
without any package publishing.

### 12.2 Publishing to npm

```bash
cd plugins/gutu-plugin-fleet-core
# Bump version
npm version patch
# Publish
bun publish        # or `npm publish --access public`
```

The `package.json` already has the right shape:
```jsonc
{
  "name": "@gutu-plugin/fleet-core",
  "version": "1.0.1",
  "private": false,         // remove or set to false to publish
  "type": "module",
  "exports": {
    ".": "./framework/builtin-plugins/fleet-core/src/host-plugin/index.ts"
  }
}
```

### 12.3 Customer install

```bash
cd customer-host
bun add @acme/gutu-fleet-core
# Add to package.json["gutuPlugins"]:
#   "@acme/gutu-fleet-core"
bun run start
# ⇒ [plugin-host] discovered N+1 plugin(s): ..., fleet-core
```

For UI plugins, the customer also adds the package name to
`admin-panel/package.json["gutuPlugins"]` so Vite's `import.meta.glob`
picks up the UI export.

### 12.4 Versioning

Follow semver. Breaking changes:
- Removing a route
- Removing a column without backwards-compat backfill
- Changing a `provides` capability shape
- Changing manifest `permissions` (consumers may break)

Use `versionRange` in `dependsOn` to express compat:
```ts
dependsOn: [{ id: "accounting-core", versionRange: "^1.0.0" }]
```

---

## 13. Common pitfalls

### 13.1 "My route returns 404"

Check the mount path: routes are mounted at `/api/<mountPath>`. If
`mountPath: "/fleet"`, the URL is `/api/fleet`. Common mistake:
mounting without the leading slash.

### 13.2 "My migration runs but the table doesn't exist"

`migrate()` is wrapped in per-plugin try/catch isolation. If your
migrate threw, the plugin is quarantined. Check `/api/_plugins` for the
`status: "quarantined"` and the `errors[]` array.

### 13.3 "My start hook runs twice"

You're probably observing two replicas in dev (frontend hot-reload doesn't
restart the backend, but if you ran `bun run --hot src/main.ts`, the
backend reloads on every save). For cluster-singleton workers, use
`withLeadership` — it self-corrects.

### 13.4 "My WebSocket handler never fires"

Check three things:
- `path` in `ws[]` doesn't have a leading slash (it's appended to `/api/ws/`)
- `authorize` returns the session (or null to refuse)
- The client connects to `ws://host/api/ws/<your path>`

### 13.5 "My consumes capability returns undefined"

Two common causes:
- The provider plugin isn't loaded (check `package.json["gutuPlugins"]`)
- The provider's `start()` hasn't run yet — `consumes` plugins MUST
  declare `dependsOn` of the provider so topo sort runs them first

### 13.6 "Cross-tenant data leak in tests"

Always read `getTenantContext().tenantId` and use it in your WHERE
clauses. Never trust `req.body.tenantId` — that's user-controllable.

### 13.7 "UI plugin doesn't show up"

- Did you add it to `admin-panel/package.json["gutuPlugins"]`?
- Did `bun run dev:ui` restart? (Vite needs a restart to re-evaluate
  `import.meta.glob`.)
- Does your UI export `adminUi` (not `default` or `AdminUi`)?
- Browser console for `[admin-tools] discovered N UI plugin(s):` —
  if your id isn't listed, it didn't load.

---

## 14. The plugin-author checklist

Before declaring a plugin "production-ready":

- [ ] Manifest has `label`, `description`, `vendor`, `permissions`
- [ ] All routes wrapped in `requireAuth`
- [ ] All queries scoped by `tenant_id`
- [ ] Schema indexes on `tenant_id` and any frequently-filtered column
- [ ] `migrate()` is idempotent (`CREATE TABLE IF NOT EXISTS`)
- [ ] `install()` is one-shot (uses `acquireOnce` if it does anything heavy)
- [ ] `seed()` is idempotent (skip-if-exists semantics)
- [ ] Workers wrapped in `withLeadership()` if cluster-singleton
- [ ] `health()` returns a useful liveness signal
- [ ] `uninstall()` drops the plugin's tables
- [ ] `exportSubjectData()` + `deleteSubjectData()` if PII is stored
- [ ] `pluginGate()` middleware on all routes (so per-tenant disable works)
- [ ] All input validated with Zod
- [ ] All errors return structured `{ error, code }` JSON
- [ ] User-facing strings use semantic Tailwind tokens (theme-safe)
- [ ] Empty states + loading states + error states for every list/detail page
- [ ] PluginBoundary wrapping every page (the shell does this for you)
- [ ] Plugin tested against the four shell suites
- [ ] README.md explains: what the plugin does, install instructions, env vars
- [ ] Semver versioning, with `dependsOn` ranges where applicable

---

## 15. The end-to-end mental model (last words)

A plugin is:
1. A folder under `plugins/gutu-plugin-<id>/` with a `package.json`
2. A backend `hostPlugin: HostPlugin` export
3. (Optionally) a frontend `adminUi: AdminUiContribution` export

The shell:
1. Discovers plugins via `package.json["gutuPlugins"]`
2. Imports them at boot
3. Calls `migrate → install → mountRoutes → start` with try/catch isolation
4. Exposes their routes at `/api/<mountPath>`
5. Composes their UI contributions into nav + pages + commands + rails
6. Surfaces their status on `/api/_plugins`

The plugin participates by:
1. Declaring its identity (id, version, manifest, permissions)
2. Owning its schema (migrate, uninstall)
3. Owning its routes (Hono routers)
4. Owning its workers (start/stop, with leader election)
5. Optionally publishing capabilities (provides) and consuming others' (consumes)
6. Optionally contributing UI (pages, nav, commands, detail rails)

That's the entire model. Everything in this doc is depth on those nine
bullet points.
