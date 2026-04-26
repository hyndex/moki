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
export function createContributionStore() {
    const nav = new Map();
    const navSections = new Map();
    const views = new Map();
    const resources = new Map();
    const widgets = new Map();
    const actions = new Map();
    const commands = new Map();
    const connections = new Map();
    const viewExtensions = new Map();
    const routeGuards = new Map();
    const shortcuts = new Map();
    const jobs = new Map();
    const seeds = new Map();
    const conflicts = [];
    const listeners = new Set();
    const emit = () => {
        for (const l of listeners) {
            try {
                l();
            }
            catch (err) {
                // eslint-disable-next-line no-console
                console.error("[contribution-store] listener threw", err);
            }
        }
    };
    const dropByPlugin = (pluginId) => {
        let changed = false;
        const cleanMap = (m) => {
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
                const h = v.handle;
                if (typeof h === "number")
                    clearInterval(h);
                jobs.delete(k);
                changed = true;
            }
        }
        // Keep conflicts that no longer involve this plugin.
        for (let i = conflicts.length - 1; i >= 0; i--) {
            const c = conflicts[i];
            const before = c.contributors.length;
            c.contributors = c.contributors.filter((p) => p !== pluginId);
            if (c.contributors.length !== before)
                changed = true;
            if (c.contributors.length < 2)
                conflicts.splice(i, 1);
        }
        if (changed)
            emit();
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
        countByPlugin(pluginId) {
            const out = {};
            const count = (k, m) => {
                let n = 0;
                for (const v of m.values())
                    if (v.pluginId === pluginId)
                        n++;
                if (n > 0)
                    out[k] = n;
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
function makeContributions(manifest, store, permissions, notifyStoreChange) {
    const pluginId = manifest.id;
    const recordConflict = (kind, key, contributor) => {
        const existing = store.conflicts.find((c) => c.kind === kind && c.key === key);
        if (existing) {
            if (!existing.contributors.includes(contributor)) {
                existing.contributors.push(contributor);
            }
        }
        else {
            store.conflicts.push({ kind, key, contributors: [contributor] });
        }
    };
    const contributeBag = (kind, map, items, keyOf, wrap) => {
        const addedKeys = [];
        for (const it of items) {
            const key = keyOf(it);
            if (!key)
                continue;
            if (map.has(key)) {
                const prev = map.get(key);
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
                if (entry && entry.pluginId === pluginId)
                    map.delete(k);
            }
            notifyStoreChange();
        };
    };
    return {
        nav(items) {
            permissions.require("nav");
            return contributeBag("nav", store.nav, items, (i) => i.id, (item, pluginId) => ({ item, pluginId }));
        },
        navSections(sections) {
            permissions.require("nav");
            return contributeBag("navSection", store.navSections, sections, (s) => s.id, (section, pluginId) => ({ section, pluginId }));
        },
        views(views) {
            return contributeBag("view", store.views, views, (v) => v.id, (view, pluginId) => ({ view, pluginId }));
        },
        resources(resources) {
            permissions.require("resources:read");
            return contributeBag("resource", store.resources, resources, (r) => r.id, (resource, pluginId) => ({ resource, pluginId }));
        },
        widgets(widgets) {
            return contributeBag("widget", store.widgets, widgets, (w) => w.id, (widget, pluginId) => ({ widget, pluginId }));
        },
        actions(actions) {
            return contributeBag("action", store.actions, actions, (a) => a.id, (action, pluginId) => ({ action, pluginId }));
        },
        commands(commands) {
            permissions.require("commands");
            return contributeBag("command", store.commands, commands, (c) => c.id, (command, pluginId) => ({ command, pluginId }));
        },
        connections(desc) {
            return contributeBag("connection", store.connections, [desc], (d) => d.parentResource, (connection, pluginId) => ({ connection, pluginId }));
        },
        viewExtensions(exts) {
            return contributeBag("viewExtension", store.viewExtensions, exts, (e, i = 0) => {
                const t = typeof e.target === "string" ? e.target : "*";
                const suffix = e.tab?.id ?? e.section?.id ?? e.rowAction?.id ?? e.pageAction?.id ?? e.railCard?.id ?? String(i);
                return `${pluginId}::${t}::${suffix}`;
            }, (extension, pluginId) => ({ extension, pluginId }));
        },
        routeGuards(guards) {
            return contributeBag("routeGuard", store.routeGuards, guards, (_g, i = 0) => `${pluginId}::guard::${String(i)}`, (guard, pluginId) => ({ guard, pluginId }));
        },
        shortcuts(shortcuts) {
            permissions.require("shortcuts");
            return contributeBag("shortcut", store.shortcuts, shortcuts, (s) => `${pluginId}::${s.keys}`, (shortcut, pluginId) => ({ shortcut, pluginId }));
        },
        jobs(jobsList) {
            const added = [];
            for (const job of jobsList) {
                const key = `${pluginId}::${job.id}`;
                const intervalMs = typeof job.schedule === "number" ? job.schedule : parseCronishMs(job.schedule);
                if (intervalMs === null)
                    continue;
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
                        if (typeof entry.handle === "number")
                            clearInterval(entry.handle);
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
                if (entry && entry.pluginId === pluginId)
                    store.seeds.delete(key);
                notifyStoreChange();
            };
        },
    };
}
/** Very loose cron parser — supports "every Nm/s/h/d". Returns ms or null. */
function parseCronishMs(s) {
    const m = s.trim().toLowerCase().match(/^every\s+(\d+)\s*(ms|s|m|h|d)$/);
    if (!m)
        return null;
    const n = Number(m[1]);
    switch (m[2]) {
        case "ms": return n;
        case "s": return n * 1000;
        case "m": return n * 60_000;
        case "h": return n * 3_600_000;
        case "d": return n * 86_400_000;
        default: return null;
    }
}
/* ================================================================== */
/* Scoped runtime                                                      */
/* ================================================================== */
function makeScopedStorage(pluginId) {
    const prefix = `gutu.plugin.${pluginId}.`;
    const mem = new Map();
    const hasLS = (() => {
        try {
            if (typeof window === "undefined")
                return false;
            const k = "__gutu_ls_probe";
            window.localStorage.setItem(k, "1");
            window.localStorage.removeItem(k);
            return true;
        }
        catch {
            return false;
        }
    })();
    return {
        get(key) {
            const full = prefix + key;
            if (hasLS) {
                try {
                    const raw = window.localStorage.getItem(full);
                    if (raw == null)
                        return undefined;
                    return JSON.parse(raw);
                }
                catch {
                    /* fall through to mem */
                }
            }
            return mem.get(full);
        },
        set(key, value) {
            const full = prefix + key;
            mem.set(full, value);
            if (hasLS) {
                try {
                    window.localStorage.setItem(full, JSON.stringify(value));
                }
                catch {
                    /* quota or serialization — mem fallback is authoritative */
                }
            }
        },
        remove(key) {
            const full = prefix + key;
            mem.delete(full);
            if (hasLS) {
                try {
                    window.localStorage.removeItem(full);
                }
                catch {
                    /* ignore */
                }
            }
        },
        clear() {
            for (const k of Array.from(mem.keys())) {
                if (k.startsWith(prefix))
                    mem.delete(k);
            }
            if (hasLS) {
                try {
                    const rm = [];
                    for (let i = 0; i < window.localStorage.length; i++) {
                        const key = window.localStorage.key(i);
                        if (key && key.startsWith(prefix))
                            rm.push(key);
                    }
                    rm.forEach((k) => window.localStorage.removeItem(k));
                }
                catch {
                    /* ignore */
                }
            }
        },
        keys() {
            const out = new Set();
            for (const k of mem.keys()) {
                if (k.startsWith(prefix))
                    out.add(k.slice(prefix.length));
            }
            if (hasLS) {
                try {
                    for (let i = 0; i < window.localStorage.length; i++) {
                        const key = window.localStorage.key(i);
                        if (key && key.startsWith(prefix))
                            out.add(key.slice(prefix.length));
                    }
                }
                catch {
                    /* ignore */
                }
            }
            return Array.from(out);
        },
    };
}
function makeLogger(pluginId) {
    const prefix = `[${pluginId}]`;
    return {
        /* eslint-disable no-console */
        trace: (...a) => console.trace(prefix, ...a),
        debug: (...a) => console.debug(prefix, ...a),
        info: (...a) => console.info(prefix, ...a),
        warn: (...a) => console.warn(prefix, ...a),
        error: (...a) => console.error(prefix, ...a),
        /* eslint-enable no-console */
    };
}
function makeI18n(pluginId, storage) {
    let currentLocale = (typeof navigator !== "undefined" && navigator.language?.split("-")[0]) || "en";
    let catalogs = (storage.get("i18n.catalogs")) ?? {};
    return {
        t(key, params) {
            const entry = catalogs[currentLocale]?.[key] ?? catalogs.en?.[key] ?? key;
            if (!params)
                return entry;
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
function makeAssetResolver(manifest) {
    const base = manifest.origin?.kind === "remote"
        ? (manifest.origin.location ?? "").replace(/\/[^/]*$/, "/")
        : manifest.origin?.kind === "filesystem"
            ? `/plugins/${manifest.id}/assets/`
            : `/plugins/${manifest.id}/`;
    return {
        url(relative) {
            if (/^(https?:|data:|blob:)/i.test(relative))
                return relative;
            return base + relative.replace(/^\/+/, "");
        },
    };
}
function makePermissionGate(manifest) {
    const granted = new Set(manifest.requires?.capabilities ?? []);
    return {
        has(cap) {
            if (granted.has(cap))
                return true;
            // Fine-grained ladder for generic → specific caps:
            //   resources:write grants resource:<anything>:write
            //   resources:read  grants resource:<anything>         (read)
            //   resources:delete grants resource:<anything>:delete
            if (typeof cap === "string" && cap.startsWith("resource:")) {
                if (cap.endsWith(":write") && granted.has("resources:write"))
                    return true;
                if (cap.endsWith(":delete") && granted.has("resources:delete"))
                    return true;
                if (!cap.endsWith(":write") && !cap.endsWith(":delete") && granted.has("resources:read"))
                    return true;
            }
            return false;
        },
        require(cap) {
            if (!this.has(cap)) {
                throw new CapabilityError(manifest.id, cap);
            }
        },
    };
}
export class CapabilityError extends Error {
    pluginId;
    capability;
    constructor(pluginId, capability) {
        super(`Plugin "${pluginId}" attempted "${capability}" without declaring it in manifest.requires.capabilities.`);
        this.pluginId = pluginId;
        this.capability = capability;
        this.name = "CapabilityError";
    }
}
function makeAnalytics(manifest, runtime) {
    // The strict analytics emitter has a typed event map; plugins emit free-form
    // strings so we widen through an untyped facade.
    const emitter = runtime.analytics;
    return {
        emit(event, props) {
            emitter.emit(event, { ...(props ?? {}), plugin: manifest.id });
        },
        setMeta(meta) {
            emitter.setMeta({ ...meta, plugin: manifest.id });
        },
    };
}
function makeScopedBus(manifest, runtime, disposers) {
    // The strict Emitter<RuntimeEvents> has a typed event map; plugins use free-
    // form event names so we widen through an untyped facade.
    const bus = runtime.bus;
    return {
        emit(event, payload) {
            // Tag events with the source plugin so listeners can attribute.
            const tagged = payload && typeof payload === "object"
                ? { ...payload, __from: manifest.id }
                : payload;
            bus.emit(event, tagged);
        },
        on(event, handler) {
            const off = bus.on(event, handler);
            const wrapped = () => off();
            disposers.push(wrapped);
            return wrapped;
        },
        once(event, handler) {
            const off = bus.on(event, (p) => {
                off();
                handler(p);
            });
            const wrapped = () => off();
            disposers.push(wrapped);
            return wrapped;
        },
    };
}
function makeScopedResourceClient(manifest, runtime, permissions) {
    /** Enforces: per-resource caps are checked first; a plugin can declare
     *  `resource:sales.deal:write` without the broad `resources:write`.
     *  If it declared neither, the broad cap is checked next. */
    const guard = (operation, resource) => {
        const fine = operation === "read"
            ? `resource:${resource}`
            : `resource:${resource}:${operation}`;
        const broad = operation === "read" ? "resources:read" : operation === "write" ? "resources:write" : "resources:delete";
        if (permissions.has(fine))
            return;
        if (permissions.has(broad))
            return;
        throw new CapabilityError(manifest.id, fine);
    };
    return {
        async list(resource, query) {
            guard("read", resource);
            return runtime.resources.list(resource, query ?? {});
        },
        async get(resource, id) {
            guard("read", resource);
            return runtime.resources.get(resource, id);
        },
        async create(resource, body) {
            guard("write", resource);
            return runtime.resources.create(resource, body);
        },
        async update(resource, id, patch) {
            guard("write", resource);
            return runtime.resources.update(resource, id, patch);
        },
        async delete(resource, id) {
            guard("delete", resource);
            return runtime.resources.delete(resource, id);
        },
    };
}
export function buildPluginContext(args) {
    const { manifest, runtime, registries, store, peers, notifyStoreChange } = args;
    const disposers = [];
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
    const scopedRegistries = scopedRegistryFacade(registries, manifest.id, disposers, permissions, manifest);
    const scopedRuntime = {
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
                intent: msg.intent ?? "info",
            });
        },
    };
    const contribute = makeContributions(manifest, store, permissions, notifyStoreChange);
    // Wrap each contribute.* so its disposer is tracked for auto-cleanup.
    const contributeTracked = wrapContributionsForCleanup(contribute, disposers);
    const context = {
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
function wrapContributionsForCleanup(contribute, disposers) {
    const track = (fn) => {
        return (...a) => {
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
const REGISTRY_CAPS = {
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
function scopedRegistryFacade(registries, contributor, disposers, permissions, manifest) {
    const wrapRegistry = (r, registryName) => {
        const requiredCap = REGISTRY_CAPS[registryName];
        const guard = () => {
            if (requiredCap && permissions && !permissions.has(requiredCap)) {
                throw new CapabilityError(manifest?.id ?? contributor, requiredCap);
            }
        };
        return new Proxy(r, {
            get(target, prop) {
                if (prop === "register") {
                    return (k, v) => {
                        guard();
                        const d = registries._withContributor(contributor, () => target.register(k, v));
                        disposers.push(d);
                        return d;
                    };
                }
                if (prop === "registerMany") {
                    return (entries) => {
                        guard();
                        const d = registries._withContributor(contributor, () => target.registerMany(entries));
                        disposers.push(d);
                        return d;
                    };
                }
                return target[prop];
            },
        });
    };
    return {
        _withContributor: registries._withContributor.bind(registries),
        fieldKinds: wrapRegistry(registries.fieldKinds, "fieldKinds"),
        widgetTypes: wrapRegistry(registries.widgetTypes, "widgetTypes"),
        viewModes: wrapRegistry(registries.viewModes, "viewModes"),
        themes: wrapRegistry(registries.themes, "themes"),
        layouts: wrapRegistry(registries.layouts, "layouts"),
        dataSources: wrapRegistry(registries.dataSources, "dataSources"),
        exporters: wrapRegistry(registries.exporters, "exporters"),
        importers: wrapRegistry(registries.importers, "importers"),
        authProviders: wrapRegistry(registries.authProviders, "authProviders"),
        chartKinds: wrapRegistry(registries.chartKinds, "chartKinds"),
        notificationChannels: wrapRegistry(registries.notificationChannels, "notificationChannels"),
        filterOps: wrapRegistry(registries.filterOps, "filterOps"),
        expressionFunctions: wrapRegistry(registries.expressionFunctions, "expressionFunctions"),
    };
}
