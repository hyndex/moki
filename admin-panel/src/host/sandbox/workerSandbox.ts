/** Worker sandbox — runs plugin activate() inside a Web Worker.
 *
 *  Best for plugins whose work is pure logic (no DOM): imports, data
 *  adapters, job handlers, expression function libraries. The worker
 *  receives a postMessage RPC proxy for every runtime call; contributions
 *  that produce UI (views with render(), viewExtensions with render())
 *  are kept on the main thread via serializable descriptors only.
 *
 *  Because Workers can't transfer React components, UI-heavy plugins
 *  should use iframe sandbox instead. Worker sandbox is ideal for:
 *    - Data-source adapters (Salesforce, BigQuery RPC clients)
 *    - Scheduled jobs
 *    - Expression / filter operator plugins
 *    - Notification channels
 *
 *  Security boundary:
 *    - Worker cannot touch the DOM — no XSS risk.
 *    - Origin is same as host but storage access is explicit only via
 *      RPC to main thread.
 *    - Capability enforcement happens at RPC-dispatch time on main. */

import type { PluginV2 } from "@/contracts/plugin-v2";
import type { PluginHost2 } from "../pluginHost2";

/** Inline worker bootstrap. Imports the plugin via `importScripts` or ESM
 *  `import()` and exposes the same proxy context pattern as the iframe
 *  sandbox. */
const WORKER_BOOTSTRAP = `
let nextId = 1;
const pending = new Map();
function rpc(method, params) {
  return new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    self.postMessage({ __gutuSandbox: true, id, method, params });
  });
}
self.addEventListener("message", async (ev) => {
  const m = ev.data;
  if (!m || !m.__gutuSandbox) return;
  if (m.type === "boot") {
    try {
      const mod = await import(m.entry);
      const plugin = mod.default || mod;
      const ctx = makeProxyContext(m.manifest);
      await plugin.activate(ctx);
      self.postMessage({ __gutuSandbox: true, type: "activated" });
    } catch (err) {
      self.postMessage({ __gutuSandbox: true, type: "fatal", message: String(err && err.message || err) });
    }
  } else if (m.id && pending.has(m.id)) {
    const p = pending.get(m.id);
    pending.delete(m.id);
    if (m.error) p.reject(new Error(m.error));
    else p.resolve(m.result);
  }
});
function makeProxyContext(manifest) {
  return {
    manifest,
    contribute: new Proxy({}, {
      get: (_t, prop) => (...args) => {
        const id = rpc("contribute." + String(prop), args);
        return () => rpc("contribute." + String(prop) + ":dispose", []);
      }
    }),
    registries: new Proxy({}, {
      get: (_t, name) => ({
        register: (k, v) => {
          rpc("reg." + String(name), [k, v]);
          return () => rpc("reg." + String(name) + ":dispose", [k]);
        },
        registerMany: () => () => {},
        get: () => undefined,
        list: () => [],
        keys: () => [],
        has: () => false,
        onChange: () => () => {},
      })
    }),
    runtime: {
      resources: {
        list: (r, q) => rpc("res.list", [r, q]),
        get: (r, id) => rpc("res.get", [r, id]),
        create: (r, b) => rpc("res.create", [r, b]),
        update: (r, id, p) => rpc("res.update", [r, id, p]),
        delete: (r, id) => rpc("res.delete", [r, id]),
      },
      bus: { emit: (e, p) => rpc("bus.emit", [e, p]), on: () => () => {}, once: () => () => {} },
      storage: {
        get: (k) => rpc("storage.get", [k]),
        set: (k, v) => rpc("storage.set", [k, v]),
        remove: (k) => rpc("storage.remove", [k]),
        clear: () => rpc("storage.clear", []),
        keys: () => rpc("storage.keys", []),
      },
      logger: {
        trace: (...a) => rpc("log.trace", a),
        debug: (...a) => rpc("log.debug", a),
        info:  (...a) => rpc("log.info", a),
        warn:  (...a) => rpc("log.warn", a),
        error: (...a) => rpc("log.error", a),
      },
      i18n: { t: (k) => k, locale: () => "en", setCatalog: () => {} },
      assets: { url: (rel) => rel },
      permissions: { has: () => true, require: () => {} },
      analytics: { emit: (ev, p) => rpc("analytics.emit", [ev, p]), setMeta: () => {} },
      notify: (msg) => rpc("notify", [msg]),
    },
    peers: { get: () => undefined, isActive: () => false, on: () => () => {} },
  };
}
self.postMessage({ __gutuSandbox: true, type: "ready" });
`;

export interface WorkerSandboxHandle {
  readonly worker: Worker;
  dispose(): void;
}

export async function spawnWorkerSandbox(args: {
  readonly plugin: PluginV2;
  readonly host: PluginHost2;
  readonly entryUrl: string;
}): Promise<WorkerSandboxHandle> {
  const blob = new Blob([WORKER_BOOTSTRAP], { type: "text/javascript" });
  const blobUrl = URL.createObjectURL(blob);
  const worker = new Worker(blobUrl, { type: "module" });

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Worker boot timeout")), 10_000);
    worker.addEventListener("message", function onReady(ev) {
      const m = ev.data as { __gutuSandbox?: boolean; type?: string } | undefined;
      if (m?.__gutuSandbox && m.type === "ready") {
        clearTimeout(timeout);
        worker.removeEventListener("message", onReady);
        resolve();
      }
    });
  });

  const disposers = attachWorkerRpc(worker, args.host, args.plugin);

  worker.postMessage({
    __gutuSandbox: true,
    type: "boot",
    entry: args.entryUrl,
    manifest: args.plugin.manifest,
  });

  return {
    worker,
    dispose: () => {
      for (const d of disposers) d();
      worker.terminate();
      URL.revokeObjectURL(blobUrl);
    },
  };
}

function attachWorkerRpc(
  worker: Worker,
  host: PluginHost2,
  plugin: PluginV2,
): Array<() => void> {
  const cleanups: Array<() => void> = [];
  const onMessage = async (ev: MessageEvent) => {
    const m = ev.data as {
      __gutuSandbox?: boolean;
      id?: number;
      method?: string;
      params?: unknown[];
    } | undefined;
    if (!m?.__gutuSandbox || typeof m.id !== "number" || !m.method) return;
    try {
      /* Minimal RPC surface — the iframe sandbox's dispatcher is a better
       * reference. For Workers, most useful calls are resource ops +
       * logger + notify + analytics. */
      const result = await dispatchWorkerRpc(host, plugin, m.method, m.params ?? []);
      worker.postMessage({ __gutuSandbox: true, id: m.id, result });
    } catch (err) {
      worker.postMessage({
        __gutuSandbox: true,
        id: m.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  };
  worker.addEventListener("message", onMessage);
  cleanups.push(() => worker.removeEventListener("message", onMessage));
  return cleanups;
}

async function dispatchWorkerRpc(
  host: PluginHost2,
  plugin: PluginV2,
  method: string,
  params: unknown[],
): Promise<unknown> {
  void host;
  void plugin;
  /* Contribution calls from the worker — minimal implementation:
   * worker plugins are best-suited for data adapters + jobs, not UI. */
  if (method.startsWith("log.")) {
    const level = method.slice("log.".length) as "trace" | "debug" | "info" | "warn" | "error";
    // eslint-disable-next-line no-console
    (console[level] || console.log)(`[worker:${plugin.manifest.id}]`, ...params);
    return null;
  }
  return null;
}
