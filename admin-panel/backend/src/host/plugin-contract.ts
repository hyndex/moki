/** Plugin host contract.
 *
 *  A plugin contributes to the running system via a single
 *  `hostPlugin: HostPlugin` exported from `src/host-plugin/index.ts`.
 *  The shell loads each contribution in topological order (dependsOn)
 *  and calls each lifecycle hook with isolation: a single plugin's
 *  failure is logged + the plugin is quarantined, but other plugins
 *  keep running.
 *
 *  The contract is intentionally exhaustive so third-party plugin
 *  developers have a complete authoring surface:
 *
 *    Identity:        id, version, manifest
 *    Dependencies:    dependsOn (id or {id, versionRange})
 *    Permissions:     declared up-front; future host versions enforce
 *    Schema:          migrate() — idempotent CREATE TABLE
 *    Routes:          routes[] — Hono routers mounted at /api/<mountPath>
 *    WebSocket:       ws[] — handlers for /api/ws/<path>
 *    Lifecycle:       install (one-shot), start (every boot), stop, uninstall
 *    Demo data:       seed({force})
 *    Health:          health() — surfaced on /api/_plugins
 *    Cross-plugin:    provides + consumes — declarative registry contracts */

import type { Hono, Context } from "hono";
import type { ServerWebSocket } from "bun";
import { registerUiResource, registerUiResources } from "../lib/ui/metadata";

/* ---- types ----------------------------------------------------------- */

export type Permission =
  | "db.read"
  | "db.write"
  | "audit.write"
  | "events.publish"
  | "events.subscribe"
  | "fs.read"
  | "fs.write"
  | "net.outbound"
  | "ws.upgrade";

export interface PluginManifest {
  /** Human-readable label for admin UIs and audit. */
  label: string;
  /** One-line description; shown in /_plugins UI. */
  description?: string;
  /** Lucide icon name. */
  icon?: string;
  /** Vendor / author identifier. */
  vendor?: string;
  /** URL of the plugin's homepage / docs. */
  homepage?: string;
  /** Permissions the plugin needs. The shell records these and a
   *  future host version will refuse capabilities outside the list. */
  permissions?: Permission[];
}

export interface PluginDep {
  id: string;
  /** Optional semver range. If absent, any version satisfies. */
  versionRange?: string;
}

export interface PluginRoute {
  mountPath: string;
  router: Hono;
}

export interface PluginWsHandler {
  /** Path under /api/ws/, e.g. "yjs/:room". */
  path: string;
  /** Resolve session + tenant from upgrade request; return null to refuse. */
  authorize?(req: Request): Promise<{ userId: string; tenantId: string } | null>;
  /** Called when a client connects. */
  onOpen?(ws: ServerWebSocket<unknown>, ctx: { userId: string; tenantId: string; params: Record<string, string> }): void;
  /** Called for every text/binary frame from the client. */
  onMessage?(ws: ServerWebSocket<unknown>, data: string | Uint8Array): void;
  /** Called on disconnect. */
  onClose?(ws: ServerWebSocket<unknown>, code: number, reason: string): void;
}

export interface RegistriesContext {
  /** Get-or-create a named registry. Type parameter is the value
   *  type entries hold. Registries are global per-process; multiple
   *  plugins can register into the same registry. */
  ns<TValue>(name: string): {
    register(key: string, value: TValue): void;
    lookup(key: string): TValue | undefined;
    all(): Map<string, TValue>;
  };
}

/** UI metadata descriptors a plugin can hand back to the shell so
 *  pickers (resource select, scope tree, tool picker) render labels
 *  and groups instead of asking operators to type strings. The host
 *  exposes this through `/api/ui/resources`. */
export interface UiResourceDescriptor {
  id: string;
  label?: string;
  pluralLabel?: string;
  group?: string;
  icon?: string;
  actions?: ReadonlyArray<"read" | "write" | "delete">;
  description?: string;
}

