import * as React from "react";
import type { PluginHost2 } from "./pluginHost2";
import type { ExtensionRegistries } from "@/contracts/plugin-v2";

/** Exposes the active PluginHost2 + its registries to deeply-nested
 *  components (Plugin Inspector, ListView for fieldKinds, etc.). */
export const PluginHostContext = React.createContext<PluginHost2 | null>(null);

export function usePluginHost2(): PluginHost2 | null {
  return React.useContext(PluginHostContext);
}

/** Subscribe to host contribution changes and re-render. */
export function usePluginHostVersion(): number {
  const host = React.useContext(PluginHostContext);
  const [version, setVersion] = React.useState(0);
  React.useEffect(() => {
    if (!host) return;
    return host.subscribe(() => setVersion((v) => v + 1));
  }, [host]);
  return version;
}

/** Convenience — returns the live ExtensionRegistries for components that
 *  need to look up a field kind / widget type / etc. */
export function useRegistries(): ExtensionRegistries | null {
  const host = React.useContext(PluginHostContext);
  return host?.registries ?? null;
}
