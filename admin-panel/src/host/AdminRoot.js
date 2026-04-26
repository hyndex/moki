import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import * as React from "react";
import { RuntimeProvider } from "@/runtime/context";
import { AppShell } from "@/shell/AppShell";
import { usePluginHost } from "./PluginHost";
import { AuthGuard } from "./AuthGuard";
import { Spinner } from "@/primitives/Spinner";
import { ErrorState } from "@/admin-primitives/ErrorState";
import { PluginHostContext, ActivationEngineContext } from "./pluginHostContext";
import { discoverAllPlugins } from "./pluginLoaders";
export function AdminRoot(props) {
    return (_jsx(AuthGuard, { children: _jsx(RuntimeProvider, { children: _jsx(AdminInner, { ...props }) }) }));
}
function AdminInner({ plugins, npmPlugins, disableFilesystemDiscovery, }) {
    const [discovered, setDiscovered] = React.useState(null);
    // Capture the first-render inputs in refs so the discovery effect never
    // re-runs from new array identities.
    const explicitRef = React.useRef(plugins);
    const npmRef = React.useRef(npmPlugins);
    const disableRef = React.useRef(disableFilesystemDiscovery);
    // Keep latest refs for external observers but don't re-run discovery.
    explicitRef.current = plugins;
    npmRef.current = npmPlugins;
    disableRef.current = disableFilesystemDiscovery;
    React.useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const result = await discoverAllPlugins({
                    explicit: explicitRef.current,
                    npmSpecifiers: npmRef.current,
                    disableFilesystem: disableRef.current,
                });
                if (!cancelled)
                    setDiscovered(result.all);
            }
            catch (err) {
                // eslint-disable-next-line no-console
                console.error("[admin-root] plugin discovery failed", err);
                if (!cancelled)
                    setDiscovered(explicitRef.current ?? []);
            }
        })();
        return () => {
            cancelled = true;
        };
        // Run once on mount — the inputs are captured via refs above.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    // Pass a stable reference to usePluginHost — its internal effect has
    // `plugins` in its deps array, and we don't want that effect re-firing
    // on every parent re-render.
    const stablePlugins = React.useMemo(() => discovered ?? [], [discovered]);
    const { ready, registry, host, activation, error } = usePluginHost(stablePlugins);
    if (error) {
        return (_jsx("div", { className: "h-full w-full flex items-center justify-center p-8", children: _jsx(ErrorState, { title: "Failed to start admin", description: error.message }) }));
    }
    if (discovered === null || !ready || !registry || !host) {
        return (_jsxs("div", { className: "h-full w-full flex items-center justify-center gap-2 text-sm text-text-muted", children: [_jsx(Spinner, { size: 14 }), "Loading admin\u2026"] }));
    }
    return (_jsx(PluginHostContext.Provider, { value: host, children: _jsx(ActivationEngineContext.Provider, { value: activation, children: _jsx(AppShell, { registry: registry }) }) }));
}
