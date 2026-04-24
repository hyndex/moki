/** Scoped runtime + context builder for a plugin.
 *
 *  Every v2 plugin gets an isolated context when activate() runs:
 *
 *    - `storage` is namespaced under "gutu.plugin.<id>." in localStorage
 *      and backed by an in-memory fallback if storage is unavailable.
 *    - `bus` is a facade over the global event bus that auto-tags emitted
 *      events with the plugin id and auto-cleans listeners on deactivate.
 *    - `resources` is a facade over the global resource client that checks
 *      the plugin's declared capabilities before each call.
 *    - `logger` prefixes messages with [pluginId].
 *    - `i18n` reads from a plugin-scoped catalog (fallback: shell defaults).
 *    - `assets` resolves relative URLs against the plugin's origin.
 *    - `permissions` exposes capability checks + throws on missing grants.
 *    - `analytics` tags all events with `plugin: id`.
 *    - `notify` goes through the toast system.
 *
 *  The builder also instantiates a ContributionStore — an aggregated view
 *  of everything the plugin registered (nav, views, resources, commands,
 *  widgets, viewExtensions, shortcuts, jobs). This store powers:
 *    - Registry rebuild when plugins activate/deactivate
 *    - Plugin Inspector admin page
 *    - Conflict detection (two plugins want the same resource id)
 *    - Safe disposal (uninstall a plugin → drop its contributions)
 */

import type {
  AnyPlugin,
  Capability,
  Disposable,
  KeyboardShortcut,
  Logger,
  PluginContext,
  PluginManifest,
  PluginStorage,
  RouteGuard,
  ScheduledJob,
  ScopedEventBus,
  ScopedResourceClient,
  ScopedRuntime,
  ViewExtension,
  PluginContributions,
  ResourceSeed,
  I18n,
  AssetResolver,
  PermissionGate,
  Analytics,
  PeerAccess,
  PluginV2,
} from "@/contracts/plugin-v2";
import type { NavItem, NavSection } from "@/contracts/nav";
import type { ResourceDefinition } from "@/contracts/resources";
import type { View, DashboardWidget } from "@/contracts/views";
import type { ActionDescriptor } from "@/contracts/actions";
import type { CommandDescriptor } from "@/contracts/commands";
import type { ConnectionDescriptor } from "@/contracts/widgets";
import type { AdminRuntime as RuntimeContextValue } from "./context";
import type { ExtensionRegistriesMutable } from "./registries";

/* ================================================================== */
/* ContributionStore — the aggregated, queryable catalog               */
/* ================================================================== */

export interface ContributionStore {
  /** Live lookup tables — rebuild the AdminRegistry from these. */
  readonly nav: Map<string, { item: NavItem; pluginId: string }>;
  readonly navSections: Map<string, { section: NavSection; pluginId: string }>;
  readonly views: Map<string, { view: View; pluginId: string }>;
  readonly resources: Map<string, { resource: ResourceDefinition; pluginId: string }>;
  readonly widgets: Map<string, { widget: DashboardWidget; pluginId: string }>;
  readonly actions: Map<string, { action: ActionDescriptor; pluginId: string }>;
  readonly commands: Map<string, { command: CommandDescriptor; pluginId: string }>;
  readonly connections: Map<string, { connection: ConnectionDescriptor; pluginId: string }>;
  readonly viewExtensions: Map<string, { extension: ViewExtension; pluginId: string }>;
  readonly routeGuards: Map<string, { guard: RouteGuard; pluginId: string }>;
  readonly shortcuts: Map<string, { shortcut: KeyboardShortcut; pluginId: string }>;
  readonly jobs: Map<string, { job: ScheduledJob; pluginId: string; handle?: unknown }>;
  readonly seeds: Map<string, { seeds: readonly ResourceSeed[]; pluginId: string }>;
  /** Conflicts detected at contribution time — (kind, key) → contributors. */
  readonly conflicts: Array<{
    readonly kind: string;
    readonly key: string;
    readonly contributors: readonly string[];
  }>;
  /** Fires when any contribution changes. */
  subscribe(cb: () => void): Disposable;
  /** Remove everything contributed by a given plugin. */
  dropByPlugin(pluginId: string): void;
  /** How many items each plugin contributed (per kind) — for the Inspector. */
  countByPlugin(pluginId: string): Readonly<Record<string, number>>;
}

