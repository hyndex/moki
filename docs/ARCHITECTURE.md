# Architecture

How Gutu is structured top-to-bottom: the shell, the plugin contract, the
runtime, the database layer, and how requests flow through the system.

> Read this first. Everything else (`PLUGIN-DEVELOPMENT.md`,
> `OPERATIONS.md`) assumes you know the model.

---

## 1. The thirty-second mental model

```
┌────────────────────────────────────────────────────────────────────┐
│                          Client (browser)                          │
│                                                                    │
│     React shell (admin-panel/src) ─────┬── @gutu-plugin-ui/<X>     │
│                                        ├── @gutu-plugin-ui/<Y>     │
│                                        └── ...                     │
└────────────────┬───────────────────────────────────────────────────┘
                 │ HTTPS (Bearer token, X-Request-ID)
                 ▼
┌────────────────────────────────────────────────────────────────────┐
│   Backend (admin-panel/backend) — Bun + Hono + SQLite              │
│                                                                    │
│   ┌─ middleware stack ────────────────────────────────────────┐    │
│   │  drain · trace · security headers · body cap · rate-limit │    │
│   │  · metrics · CORS · tenant resolution                     │    │
│   └────────────────────────┬──────────────────────────────────┘    │
│                            ▼                                       │
│   ┌─ shell-owned routes ────────────────────────────────────┐      │
│   │  /api/health   /api/ready    /api/auth    /api/tenants  │      │
│   │  /api/audit    /api/resources /api/files   /api/storage │      │
│   │  /api/analytics /api/search   /api/i18n    /api/_metrics│      │
│   │  /api/_plugins /api/_gdpr     /api/mail     (transitional)│    │
│   └─────────────────────────────────────────────────────────┘      │
│                                                                    │
│   ┌─ plugin-driven routes (mounted at boot from HOST_PLUGINS) ┐    │
│   │  /api/workflows           /api/webhooks                   │    │
│   │  /api/api-tokens          /api/field-metadata             │    │
│   │  /api/notification-rules  /api/timeline                   │    │
│   │  /api/saved-views         /api/favorites                  │    │
│   │  /api/record-links        /api/erp                        │    │
│   │  /api/awesome-search      /api/editors                    │    │
│   │  /api/connections         /api/analytics-bi               │    │
│   │  /api/auto-email-reports  /api/print-formats              │    │
│   │  /api/naming-series       /api/property-setters           │    │
│   │  /api/web-forms           ... (one per plugin)            │    │
│   └─────────────────────────────────────────────────────────┘      │
│                                                                    │
│   ┌─ plugin-owned workers (one leader per cluster) ──────────┐     │
│   │  notifications:dispatcher    notifications:scheduler     │     │
│   │  webhooks:dispatcher         workflow:engine             │     │
│   │  timeline:writer             analytics:auto-email        │     │
│   └────────────────────────────────────────────────────────┘       │
│                                                                    │
│   SQLite (WAL mode) — single source of truth                       │
└────────────────────────────────────────────────────────────────────┘
```

The shell's job is **bootstrapping**: auth, tenant resolution, generic
record CRUD, file storage, plugin loading. Everything else — every domain
feature, every worker, every admin page — comes from a plugin.

---

## 2. Repository layout

