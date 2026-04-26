import * as React from "react";
/** React context that exposes the aggregated AdminRegistry to deeply-nested
 *  custom views (e.g. rich detail pages) that need to introspect plugins
 *  beyond their own. Set by AppShell at the root. */
export const RegistryContext = React.createContext(null);
/** Hook — returns the live registry or null when no provider is mounted. */
export function useRegistry() {
    return React.useContext(RegistryContext);
}
