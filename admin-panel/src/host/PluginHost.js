import * as React from "react";
import { useRuntime } from "@/runtime/context";
import { createPluginHost2, layerPlugins, runWithConcurrency, DEFAULT_ACTIVATION_CONCURRENCY, } from "./pluginHost2";
import { createActivationEngine } from "./activationEngine";
import { isV2Plugin } from "@/contracts/plugin-v2";
/** usePluginHost — activate a list of plugins (legacy OR v2) and return an
 *  aggregated AdminRegistry. Uses pluginHost2 under the hood:
 *    - Dependency-aware activation order
 *    - Per-plugin quarantine on throw
 *    - Live registry rebuild from the contribution store (so plugins
 *      installed/uninstalled at runtime take effect immediately).
 */
export function usePluginHost(plugins) {
    const runtime = useRuntime();
    const [host] = React.useState(() => createPluginHost2({ runtime }));
    const [activation] = React.useState(() => createActivationEngine({ host, runtime }));
    const [registry, setRegistry] = React.useState(null);
    const [ready, setReady] = React.useState(false);
    const [error, setError] = React.useState();
    // Initial activation: layer plugins by dependency depth, then activate
    // each layer in parallel (bounded concurrency). Plugins with non-onStart
    // activation events register with the engine but don't activate yet.
    React.useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                // Everything is PluginV2 post-migration — the filter is a safety
                // net for any ad-hoc plugin passed by tests.
                const v2s = plugins.filter(isV2Plugin);
                const { layers, cycles } = layerPlugins(v2s);
                for (const c of cycles) {
                    // eslint-disable-next-line no-console
                    console.warn("[plugin-host] dependency cycle detected:", c.path.join(" → "));
                }
                for (const layer of layers) {
                    if (cancelled)
                        return;
                    await runWithConcurrency(layer, DEFAULT_ACTIVATION_CONCURRENCY, async (p) => {
                        if (cancelled)
                            return;
                        await activation.register(p);
                    });
                }
                if (!cancelled)
                    setReady(true);
            }
            catch (err) {
                if (!cancelled)
                    setError(err instanceof Error ? err : new Error(String(err)));
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [host, activation, plugins]);
    // Keep the aggregated registry fresh whenever contributions change.
    // Two-level debounce:
    //   - queueMicrotask collapses bursts during a single plugin's activate()
    //   - rAF collapses bursts across plugins during bulk install
    //   - cheap `version` bump in the store is tracked and only rebuilds
    //     when something actually changed since last build.
    React.useEffect(() => {
        let microtaskPending = false;
        let lastBuildAt = -1;
        const rebuild = () => {
            if (microtaskPending)
                return;
            microtaskPending = true;
            queueMicrotask(() => {
                microtaskPending = false;
                const now = performance.now();
                if (now - lastBuildAt < 16) {
                    // Coalesce within a frame.
                    requestAnimationFrame(() => {
                        lastBuildAt = performance.now();
                        setRegistry(buildRegistryFromStore(host, plugins));
                    });
                    return;
                }
                lastBuildAt = now;
                setRegistry(buildRegistryFromStore(host, plugins));
            });
        };
        rebuild();
        return host.subscribe(rebuild);
    }, [host, plugins]);
    return { ready, registry, host, activation, error };
}
/** Build an AdminRegistry from the v2 contribution store — the shell still
 *  consumes the old registry shape. */
function buildRegistryFromStore(host, plugins) {
    const nav = [];
    const navSectionsMap = {};
    const resources = {};
    const views = {};
    const pluginByResource = {};
    const globalActions = [];
    const commands = [];
    const widgets = [];
    const store = host.contributions;
    for (const { section } of store.navSections.values()) {
        navSectionsMap[section.id] = section;
    }
    for (const { item } of store.nav.values()) {
        nav.push(item);
    }
    for (const { resource, pluginId } of store.resources.values()) {
        resources[resource.id] = resource;
        pluginByResource[resource.id] = pluginId;
    }
    for (const { view } of store.views.values()) {
        views[view.id] = view;
    }
    for (const { action } of store.actions.values()) {
        globalActions.push(action);
    }
    for (const { command } of store.commands.values()) {
        commands.push(command);
    }
    for (const { widget } of store.widgets.values()) {
        widgets.push(widget);
    }
    // Sort nav items for deterministic ordering.
    nav.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    void widgets;
    return {
        plugins: plugins,
        navSections: Object.values(navSectionsMap),
        nav,
        resources,
        views,
        pluginByResource,
        globalActions,
        commands,
    };
}