export function createContributionStore(): ContributionStore {
  const nav = new Map<string, { item: NavItem; pluginId: string }>();
  const navSections = new Map<string, { section: NavSection; pluginId: string }>();
  const views = new Map<string, { view: View; pluginId: string }>();
  const resources = new Map<string, { resource: ResourceDefinition; pluginId: string }>();
  const widgets = new Map<string, { widget: DashboardWidget; pluginId: string }>();
  const actions = new Map<string, { action: ActionDescriptor; pluginId: string }>();
  const commands = new Map<string, { command: CommandDescriptor; pluginId: string }>();
  const connections = new Map<string, { connection: ConnectionDescriptor; pluginId: string }>();
  const viewExtensions = new Map<string, { extension: ViewExtension; pluginId: string }>();
  const routeGuards = new Map<string, { guard: RouteGuard; pluginId: string }>();
  const shortcuts = new Map<string, { shortcut: KeyboardShortcut; pluginId: string }>();
  const jobs = new Map<string, { job: ScheduledJob; pluginId: string; handle?: unknown }>();
  const seeds = new Map<string, { seeds: readonly ResourceSeed[]; pluginId: string }>();
  const conflicts: Array<{ kind: string; key: string; contributors: string[] }> = [];
  const listeners = new Set<() => void>();

  const emit = () => {
    for (const l of listeners) {
      try {
        l();
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("[contribution-store] listener threw", err);
      }
    }
  };

  const dropByPlugin = (pluginId: string) => {
    let changed = false;
    const cleanMap = <T extends { pluginId: string }>(m: Map<string, T>) => {
      for (const [k, v] of m) {
        if (v.pluginId === pluginId) {
          m.delete(k);
          changed = true;
        }
      }
    };
    cleanMap(nav);
    cleanMap(navSections);
    cleanMap(views);
    cleanMap(resources);
    cleanMap(widgets);
    cleanMap(actions);
    cleanMap(commands);
    cleanMap(connections);
    cleanMap(viewExtensions);
    cleanMap(routeGuards);
    cleanMap(shortcuts);
    cleanMap(seeds);
    for (const [k, v] of jobs) {
      if (v.pluginId === pluginId) {
        const h = v.handle as number | undefined;
        if (typeof h === "number") clearInterval(h);
        jobs.delete(k);
        changed = true;
      }
    }
    // Keep conflicts that no longer involve this plugin.
    for (let i = conflicts.length - 1; i >= 0; i--) {
      const c = conflicts[i];
      const before = c.contributors.length;
      c.contributors = c.contributors.filter((p) => p !== pluginId);
      if (c.contributors.length !== before) changed = true;
      if (c.contributors.length < 2) conflicts.splice(i, 1);
    }
    if (changed) emit();
  };

  return {
    nav,
    navSections,
    views,
    resources,
    widgets,
    actions,
    commands,
    connections,
    viewExtensions,
    routeGuards,
    shortcuts,
    jobs,
    seeds,
    conflicts,
    subscribe(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    dropByPlugin,
    countByPlugin(pluginId: string) {
      const out: Record<string, number> = {};
      const count = (k: string, m: Map<string, { pluginId: string }>) => {
        let n = 0;
        for (const v of m.values()) if (v.pluginId === pluginId) n++;
        if (n > 0) out[k] = n;
      };
      count("nav", nav);
      count("navSections", navSections);
      count("views", views);
      count("resources", resources);
      count("widgets", widgets);
      count("actions", actions);
      count("commands", commands);
      count("connections", connections);
      count("viewExtensions", viewExtensions);
      count("routeGuards", routeGuards);
      count("shortcuts", shortcuts);
      count("jobs", jobs);
      count("seeds", seeds);
      return out;
    },
  };
}

/* ================================================================== */
/* Contributions registrars                                            */
/* ================================================================== */

function makeContributions(
  manifest: PluginManifest,
  store: ContributionStore,
  permissions: PermissionGate,
  notifyStoreChange: () => void,
): PluginContributions {
  const pluginId = manifest.id;
  const recordConflict = (kind: string, key: string, contributor: string) => {
    const existing = store.conflicts.find((c) => c.kind === kind && c.key === key);
    if (existing) {
      if (!existing.contributors.includes(contributor)) {
        (existing.contributors as string[]).push(contributor);
      }
    } else {
      store.conflicts.push({ kind, key, contributors: [contributor] });
    }
  };

  const contributeBag = <T>(
    kind: string,
    map: Map<string, { pluginId: string } & Record<string, unknown>>,
    items: readonly T[],
    keyOf: (t: T) => string,
    wrap: (t: T, pluginId: string) => { pluginId: string } & Record<string, unknown>,
  ): Disposable => {
    const addedKeys: string[] = [];
    for (const it of items) {
      const key = keyOf(it);
      if (!key) continue;
      if (map.has(key)) {
        const prev = map.get(key)!;
        if (prev.pluginId !== pluginId) {
          recordConflict(kind, key, prev.pluginId);
          recordConflict(kind, key, pluginId);
        }
      }
      map.set(key, wrap(it, pluginId));
      addedKeys.push(key);
    }
    notifyStoreChange();
    return () => {
      for (const k of addedKeys) {
        const entry = map.get(k);
        if (entry && entry.pluginId === pluginId) map.delete(k);
      }
      notifyStoreChange();
    };
  };

  return {
    nav(items) {
      permissions.require("nav");
      return contributeBag(
        "nav",
        store.nav as unknown as Map<string, { pluginId: string } & Record<string, unknown>>,
        items,
        (i) => i.id,
        (item, pluginId) => ({ item, pluginId }),
      );
    },
    navSections(sections) {
      permissions.require("nav");
      return contributeBag(
        "navSection",
        store.navSections as unknown as Map<string, { pluginId: string } & Record<string, unknown>>,
        sections,
        (s) => s.id,
        (section, pluginId) => ({ section, pluginId }),
      );
    },
    views(views) {
      return contributeBag(
        "view",
        store.views as unknown as Map<string, { pluginId: string } & Record<string, unknown>>,
        views,
        (v) => v.id,
        (view, pluginId) => ({ view, pluginId }),
      );
    },
    resources(resources) {
      permissions.require("resources:read");
      return contributeBag(
        "resource",
        store.resources as unknown as Map<string, { pluginId: string } & Record<string, unknown>>,
        resources,
        (r) => r.id,
        (resource, pluginId) => ({ resource, pluginId }),
      );
    },
    widgets(widgets) {
      return contributeBag(
        "widget",
        store.widgets as unknown as Map<string, { pluginId: string } & Record<string, unknown>>,
        widgets,
        (w) => w.id,
        (widget, pluginId) => ({ widget, pluginId }),
      );
    },
    actions(actions) {
      return contributeBag(
        "action",
        store.actions as unknown as Map<string, { pluginId: string } & Record<string, unknown>>,
        actions,
        (a) => a.id,
        (action, pluginId) => ({ action, pluginId }),
      );
    },
    commands(commands) {
      permissions.require("commands");
      return contributeBag(
        "command",
        store.commands as unknown as Map<string, { pluginId: string } & Record<string, unknown>>,
        commands,
        (c) => c.id,
        (command, pluginId) => ({ command, pluginId }),
      );
    },
    connections(desc) {
      return contributeBag(
        "connection",
        store.connections as unknown as Map<string, { pluginId: string } & Record<string, unknown>>,
        [desc],
        (d) => d.parentResource,
        (connection, pluginId) => ({ connection, pluginId }),
      );
    },
    viewExtensions(exts) {
      return contributeBag(
        "viewExtension",
        store.viewExtensions as unknown as Map<string, { pluginId: string } & Record<string, unknown>>,
        exts,
        (e, i: unknown = 0) => {
          const t = typeof e.target === "string" ? e.target : "*";
          const suffix = e.tab?.id ?? e.section?.id ?? e.rowAction?.id ?? e.pageAction?.id ?? e.railCard?.id ?? String(i);
          return `${pluginId}::${t}::${suffix}`;
        },
        (extension, pluginId) => ({ extension, pluginId }),
      );
    },
    routeGuards(guards) {
      return contributeBag(
        "routeGuard",
        store.routeGuards as unknown as Map<string, { pluginId: string } & Record<string, unknown>>,
        guards,
        (_g, i: unknown = 0) => `${pluginId}::guard::${String(i)}`,
        (guard, pluginId) => ({ guard, pluginId }),
      );
    },
    shortcuts(shortcuts) {
      permissions.require("shortcuts");
      return contributeBag(
        "shortcut",
        store.shortcuts as unknown as Map<string, { pluginId: string } & Record<string, unknown>>,
        shortcuts,
        (s) => `${pluginId}::${s.keys}`,
        (shortcut, pluginId) => ({ shortcut, pluginId }),
      );
    },
    jobs(jobsList) {
      const added: string[] = [];
      for (const job of jobsList) {
        const key = `${pluginId}::${job.id}`;
        const intervalMs = typeof job.schedule === "number" ? job.schedule : parseCronishMs(job.schedule);
        if (intervalMs === null) continue;
        const handle = setInterval(() => {
          Promise.resolve(job.run()).catch((err) => {
            // eslint-disable-next-line no-console
            console.error(`[plugin:${pluginId}] job "${job.id}" failed`, err);
          });
        }, intervalMs);
        store.jobs.set(key, { job, pluginId, handle });
        added.push(key);
        if (job.runOnActivate) {
          Promise.resolve(job.run()).catch((err) => {
            // eslint-disable-next-line no-console
            console.error(`[plugin:${pluginId}] job "${job.id}" initial run failed`, err);
          });
        }
      }
      notifyStoreChange();
      return () => {
        for (const key of added) {
          const entry = store.jobs.get(key);
          if (entry && entry.pluginId === pluginId) {
            if (typeof entry.handle === "number") clearInterval(entry.handle);
            store.jobs.delete(key);
          }
        }
        notifyStoreChange();
      };
    },
    seeds(seedsList) {
      const key = pluginId;
      store.seeds.set(key, { seeds: seedsList, pluginId });
      notifyStoreChange();
      return () => {
        const entry = store.seeds.get(key);
        if (entry && entry.pluginId === pluginId) store.seeds.delete(key);
        notifyStoreChange();
      };
    },
  };
}

/** Very loose cron parser — supports "every Nm/s/h/d". Returns ms or null. */
function parseCronishMs(s: string): number | null {
  const m = s.trim().toLowerCase().match(/^every\s+(\d+)\s*(ms|s|m|h|d)$/);
  if (!m) return null;
  const n = Number(m[1]);
  switch (m[2]) {
    case "ms": return n;
    case "s":  return n * 1000;
    case "m":  return n * 60_000;
    case "h":  return n * 3_600_000;
    case "d":  return n * 86_400_000;
    default:   return null;
  }
}

/* ================================================================== */
/* Scoped runtime                                                      */
/* ================================================================== */

function makeScopedStorage(pluginId: string): PluginStorage {
  const prefix = `gutu.plugin.${pluginId}.`;
  const mem = new Map<string, unknown>();
  const hasLS = (() => {
    try {
      if (typeof window === "undefined") return false;
      const k = "__gutu_ls_probe";
      window.localStorage.setItem(k, "1");
      window.localStorage.removeItem(k);
      return true;
    } catch {
      return false;
    }
  })();
  return {
    get<T = unknown>(key: string): T | undefined {
      const full = prefix + key;
      if (hasLS) {
        try {
          const raw = window.localStorage.getItem(full);
          if (raw == null) return undefined;
          return JSON.parse(raw) as T;
        } catch {
          /* fall through to mem */
        }
      }
      return mem.get(full) as T | undefined;
    },
    set<T = unknown>(key: string, value: T): void {
      const full = prefix + key;
      mem.set(full, value);
      if (hasLS) {
        try {
          window.localStorage.setItem(full, JSON.stringify(value));
        } catch {
          /* quota or serialization — mem fallback is authoritative */
        }
      }
    },
    remove(key: string): void {
      const full = prefix + key;
      mem.delete(full);
      if (hasLS) {
        try {
          window.localStorage.removeItem(full);
        } catch {
          /* ignore */
        }
      }
    },
    clear(): void {
      for (const k of Array.from(mem.keys())) {
        if (k.startsWith(prefix)) mem.delete(k);
      }
      if (hasLS) {
        try {
          const rm: string[] = [];
          for (let i = 0; i < window.localStorage.length; i++) {
            const key = window.localStorage.key(i);
            if (key && key.startsWith(prefix)) rm.push(key);
          }
          rm.forEach((k) => window.localStorage.removeItem(k));
        } catch {
          /* ignore */
        }
      }
    },
    keys(): readonly string[] {
      const out = new Set<string>();
      for (const k of mem.keys()) {
        if (k.startsWith(prefix)) out.add(k.slice(prefix.length));
      }
      if (hasLS) {
        try {
          for (let i = 0; i < window.localStorage.length; i++) {
            const key = window.localStorage.key(i);
            if (key && key.startsWith(prefix)) out.add(key.slice(prefix.length));
          }
        } catch {
          /* ignore */
        }
      }
      return Array.from(out);
    },
  };
}

function makeLogger(pluginId: string): Logger {
  const prefix = `[${pluginId}]`;
  return {
    /* eslint-disable no-console */
    trace: (...a) => console.trace(prefix, ...a),
    debug: (...a) => console.debug(prefix, ...a),
    info:  (...a) => console.info(prefix, ...a),
    warn:  (...a) => console.warn(prefix, ...a),
    error: (...a) => console.error(prefix, ...a),
    /* eslint-enable no-console */
  };
}

function makeI18n(pluginId: string, storage: PluginStorage): I18n {
  let currentLocale = (typeof navigator !== "undefined" && navigator.language?.split("-")[0]) || "en";
  let catalogs: Record<string, Record<string, string>> =
    (storage.get<Record<string, Record<string, string>>>("i18n.catalogs")) ?? {};
  return {
    t(key, params) {
      const entry = catalogs[currentLocale]?.[key] ?? catalogs.en?.[key] ?? key;
      if (!params) return entry;
      return entry.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? `{${k}}`));
    },
    locale() {
      return currentLocale;
    },
    setCatalog(locale, entries) {
      catalogs = { ...catalogs, [locale]: { ...(catalogs[locale] ?? {}), ...entries } };
      storage.set("i18n.catalogs", catalogs);
      void pluginId;
    },
  };
}