export interface PluginContext {
  /** Cross-plugin registry namespace. Register capabilities here and
   *  other plugins look them up by name. Avoids hard imports between
   *  plugins. */
  registries: RegistriesContext;
  /** Announce UI metadata for picker rendering. Plugins call this
   *  from `start()` (or once at module load) to override labels,
   *  group names, and supported actions for resources they own. The
   *  shell folds these descriptors into the `/api/ui/resources`
   *  aggregator. Calling without descriptors is a no-op. */
  ui: {
    registerResource(descriptor: UiResourceDescriptor): void;
    registerResources(descriptors: UiResourceDescriptor[]): void;
  };
}

export interface HostPlugin {
  /** Stable id, e.g. "accounting-core". Used in audit + logs + dep refs. */
  id: string;
  /** Semver-ish. Used for version-range checks in dependsOn. */
  version: string;
  /** Plugin metadata for admin UIs and audit. */
  manifest?: PluginManifest;
  /** Dependencies. String entries are bare ids; object entries can pin a versionRange. */
  dependsOn?: Array<string | PluginDep>;
  /** Capabilities this plugin exposes for other plugins to consume. */
  provides?: string[];
  /** Capability ids this plugin needs. Boot fails if missing. */
  consumes?: string[];

  /* ---- lifecycle hooks (all optional, all may be async) ---- */

  /** First-time activation per (plugin, tenant). Recorded in meta so
   *  it never re-runs for the same plugin version. Use this for
   *  one-shot work: seed default templates, post a "welcome" timeline
   *  event, register a default cron, etc. */
  install?(ctx: PluginContext): void | Promise<void>;
  /** Apply the plugin's schema. Must be idempotent. Runs every boot. */
  migrate?(): void | Promise<void>;
  /** Demo data. Called from `seedAll({force})` only when the shell's
   *  seed flow runs. */
  seed?(opts: { force: boolean }): void | Promise<void>;
  /** Mount HTTP routes. Returned at construction; the loader mounts
   *  them under /api/<mountPath>. */
  routes?: PluginRoute[];
  /** WebSocket upgrade handlers. Mounted under /api/ws/<path>. */
  ws?: PluginWsHandler[];
  /** Spin up workers / schedulers. Runs after migrate + routes mount.
   *  Errors are caught and the plugin is quarantined. */
  start?(ctx: PluginContext): void | Promise<void>;
  /** Drain workers on SIGTERM/SIGINT. Errors are logged but don't
   *  block shutdown of other plugins. */
  stop?(): void | Promise<void>;
  /** Reverse of install — drop the plugin's tables, unsubscribe its
   *  events, etc. Triggered manually by an operator (POST /api/_plugins/<id>/uninstall). */
  uninstall?(): void | Promise<void>;
  /** Liveness probe. Surfaced on GET /api/_plugins. Should be cheap. */
  health?(): Promise<{ ok: boolean; details?: Record<string, unknown> }>;
  /** GDPR Article 20 — data portability. Return everything the plugin
   *  has stored about (tenantId, subjectId). Caller is the operator
   *  fulfilling a Subject Access Request. Output is a JSON-serialisable
   *  bag; the shell aggregates plugins' contributions and emits a
   *  signed export. */
  exportSubjectData?(args: { tenantId: string; subjectId: string }): Promise<unknown>;
  /** GDPR Article 17 — right to erasure. Plugin permanently deletes
   *  every row associated with (tenantId, subjectId) and returns a
   *  count. The shell does NOT call this on every "user removed"
   *  event — only when an operator triggers the erasure flow. */
  deleteSubjectData?(args: { tenantId: string; subjectId: string }): Promise<{ deleted: number }>;
}

/* ---- semver helpers (minimal — supports ^, ~, =, no-op range) -------- */

interface Version {
  major: number;
  minor: number;
  patch: number;
}

