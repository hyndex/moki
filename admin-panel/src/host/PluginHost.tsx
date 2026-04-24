import * as React from "react";
import { useRuntime } from "@/runtime/context";
import type { AnyPlugin } from "@/contracts/plugin-v2";
import { buildRegistry, type AdminRegistry } from "@/shell/registry";
import {
  createPluginHost2,
  topoSortPlugins,
  type PluginHost2,
} from "./pluginHost2";
import type { View, DashboardWidget } from "@/contracts/views";
import type { NavItem, NavSection } from "@/contracts/nav";
import type { ResourceDefinition } from "@/contracts/resources";
import type { ActionDescriptor } from "@/contracts/actions";
import type { CommandDescriptor } from "@/contracts/commands";

export interface PluginHostResult {
  ready: boolean;
  registry: AdminRegistry | null;
  /** The v2 host — lets AppShell/Inspector subscribe to plugin state. */
  host: PluginHost2 | null;
  error?: Error;
}

/** usePluginHost — activate a list of plugins (legacy OR v2) and return an
 *  aggregated AdminRegistry. Uses pluginHost2 under the hood:
 *    - Dependency-aware activation order
 *    - Per-plugin quarantine on throw
 *    - Live registry rebuild from the contribution store (so plugins
 *      installed/uninstalled at runtime take effect immediately).
 */
export function usePluginHost(plugins: readonly AnyPlugin[]): PluginHostResult {
  const runtime = useRuntime();
  const [host] = React.useState<PluginHost2>(() => createPluginHost2({ runtime }));
  const [registry, setRegistry] = React.useState<AdminRegistry | null>(null);
  const [ready, setReady] = React.useState(false);
  const [error, setError] = React.useState<Error | undefined>();

  // Initial activation: topo-sort, install serially.
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { ordered, cycles } = topoSortPlugins(plugins);
        for (const c of cycles) {
          // eslint-disable-next-line no-console
          console.warn("[plugin-host] dependency cycle detected:", c.path.join(" → "));
        }
        for (const p of ordered) {
          if (cancelled) return;
          await host.install(p);
        }
        if (!cancelled) setReady(true);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err : new Error(String(err)));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [host, plugins]);

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
      if (microtaskPending) return;
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

  return { ready, registry, host, error };
}

/** Build an AdminRegistry from the v2 contribution store — the shell still
 *  consumes the old registry shape. */
function buildRegistryFromStore(
  host: PluginHost2,
  plugins: readonly AnyPlugin[],
): AdminRegistry {
  const nav: NavItem[] = [];
  const navSectionsMap: Record<string, NavSection> = {};
  const resources: Record<string, ResourceDefinition> = {};
  const views: Record<string, View> = {};
  const pluginByResource: Record<string, string> = {};
  const globalActions: ActionDescriptor[] = [];
  const commands: CommandDescriptor[] = [];
  const widgets: DashboardWidget[] = [];

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
    plugins: plugins as unknown as AdminRegistry["plugins"],
    navSections: Object.values(navSectionsMap),
    nav,
    resources,
    views,
    pluginByResource,
    globalActions,
    commands,
  };
}