function makeAssetResolver(manifest: PluginManifest): AssetResolver {
  const base =
    manifest.origin?.kind === "remote"
      ? (manifest.origin.location ?? "").replace(/\/[^/]*$/, "/")
      : manifest.origin?.kind === "filesystem"
        ? `/plugins/${manifest.id}/assets/`
        : `/plugins/${manifest.id}/`;
  return {
    url(relative) {
      if (/^(https?:|data:|blob:)/i.test(relative)) return relative;
      return base + relative.replace(/^\/+/, "");
    },
  };
}

function makePermissionGate(manifest: PluginManifest): PermissionGate {
  const granted = new Set<Capability>(manifest.requires?.capabilities ?? []);
  return {
    has(cap) {
      if (granted.has(cap)) return true;
      // Fine-grained resource: `resource:<id>` implies no write, so
      // `resource:<id>:write` is a distinct grant.
      return granted.has(cap);
    },
    require(cap) {
      if (!granted.has(cap)) {
        throw new CapabilityError(manifest.id, cap);
      }
    },
  };
}

export class CapabilityError extends Error {
  constructor(public pluginId: string, public capability: Capability) {
    super(
      `Plugin "${pluginId}" attempted "${capability}" without declaring it in manifest.requires.capabilities.`,
    );
    this.name = "CapabilityError";
  }
}