function parseVersion(s: string): Version {
  const m = /^(\d+)\.(\d+)\.(\d+)/.exec(s);
  if (!m) return { major: 0, minor: 0, patch: 0 };
  return { major: +m[1]!, minor: +m[2]!, patch: +m[3]! };
}

/** Test a version string against a range of the form `^X.Y.Z`,
 *  `~X.Y.Z`, `>=X.Y.Z`, or exact. Returns true if compatible. */
export function satisfies(version: string, range: string): boolean {
  if (!range || range === "*" || range === "any") return true;
  const v = parseVersion(version);
  if (range.startsWith("^")) {
    const r = parseVersion(range.slice(1));
    if (r.major === 0 && r.minor === 0)
      return v.major === 0 && v.minor === 0 && v.patch === r.patch;
    if (r.major === 0)
      return v.major === 0 && v.minor === r.minor && (v.patch > r.patch || v.patch === r.patch);
    return v.major === r.major && (v.minor > r.minor || (v.minor === r.minor && v.patch >= r.patch));
  }
  if (range.startsWith("~")) {
    const r = parseVersion(range.slice(1));
    return v.major === r.major && v.minor === r.minor && v.patch >= r.patch;
  }
  if (range.startsWith(">=")) {
    const r = parseVersion(range.slice(2));
    return v.major > r.major
      || (v.major === r.major && v.minor > r.minor)
      || (v.major === r.major && v.minor === r.minor && v.patch >= r.patch);
  }
  if (range.startsWith("=")) return version === range.slice(1);
  return version === range;
}

/* ---- plugin registry (global per-process) --------------------------- */

const REGISTRIES = new Map<string, Map<string, unknown>>();

const registries: RegistriesContext = {
  ns<TValue>(name: string) {
    if (!REGISTRIES.has(name)) REGISTRIES.set(name, new Map());
    const m = REGISTRIES.get(name)! as Map<string, TValue>;
    return {
      register: (key: string, value: TValue) => { m.set(key, value); },
      lookup: (key: string) => m.get(key),
      all: () => new Map(m),
    };
  },
};

const ui: PluginContext["ui"] = {
  registerResource(d) { registerUiResource(d); },
  registerResources(ds) { registerUiResources(ds); },
};

const PLUGIN_CONTEXT: PluginContext = { registries, ui };

/* ---- plugin status tracking (used by /api/_plugins) ----------------- */

export type PluginStatus = "loaded" | "quarantined" | "disabled" | "unknown";

interface PluginRecord {
  plugin: HostPlugin;
  status: PluginStatus;
  errors: string[];
  installedAt?: string;
  startedAt?: string;
}

const REGISTRY = new Map<string, PluginRecord>();

export function listPluginRecords(): readonly PluginRecord[] {
  return [...REGISTRY.values()];
}

export function getPluginRecord(id: string): PluginRecord | undefined {
  return REGISTRY.get(id);
}

/* ---- topological sort with version-range dep validation ------------ */

const sorted = new Set<string>();

function depId(d: string | PluginDep): string { return typeof d === "string" ? d : d.id; }
function depRange(d: string | PluginDep): string | undefined { return typeof d === "string" ? undefined : d.versionRange; }

function topoVisit(p: HostPlugin, byId: Map<string, HostPlugin>, stack: Set<string>, out: HostPlugin[]) {
  if (sorted.has(p.id)) return;
  if (stack.has(p.id)) throw new Error(`[plugin-host] dependency cycle through ${p.id}`);
  stack.add(p.id);
  for (const dep of p.dependsOn ?? []) {
    const id = depId(dep);
    const range = depRange(dep);
    const depPlugin = byId.get(id);
    if (!depPlugin) throw new Error(`[plugin-host] ${p.id} depends on missing plugin ${id}`);
    if (range && !satisfies(depPlugin.version, range)) {
      throw new Error(
        `[plugin-host] ${p.id} requires ${id}@${range} but ${id}@${depPlugin.version} is loaded`,
      );
    }
    topoVisit(depPlugin, byId, stack, out);
  }
  stack.delete(p.id);
  sorted.add(p.id);
  out.push(p);
}

