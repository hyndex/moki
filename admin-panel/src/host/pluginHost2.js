/** pluginHost2 — the v2 activation engine.
 *
 *  Responsibilities:
 *    1. Discover plugins from multiple loaders (filesystem, URL, npm).
 *    2. Validate manifests, verify signatures/integrity when remote.
 *    3. Check shell + peer-plugin version compatibility.
 *    4. Topologically sort by `requires.plugins`; detect cycles.
 *    5. Activate in order with per-plugin error isolation (throwing a plugin
 *       quarantines it + its dependents; peers continue).
 *    6. Wire seeds into the mock backend.
 *    7. Expose install/uninstall/reload APIs so the admin UI can manage
 *       plugins at runtime.
 *    8. Maintain a `PluginHost` singleton per shell that the Inspector UI
 *       subscribes to for live state.
 *
 *  This is the single runtime path — every plugin is a v2 `PluginV2`. */
import { createContributionStore, buildPluginContext, } from "@/runtime/pluginContext";
import { createExtensionRegistries, seedBuiltInRegistries, } from "@/runtime/registries";
import { satisfies as semverSatisfies } from "@/runtime/semver";
import { verifyAgainstTrustedKeys, loadTrustedKeys, } from "@/runtime/pluginSignature";
/** Current running shell API version. Bumped on breaking contract changes. */
export const SHELL_API_VERSION = "2.0.0";
/** Hard ceiling on a single plugin's `activate()` call. A hung plugin
 *  is quarantined after this elapses. Configurable via env / arg. */
export const DEFAULT_ACTIVATION_TIMEOUT_MS = 15_000;
/** Maximum parallel activations. Dependent plugins still serialize;
 *  independent groups fan out. */