```
Framework/                                # Monorepo root, git: gutula/gutu
├── admin-panel/                          # Shell (frontend + backend)
│   ├── src/                              #   React app
│   │   ├── shell/                        #   Router, AppShell, Sidebar
│   │   ├── host/                         #   Plugin SDK (frontend)
│   │   ├── admin-primitives/             #   Reusable detail-page UI
│   │   ├── primitives/                   #   Reusable form/list UI
│   │   ├── builders/                     #   defineCustomView, defineResource
│   │   ├── contracts/                    #   View, Resource, Plugin types
│   │   ├── runtime/                      #   apiFetch, authStore
│   │   └── examples/admin-tools/         #   Plugin dispatcher (composes UI)
│   ├── backend/                          #   Bun + Hono server
│   │   ├── src/host/                     #   Plugin SDK (backend)
│   │   │   ├── plugin-contract.ts        #     HostPlugin types + loader
│   │   │   ├── discover.ts               #     auto-discover from package.json
│   │   │   ├── leader.ts                 #     lease-based mutex
│   │   │   ├── lifecycle.ts              #     boot/drain orchestration
│   │   │   ├── middleware-stack.ts       #     trace, security, rate-limit, metrics
│   │   │   ├── permissions.ts            #     manifest enforcement
│   │   │   ├── tenant-enablement.ts      #     per-tenant gating
│   │   │   ├── ws-router.ts              #     WS contract router
│   │   │   ├── (re-exports)              #     ws, query, storage, acl, …
│   │   │   └── index.ts                  #     @gutu-host main barrel
│   │   ├── src/lib/                      #   Cross-cutting helpers
│   │   │   ├── acl.ts, audit.ts, auth.ts, event-bus.ts
│   │   │   ├── field-metadata.ts, i18n.ts, id.ts
│   │   │   ├── query.ts, totp.ts, ws.ts
│   │   ├── src/routes/                   #   Shell-owned bootstrap routes
│   │   │   ├── health.ts, ready.ts, auth.ts, tenants.ts
│   │   │   ├── audit.ts, resources.ts, files.ts, storage.ts
│   │   │   ├── analytics.ts, search.ts, i18n.ts, mail.ts
│   │   │   ├── _plugins.ts               #   Operator admin (plugin status)
│   │   │   ├── _metrics.ts               #   Lifecycle + leases + routes
│   │   │   └── _gdpr.ts                  #   Article 20/17 fan-out
│   │   ├── src/storage/                  #   Pluggable storage adapters (local, s3)
│   │   ├── src/tenancy/                  #   Multi-tenant resolver + middleware
│   │   ├── src/seed/                     #   Demo data seeders
│   │   ├── src/main.ts                   #   Boot orchestrator
│   │   ├── src/server.ts                 #   Hono createApp()
│   │   ├── src/migrations.ts             #   Shell schema (auth, audit, tenants)
│   │   ├── src/db.ts                     #   SQLite handle + PRAGMAs
│   │   └── package.json                  #   gutuPlugins[] = discovery list
│   ├── scripts/                          #   Test harnesses (4 suites)
│   │   ├── e2e-crud.ts                   #     53 CRUD scenarios
│   │   ├── visual-smoke.ts               #     10 page renders
│   │   ├── visual-interactions.ts        #     10 dialogs/palette/detail
│   │   └── bug-hunt.ts                   #     76 adversarial probes
│   └── package.json                      #   gutuPlugins[] = UI discovery list
│
├── plugins/                              # All plugin repos (each its own .git)
│   ├── gutu-plugin-accounting-core/
│   ├── gutu-plugin-sales-core/
│   ├── gutu-plugin-inventory-core/
│   ├── gutu-plugin-workflow-core/
│   ├── gutu-plugin-webhooks-core/
│   ├── gutu-plugin-auth-core/
│   ├── ...                               # 75+ plugins as of v1
│   └── (each plugin)/
│       ├── package.json                  # name = @gutu-plugin/<id>
│       ├── README.md
│       ├── tsconfig.base.json
│       └── framework/builtin-plugins/<id>/
│           ├── tsconfig.json             # path: "@gutu-host" → admin-panel
│           └── src/host-plugin/
│               ├── index.ts              # exports `hostPlugin: HostPlugin`
│               ├── db/migrate.ts         # owned schema (CREATE IF NOT EXISTS)
│               ├── routes/<id>.ts        # Hono router(s)
│               ├── lib/                  # cross-plugin lib + workers
│               └── ui/                   # AdminUiContribution (optional)
│                   ├── index.ts
│                   ├── pages/
│                   └── primitives/
│
├── scripts/                              # Repo-wide scripts
│   └── scaffold-plugin.ts                #   bun run scaffold:plugin <code>
│
├── tooling/                              # Build + workspace tooling
├── catalogs/                             # Business pack catalogs
├── ref/                                  # Reference material
├── libraries/                            # Shared libraries (gutu-lib-*)
│
├── .github/workflows/ci.yml              # CI (test + typecheck + docker)
├── Dockerfile                            # Multi-stage prod image
├── DEPLOYMENT.md                         # Production deploy guide
├── RUNBOOK.md                            # Day-to-day operations
├── PLUGIN_AUTHORING.md                   # Plugin author quickstart
├── README.md                             # This repo's intro
└── docs/                                 # Deeper documentation
    ├── ARCHITECTURE.md                   # ← you are here
    ├── PLUGIN-DEVELOPMENT.md             # End-to-end plugin walkthrough
    ├── HOST-SDK-REFERENCE.md             # Every @gutu-host export
    ├── UI-UX-GUIDELINES.md               # Design system + component patterns
    ├── SECURITY.md                       # Auth, permissions, audit, GDPR
    ├── OBSERVABILITY.md                  # Logs, metrics, tracing
    ├── TESTING.md                        # The four suites + author harness
    └── CONTRIBUTING.md                   # Code style, PR process
```

