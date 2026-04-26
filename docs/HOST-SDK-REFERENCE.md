# Host SDK reference

Every export from `@gutu-host`, `@gutu-host/leader`, `@gutu-host/acl`,
`@gutu-host/event-bus`, `@gutu-host/field-metadata`, `@gutu-host/query`,
`@gutu-host/storage`, `@gutu-host/ws`, `@gutu-host/yjs-room`,
`@gutu-host/timeline-helpers`, `@gutu-host/awesome-bar`,
`@gutu-host/webhook-dispatcher`, `@gutu-host/plugin-contract`,
`@gutu-host/plugin-ui-contract`, `@gutu-host/tenant-enablement`,
`@gutu-host/permissions`. With type signatures and usage notes.

> Pair with `PLUGIN-DEVELOPMENT.md` for context on when to use what.

---

## `@gutu-host` (main barrel)

The grab-bag every plugin imports for core platform services.

### `db: Database`
The shared SQLite handle (Bun's `bun:sqlite`). Single connection,
WAL mode, FK enforcement, busy_timeout=5s, 64 MiB cache.
```ts
import { db } from "@gutu-host";
const rows = db.prepare("SELECT * FROM my_table WHERE tenant_id = ?").all(tenantId);
```

### `nowIso(): string`
ISO-8601 UTC timestamp.
```ts
const ts = nowIso();   // "2026-04-26T12:34:56.789Z"
```

### `uuid(): string`
RFC 4122 v4 UUID.
```ts
const id = uuid();   // "8a91...-..."
```

### `token(): string`
URL-safe random token (32 bytes base64url). For session tokens, API
token plaintexts, password reset tokens.
```ts
const t = token();
```

### `recordAudit(input): void`
Append to `audit_events` with hash-chain. **Always call this for any
mutation** — it's the audit log of record.
```ts
recordAudit({
  actor: user.email,
  action: "fleet.vehicle.created",
  resource: "fleet.vehicle",
  recordId: id,
  level: "info",            // "info" | "warn" | "error"
  ip: c.req.header("x-forwarded-for"),
  payload: { name, vin },   // any JSON-serialisable
});
```

### `getTenantContext(): { tenantId: string; ... }`
Read the current request's tenant from AsyncLocalStorage. Throws if
called outside a tenant-resolved request.
```ts
const { tenantId } = getTenantContext();
```

### `requireAuth(c, next): Promise<Response | undefined>`
Hono middleware. Validates the Bearer token; returns 401 if invalid;
otherwise sets `c.var.user` + `c.var.session`.
```ts
fleetRoutes.use("*", requireAuth);
```

### `currentUser(c): User`
Read the authenticated user from a Hono context. **Must** be inside a
`requireAuth`-protected route.
```ts
const user = currentUser(c);
// user.id, user.email, user.role, user.tenantId
```

### `Hono`
Re-export of `hono`. Use this so plugins don't take a direct hono
dependency.
```ts
import { Hono } from "@gutu-host";
const router = new Hono();
```

### `type Context`
Re-export of `hono`'s `Context` type, for handler signatures.

### Contract types (see `@gutu-host/plugin-contract`)
- `HostPlugin`, `PluginManifest`, `PluginContext`, `PluginDep`,
  `PluginRoute`, `PluginWsHandler`, `Permission`
- `pluginContext()`, `satisfies(version, range)`

### Leader-election helpers (see `@gutu-host/leader`)
- `withLeadership`, `acquireOnce`, `listLeases`

### Tenant-enablement helpers (see `@gutu-host/tenant-enablement`)
- `pluginGate`, `isPluginEnabled`, `setPluginEnabled`, `listPluginEnablement`

---

## `@gutu-host/plugin-contract`

The HostPlugin type system + the loader.

### `interface HostPlugin`

```ts
interface HostPlugin {
  id: string;
  version: string;
  manifest?: PluginManifest;
  dependsOn?: Array<string | { id: string; versionRange: string }>;
  provides?: string[];
  consumes?: string[];
  install?(ctx: PluginContext): void | Promise<void>;
  migrate?(): void | Promise<void>;
  seed?(opts: { force: boolean }): void | Promise<void>;
  routes?: PluginRoute[];
  ws?: PluginWsHandler[];
  start?(ctx: PluginContext): void | Promise<void>;
  stop?(): void | Promise<void>;
  uninstall?(): void | Promise<void>;
  health?(): Promise<{ ok: boolean; details?: Record<string, unknown> }>;
  exportSubjectData?(args: { tenantId: string; subjectId: string }): Promise<unknown>;
  deleteSubjectData?(args: { tenantId: string; subjectId: string }): Promise<{ deleted: number }>;
}
```

Field-by-field notes:

#### `id: string`
Stable id, used in audit logs, dep refs, registry namespaces. Convention:
`<domain>-core` (e.g. `fleet-core`, `accounting-core`).

#### `version: string`
Semver. Bumped on any change; major bump on breaking changes.

#### `manifest.label`, `manifest.description`, `manifest.icon`
For operator UIs (`/api/_plugins`, Plugins console). Icon is a Lucide
icon name (string).

#### `manifest.vendor`, `manifest.homepage`
Author identification. Surfaced in `/api/_plugins`.

#### `manifest.permissions: Permission[]`
What the plugin needs. Recorded at load. Enforced under
`GUTU_PERMISSIONS=enforce`. Available:
`db.read | db.write | audit.write | events.publish | events.subscribe | fs.read | fs.write | net.outbound | ws.upgrade`

#### `dependsOn`
String for any version, object for version range:
```ts
dependsOn: [
  "template-core",
  { id: "accounting-core", versionRange: "^1.0.0" },
],
```
Topo-sorted at load. Cycles throw.

#### `provides: string[]`, `consumes: string[]`
Capability namespace. Validated at boot (consumers without providers
throw). See `PLUGIN-DEVELOPMENT.md` §8.

#### `install(ctx): void | Promise<void>`
One-shot. Tracked in `meta` table under `plugin:installed:<id>@<version>`.
Bumping the version re-runs install. Use for: seed default templates,
register a default cron, post welcome notification.

#### `migrate(): void | Promise<void>`
Schema. Idempotent. Runs every boot. **All `CREATE TABLE IF NOT EXISTS`
+ `ALTER TABLE ADD COLUMN` (with PRAGMA check).** Throws → plugin
quarantined.

#### `seed(opts): void | Promise<void>`
Demo data. Only runs when an operator triggers `seedAll({force})` —
NOT every boot. Implementation should be skip-if-exists.

#### `routes: PluginRoute[]`
```ts
interface PluginRoute {
  mountPath: string;        // "/fleet" → mounted at /api/fleet
  router: Hono;
}
```

#### `ws: PluginWsHandler[]`
```ts
interface PluginWsHandler {
  path: string;             // "yjs/:room" → matches /api/ws/yjs/<room>
  authorize?(req: Request): Promise<{ userId; tenantId } | null>;
  onOpen?(ws, ctx: { userId; tenantId; params }): void;
  onMessage?(ws, data): void;
  onClose?(ws, code, reason): void;
}
```

#### `start(ctx): void | Promise<void>`
Worker startup. Use `ctx.registries` to publish capabilities + consume
others'. Use `withLeadership` for cluster-singletons.

#### `stop(): void | Promise<void>`
Drain workers on SIGTERM. **Don't throw.**

#### `uninstall(): void | Promise<void>`
Operator-triggered. `POST /api/_plugins/<id>/uninstall`. Drop tables,
unsubscribe events, etc.

#### `health(): Promise<{ ok; details? }>`
Cheap liveness probe. Surfaced on `/api/_plugins`. Don't query the
slow path.

#### `exportSubjectData / deleteSubjectData`
GDPR fan-out. See `SECURITY.md` §4 for the full contract.

### `loadPlugins(plugins): HostPlugin[]`
Topo-sort + validate consumes/version. Returns ordered list. Sets up
the registry for `/api/_plugins`.

### `runPluginMigrations(plugins): Promise<void>`
Run each plugin's `migrate()` in topological order with per-plugin
isolation. Records success in `meta`.

### `installPluginsIfNeeded(plugins): Promise<void>`
Run each plugin's `install()` if its (id, version) hasn't been recorded
in `meta`.

### `mountPluginRoutes(plugins, app): void`
Mount each plugin's routes under `/api/<mountPath>`.

### `startPlugins(plugins): Promise<void>`
Fire `start()` hooks in topo order with per-plugin isolation.

### `stopPlugins(plugins): Promise<void>`
Fire `stop()` hooks in reverse topo order (errors logged, not thrown).

### `seedPlugins(plugins, opts): Promise<void>`
Operator-triggered seeding fan-out.

### `checkPluginHealth(plugins): Promise<HealthSnapshot[]>`
Run all `health()` probes in parallel.

### `uninstallPlugin(plugin): Promise<{ ok; error? }>`
Run a single plugin's `uninstall()` + clear its install marker.

### `listPluginRecords(): readonly PluginRecord[]`
Live registry of every plugin's status (`loaded` / `quarantined` / etc.)

### `getPluginRecord(id): PluginRecord | undefined`

### `pluginContext(): PluginContext`
Get the global plugin context (registries surface).

### `satisfies(version, range): boolean`
Tiny semver. Supports `^X.Y.Z`, `~X.Y.Z`, `>=X.Y.Z`, exact match.

---

## `@gutu-host/leader`

Cluster-singleton worker coordination.

### `withLeadership(name, start, opts?): () => void`
```ts
const stop = withLeadership(
  "fleet:dispatcher",
  () => {
    const interval = setInterval(tick, 30_000);
    return () => clearInterval(interval);  // returned to host on lose
  },
  {
    ttlMs: 30_000,                  // default
    heartbeatMs: 10_000,            // default = ttlMs / 3
    onAcquire: () => console.log("became leader"),
    onLose: () => console.log("lost lease"),
  },
);
// later: stop();   // releases lease + calls worker stop fn
```

Lease row in `meta` under `lease:fleet:dispatcher`. Holders renew on
heartbeat. Crashed holders lose the lease after TTL.

### `acquireOnce(name): boolean`
Idempotency marker. Returns true the first time only across all
processes / restarts.
```ts
const today = new Date().toISOString().slice(0, 10);
if (acquireOnce(`fleet:daily-digest:${today}`)) {
  await sendDailyDigest();
}
```

### `listLeases(): Lease[]`
Diagnostics — show every active lease + holder. Used by
`GET /api/_plugins/_leases`.

---

## `@gutu-host/acl`

Per-record access control.

### `seedDefaultAcl({resource, recordId, creatorUserId, tenantId}): void`
Seed `(record, user:creator, owner)` + `(record, tenant:<tid>, editor)`.
Call after creating a new record.

### `effectiveRole({resource, recordId, userId, tenantId}): Role | null`
The user's effective role on the record. Returns `null` if no access.
Roles are `owner > editor > viewer`.

### `accessibleRecordIds({resource, userId, tenantId}): Set<string>`
Set of record IDs the user can READ. Pipe into SQL `IN (?, ?, ...)`
clauses.

### `roleAtLeast(have, need): boolean`
Compare roles. `roleAtLeast("editor", "viewer")` → true.

### `grantAcl({resource, recordId, subjectKind, subjectId, role, grantedBy}): void`
Insert a single ACL row.

### `revokeAcl({resource, recordId, subjectKind, subjectId}): boolean`
Remove a single ACL row.

### `listAcl(resource, recordId): AclRow[]`
List all subjects on a record (used by Share dialogs).

### `purgeAclForRecord(resource, recordId): void`
Drop all rows for a record. Call from delete endpoints to avoid
orphaned ACL rows.

### `roleFromLinkToken({token}): Role | null`
Resolve a public-link token to a role. Used by anonymous-share UX.

### Types
- `type Role = "owner" | "editor" | "viewer"`
- `type SubjectKind = "user" | "tenant" | "public-link" | "public"`
- `interface AclRow { ... }`

---

## `@gutu-host/event-bus`

In-process pub/sub for record CRUD events.

### `emitRecordEvent(event): void`
Called by the resource router. Plugin authors usually consume, not emit.
```ts
type RecordEvent = {
  type: "record.created" | "record.updated" | "record.deleted" | "record.restored" | "record.destroyed";
  tenantId: string;
  resource: string;
  recordId: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  actor?: string;
};
```

### `subscribeRecordEvents(handler): () => void`
Subscribe. Returns an unsubscribe function. **Always store + call this
on plugin stop.**
```ts
const unsubscribe = subscribeRecordEvents((event) => {
  if (event.resource === "crm.contact" && event.type === "record.created") {
    // ...
  }
});
// later: unsubscribe();
```

---

## `@gutu-host/field-metadata`

Custom-field metadata helpers.

### `validateRecordAgainstFieldMeta(tenantId, resource, body): { ok; record? | issues? }`
Coerce + validate a record against the resource's custom fields. Used
by the resource router.

### `listFieldMetadata(tenantId, resource): FieldMeta[]`
Read all custom fields for a (tenant, resource).

### Types
- `interface FieldMeta { id, key, label, kind, options, required, ... }`
- `type FieldKind = "text" | "number" | "select" | "multiselect" | "boolean" | "date" | "currency" | "email" | "phone" | "url" | "relation" | "rich-text" | "json"`

---

## `@gutu-host/query`

Generic record-query helpers.

### `parseListQuery(params: URLSearchParams): ListQueryParams`
Parse `?page=N&pageSize=N&sort=field&dir=asc&search=...&filter[k]=v`.
Also accepts `?limit=N&offset=N` (REST-classic compat).

### `listRecords(resource, q): ListResult`
SQL-level list with pagination, filter, search, ACL, soft-delete,
tenant scoping. Returns `{ rows, total, page, pageSize }`.

### `getRecord(resource, id): Record<string, unknown> | null`

### `insertRecord(resource, id, data): Record<string, unknown>`

### `updateRecord(resource, id, patch): Record<string, unknown> | null`

### `deleteRecord(resource, id): boolean`

### `bulkInsert(resource, rows): number`
Single-transaction bulk write. Used by seeders.

---

## `@gutu-host/storage`

Pluggable storage adapter registry.

### `getStorageRegistry(): StorageRegistry`
Singleton registry. Plugins use this to get a storage adapter for the
current tenant.

```ts
const reg = getStorageRegistry();
const adapter = reg.adapterForTenant(tenantId);
const url = await adapter.signedReadUrl({ key: "files/abc.pdf", expiresInS: 300 });
```

### `bootstrapStorage(opts): void`
Called at boot from `main.ts`. Plugins don't call this.

### `class ObjectNotFound extends Error`
Throw / catch when a key doesn't resolve.

### `function isStorageError(err): boolean`
Type guard.

---

## `@gutu-host/ws`

WebSocket broadcast helpers.

### `registerSocket(ws): void`
### `unregisterSocket(ws): void`
The shell's WebSocket fetch handler manages this. Plugin authors can
use it from custom `ws[]` handlers.

### `broadcastResourceChange({tenantId, resource, recordId, type, payload?}): void`
Fan out a record change to every connected socket in the tenant.

### `broadcast({to, message}): void`
Lower-level: send raw to a target.

### `broadcastAudit(actor, action, resource): void`
Stream audit events to admin observers (rare).

### `closeSocketsForTenant(tenantId, code?, reason?): number`
Disconnect every socket in a tenant (e.g. after tenant-suspended).

---

## `@gutu-host/yjs-room`

Yjs WebSocket sync (real-time co-editing).

### `yjsOnOpen(ws, data): void`
### `yjsOnMessage(ws, data): void`
### `yjsOnClose(ws): void`
### `interface YjsSocketData { userId, tenantId, resource, recordId, role, user }`

The shell wires these into its WebSocket fetch handler. Plugins shouldn't
use these directly — use `editor-core` plugin's contributions instead.

---

## `@gutu-host/timeline-helpers`

Per-record activity timeline.

### `appendTimelineEvent({tenantId, resource, recordId, kind, actor?, message?, diff?}): void`
Add a timeline event. Used for "Sarah created this", "Bob changed
stage to Customer", etc.

### `readTimeline({tenantId, resource, recordId, limit?}): TimelineRow[]`
Read the timeline for a (resource, record).

### `startTimelineWriter(): () => void`
Start the writer worker. Returns stop fn.

### `interface TimelineRow { ... }`

---

## `@gutu-host/awesome-bar`

Universal-search facade.

### `searchAwesome({tenantId, userId, query, limit?}): SearchResult[]`
Cross-resource fuzzy search. Used by the Cmd-K palette.

---

## `@gutu-host/webhook-dispatcher`

Outbound webhook worker.

### `startWebhookDispatcher(): () => void`
Start the dispatcher. Subscribes to record events, fans out HTTP POSTs
to webhook subscribers. Returns stop fn.

(Plugins usually wrap this in `withLeadership("webhooks:dispatcher", ...)`)

---

## `@gutu-host/plugin-ui-contract`

Frontend plugin contract types + helper.

### `defineAdminUi<T>(c: T): Readonly<T>`
Helper. Freezes the contribution + its arrays. Use this for type
inference + immutability.

### Types
- `interface AdminUiContribution { id, manifest?, pages?, navEntries?, commands?, detailRails?, install?, start?, stop? }`
- `interface PluginPageDescriptor { id, path, title, description?, Component, icon? }`
- `interface PluginNavEntry { id, label, icon?, path, section?, order? }`
- `interface PluginCommand { id, label, icon?, keywords?, run }`
- `interface PluginDetailRail { id, resourcePattern, Component, priority? }`

### `detailRailMatches(pattern, resource): boolean`
Pattern matcher. `*` = all, `crm.*` = crm.* only, `crm.contact` = exact.

---

## `@gutu-host/tenant-enablement`

Per-tenant plugin gating.

### `pluginGate(pluginId): MiddlewareHandler`
Hono middleware. Refuses requests with 404 + `code: "plugin-disabled"`
when the tenant has set `plugin_enablement.enabled = 0` for `pluginId`.
```ts
fleetRoutes.use("*", pluginGate("fleet-core"));
```

### `isPluginEnabled(tenantId, pluginId): boolean`
Default-on read. Missing row counts as enabled.

### `setPluginEnabled(tenantId, pluginId, enabled, settings?): void`
Operator API.

### `listPluginEnablement(tenantId): EnablementRow[]`
List rows for a tenant.

### `ensureTenantEnablementSchema(): void`
Idempotent schema creation. Called by main.ts at boot.

---

## `@gutu-host/permissions`

Plugin permission enforcement.

### `enforce(pluginId, perm): void`
Throw `PermissionDeniedError` (in `enforce` mode) if `pluginId` doesn't
hold `perm`. Internal — host SDK call sites use this.

### `registerPluginPermissions(plugins): void`
Called by `loadPlugins`. Records what each plugin declared.

### `listPermissions(pluginId): readonly Permission[]`
Diagnostics.

### `withPluginScope(pluginId, fn): T`
Run `fn` with `pluginId` on the caller stack. Used by the host SDK to
attribute calls to plugins.

### `currentCaller(): string | undefined`
Get the current caller plugin id (if inside `withPluginScope`).

### `class PermissionDeniedError extends Error`

---

## Permission constants

```ts
type Permission =
  | "db.read"
  | "db.write"
  | "audit.write"
  | "events.publish"
  | "events.subscribe"
  | "fs.read"
  | "fs.write"
  | "net.outbound"
  | "ws.upgrade";
```

---

## Stable surface guarantees

- Major version bumps to the host SDK are rare. We aim for never.
- Anything in this doc is part of the **stable surface** — additions are
  always non-breaking.
- Internal APIs (anything not in this doc) may change between versions.
  If you find yourself reaching for them, file an issue and we'll move
  them onto the surface.
- `withPluginScope` and `currentCaller` are exposed for advanced
  metaprogramming — most plugins don't need them.
