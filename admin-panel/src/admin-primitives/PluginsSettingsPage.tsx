/** Operator settings page: list every loaded plugin + per-tenant toggles.
 *
 *  /api/_plugins exposes manifests, status, ws routes, and per-tenant
 *  enablement. This page renders one row per plugin with:
 *    - icon + label + version + vendor
 *    - status pill (loaded | quarantined | disabled | unknown)
 *    - manifest description
 *    - permissions chips
 *    - per-tenant Enable/Disable toggle (admin-only; flips
 *      /api/_plugins/_enablement)
 *    - quarantine errors expanded inline if any. */

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./Card";
import { Badge } from "@/primitives/Badge";
import { Button } from "@/primitives/Button";
import { apiFetch } from "@/runtime/auth";

interface PluginRow {
  id: string;
  version: string;
  manifest: {
    label?: string;
    description?: string;
    icon?: string;
    vendor?: string;
    permissions?: string[];
  } | null;
  status: "loaded" | "quarantined" | "disabled" | "unknown";
  errors: string[];
  enabledForTenant: boolean;
  routes: string[];
  ws: string[];
  provides: string[];
  consumes: string[];
}

export function PluginsSettingsPage() {
  const [plugins, setPlugins] = React.useState<PluginRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [filter, setFilter] = React.useState("");

  const load = React.useCallback(async () => {
    try {
      const r = await apiFetch<{ rows: PluginRow[] }>("/_plugins");
      setPlugins(r.rows);
    } finally { setLoading(false); }
  }, []);

  React.useEffect(() => { void load(); }, [load]);

  const setEnabled = async (pluginId: string, enabled: boolean) => {
    setBusy(pluginId);
    try {
      await apiFetch("/_plugins/_enablement", {
        method: "POST",
        body: JSON.stringify({ pluginId, enabled }),
      });
      await load();
    } finally { setBusy(null); }
  };

  const filtered = React.useMemo(() => {
    if (!filter) return plugins;
    const f = filter.toLowerCase();
    return plugins.filter((p) =>
      p.id.toLowerCase().includes(f) ||
      (p.manifest?.label ?? "").toLowerCase().includes(f) ||
      (p.manifest?.vendor ?? "").toLowerCase().includes(f),
    );
  }, [plugins, filter]);

  if (loading) return <div className="p-6 text-text-muted">Loading plugins…</div>;

  const enabled = plugins.filter((p) => p.enabledForTenant).length;
  const quarantined = plugins.filter((p) => p.status === "quarantined").length;

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Plugins</h1>
        <p className="text-sm text-text-muted mt-1">
          {plugins.length} loaded · {enabled} enabled for this tenant
          {quarantined > 0 ? ` · ${quarantined} quarantined` : ""}
        </p>
      </div>

      <input
        type="search"
        placeholder="Filter by id, label, vendor…"
        className="w-full max-w-md px-3 py-2 border border-border rounded-md text-sm"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />

      <div className="space-y-3">
        {filtered.map((p) => (
          <Card key={p.id} className={p.status === "quarantined" ? "border-danger" : undefined}>
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <CardTitle className="flex items-center gap-2">
                    <span>{p.manifest?.label ?? p.id}</span>
                    <span className="text-xs text-text-muted font-mono">v{p.version}</span>
                    <StatusPill status={p.status} />
                    {!p.enabledForTenant && <Badge intent="muted">Disabled for tenant</Badge>}
                  </CardTitle>
                  {p.manifest?.description && (
                    <CardDescription>{p.manifest.description}</CardDescription>
                  )}
                </div>
                <Button
                  variant={p.enabledForTenant ? "secondary" : "default"}
                  disabled={busy === p.id || p.status === "quarantined"}
                  onClick={() => setEnabled(p.id, !p.enabledForTenant)}
                >
                  {busy === p.id ? "…" : p.enabledForTenant ? "Disable for tenant" : "Enable for tenant"}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="grid grid-cols-2 gap-2 text-xs text-text-muted">
                <div><strong>id:</strong> <code className="font-mono">{p.id}</code></div>
                {p.manifest?.vendor && <div><strong>vendor:</strong> {p.manifest.vendor}</div>}
                {p.routes.length > 0 && <div><strong>routes:</strong> {p.routes.length}</div>}
                {p.ws.length > 0 && <div><strong>ws routes:</strong> {p.ws.length}</div>}
                {p.provides.length > 0 && <div><strong>provides:</strong> {p.provides.join(", ")}</div>}
                {p.consumes.length > 0 && <div><strong>consumes:</strong> {p.consumes.join(", ")}</div>}
              </div>
              {(p.manifest?.permissions?.length ?? 0) > 0 && (
                <div className="flex flex-wrap gap-1">
                  {p.manifest!.permissions!.map((perm) => (
                    <Badge key={perm} intent="muted" className="font-mono text-xs">{perm}</Badge>
                  ))}
                </div>
              )}
              {p.errors.length > 0 && (
                <div className="bg-danger-bg/50 p-2 rounded font-mono text-xs space-y-1">
                  {p.errors.map((e, i) => <div key={i} className="text-danger">{e}</div>)}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: PluginRow["status"] }) {
  if (status === "loaded") return <Badge intent="success">loaded</Badge>;
  if (status === "quarantined") return <Badge intent="danger">quarantined</Badge>;
  if (status === "disabled") return <Badge intent="muted">disabled</Badge>;
  return <Badge intent="muted">{status}</Badge>;
}