---

## 3. The boundary: what stays in the shell, what's a plugin

| Concern | Shell | Plugin |
|---|---|---|
| Bun + Hono server boot | ✅ | |
| HTTP middleware (trace, security, rate-limit, drain) | ✅ | |
| Auth flow (sign-in, MFA, sessions, password reset) | ✅ | |
| Tenant resolution (subdomain/header/path) | ✅ | |
| Audit log (with hash-chain) | ✅ | |
| Generic `records` table CRUD facade (`/api/resources`) | ✅ | |
| File uploads + storage adapter registry | ✅ | |
| Analytics/telemetry event collection | ✅ | |
| i18n strings | ✅ | |
| Domain entities (CRM contacts, GL accounts, stock items) | | ✅ |
| Domain workflows (notification rules, webhook delivery, …) | | ✅ |
| Admin UI pages (Workflows, Custom fields, …) | | ✅ |
| Worker processes (cron, dispatchers, schedulers) | | ✅ |
| Schema for domain tables | | ✅ |

Rule of thumb: **if it's installable, it's a plugin.** If it's the
substrate that lets installation happen, it's the shell.

---

## 4. Two distinct contracts

### 4.1 Backend `HostPlugin` contract

Defined in `admin-panel/backend/src/host/plugin-contract.ts`. Every
backend plugin exports `hostPlugin: HostPlugin` from
`src/host-plugin/index.ts`. See **HOST-SDK-REFERENCE.md** for the full
field-by-field spec.

### 4.2 Frontend `AdminUiContribution` contract

Defined in `admin-panel/src/host/plugin-ui-contract.ts`. Every UI plugin
exports `adminUi: AdminUiContribution` from
`src/host-plugin/ui/index.ts`. See **PLUGIN-DEVELOPMENT.md** §5 for usage.

The two contracts are **independent**. A plugin can ship:
- backend only (e.g. `awesome-search-core` — pure API)
- frontend only (rare, mostly possible)
- both (e.g. `webhooks-core` — REST routes + admin UI)

Each contract has its own discovery + lifecycle. The backend's
`HOST_PLUGINS` and the frontend's `ALL_PLUGINS` are completely separate
arrays, each driven by their own `package.json["gutuPlugins"]`.

---

## 5. Plugin discovery

Two parallel mechanisms:

### Backend
```
admin-panel/backend/package.json
{
  "gutuPlugins": [
    "@gutu-plugin/template-core",
    "@gutu-plugin/notifications-core",
    ...
  ]
}
```

At boot, `loadDiscoveredPlugins()` (from `host/discover.ts`) tries:
1. `process.env.GUTU_PLUGINS` (CSV) — production allowlist override
2. `package.json["gutuPlugins"]` array (npm-style)
3. Filesystem scan of `plugins/gutu-plugin-*/` (monorepo dev)

Each entry is `await import(spec)` — Bun resolves via tsconfig paths in
dev, npm-resolved in prod. The loader takes the `hostPlugin` named export.

### Frontend
```
admin-panel/package.json
{
  "gutuPlugins": [
    "@gutu-plugin/forms-core",
    "@gutu-plugin/template-core",
    ...
  ]
}
```