export function topologicallySort(plugins: HostPlugin[]): HostPlugin[] {
  const byId = new Map(plugins.map((p) => [p.id, p]));
  const out: HostPlugin[] = [];
  sorted.clear();
  for (const p of plugins) topoVisit(p, byId, new Set(), out);
  return out;
}

/* ---- consumes / provides validation -------------------------------- */

function validateConsumes(plugins: HostPlugin[]): void {
  const provided = new Set<string>();
  for (const p of plugins) for (const c of p.provides ?? []) provided.add(c);
  for (const p of plugins) {
    for (const need of p.consumes ?? []) {
      if (!provided.has(need)) {
        throw new Error(`[plugin-host] ${p.id} consumes capability "${need}" which no plugin provides`);
      }
    }
  }
}

/* ---- isolated runner: one plugin's failure quarantines IT only ----- */

async function runIsolated<T>(p: HostPlugin, phase: string, fn: () => T | Promise<T>): Promise<T | null> {
  const rec = REGISTRY.get(p.id);
  try {
    const r = await fn();
    return r;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[plugin-host] ${phase} failed for ${p.id}@${p.version}:`, err);
    if (rec) {
      rec.status = "quarantined";
      rec.errors.push(`${phase}: ${msg}`);
    }
    return null;
  }
}

/* ---- lifecycle drivers --------------------------------------------- */

/** Initialise the plugin registry: register every plugin's record + its
 *  initial status, run topo + consumes validation, record permissions. */
export function loadPlugins(plugins: HostPlugin[]): HostPlugin[] {
  const ordered = topologicallySort(plugins);
  validateConsumes(ordered);
  REGISTRY.clear();
  for (const p of ordered) {
    REGISTRY.set(p.id, { plugin: p, status: "loaded", errors: [] });
  }
  // Register manifest permissions so host SDK call sites can enforce.
  // Lazy-import to avoid circular dep: permissions imports back from here.
  void import("./permissions").then((m) => m.registerPluginPermissions(ordered));
  return ordered;
}

/** Run every plugin's migrate(); records the run in meta so re-runs
 *  on an applied plugin are logged but not re-executed. */
export async function runPluginMigrations(plugins: HostPlugin[]): Promise<void> {
  const ordered = topologicallySort(plugins);
  const { db, nowIso } = await import("../db");
  for (const p of ordered) {
    if (!p.migrate) continue;
    const before = nowIso();
    const ok = await runIsolated(p, "migrate", () => p.migrate!());
    if (ok !== null) {
      try {
        db.prepare(
          `INSERT INTO meta (key, value) VALUES (?, ?)
           ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        ).run(`plugin:migrated:${p.id}`, `${p.version}@${before}`);
      } catch {/* meta table missing in tests — ignore */}
    }
  }
}

