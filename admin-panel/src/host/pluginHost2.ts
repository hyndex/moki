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
 *  Migration: the legacy `usePluginHost` is preserved; AppShell now uses
 *  `usePluginHost2` which internally wraps any legacy `Plugin` via
 *  `wrapLegacyPlugin`.
 */

import type { MockBackend } from "@/runtime/mockBackend";
import type {
  AnyPlugin,
  PluginInstallRecord,
  PluginManifest,
  PluginStatus,
  PluginV2,
  Disposable,
  Capability,
  PeerAccess,
} from "@/contracts/plugin-v2";
import { isV2Plugin } from "@/contracts/plugin-v2";
import {
  createContributionStore,
  wrapLegacyPlugin,
  buildPluginContext,
  type ContributionStore,
} from "@/runtime/pluginContext";
import {
  createExtensionRegistries,
  seedBuiltInRegistries,
  type ExtensionRegistriesMutable,
} from "@/runtime/registries";
import { satisfies as semverSatisfies } from "@/runtime/semver";
import type { AdminRuntime } from "@/runtime/context";
import {
  verifyAgainstTrustedKeys,
  loadTrustedKeys,
  type SignatureDescriptor,
} from "@/runtime/pluginSignature";

export interface PluginHost2 {
  readonly registries: ExtensionRegistriesMutable;
  readonly contributions: ContributionStore;
  /** Snapshot of every known plugin's state. */
  getRecords(): readonly PluginInstallRecord[];
  /** Subscribe to host state changes. */
  subscribe(cb: () => void): Disposable;
  /** Install + activate a plugin at runtime. */
  install(plugin: AnyPlugin): Promise<PluginInstallRecord>;
  /** Deactivate + drop contributions. */
  uninstall(pluginId: string): Promise<void>;
  /** Restart a plugin (deactivate + activate). */
  reload(pluginId: string): Promise<void>;
  /** Fetch + install a remote plugin from a manifest URL. */
  installFromURL(url: string): Promise<PluginInstallRecord>;
  /** Peer access used by PluginContext.peers. */
  readonly peers: PeerAccess;
}

/** Current running shell API version. Bumped on breaking contract changes. */
export const SHELL_API_VERSION = "2.0.0";

interface ActiveEntry {
  readonly manifest: PluginManifest;
  readonly plugin: PluginV2;
  status: PluginStatus;
  disposers: Disposable[];
  error?: string;
  activatedAt?: number;
  /** Sandbox handle when manifest.sandbox is "iframe" or "worker". */
  sandbox?: { dispose: () => void };
}