function makeAnalytics(manifest: PluginManifest, runtime: RuntimeContextValue): Analytics {
  // The strict analytics emitter has a typed event map; plugins emit free-form
  // strings so we widen through an untyped facade.
  const emitter = runtime.analytics as unknown as {
    emit: (event: string, props?: Record<string, unknown>) => void;
    setMeta: (meta: Record<string, unknown>) => void;
  };
  return {
    emit(event, props) {
      emitter.emit(event, { ...(props ?? {}), plugin: manifest.id });
    },
    setMeta(meta) {
      emitter.setMeta({ ...meta, plugin: manifest.id });
    },
  };
}

function makeScopedBus(
  manifest: PluginManifest,
  runtime: RuntimeContextValue,
  disposers: Disposable[],
): ScopedEventBus {
  // The strict Emitter<RuntimeEvents> has a typed event map; plugins use free-
  // form event names so we widen through an untyped facade.
  const bus = runtime.bus as unknown as {
    emit: (event: string, payload?: unknown) => void;
    on: (event: string, handler: (p: unknown) => void) => () => void;
  };
  return {
    emit(event, payload) {
      // Tag events with the source plugin so listeners can attribute.
      const tagged =
        payload && typeof payload === "object"
          ? { ...(payload as object), __from: manifest.id }
          : payload;
      bus.emit(event, tagged);
    },
    on(event, handler) {
      const off = bus.on(event, handler as (p: unknown) => void);
      const wrapped: Disposable = () => off();
      disposers.push(wrapped);
      return wrapped;
    },
    once(event, handler) {
      const off = bus.on(event, (p: unknown) => {
        off();
        (handler as (payload: unknown) => void)(p);
      });
      const wrapped: Disposable = () => off();
      disposers.push(wrapped);
      return wrapped;
    },
  };
}