export const DEFAULT_ACTIVATION_CONCURRENCY = 8;
export function createPluginHost2(args) {
    const { runtime } = args;
    const registries = createExtensionRegistries();
    if (args.seedDefaults !== false)
        seedBuiltInRegistries(registries);
    const contributions = createContributionStore();
    const active = new Map();
    const listeners = new Set();
    const emit = () => {
        for (const l of listeners) {
            try {
                l();
            }
            catch (err) {
                // eslint-disable-next-line no-console
                console.error("[plugin-host] listener threw", err);
            }
        }
    };
    contributions.subscribe(emit);
    /* ----- Peer access ----- */
    const peerListeners = new Set();
    const peers = {
        get(pluginId) {
            const e = active.get(pluginId);
            if (!e || e.status !== "active")
                return undefined;
            return { api: e.plugin.api ?? {}, manifest: e.manifest };
        },
        isActive(pluginId) {
            return active.get(pluginId)?.status === "active";
        },
        on(event, handler) {
            const wrapped = (ev, id) => {
                if (ev === event)
                    handler(id);
            };
            peerListeners.add(wrapped);
            return () => peerListeners.delete(wrapped);
        },
    };
    const emitPeer = (event, id) => {
        for (const l of peerListeners) {
            try {
                l(event, id);
            }
            catch (err) {
                // eslint-disable-next-line no-console
                console.error("[plugin-host] peer listener threw", err);
            }
        }
    };
    /* ----- Analytics emission ----- */
    const analyticsEmit = (event, props) => {
        try {
            runtime.analytics.emit(event, props);
        }
        catch { /* swallow — analytics must never break the host */ }
    };
    /* ----- Per-plugin activation ----- */
    const activatePlugin = async (plugin) => {
        const manifest = plugin.manifest;
        /* Sandbox tier — when declared, spawn an iframe / worker for the
         * plugin and let the sandbox bridge handle activation. The plugin's
         * main-thread activate() is NOT called; instead the sandbox re-loads
         * the module from its origin URL and runs activate() in isolation. */
        if (manifest.sandbox === "iframe" || manifest.sandbox === "worker") {
            return activateSandboxed(plugin);
        }
        const entry = {
            manifest,
            plugin,
            status: "loading",
            disposers: [],
        };
        active.set(manifest.id, entry);
        emit();
        // Compatibility: shell version.
        const requireShell = manifest.requires?.shell;
        if (requireShell && requireShell !== "*" && !semverSatisfies(SHELL_API_VERSION, requireShell)) {
            entry.status = "quarantined";
            entry.error = `Requires shell ${requireShell} but host is ${SHELL_API_VERSION}`;
            emitPeer("quarantined", manifest.id);
            emit();
            return entry;
        }
        // Compatibility: peer plugins.
        for (const [depId, depRange] of Object.entries(manifest.requires?.plugins ?? {})) {
            const depEntry = active.get(depId);
            if (!depEntry || depEntry.status !== "active") {
                entry.status = "quarantined";
                entry.error = `Requires plugin "${depId}" (${depRange}) but it isn't active`;
                emitPeer("quarantined", manifest.id);
                emit();
                return entry;
            }
            if (!semverSatisfies(depEntry.manifest.version, depRange)) {
                entry.status = "quarantined";
                entry.error = `Requires "${depId}" ${depRange}, found ${depEntry.manifest.version}`;
                emitPeer("quarantined", manifest.id);
                emit();
                return entry;
            }
        }
        // Activation.
        entry.status = "activating";
        emit();
        try {
            const { context, disposers } = buildPluginContext({
                manifest,
                runtime,
                registries,
                store: contributions,
                peers,
                notifyStoreChange: emit,
            });
            const activationStart = performance.now();
            await withTimeout(plugin.activate(context), DEFAULT_ACTIVATION_TIMEOUT_MS, `Plugin "${manifest.id}" activate() exceeded ${DEFAULT_ACTIVATION_TIMEOUT_MS}ms`);
            entry.disposers = disposers;
            entry.status = "active";
            entry.activatedAt = Date.now();
            entry.activationDurationMs = performance.now() - activationStart;
            analyticsEmit("plugin.activated", {
                pluginId: manifest.id,
                version: manifest.version,
                durationMs: entry.activationDurationMs,
                origin: manifest.origin?.kind,
            });
            // Flush plugin-contributed seeds into the mock backend, if present.
            const backend = runtime.__backend;
            if (backend) {
                for (const seedEntry of contributions.seeds.values()) {
                    if (seedEntry.pluginId === manifest.id) {
                        for (const s of seedEntry.seeds) {
                            backend.seed(s.resource, [...s.rows]);
                        }
                    }
                }
                // Resource-level seed metadata: plugins may attach `__seed` to any
                // ResourceDefinition they contribute; the mock backend picks it up.
                for (const { resource, pluginId } of contributions.resources.values()) {
                    if (pluginId !== manifest.id)
                        continue;
                    const seedRows = resource.__seed;
                    if (seedRows)
                        backend.seed(resource.id, [...seedRows]);
                }
            }
            emitPeer("activated", manifest.id);
        }
        catch (err) {
            entry.status = "quarantined";
            entry.error = err instanceof Error ? err.message : String(err);
            // Clean up anything the plugin did register before it threw.
            for (const d of entry.disposers) {
                try {
                    d();
                }
                catch { /* swallow */ }
            }
            entry.disposers = [];
            contributions.dropByPlugin(manifest.id);
            // eslint-disable-next-line no-console
            console.error(`[plugin-host] "${manifest.id}" activate() threw`, err);
            analyticsEmit("plugin.quarantined", {
                pluginId: manifest.id,
                version: manifest.version,
                error: entry.error,
                origin: manifest.origin?.kind,
            });
            emitPeer("quarantined", manifest.id);
        }
        finally {
            emit();
        }
        return entry;
    };
    const activateSandboxed = async (plugin) => {
        const manifest = plugin.manifest;
        const entry = {
            manifest,
            plugin,
            status: "activating",
            disposers: [],
        };
        active.set(manifest.id, entry);
        emit();
        const entryUrl = manifest.origin?.location ?? "";
        if (!entryUrl) {
            entry.status = "quarantined";
            entry.error = "Sandboxed plugins require manifest.origin.location (module URL).";
            emitPeer("quarantined", manifest.id);
            emit();
            return entry;
        }
        try {
            if (manifest.sandbox === "iframe") {
                const { spawnIframeSandbox } = await import("./sandbox/iframeSandbox");
                const handle = await spawnIframeSandbox({
                    plugin,
                    host: self,
                    entryUrl,
                });
                entry.sandbox = handle;
            }
            else if (manifest.sandbox === "worker") {
                const { spawnWorkerSandbox } = await import("./sandbox/workerSandbox");
                const handle = await spawnWorkerSandbox({
                    plugin,
                    host: self,
                    entryUrl,
                });
                entry.sandbox = handle;
            }
            entry.status = "active";
            entry.activatedAt = Date.now();
            emitPeer("activated", manifest.id);
        }
        catch (err) {
            entry.status = "quarantined";
            entry.error = err instanceof Error ? err.message : String(err);
            emitPeer("quarantined", manifest.id);
            // eslint-disable-next-line no-console
            console.error(`[plugin-host] sandbox "${manifest.id}" failed to spawn`, err);
        }
        finally {
            emit();
        }
        return entry;
    };
    const deactivatePlugin = async (pluginId) => {
        const entry = active.get(pluginId);
        if (!entry)
            return;
        try {
            if (entry.plugin.deactivate)
                await entry.plugin.deactivate();
        }
        catch (err) {
            // eslint-disable-next-line no-console
            console.error(`[plugin-host] "${pluginId}" deactivate() threw`, err);
        }
        for (const d of entry.disposers) {
            try {
                d();
            }
            catch { /* swallow */ }
        }
        /* Dispose sandbox if present. */
        if (entry.sandbox) {
            try {
                entry.sandbox.dispose();
            }
            catch { /* swallow */ }
        }
        contributions.dropByPlugin(pluginId);
        entry.status = "deactivated";
        entry.disposers = [];
        analyticsEmit("plugin.deactivated", {
            pluginId,
            version: entry.manifest.version,
        });
        emitPeer("deactivated", pluginId);
        emit();
    };
    /* ----- Public surface ----- */
    const install = async (plugin) => {
        // Reject duplicate ids.
        if (active.has(plugin.manifest.id)) {
            const prev = active.get(plugin.manifest.id);
            if (prev.status === "active") {
                return toRecord(prev);
            }
            await deactivatePlugin(plugin.manifest.id);
        }
        const entry = await activatePlugin(plugin);
        return toRecord(entry);
    };
    const uninstall = async (pluginId) => {
        await deactivatePlugin(pluginId);
        active.delete(pluginId);
        emit();
    };
    const reload = async (pluginId) => {
        const entry = active.get(pluginId);
        if (!entry)
            return;
        const plugin = entry.plugin;
        await deactivatePlugin(pluginId);
        await activatePlugin(plugin);
    };
    const installFromURL = async (url) => {
        // 1. Validate URL shape before hitting the network.
        let parsed;
        try {
            parsed = new URL(url);
        }
        catch {
            throw new Error(`Invalid manifest URL: "${url}"`);
        }
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
            throw new Error(`Unsupported manifest scheme: ${parsed.protocol}`);
        }
        // 2. Fetch with timeout — 10 seconds is ample for a JSON manifest.
        const res = await fetchWithTimeout(url, { mode: "cors" }, 10_000);
        if (!res.ok)
            throw new Error(`Manifest fetch failed: ${res.status} ${res.statusText}`);
        const contentType = res.headers.get("content-type") ?? "";
        if (!contentType.includes("json") && !contentType.includes("text")) {
            throw new Error(`Manifest has unexpected content-type: "${contentType}"`);
        }
        // 3. Parse JSON with precise errors.
        let manifest;
        try {
            manifest = (await res.json());
        }
        catch (err) {
            throw new Error(`Manifest JSON parse failed: ${err instanceof Error ? err.message : String(err)}`);
        }
        // 4. Required field validation.
        if (!manifest.id)
            throw new Error("Manifest missing `id`");
        if (!manifest.version)
            throw new Error("Manifest missing `version`");
        if (!manifest.label)
            throw new Error("Manifest missing `label`");
        if (!manifest.entry)
            throw new Error("Manifest missing `entry` URL");
        if (manifest.requires?.shell && !semverSatisfies(SHELL_API_VERSION, manifest.requires.shell)) {
            throw new Error(`Plugin "${manifest.id}" requires shell ${manifest.requires.shell}, host is ${SHELL_API_VERSION}`);
        }
        // Integrity check — compute SHA-384 of the entry bytes when declared.
        const entryUrl = new URL(manifest.entry, url).toString();
        const entryRes = await fetchWithTimeout(entryUrl, { mode: "cors" }, 30_000);
        if (!entryRes.ok)
            throw new Error(`Plugin entry fetch failed: ${entryRes.status} ${entryRes.statusText}`);
        const entryType = entryRes.headers.get("content-type") ?? "";
        if (!entryType.includes("javascript") && !entryType.includes("module")) {
            // eslint-disable-next-line no-console
            console.warn(`[plugin-host] remote entry content-type="${entryType}" — expected application/javascript. Attempting import anyway.`);
        }
        const buf = await entryRes.clone().arrayBuffer();
        if (buf.byteLength === 0) {
            throw new Error("Plugin entry bundle is empty (0 bytes).");
        }
        if (buf.byteLength > 32 * 1024 * 1024) {
            throw new Error(`Plugin entry bundle exceeds 32MB (${Math.round(buf.byteLength / 1024 / 1024)}MB). Refused.`);
        }
        if (manifest.origin?.integrity) {
            const expected = manifest.origin.integrity;
            const actual = await computeSRI(buf);
            if (expected !== actual) {
                throw new Error(`Integrity check failed: declared ${expected}, computed ${actual}`);
            }
        }
        /* Signature check — if the manifest declares a signature, the
         * publisher's public key must be in the trusted-keys list and the
         * signature must verify against the bundle bytes. */
        const sigObj = manifest.origin;
        if (sigObj?.signature) {
            if (!sigObj.signaturePublicKey && !sigObj.publicKey) {
                throw new Error("Manifest declares a signature but no publicKey to verify it against.");
            }
            const trusted = loadTrustedKeys();
            if (trusted.length === 0) {
                throw new Error("No trusted publisher keys configured. Add the publisher's key via Plugin Inspector → Trusted keys before installing signed plugins.");
            }
            const descriptor = {
                signature: sigObj.signature,
                publicKey: sigObj.publicKey ?? sigObj.signaturePublicKey,
            };
            const verify = await verifyAgainstTrustedKeys(buf, descriptor);
            if (!verify.ok) {
                throw new Error(`Signature verification failed: ${verify.error ?? "unknown"}`);
            }
        }
        // Load via a Blob URL so the browser treats it as a fresh ESM module.
        const blob = new Blob([buf], { type: "application/javascript" });
        const blobUrl = URL.createObjectURL(blob);
        try {
            const mod = (await import(/* @vite-ignore */ blobUrl));
            const plugin = "default" in mod && mod.default ? mod.default : mod;
            const stamped = {
                ...plugin,
                manifest: {
                    ...plugin.manifest,
                    origin: { kind: "remote", location: url, integrity: manifest.origin?.integrity },
                },
            };
            return install(stamped);
        }
        finally {
            URL.revokeObjectURL(blobUrl);
        }
    };
    return {
        registries,
        contributions,
        peers,
        getRecords() {
            return Array.from(active.values()).map(toRecord);
        },
        subscribe(cb) {
            listeners.add(cb);
            return () => listeners.delete(cb);
        },
        install,
        uninstall,
        reload,
        installFromURL,
    };
    function toRecord(e) {
        return {
            manifest: e.manifest,
            status: e.status,
            error: e.error,
            activatedAt: e.activatedAt,
            activationDurationMs: e.activationDurationMs,
            contributionCounts: contributions.countByPlugin(e.manifest.id),
            consentedCapabilities: e.manifest.requires?.capabilities,
        };
    }
}
/* ====================================================================== */
/* Topological ordering                                                    */
/* ====================================================================== */
/** Sort plugins by their `requires.plugins` graph. Returns the ordered list
 *  + any cycles as `{pluginId, reason}`. Plugins whose deps aren't present
 *  are returned at the end; activation will quarantine them. */