The frontend uses Vite's `import.meta.glob` (eager) over
`plugins/gutu-plugin-*/.../host-plugin/ui/index.ts`. This works at build
time — Vite must see the imports for tree-shaking. Adding a UI plugin:
1. `bun add @acme/gutu-foo` (or scaffold locally)
2. Add to `package.json["gutuPlugins"]`
3. Restart Vite — `import.meta.glob` picks it up

---

## 6. The boot sequence (backend)

`admin-panel/backend/src/main.ts` orchestrates this:

```
1.  loadConfig()                              # env, ports, db kind
2.  migrate()                                 # shell schema
3.  migrateGlobal()                           # multi-tenant tables
4.  HOST_PLUGINS = loadDiscoveredPlugins()    # discover
5.  loadPlugins(HOST_PLUGINS)                 # topo sort + validate consumes/version
6.  ensureTenantEnablementSchema()            # plugin_enablement table
7.  runPluginMigrations(orderedPlugins)       # each plugin's migrate()
8.  installPluginsIfNeeded(orderedPlugins)    # one-shot install hooks
9.  registerPluginWsRoutes(orderedPlugins)    # WS routing table
10. setActivePlugins(orderedPlugins)          # /api/_plugins awareness
11. ensureDefaultTenant() + migrateTenantSchema
12. bootstrapStorage()                        # storage adapter registry
13. createApp()                               # Hono with middleware
14. app.route("/api/_plugins", ...)           # operator admin
15. mountPluginRoutes(orderedPlugins, app)    # plugin REST routes
16. startPlugins(orderedPlugins)              # workers (with leader election)
17. markReady()                               # /api/ready flips to 200
18. Bun.serve(...) listens on cfg.port
19. process.on("SIGTERM", shutdown)
```

Steps 7–10 are wrapped in **per-plugin try/catch isolation**: if a single
plugin fails any step, that plugin is quarantined (status surfaced on
`/api/_plugins`) but boot continues.

---

## 7. Lifecycle hooks (backend plugin)

Every plugin participates in this lifecycle:

```
discovery → loadPlugins → migrate → install → mountRoutes → start
                                                                ↓
                                                          (running)
                                                                ↓
                                          SIGTERM → drain HTTP → stop
```

| Hook | When | Idempotent? | Quarantines on failure? |
|---|---|---|---|
| `migrate()` | every boot | YES (`CREATE TABLE IF NOT EXISTS`) | YES |
| `install(ctx)` | once per (plugin, version) | NO (tracked in `meta`) | YES |
| `routes[]` | mounted after migrate | n/a | YES |
| `ws[]` | registered with router | n/a | YES |
| `start(ctx)` | every boot, after mount | YES (workers handle re-start) | YES |
| `seed(opts)` | only when seedAll runs | YES (skip-if-exists semantics) | log only |
| `health()` | on /api/_plugins request | n/a | error → status:false |
| `stop()` | SIGTERM/SIGINT | YES | log only |
| `uninstall()` | operator clicks Uninstall | n/a | returns error |
| `exportSubjectData()` | GDPR Article 20 request | n/a | log only |
| `deleteSubjectData()` | GDPR Article 17 request | YES | log only |

---

## 8. The middleware stack

`createApp()` wires this in order. **Order matters.**

```
1. drainMiddleware       — refuses NEW with 503+Retry-After post-SIGTERM
2. traceAndLog           — assigns X-Request-ID; structured JSON log per request
3. securityHeaders       — HSTS, CSP, X-Frame, X-Content-Type, Referrer
4. bodySizeLimit         — 413 if Content-Length > MAX_BODY_BYTES
5. rateLimit             — DB-backed sliding window per IP (skips /health, /ready)
6. metricsCollector      — per-route count + min/max/avg duration → /api/_metrics
7. cors                  — explicit allowlist via CORS_ORIGINS
8. tenantMiddleware      — AsyncLocalStorage tenant scope for /api/*
9. (your route)
```

The drain middleware lives at the top so SIGTERM handling is the very
first decision: if we're draining, refuse new traffic before paying any
other middleware cost.