function makeScopedResourceClient(
  manifest: PluginManifest,
  runtime: RuntimeContextValue,
  permissions: PermissionGate,
): ScopedResourceClient {
  const guard = (cap: Capability) => {
    if (!permissions.has(cap)) {
      throw new CapabilityError(manifest.id, cap);
    }
  };
  return {
    async list(resource, query) {
      guard("resources:read");
      return runtime.resources.list(resource, (query as Parameters<typeof runtime.resources.list>[1]) ?? {});
    },
    async get(resource, id) {
      guard("resources:read");
      return runtime.resources.get(resource, id);
    },
    async create(resource, body) {
      guard("resources:write");
      return runtime.resources.create(resource, body);
    },
    async update(resource, id, patch) {
      guard("resources:write");
      return runtime.resources.update(resource, id, patch);
    },
    async delete(resource, id) {
      guard("resources:delete");
      return runtime.resources.delete(resource, id);
    },
  };
}

/* ================================================================== */
/* buildPluginContext — the single entry point                         */
/* ================================================================== */

export interface PluginContextBuildArgs {
  readonly manifest: PluginManifest;
  readonly runtime: RuntimeContextValue;
  readonly registries: ExtensionRegistriesMutable;
  readonly store: ContributionStore;
  readonly peers: PeerAccess;
  readonly notifyStoreChange: () => void;
}

