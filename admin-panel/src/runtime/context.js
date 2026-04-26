import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useContext, useMemo } from "react";
import { ResourceClient } from "./resourceClient";
import { MockBackend } from "./mockBackend";
import { RestAdapter } from "./restAdapter";
import { Emitter } from "@/lib/emitter";
import { startRealtime } from "./realtime";
import { createAnalytics, consoleSink, restSink } from "./analytics";
import { createPermissionEvaluator } from "./permissions";
import { createFeatureFlags, createCapabilityRegistry } from "./featureFlags";
import { createSavedViewStore } from "./savedViews";
import { authStore } from "./auth";
import { ErpClient } from "./erp";
const RuntimeContext = createContext(null);
export function RuntimeProvider({ children }) {
    const runtime = useMemo(() => createRuntime(), []);
    return (_jsx(RuntimeContext.Provider, { value: runtime, children: children }));
}
export function useRuntime() {
    const ctx = useContext(RuntimeContext);
    if (!ctx)
        throw new Error("useRuntime must be used inside <RuntimeProvider>");
    return ctx;
}
/** Factory — exported so tests can build a runtime without the provider.
 *  Uses RestAdapter by default. Set VITE_USE_MOCK_BACKEND=1 to fall back to
 *  the in-memory mock (useful for offline demos or Storybook). */
export function createRuntime() {
    const env = import.meta.env ?? {};
    const useMock = env.VITE_USE_MOCK_BACKEND === "1";
    const backend = useMock ? new MockBackend() : new RestAdapter();
    const resources = new ResourceClient(backend);
    const bus = new Emitter();
    const analytics = createAnalytics();
    analytics.addSink(consoleSink);
    analytics.addSink(restSink);
    const permissions = createPermissionEvaluator();
    const flags = createFeatureFlags();
    const capabilities = createCapabilityRegistry();
    const savedViews = createSavedViewStore();
    const erp = new ErpClient();
    const runtime = {
        resources,
        bus,
        analytics,
        permissions,
        flags,
        capabilities,
        savedViews,
        erp,
        actions: {
            toast: (opts) => bus.emit("toast:add", {
                id: cryptoId(),
                intent: "default",
                ...opts,
            }),
            navigate: (path) => bus.emit("nav:to", { path }),
            refresh: (resource) => resources.refresh(resource),
            update: (resource, id, data) => resources.update(resource, id, data),
            create: (resource, data) => resources.create(resource, data),
            delete: (resource, id) => resources.delete(resource, id),
            confirm: (opts) => new Promise((resolve) => {
                const id = cryptoId();
                const off = bus.on("confirm:resolve", (p) => {
                    if (p.id === id) {
                        off();
                        resolve(p.result);
                    }
                });
                bus.emit("confirm:open", { id, ...opts });
            }),
        },
    };
    // Start realtime subscription when using the REST adapter. Reconnect logic
    // is inside startRealtime; we expose a disposer on the runtime.
    if (!useMock && typeof window !== "undefined") {
        runtime.stopRealtime = startRealtime(resources, bus);
    }
    // Clear ALL cached queries whenever the active tenant changes — stale
    // data from the previous tenant must never surface in the new one.
    // Covers direct switchTenant() calls that bypass the WorkspaceSwitcher UI.
    authStore.emitter.on("tenant", ({ active }) => {
        resources.cache.clear();
        if (active) {
            analytics.setMeta({ tenantId: active.id });
        }
    });
    // expose backend for plugin seeding during registration (mock only — the REST
    // adapter has no seed hook; data seeding happens server-side)
    if (backend instanceof MockBackend) {
        runtime.__backend = backend;
    }
    return runtime;
}
function cryptoId() {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
