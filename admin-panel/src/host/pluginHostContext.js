import * as React from "react";
/** Exposes the active PluginHost2 + its registries to deeply-nested
 *  components (Plugin Inspector, ListView for fieldKinds, etc.). */
export const PluginHostContext = React.createContext(null);
export function usePluginHost2() {
    return React.useContext(PluginHostContext);
}
/** Activation engine context — separate so Inspector UI can drive
 *  activateNow() without needing access to the full host. */
export const ActivationEngineContext = React.createContext(null);
export function useActivationEngine() {
    return React.useContext(ActivationEngineContext);
}
/** Subscribe to host contribution changes and re-render. */
export function usePluginHostVersion() {
    const host = React.useContext(PluginHostContext);
    const [version, setVersion] = React.useState(0);
    React.useEffect(() => {
        if (!host)
            return;
        return host.subscribe(() => setVersion((v) => v + 1));
    }, [host]);
    return version;
}
/** Convenience — returns the live ExtensionRegistries for components that
 *  need to look up a field kind / widget type / etc. */
export function useRegistries() {
    const host = React.useContext(PluginHostContext);
    return host?.registries ?? null;
}