export interface BuiltPluginContext {
  readonly context: PluginContext;
  /** Disposers that must be called when the plugin deactivates. */
  readonly disposers: Disposable[];
}

export function buildPluginContext(args: PluginContextBuildArgs): BuiltPluginContext {
  const { manifest, runtime, registries, store, peers, notifyStoreChange } = args;
  const disposers: Disposable[] = [];

  const permissions = makePermissionGate(manifest);
  const storage = makeScopedStorage(manifest.id);
  const logger = makeLogger(manifest.id);
  const i18n = makeI18n(manifest.id, storage);
  const assets = makeAssetResolver(manifest);
  const analytics = makeAnalytics(manifest, runtime);
  const bus = makeScopedBus(manifest, runtime, disposers);
  const resources = makeScopedResourceClient(manifest, runtime, permissions);

  // Wrap the registries so that every `.register()` is attributed to this
  // plugin AND auto-cleaned when the plugin deactivates. Enforces
  // register:* capabilities at call time.
  const scopedRegistries = scopedRegistryFacade(
    registries,
    manifest.id,
    disposers,
    permissions,
    manifest,
  );

  const scopedRuntime: ScopedRuntime = {
    resources,
    bus,
    storage,
    logger,
    i18n,
    assets,
    permissions,
    analytics,
    notify(msg) {
      runtime.actions.toast({
        title: msg.title,
        description: msg.body,
        intent: (msg.intent as "info" | "success" | "warning" | "danger" | undefined) ?? "info",
      });
    },
  };

  const contribute = makeContributions(manifest, store, permissions, notifyStoreChange);
  // Wrap each contribute.* so its disposer is tracked for auto-cleanup.
  const contributeTracked = wrapContributionsForCleanup(contribute, disposers);

  const context: PluginContext = {
    manifest,
    contribute: contributeTracked,
    registries: scopedRegistries,
    runtime: scopedRuntime,
    peers,
  };

  return { context, disposers };
}