---

## 9. Tenant scoping (multi-tenancy)

Every authenticated request goes through `tenantMiddleware()` which
resolves the tenant via one of three strategies:

```
single-site:    always default tenant
subdomain:      acme.example.com → tenant slug "acme"
header:         X-Tenant: acme
path:           /t/acme/api/...
```

The resolved tenant is stashed in **AsyncLocalStorage** so any code in
the request stack can call `getTenantContext()` and get the current
tenant without threading it through every function.

```ts
import { getTenantContext } from "@gutu-host";

router.get("/items", (c) => {
  const { tenantId } = getTenantContext();
  // tenantId is the resolved tenant for THIS request only.
});
```

Plugins use this everywhere; the shell's resource router uses it to scope
the generic `records` table.

---

## 10. Per-tenant plugin enablement

Not every tenant gets every plugin. The `plugin_enablement` table tracks
this:

```sql
CREATE TABLE plugin_enablement (
  tenant_id TEXT NOT NULL,
  plugin_id TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  settings TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, plugin_id)
);
```

Default-on: a missing row counts as enabled (so existing tenants don't
break when a new plugin ships).

Plugins that want to honour this wrap their routes:
```ts
import { pluginGate } from "@gutu-host";
myRoutes.use("*", pluginGate("my-plugin-id"));
```

When a tenant disables `my-plugin-id`, the middleware short-circuits
with 404 + `code: "plugin-disabled"`. Data is preserved; flipping back
to enabled restores access.

Operator UI: Settings → Plugins (a built-in shell page).

---

## 11. Cross-plugin contracts (provides/consumes)

Direct imports between plugins are an anti-pattern — they're hard
dependencies that make swapping implementations impossible. Use the
**registry pattern** instead:

### Provider plugin

```ts
// notifications-core declares the capability
provides: ["notifications.dispatch"],

start: (ctx) => {
  ctx.registries.ns<DispatchCapability>("notifications.dispatch")
    .register("default", myDispatcher);
},
```

### Consumer plugin

```ts
// workflow-core declares it needs the capability
consumes: ["notifications.dispatch"],

start: (ctx) => {
  const dispatch = ctx.registries
    .ns<DispatchCapability>("notifications.dispatch")
    .lookup("default");
  // use dispatch.send() from action steps
},
```

The host validates `consumes` at boot — any consumed capability that
isn't `provided` by some loaded plugin throws.

---

## 12. Worker patterns

In-process workers (cron, dispatchers, watchers) **must** use leader
election when run in horizontal-scale deployments — otherwise multiple
replicas fire the same job.

The pattern:

```ts
import { withLeadership } from "@gutu-host/leader";

let stopLeader: (() => void) | null = null;

export const hostPlugin: HostPlugin = {
  start: () => {
    stopLeader = withLeadership("my-plugin:worker", () => {
      const interval = setInterval(tick, 30_000);
      return () => clearInterval(interval);  // returned to leader to call on lose
    });
  },
  stop: () => { stopLeader?.(); stopLeader = null; },
};
```

The lease lives in the `meta` table under key `lease:my-plugin:worker`.
Holders renew on heartbeat (1/3 of TTL); crashed holders' leases expire
naturally and another replica takes over.

