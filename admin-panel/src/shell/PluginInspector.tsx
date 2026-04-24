import * as React from "react";
import { PageHeader } from "@/admin-primitives/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/admin-primitives/Card";
import { Badge } from "@/primitives/Badge";
import { Button } from "@/primitives/Button";
import { Input } from "@/primitives/Input";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  HelpCircle,
  Package,
  Power,
  RefreshCw,
  Trash2,
  XCircle,
} from "lucide-react";
import { usePluginHost2, usePluginHostVersion } from "@/host/pluginHostContext";
import type { PluginInstallRecord, PluginStatus } from "@/contracts/plugin-v2";

/** Plugin Inspector — the admin UI for managing installed plugins.
 *
 *  Shows every plugin in the host with its manifest, status, capabilities,
 *  contribution counts, and any errors. Supports install-from-URL, reload,
 *  and uninstall. Lists every extension-registry entry with its contributor
 *  so operators can see exactly who added what. */
export function PluginInspectorPage() {
  const host = usePluginHost2();
  const version = usePluginHostVersion();
  void version; // force re-render on change
  const [installUrl, setInstallUrl] = React.useState("");
  const [installing, setInstalling] = React.useState(false);
  const [installError, setInstallError] = React.useState<string | null>(null);

  const records = host?.getRecords() ?? [];
  const conflicts = host?.contributions.conflicts ?? [];

  const handleInstall = async () => {
    if (!host) return;
    const url = installUrl.trim();
    if (!url) return;
    setInstalling(true);
    setInstallError(null);
    try {
      await host.installFromURL(url);
      setInstallUrl("");
    } catch (err) {
      setInstallError(err instanceof Error ? err.message : String(err));
    } finally {
      setInstalling(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Plugins"
        description="Every installed plugin — their manifest, contributions, and current health."
      />

      {/* Install from URL */}
      <Card>
        <CardHeader>
          <CardTitle>
            <span className="inline-flex items-center gap-2">
              <Download className="h-4 w-4 text-accent" />
              Install from URL
            </span>
          </CardTitle>
          <CardDescription>
            Paste a plugin manifest URL. The shell fetches the module, verifies
            integrity (when declared), and activates it.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-2">
          <Input
            className="flex-1"
            placeholder="https://plugins.example.com/my-plugin/1.0.0/manifest.json"
            value={installUrl}
            onChange={(e) => setInstallUrl(e.target.value)}
          />
          <Button
            variant="primary"
            size="sm"
            onClick={handleInstall}
            loading={installing}
            disabled={!installUrl.trim() || !host}
          >
            Install
          </Button>
        </CardContent>
        {installError && (
          <div className="px-4 pb-3 text-xs text-intent-danger">{installError}</div>
        )}
      </Card>

      {/* Conflicts */}
      {conflicts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>
              <span className="inline-flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-intent-warning" />
                Conflicts — {conflicts.length}
              </span>
            </CardTitle>
            <CardDescription>
              Two or more plugins claimed the same contribution id. The last to
              register wins; earlier registrations are shadowed.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border-subtle text-xs">
              {conflicts.map((c) => (
                <li
                  key={`${c.kind}::${c.key}`}
                  className="flex items-center gap-3 py-2"
                >
                  <Badge intent="warning">{c.kind}</Badge>
                  <code className="font-mono">{c.key}</code>
                  <span className="ml-auto text-text-muted">
                    by {c.contributors.join(", ")}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Plugins */}
      <Card>
        <CardHeader>
          <CardTitle>
            <span className="inline-flex items-center gap-2">
              <Package className="h-4 w-4 text-accent" />
              Installed — {records.length}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ul className="divide-y divide-border-subtle">
            {records.length === 0 ? (
              <li className="px-4 py-6 text-sm text-text-muted text-center">
                No plugins installed.
              </li>
            ) : (
              records.map((r) => (
                <PluginRow key={r.manifest.id} record={r} host={host} />
              ))
            )}
          </ul>
        </CardContent>
      </Card>

      {/* Registries — live extension points */}
      <RegistriesCard />
    </div>
  );
}

function PluginRow({
  record,
  host,
}: {
  record: PluginInstallRecord;
  host: ReturnType<typeof usePluginHost2>;
}) {
  const { manifest, status, error, contributionCounts } = record;
  const [busy, setBusy] = React.useState(false);
  const onReload = async () => {
    if (!host) return;
    setBusy(true);
    try { await host.reload(manifest.id); } finally { setBusy(false); }
  };
  const onUninstall = async () => {
    if (!host) return;
    setBusy(true);
    try { await host.uninstall(manifest.id); } finally { setBusy(false); }
  };
  return (
    <li className="px-4 py-3">
      <div className="flex items-start gap-3">
        <StatusIcon status={status} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm">{manifest.label}</span>
            <code className="font-mono text-xs text-text-muted">{manifest.id}</code>
            <Badge intent="neutral">{manifest.version}</Badge>
            {manifest.origin?.kind && (
              <Badge intent="info">{manifest.origin.kind}</Badge>
            )}
            <StatusBadge status={status} />
          </div>
          {manifest.description && (
            <div className="text-xs text-text-muted mt-1">{manifest.description}</div>
          )}
          {error && (
            <div className="text-xs text-intent-danger mt-1 font-mono break-words">
              {error}
            </div>
          )}
          {contributionCounts && Object.keys(contributionCounts).length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {Object.entries(contributionCounts).map(([k, v]) => (
                <span
                  key={k}
                  className="inline-flex items-center gap-1 rounded-sm border border-border bg-surface-0 px-1.5 py-0.5 text-[10px] font-mono"
                >
                  {k}: {v}
                </span>
              ))}
            </div>
          )}
          {manifest.requires?.capabilities && manifest.requires.capabilities.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {manifest.requires.capabilities.map((c) => (
                <Badge key={c} intent="neutral">{c}</Badge>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="xs"
            onClick={onReload}
            disabled={busy || !host}
            iconLeft={<RefreshCw className="h-3 w-3" />}
          >
            Reload
          </Button>
          <Button
            variant="ghost"
            size="xs"
            onClick={onUninstall}
            disabled={busy || !host}
            iconLeft={<Trash2 className="h-3 w-3" />}
          >
            Uninstall
          </Button>
        </div>
      </div>
    </li>
  );
}

function StatusIcon({ status }: { status: PluginStatus }) {
  switch (status) {
    case "active":       return <CheckCircle2 className="h-4 w-4 text-intent-success mt-0.5" />;
    case "quarantined":  return <AlertTriangle className="h-4 w-4 text-intent-danger mt-0.5" />;
    case "deactivated":  return <Power className="h-4 w-4 text-text-muted mt-0.5" />;
    case "loading":
    case "activating":
    case "pending":      return <RefreshCw className="h-4 w-4 text-accent mt-0.5 animate-spin" />;
    default:             return <HelpCircle className="h-4 w-4 text-text-muted mt-0.5" />;
  }
}

function StatusBadge({ status }: { status: PluginStatus }) {
  const map: Record<PluginStatus, { label: string; intent: "success" | "danger" | "neutral" | "info" | "warning" }> = {
    active:       { label: "Active",       intent: "success" },
    quarantined:  { label: "Quarantined",  intent: "danger" },
    deactivated:  { label: "Deactivated",  intent: "neutral" },
    loading:      { label: "Loading",      intent: "info" },
    activating:   { label: "Activating",   intent: "info" },
    pending:      { label: "Pending",      intent: "warning" },
  };
  const { label, intent } = map[status];
  return <Badge intent={intent}>{label}</Badge>;
}

function RegistriesCard() {
  const host = usePluginHost2();
  const version = usePluginHostVersion();
  void version;
  if (!host) return null;
  const { registries } = host;
  const sections: { label: string; entries: readonly { key: string; contributor: string }[] }[] = [
    { label: "Field kinds", entries: registries.fieldKinds.list() },
    { label: "Widget types", entries: registries.widgetTypes.list() },
    { label: "View modes", entries: registries.viewModes.list() },
    { label: "Chart kinds", entries: registries.chartKinds.list() },
    { label: "Themes", entries: registries.themes.list() },
    { label: "Layouts", entries: registries.layouts.list() },
    { label: "Data sources", entries: registries.dataSources.list() },
    { label: "Exporters", entries: registries.exporters.list() },
    { label: "Importers", entries: registries.importers.list() },
    { label: "Auth providers", entries: registries.authProviders.list() },
    { label: "Notification channels", entries: registries.notificationChannels.list() },
    { label: "Filter operators", entries: registries.filterOps.list() },
    { label: "Expression functions", entries: registries.expressionFunctions.list() },
  ].filter((s) => s.entries.length > 0);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Extension registries</CardTitle>
        <CardDescription>
          Every open extension point — the shell seeds defaults; plugins extend
          by registering during <code>activate()</code>.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          {sections.map((s) => (
            <div key={s.label}>
              <div className="font-medium text-text-primary mb-1">
                {s.label} — {s.entries.length}
              </div>
              <ul className="space-y-0.5">
                {s.entries.map((e) => (
                  <li key={e.key} className="flex items-center gap-2">
                    <code className="font-mono text-[11px]">{e.key}</code>
                    <span className="text-text-muted ml-auto">{e.contributor}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