/** Mount every loaded plugin's routes under /api/<mountPath>. */
export function mountPluginRoutes(plugins: HostPlugin[], app: Hono): void {
  for (const p of plugins) {
    const rec = REGISTRY.get(p.id);
    if (rec?.status === "quarantined") continue;
    for (const r of p.routes ?? []) {
      const path = r.mountPath.startsWith("/") ? r.mountPath : `/${r.mountPath}`;
      try {
        app.route(`/api${path}`, r.router);
      } catch (err) {
        console.error(`[plugin-host] failed to mount ${p.id} ${path}:`, err);
        if (rec) {
          rec.status = "quarantined";
          rec.errors.push(`mount ${path}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }
  }
}

/** Run install hooks: fires once per (plugin, version), tracked in meta. */
export async function installPluginsIfNeeded(plugins: HostPlugin[]): Promise<void> {
  const ordered = topologicallySort(plugins);
  const { db, nowIso } = await import("../db");
  for (const p of ordered) {
    if (!p.install) continue;
    const rec = REGISTRY.get(p.id);
    if (rec?.status === "quarantined") continue;
    const key = `plugin:installed:${p.id}@${p.version}`;
    let already = false;
    try {
      const row = db.prepare("SELECT value FROM meta WHERE key = ?").get(key);
      already = !!row;
    } catch {/* meta missing */}
    if (already) continue;
    const ok = await runIsolated(p, "install", () => p.install!(PLUGIN_CONTEXT));
    if (ok !== null) {
      try {
        db.prepare(
          `INSERT INTO meta (key, value) VALUES (?, ?)
           ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        ).run(key, nowIso());
      } catch {/* meta missing */}
      if (rec) rec.installedAt = nowIso();
    }
  }
}

/** Fire start hooks in topological order. A start failure quarantines
 *  the plugin only — other plugins keep going. */
export async function startPlugins(plugins: HostPlugin[]): Promise<void> {
  const ordered = topologicallySort(plugins);
  const { nowIso } = await import("../db");
  for (const p of ordered) {
    if (!p.start) continue;
    const rec = REGISTRY.get(p.id);
    if (rec?.status === "quarantined") continue;
    const ok = await runIsolated(p, "start", () => p.start!(PLUGIN_CONTEXT));
    if (ok !== null && rec) rec.startedAt = nowIso();
  }
}

/** Fire stop hooks in reverse topological order. Errors are logged but
 *  don't block subsequent plugins from shutting down. */
export async function stopPlugins(plugins: HostPlugin[]): Promise<void> {
  const ordered = topologicallySort(plugins).reverse();
  for (const p of ordered) {
    if (!p.stop) continue;
    await runIsolated(p, "stop", () => p.stop!());
  }
}

/** Run every plugin's seed() — only when the operator has explicitly
 *  requested seeding (this is NOT called on every boot). */
export async function seedPlugins(plugins: HostPlugin[], opts: { force: boolean }): Promise<void> {
  const ordered = topologicallySort(plugins);
  for (const p of ordered) {
    if (!p.seed) continue;
    const rec = REGISTRY.get(p.id);
    if (rec?.status === "quarantined") continue;
    await runIsolated(p, "seed", () => p.seed!(opts));
  }
}

/** Run every plugin's health() in parallel; returns a snapshot. */
export async function checkPluginHealth(plugins: HostPlugin[]): Promise<Array<{
  id: string; version: string; status: PluginStatus; ok: boolean; details?: unknown; errors: string[];
}>> {
  const out = await Promise.all(plugins.map(async (p) => {
    const rec = REGISTRY.get(p.id);
    if (!p.health) {
      return {
        id: p.id, version: p.version,
        status: rec?.status ?? "unknown",
        ok: rec?.status !== "quarantined",
        errors: rec?.errors ?? [],
      };
    }
    try {
      const h = await p.health();
      return {
        id: p.id, version: p.version,
        status: rec?.status ?? "unknown",
        ok: h.ok && rec?.status !== "quarantined",
        details: h.details,
        errors: rec?.errors ?? [],
      };
    } catch (err) {
      return {
        id: p.id, version: p.version,
        status: "quarantined" as PluginStatus,
        ok: false,
        errors: [...(rec?.errors ?? []), `health: ${err instanceof Error ? err.message : String(err)}`],
      };
    }
  }));
  return out;
}

/** Run a single plugin's uninstall hook. Operator-only. */
export async function uninstallPlugin(p: HostPlugin): Promise<{ ok: boolean; error?: string }> {
  if (!p.uninstall) return { ok: true };
  try {
    await p.uninstall();
    const { db } = await import("../db");
    try {
      db.prepare("DELETE FROM meta WHERE key = ?").run(`plugin:installed:${p.id}@${p.version}`);
    } catch {/* meta missing */}
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Read the global plugin context. Useful for shell-side code that
 *  needs to look up a registered capability. */
export function pluginContext(): PluginContext {
  return PLUGIN_CONTEXT;
}