For one-shot idempotency markers (e.g. "did we send the daily digest at
9am today?"), use `acquireOnce(name)` from the same module.

---

## 13. Storage layer

Pluggable backend storage. Out of the box:
- `local` — files on disk under `FILES_ROOT`
- `s3` — AWS S3 / R2 / MinIO / Wasabi (any S3-compatible endpoint)

Configuration:
```bash
# Default (local) is auto-configured
STORAGE_DEFAULT=s3 S3_BUCKET=my-bucket S3_REGION=us-east-1 ...

# Or full multi-backend config:
STORAGE_BACKENDS_JSON='[{"id":"primary","kind":"s3",...}, ...]'
```

Plugins access storage via `getStorageRegistry()` from
`@gutu-host/storage`. Each request resolves to the active backend for
the tenant; the registry caches adapters per (tenant, backend).

---

## 14. The frontend

### 14.1 Routing

Hash-based: `#/path/to/page`. The router (`admin-panel/src/shell/router.ts`)
maps:

```
/<navPath>          → list/dashboard/custom view bound to that nav item
/<navPath>/new      → form view for resource (create)
/<navPath>/<id>     → detail view for resource
/<navPath>/<id>/edit → form view for resource (edit)
```

For `custom` views (which "own" their sub-paths), the router preserves
the full path UNLESS a `<resource>-detail.view` exists — then it switches
to detail mode for `/<navPath>/<id>`. This is how `/contacts/abc-123`
correctly opens the contact detail page even though the contacts view is
custom.

### 14.2 Plugin UI composition

`admin-panel/src/examples/admin-tools/plugin.tsx` is the dispatcher:

```ts
const PLUGIN_MODULES = import.meta.glob<{ adminUi?: AdminUiContribution }>(
  "../../../../plugins/gutu-plugin-*/framework/builtin-plugins/*/src/host-plugin/ui/index.ts",
  { eager: true },
);
const ALL_PLUGINS = Object.values(PLUGIN_MODULES).map(m => m.adminUi).filter(Boolean);
```

Each contribution declares:
- `pages` — full-page React components mounted at hash routes
- `navEntries` — sidebar entries
- `commands` — Cmd-K palette entries
- `detailRails` — right-rail cards on record detail pages
- `install/start/stop` — frontend lifecycle hooks

Every page is wrapped in `PluginBoundary` so a buggy plugin's render
becomes a "Plugin failed" tile, not a white screen.

### 14.3 Built-in pages

The shell ships these admin pages as part of `admin-tools`:
- **Plugins** (`/settings/plugins`) — operator console for every loaded plugin

Everything else (Custom fields, Workflows, Webhooks, etc.) comes from
plugins.

---

## 15. The data model

Two coexisting models in SQLite:

### 15.1 The generic `records` table

```sql
CREATE TABLE records (
  resource   TEXT NOT NULL,    -- e.g. "crm.contact", "sales.deal"
  id         TEXT NOT NULL,
  data       TEXT NOT NULL,    -- JSON blob
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (resource, id)
);
```

Resources are typed by the `resource` column. The body is JSON — this is
how custom fields, soft delete (`status: "deleted"`), and tenant scope
(`tenantId`) ride along without a schema migration.

CRUD goes through `/api/resources/<resource>`. All ACL filtering, custom
field validation, event bus emission, and audit logging happens here.

### 15.2 Plugin-owned tables

Each plugin owns its own tables (defined in `db/migrate.ts`):
- `webhooks`, `webhook_deliveries` (webhooks-core)
- `workflows`, `workflow_runs` (workflow-core)
- `field_metadata` (field-metadata-core)
- `timeline_events` (timeline-core)
- ...

These are domain-specific. Drop the plugin and the tables go with it
(via `uninstall()`).

---

## 16. The ACL model

Per-record access control via `editor_acl`:

```sql
CREATE TABLE editor_acl (
  resource     TEXT NOT NULL,
  record_id    TEXT NOT NULL,
  subject_kind TEXT NOT NULL,    -- 'user' | 'tenant' | 'public-link' | 'public'
  subject_id   TEXT NOT NULL,
  role         TEXT NOT NULL,    -- 'owner' | 'editor' | 'viewer'
  granted_by   TEXT NOT NULL,
  granted_at   TEXT NOT NULL,
  PRIMARY KEY (resource, record_id, subject_kind, subject_id)
);
```

When a record is created, `seedDefaultAcl()` inserts:
- `(record, user:creator, owner)` — the creator owns it
- `(record, tenant:<tid>, editor)` — every tenant member can edit by default

Sharing UIs add explicit user rows; public links add `public-link:<token>`.

Helpers (in `@gutu-host/acl`):
- `effectiveRole({resource, recordId, userId, tenantId})` — resolves role
- `accessibleRecordIds({resource, userId, tenantId})` — what user can read
- `roleAtLeast(have, need)` — `owner > editor > viewer`

The resource list endpoint pipes `accessibleRecordIds` into the SQL `IN`
clause so total + pagination are accurate against the filtered universe.

---

## 17. The event bus

A simple in-process pub/sub for record events. Driven by the resource CRUD:
- Insert → `record.created`
- Update → `record.updated`
- Soft-delete → `record.deleted`
- Restore → `record.restored`
- Hard-delete → `record.destroyed`

Subscribers (in `@gutu-host/event-bus`):
- `subscribeRecordEvents(handler)` — receive every event
- Events carry `{ tenantId, resource, recordId, type, before?, after? }`

Workers (webhook-dispatcher, workflow engine, timeline writer) subscribe
here to react to record changes without coupling to the resource router.

The bus is **in-process only** — for cross-instance fan-out, use webhooks
or a queue (out of scope for v1).

---

## 18. Observability

| Surface | Endpoint | What |
|---|---|---|
| Liveness | `GET /api/health` | Process is up |
| Readiness | `GET /api/ready` | Boot done, not draining |
| Metrics | `GET /api/_metrics` | Lifecycle, leases, plugins, per-route counters |
| Plugin status | `GET /api/_plugins` | Manifest, status, errors, ws routes per plugin |
| Plugin leases | `GET /api/_plugins/_leases` | Cluster-singleton workers + holders |
| Audit | `GET /api/audit` | Append-only event log (hash-chained) |
| Audit verify | `GET /api/audit/verify` | Walks the chain, surfaces tamper points |

Logs are structured JSON, one line per request:
```json
{"ts":"...","level":"info","method":"GET","path":"/api/...",
 "status":200,"dur_ms":2,"traceId":"685803f7","user":"...","tenant":"..."}
```

`X-Request-ID` is propagated; pass it back from clients to correlate.

---

## 19. The shell mounts these routes; everything else is a plugin

```
/api/health           ✅ liveness probe
/api/ready            ✅ readiness probe
/api/_metrics         ✅ operator metrics
/api/_plugins/*       ✅ plugin admin (list, leases, ws-routes, enablement, uninstall)
/api/_gdpr/*          ✅ data export + erasure fan-out
/api/auth/*           ✅ sign-in, MFA, sessions, password reset
/api/tenants/*        ✅ multi-tenant CRUD
/api/audit/*          ✅ event log + chain verification
/api/resources/:r/*   ✅ generic record CRUD facade
/api/files/*          ✅ uploads
/api/storage/*        ✅ adapter management
/api/analytics/*      ✅ telemetry events
/api/search/*         ✅ generic full-text search
/api/i18n/*           ✅ translations
/api/mail/*           🟡 transitional (mail plugin not yet extracted)

/api/<plugin>/*       ↓ from plugins
/api/workflows/*      → workflow-core
/api/webhooks/*       → webhooks-core
/api/api-tokens/*     → auth-core
/api/field-metadata/* → field-metadata-core
/api/timeline/*       → timeline-core
... (one route prefix per plugin)
```

This boundary is the architectural promise: anything under
`/api/_*` or in the bootstrap list is shell; everything else moves with
its plugin.

---

## 20. Production posture summary

- 100+ files in the shell, ~10 routes hard-coded; all domain functionality
  in plugins.
- 25+ first-party plugins, each shipped as its own git repo + npm package.
- Zero hard-coded admin pages in the shell — every admin surface comes
  from `AdminUiContribution` declarations.
- Every cluster-singleton worker uses leader-election leases.
- Hash-chained tamper-evident audit log.
- DB-backed rate limiter (no Redis required for the basic tier).
- Per-tenant plugin enablement at the gate.
- Permission declarations enforced at host SDK call sites
  (`GUTU_PERMISSIONS=enforce`).
- GDPR Article 17/20 fan-out across every plugin.
- Graceful HTTP drain with 503+Retry-After during shutdown.
- Structured JSON logs with X-Request-ID propagation.
- 149/149 automated probes across e2e-CRUD + visual-smoke +
  visual-interactions + bug-hunt suites.

Ship-ready for k8s / ECS / Fly.io / Railway. See `DEPLOYMENT.md` for the
full production checklist.