export function topoSortPlugins(plugins) {
    const byId = new Map();
    for (const p of plugins)
        byId.set(p.manifest.id, p);
    const ordered = [];
    const cycles = [];
    const visited = new Set();
    const stack = new Set();
    const visit = (id, path) => {
        if (visited.has(id))
            return;
        if (stack.has(id)) {
            cycles.push({ path: [...path, id] });
            return;
        }
        const plugin = byId.get(id);
        if (!plugin)
            return;
        stack.add(id);
        for (const dep of Object.keys(plugin.manifest.requires?.plugins ?? {})) {
            visit(dep, [...path, id]);
        }
        stack.delete(id);
        visited.add(id);
        ordered.push(plugin);
    };
    for (const p of plugins)
        visit(p.manifest.id, []);
    return { ordered, cycles };
}
/** Partition plugins into activation layers (Kahn's algorithm). Plugins in
 *  the same layer have no dependency between each other and can be
 *  activated in parallel. Subsequent layers wait for predecessors.
 *  Returns `layers: PluginV2[][]` + cycles detected. */
export function layerPlugins(plugins) {
    const byId = new Map();
    for (const p of plugins)
        byId.set(p.manifest.id, p);
    const inDegree = new Map();
    const dependents = new Map();
    for (const p of plugins) {
        inDegree.set(p.manifest.id, 0);
        dependents.set(p.manifest.id, []);
    }
    for (const p of plugins) {
        const deps = Object.keys(p.manifest.requires?.plugins ?? {});
        for (const dep of deps) {
            if (byId.has(dep)) {
                inDegree.set(p.manifest.id, (inDegree.get(p.manifest.id) ?? 0) + 1);
                dependents.get(dep).push(p.manifest.id);
            }
        }
    }
    const layers = [];
    let current = plugins.filter((p) => (inDegree.get(p.manifest.id) ?? 0) === 0);
    while (current.length > 0) {
        layers.push(current);
        const next = [];
        for (const p of current) {
            for (const child of dependents.get(p.manifest.id) ?? []) {
                const remaining = (inDegree.get(child) ?? 0) - 1;
                inDegree.set(child, remaining);
                if (remaining === 0) {
                    const plugin = byId.get(child);
                    if (plugin)
                        next.push(plugin);
                }
            }
        }
        current = next;
    }
    const processed = new Set(layers.flat().map((p) => p.manifest.id));
    const cycles = [];
    for (const p of plugins) {
        if (!processed.has(p.manifest.id)) {
            cycles.push({ path: [p.manifest.id] });
        }
    }
    return { layers, cycles };
}
/** Run async tasks with bounded concurrency. */
export async function runWithConcurrency(items, concurrency, task) {
    if (concurrency <= 1) {
        const out = [];
        for (const it of items)
            out.push(await task(it));
        return out;
    }
    const results = new Array(items.length);
    let idx = 0;
    const worker = async () => {
        while (true) {
            const i = idx++;
            if (i >= items.length)
                return;
            results[i] = await task(items[i]);
        }
    };
    const workers = Array.from({ length: Math.min(concurrency, items.length) }, worker);
    await Promise.all(workers);
    return results;
}
/* ====================================================================== */
/* SRI helper                                                              */
/* ====================================================================== */
/** Fetch with a deadline — aborts via AbortController when elapsed. */
async function fetchWithTimeout(url, init, ms) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error("timeout")), ms);
    try {
        return await fetch(url, { ...init, signal: controller.signal });
    }
    finally {
        clearTimeout(timer);
    }
}
/** Race a Promise against a deadline. Throws with the given message when
 *  the deadline fires. Used to keep hung plugin `activate()` calls from
 *  wedging the shell. */
function withTimeout(p, ms, message) {
    return new Promise((resolve, reject) => {
        let settled = false;
        const timer = setTimeout(() => {
            if (settled)
                return;
            settled = true;
            reject(new Error(message));
        }, ms);
        Promise.resolve(p).then((v) => {
            if (settled)
                return;
            settled = true;
            clearTimeout(timer);
            resolve(v);
        }, (err) => {
            if (settled)
                return;
            settled = true;
            clearTimeout(timer);
            reject(err);
        });
    });
}
async function computeSRI(buf) {
    const digest = await crypto.subtle.digest("SHA-384", buf);
    const b = new Uint8Array(digest);
    let bin = "";
    for (let i = 0; i < b.length; i++)
        bin += String.fromCharCode(b[i]);
    return "sha384-" + btoa(bin);
}