/** Wrap each registrar on PluginContributions so its returned Disposable
 *  is automatically tracked for plugin-teardown. Plugins can still call
 *  the returned disposer themselves for early revocation. */
function wrapContributionsForCleanup(
  contribute: PluginContributions,
  disposers: Disposable[],
): PluginContributions {
  const track = <A extends unknown[]>(
    fn: (...a: A) => Disposable,
  ): ((...a: A) => Disposable) => {
    return (...a: A) => {
      const d = fn(...a);
      disposers.push(d);
      return d;
    };
  };
  return {
    nav: track(contribute.nav),
    navSections: track(contribute.navSections),
    views: track(contribute.views),
    resources: track(contribute.resources),
    widgets: track(contribute.widgets),
    actions: track(contribute.actions),
    commands: track(contribute.commands),
    connections: track(contribute.connections),
    viewExtensions: track(contribute.viewExtensions),
    routeGuards: track(contribute.routeGuards),
    shortcuts: track(contribute.shortcuts),
    jobs: track(contribute.jobs),
    seeds: track(contribute.seeds),
  };
}

/** Map from registry name → the capability required to register entries. */
const REGISTRY_CAPS: Readonly<Record<string, Capability>> = {
  fieldKinds: "register:field-kind",
  widgetTypes: "register:widget-type",
  viewModes: "register:view-mode",
  chartKinds: "register:chart-kind",
  exporters: "register:exporter",
  importers: "register:importer",
  authProviders: "auth",
  dataSources: "data-source",
  themes: "theme",
  layouts: "layout",
};

/** Return a registries object whose `register(...)` calls are attributed
 *  to the given plugin id AND auto-disposed when the plugin unloads. */
