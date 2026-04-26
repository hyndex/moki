import * as React from "react";
import { RuntimeProvider } from "@/runtime/context";
import { AppShell } from "@/shell/AppShell";
import { usePluginHost } from "./PluginHost";
import { AuthGuard } from "./AuthGuard";
import { Spinner } from "@/primitives/Spinner";
import { ErrorState } from "@/admin-primitives/ErrorState";
import { PluginHostContext, ActivationEngineContext } from "./pluginHostContext";
import type { AnyPlugin } from "@/contracts/plugin-v2";
import { discoverAllPlugins } from "./pluginLoaders";
import { PermissionsProvider } from "@/admin-archetypes/permissions/PermissionsContext";
import { authStore } from "@/runtime/auth";

export interface AdminRootProps {
  /** Plugins passed explicitly from the consumer's App. Optional — the
   *  host also auto-discovers plugins from `src/plugins/*` via Vite
   *  glob-import. Explicit plugins win on id collision. */
  plugins?: readonly AnyPlugin[];
  /** npm plugin specifiers — e.g. from `package.json`'s `gutuPlugins[]`. */
  npmPlugins?: readonly string[];
  /** Disable filesystem auto-discovery (useful in tests). */
  disableFilesystemDiscovery?: boolean;
}

export function AdminRoot(props: AdminRootProps) {
  return (
    <AuthGuard>
      <RuntimeProvider>
        <AdminInner {...props} />
      </RuntimeProvider>
    </AuthGuard>
  );
}

function AdminInner({
  plugins,
  npmPlugins,
  disableFilesystemDiscovery,
}: AdminRootProps) {
  const [discovered, setDiscovered] = React.useState<readonly AnyPlugin[] | null>(null);

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
        if (!cancelled) setDiscovered(result.all);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("[admin-root] plugin discovery failed", err);
        if (!cancelled) setDiscovered(explicitRef.current ?? []);
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
  const stablePlugins = React.useMemo(
    () => discovered ?? [],
    [discovered],
  );
  const { ready, registry, host, activation, error } = usePluginHost(stablePlugins);

  if (error) {
    return (
      <div className="h-full w-full flex items-center justify-center p-8">
        <ErrorState title="Failed to start admin" description={error.message} />
      </div>
    );
  }
  if (discovered === null || !ready || !registry || !host) {
    return (
      <div className="h-full w-full flex items-center justify-center gap-2 text-sm text-text-muted">
        <Spinner size={14} />
        Loading admin…
      </div>
    );
  }
  return (
    <PluginHostContext.Provider value={host}>
      <ActivationEngineContext.Provider value={activation}>
        <PermissionsRoot>
          <AppShell registry={registry} />
        </PermissionsRoot>
      </ActivationEngineContext.Provider>
    </PluginHostContext.Provider>
  );
}

/** Bridges the `authStore` user → PermissionsProvider grants.
 *
 *  Two modes:
 *    1. The signed-in user's `role` is derived to a set of grants
 *       (e.g. role "admin" → all permissions; "viewer" → "*.read"
 *       plus the explicit grants from a future user-roles plugin).
 *    2. When no permission requirements are declared on the page, the
 *       grants set is irrelevant — `RequirePermissions` short-circuits.
 *
 *  Production deployments wire `grants` from the user-roles plugin
 *  (or the auth provider) by replacing this component. */
function PermissionsRoot({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState(authStore.user);
  React.useEffect(() => {
    return authStore.emitter.on("change", () => setUser(authStore.user));
  }, []);
  const grants = React.useMemo(() => {
    if (!user) return [] as readonly string[];
    if (user.role === "admin" || user.role === "super") {
      // No fine-grained system yet → admins bypass.
      return [] as readonly string[];
    }
    return [user.role + ".read"] as readonly string[];
  }, [user]);
  const bypass = user?.role === "admin" || user?.role === "super" || !user;
  return (
    <PermissionsProvider grants={grants} bypass={bypass}>
      {children}
    </PermissionsProvider>
  );
}