export function createPluginHost2(args: {
  runtime: AdminRuntime;
  /** Toggle built-in registry defaults (test harness can skip). */
  seedDefaults?: boolean;
}): PluginHost2 {
  const { runtime } = args;
  const registries = createExtensionRegistries();
  if (args.seedDefaults !== false) seedBuiltInRegistries(registries);

  const contributions = createContributionStore();
  const active = new Map<string, ActiveEntry>();
  const listeners = new Set<() => void>();

  const emit = () => {
    for (const l of listeners) {
      try {
        l();
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("[plugin-host] listener threw", err);
      }
    }
  };
  contributions.subscribe(emit);

  /* ----- Peer access ----- */
  const peerListeners = new Set<(event: "activated" | "deactivated" | "quarantined", id: string) => void>();
  const peers: PeerAccess = {
    get<T = unknown>(pluginId: string) {
      const e = active.get(pluginId);
      if (!e || e.status !== "active") return undefined;
      return { api: (e.plugin.api as T) ?? ({} as T), manifest: e.manifest };
    },
    isActive(pluginId) {
      return active.get(pluginId)?.status === "active";
    },
    on(event, handler) {
      const wrapped = (ev: "activated" | "deactivated" | "quarantined", id: string) => {
        if (ev === event) handler(id);
      };
      peerListeners.add(wrapped);
      return () => peerListeners.delete(wrapped);
    },
  };
  const emitPeer = (
    event: "activated" | "deactivated" | "quarantined",
    id: string,
  ) => {
    for (const l of peerListeners) {
      try {
        l(event, id);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("[plugin-host] peer listener threw", err);
      }
    }
  };

  /* ----- Per-plugin activation ----- */
  const activatePlugin = async (plugin: PluginV2): Promise<ActiveEntry> => {
    const manifest = plugin.manifest;
    /* Sandbox tier — when declared, spawn an iframe / worker for the
     * plugin and let the sandbox bridge handle activation. The plugin's
     * main-thread activate() is NOT called; instead the sandbox re-loads
     * the module from its origin URL and runs activate() in isolation. */
    if (manifest.sandbox === "iframe" || manifest.sandbox === "worker") {
      return activateSandboxed(plugin);
    }
    const entry: ActiveEntry = {
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
      await plugin.activate(context);
      entry.disposers = disposers;
      entry.status = "active";
      entry.activatedAt = Date.now();
      // Flush plugin-contributed seeds into the mock backend, if present.
      const backend = (runtime as { __backend?: MockBackend }).__backend;
      if (backend) {
        for (const seedEntry of contributions.seeds.values()) {
          if (seedEntry.pluginId === manifest.id) {
            for (const s of seedEntry.seeds) {
              backend.seed(s.resource, [...s.rows]);
            }
          }
        }
        // Also honour the legacy `resource.__seed` for any resources this
        // plugin contributed (maintains compatibility with wrapLegacyPlugin).
        for (const { resource, pluginId } of contributions.resources.values()) {
          if (pluginId !== manifest.id) continue;
          const seedRows = (resource as { __seed?: readonly Record<string, unknown>[] }).__seed;
          if (seedRows) backend.seed(resource.id, [...seedRows]);
        }
      }
      emitPeer("activated", manifest.id);
    } catch (err) {
      entry.status = "quarantined";
      entry.error = err instanceof Error ? err.message : String(err);
      // Clean up anything the plugin did register before it threw.
      for (const d of entry.disposers) {
        try { d(); } catch { /* swallow */ }
      }
      entry.disposers = [];
      contributions.dropByPlugin(manifest.id);
      // eslint-disable-next-line no-console
      console.error(`[plugin-host] "${manifest.id}" activate() threw`, err);
      emitPeer("quarantined", manifest.id);
    } finally {
      emit();
    }
    return entry;
  };

  const activateSandboxed = async (plugin: PluginV2): Promise<ActiveEntry> => {
    const manifest = plugin.manifest;
    const entry: ActiveEntry = {
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
          host: self as unknown as PluginHost2,
          entryUrl,
        });
        entry.sandbox = handle;
      } else if (manifest.sandbox === "worker") {
        const { spawnWorkerSandbox } = await import("./sandbox/workerSandbox");
        const handle = await spawnWorkerSandbox({
          plugin,
          host: self as unknown as PluginHost2,
          entryUrl,
        });
        entry.sandbox = handle;
      }
      entry.status = "active";
      entry.activatedAt = Date.now();
      emitPeer("activated", manifest.id);
    } catch (err) {
      entry.status = "quarantined";
      entry.error = err instanceof Error ? err.message : String(err);
      emitPeer("quarantined", manifest.id);
      // eslint-disable-next-line no-console
      console.error(`[plugin-host] sandbox "${manifest.id}" failed to spawn`, err);
    } finally {
      emit();
    }
    return entry;
  };

  const deactivatePlugin = async (pluginId: string): Promise<void> => {
    const entry = active.get(pluginId);
    if (!entry) return;
    try {
      if (entry.plugin.deactivate) await entry.plugin.deactivate();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`[plugin-host] "${pluginId}" deactivate() threw`, err);
    }
    for (const d of entry.disposers) {
      try { d(); } catch { /* swallow */ }
    }
    /* Dispose sandbox if present. */
    if (entry.sandbox) {
      try { entry.sandbox.dispose(); } catch { /* swallow */ }
    }
    contributions.dropByPlugin(pluginId);
    entry.status = "deactivated";
    entry.disposers = [];
    emitPeer("deactivated", pluginId);
    emit();
  };

  /* ----- Public surface ----- */
  const install = async (pluginOrLegacy: AnyPlugin): Promise<PluginInstallRecord> => {
    const v2 = isV2Plugin(pluginOrLegacy)
      ? pluginOrLegacy
      : wrapLegacyPlugin(pluginOrLegacy as Parameters<typeof wrapLegacyPlugin>[0]);
    // Reject duplicate ids.
    if (active.has(v2.manifest.id)) {
      const prev = active.get(v2.manifest.id)!;
      if (prev.status === "active") {
        return toRecord(prev);
      }
      await deactivatePlugin(v2.manifest.id);
    }
    const entry = await activatePlugin(v2);
    return toRecord(entry);
  };

  const uninstall = async (pluginId: string): Promise<void> => {
    await deactivatePlugin(pluginId);
    active.delete(pluginId);
    emit();
  };

  const reload = async (pluginId: string): Promise<void> => {
    const entry = active.get(pluginId);
    if (!entry) return;
    const plugin = entry.plugin;
    await deactivatePlugin(pluginId);
    await activatePlugin(plugin);
  };

  const installFromURL = async (url: string): Promise<PluginInstallRecord> => {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) throw new Error(`Manifest fetch failed: ${res.status} ${res.statusText}`);
    const manifest = (await res.json()) as PluginManifest & { entry?: string };
    if (!manifest.id) throw new Error("Manifest missing id");
    if (!manifest.entry) throw new Error("Manifest missing entry URL");
    // Integrity check — compute SHA-384 of the entry bytes when declared.
    const entryUrl = new URL(manifest.entry, url).toString();
    const entryRes = await fetch(entryUrl, { mode: "cors" });
    if (!entryRes.ok)
      throw new Error(`Plugin entry fetch failed: ${entryRes.status}`);
    const buf = await entryRes.clone().arrayBuffer();
    if (manifest.origin?.integrity) {
      const expected = manifest.origin.integrity;
      const actual = await computeSRI(buf);
      if (expected !== actual) {
        throw new Error(
          `Integrity check failed: declared ${expected}, computed ${actual}`,
        );
      }
    }
    /* Signature check — if the manifest declares a signature, the
     * publisher's public key must be in the trusted-keys list and the
     * signature must verify against the bundle bytes. */
    const sigObj = manifest.origin as unknown as
      | (Partial<SignatureDescriptor> & { signaturePublicKey?: string })
      | undefined;
    if (sigObj?.signature) {
      if (!sigObj.signaturePublicKey && !sigObj.publicKey) {
        throw new Error(
          "Manifest declares a signature but no publicKey to verify it against.",
        );
      }
      const trusted = loadTrustedKeys();
      if (trusted.length === 0) {
        throw new Error(
          "No trusted publisher keys configured. Add the publisher's key via Plugin Inspector → Trusted keys before installing signed plugins.",
        );
      }
      const descriptor: SignatureDescriptor = {
        signature: sigObj.signature,
        publicKey: sigObj.publicKey ?? sigObj.signaturePublicKey!,
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
      const mod = (await import(/* @vite-ignore */ blobUrl)) as { default?: PluginV2 } | PluginV2;
      const plugin = "default" in mod && mod.default ? mod.default : (mod as PluginV2);
      const stamped: PluginV2 = {
        ...plugin,
        manifest: {
          ...plugin.manifest,
          origin: { kind: "remote", location: url, integrity: manifest.origin?.integrity },
        },
      };
      return install(stamped);
    } finally {
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

  function toRecord(e: ActiveEntry): PluginInstallRecord {
    return {
      manifest: e.manifest,
      status: e.status,
      error: e.error,
      activatedAt: e.activatedAt,
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
export function topoSortPlugins(plugins: readonly AnyPlugin[]): {
  ordered: AnyPlugin[];
  cycles: { path: string[] }[];
} {
  const byId = new Map<string, AnyPlugin>();
  for (const p of plugins) {
    const manifest = isV2Plugin(p)
      ? p.manifest
      : { id: (p as { id: string }).id };
    byId.set(manifest.id, p);
  }

  const ordered: AnyPlugin[] = [];
  const cycles: { path: string[] }[] = [];
  const visited = new Set<string>();
  const stack = new Set<string>();
  const depsOf = (p: AnyPlugin): string[] => {
    if (!isV2Plugin(p)) return [];
    return Object.keys(p.manifest.requires?.plugins ?? {});
  };

  const visit = (id: string, path: string[]) => {
    if (visited.has(id)) return;
    if (stack.has(id)) {
      cycles.push({ path: [...path, id] });
      return;
    }
    const plugin = byId.get(id);
    if (!plugin) return;
    stack.add(id);
    for (const dep of depsOf(plugin)) {
      visit(dep, [...path, id]);
    }
    stack.delete(id);
    visited.add(id);
    ordered.push(plugin);
  };

  for (const p of plugins) {
    const id = isV2Plugin(p) ? p.manifest.id : (p as { id: string }).id;
    visit(id, []);
  }
  return { ordered, cycles };
}

/* ====================================================================== */
/* SRI helper                                                              */
/* ====================================================================== */

async function computeSRI(buf: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-384", buf);
  const b = new Uint8Array(digest);
  let bin = "";
  for (let i = 0; i < b.length; i++) bin += String.fromCharCode(b[i]);
  return "sha384-" + btoa(bin);
}