function scopedRegistryFacade(
  registries: ExtensionRegistriesMutable,
  contributor: string,
  disposers: Disposable[],
  permissions?: PermissionGate,
  manifest?: PluginManifest,
): ExtensionRegistriesMutable {
  const wrapRegistry = <K extends string, V>(
    r: ExtensionRegistriesMutable[keyof ExtensionRegistriesMutable] & {
      register: (k: K, v: V) => Disposable;
      registerMany?: (entries: Record<K, V>) => Disposable;
    },
    registryName: string,
  ): typeof r => {
    const requiredCap = REGISTRY_CAPS[registryName];
    const guard = () => {
      if (requiredCap && permissions && !permissions.has(requiredCap)) {
        throw new CapabilityError(
          manifest?.id ?? contributor,
          requiredCap,
        );
      }
    };
    return new Proxy(r, {
      get(target, prop) {
        if (prop === "register") {
          return (k: K, v: V) => {
            guard();
            const d = registries._withContributor(contributor, () =>
              (target as unknown as { register: (k: K, v: V) => Disposable }).register(k, v),
            );
            disposers.push(d);
            return d;
          };
        }
        if (prop === "registerMany") {
          return (entries: Record<K, V>) => {
            guard();
            const d = registries._withContributor(contributor, () =>
              (target as unknown as { registerMany: (e: Record<K, V>) => Disposable }).registerMany(entries),
            );
            disposers.push(d);
            return d;
          };
        }
        return (target as unknown as Record<string, unknown>)[prop as string];
      },
    }) as unknown as typeof r;
  };

  return {
    _withContributor: registries._withContributor.bind(registries),
    fieldKinds: wrapRegistry(registries.fieldKinds, "fieldKinds") as typeof registries.fieldKinds,
    widgetTypes: wrapRegistry(registries.widgetTypes, "widgetTypes") as typeof registries.widgetTypes,
    viewModes: wrapRegistry(registries.viewModes, "viewModes") as typeof registries.viewModes,
    themes: wrapRegistry(registries.themes, "themes") as typeof registries.themes,
    layouts: wrapRegistry(registries.layouts, "layouts") as typeof registries.layouts,
    dataSources: wrapRegistry(registries.dataSources, "dataSources") as typeof registries.dataSources,
    exporters: wrapRegistry(registries.exporters, "exporters") as typeof registries.exporters,
    importers: wrapRegistry(registries.importers, "importers") as typeof registries.importers,
    authProviders: wrapRegistry(registries.authProviders, "authProviders") as typeof registries.authProviders,
    chartKinds: wrapRegistry(registries.chartKinds, "chartKinds") as typeof registries.chartKinds,
    notificationChannels: wrapRegistry(registries.notificationChannels, "notificationChannels") as typeof registries.notificationChannels,
    filterOps: wrapRegistry(registries.filterOps, "filterOps") as typeof registries.filterOps,
    expressionFunctions: wrapRegistry(registries.expressionFunctions, "expressionFunctions") as typeof registries.expressionFunctions,
  };
}

/* ================================================================== */
/* Dual-mode compat — wrap a legacy `Plugin` as a v2 `PluginV2`        */
/* ================================================================== */

export function wrapLegacyPlugin(legacy: {
  readonly id: string;
  readonly label: string;
  readonly version?: string;
  readonly description?: string;
  readonly icon?: string;
  readonly admin?: {
    readonly nav?: readonly NavItem[];
    readonly navSections?: readonly NavSection[];
    readonly views?: readonly View[];
    readonly resources?: readonly ResourceDefinition[];
    readonly widgets?: readonly DashboardWidget[];
    readonly globalActions?: readonly ActionDescriptor[];
    readonly commands?: readonly CommandDescriptor[];
  };
  readonly onActivate?: () => void | Promise<void>;
  readonly onDeactivate?: () => void | Promise<void>;
}): PluginV2 {
  const manifest: PluginManifest = {
    id: legacy.id,
    version: legacy.version ?? "0.0.0",
    label: legacy.label,
    description: legacy.description,
    icon: legacy.icon,
    requires: {
      shell: "*",
      capabilities: [
        "resources:read",
        "resources:write",
        "resources:delete",
        "nav",
        "commands",
        "topbar",
        "shortcuts",
        "theme",
        "layout",
        "storage",
      ],
    },
    activationEvents: [{ kind: "onStart" }],
    origin: { kind: "legacy" },
  };
  return {
    manifest,
    async activate(ctx) {
      const admin = legacy.admin;
      if (admin?.resources?.length) ctx.contribute.resources(admin.resources);
      if (admin?.navSections?.length) ctx.contribute.navSections(admin.navSections);
      if (admin?.nav?.length) ctx.contribute.nav(admin.nav);
      if (admin?.views?.length) ctx.contribute.views(admin.views);
      if (admin?.widgets?.length) ctx.contribute.widgets(admin.widgets);
      if (admin?.commands?.length) ctx.contribute.commands(admin.commands);
      if (admin?.globalActions?.length) ctx.contribute.actions(admin.globalActions);
      if (legacy.onActivate) await legacy.onActivate();
    },
    async deactivate() {
      if (legacy.onDeactivate) await legacy.onDeactivate();
    },
  };
}
