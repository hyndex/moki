import * as React from "react";
import * as Icons from "lucide-react";
import {
  RichDetailPage,
  MetadataRailCard,
  TabEmpty,
  ConnectionsPanel,
  AutomationHookPanel,
  AIInsightPanel,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/admin-primitives";
import { Badge, type Intent } from "@/primitives/Badge";
import { Timeline } from "@/admin-primitives/Timeline";
import { useRecord } from "@/runtime/hooks";
import { useLiveAudit } from "@/runtime/audit";
import { useHash, navigateTo } from "@/views/useRoute";
import { useRuntime } from "@/runtime/context";
import type {
  DomainFieldConfig,
  DomainPluginConfig,
  DomainResourceConfig,
} from "./buildDomainPlugin";
import { renderValue } from "./renderValue";
import {
  OverviewSections,
  BIPanel,
  AutoConnectionsPanel,
  ActionsPanel,
} from "./detailSections";
import { useRegistry } from "@/shell/registry";
import { usePluginHost2 } from "@/host/pluginHostContext";
import { resolveViewExtensions } from "@/host/viewExtensions";
import { PluginBoundary } from "@/host/PluginBoundary";

/** Auto-generated RichDetailPage for every factory-built resource.
 *
 *  Every factory plugin now ships a proper enterprise detail page:
 *    - Hero with avatar, title, status badge, key metrics, 3–5 actions
 *    - Tabs: Overview, Activity, Related, Files, Audit (configurable)
 *    - Right rail: Metadata, Connections, AI Insights, Automation hooks
 *
 *  Plugin authors can still override this with a custom RichDetailPage
 *  if the domain needs more tabs (invoices need "Line items + Payments",
 *  deals need "Line items + Quotes + Forecast", etc.) — those live in
 *  their plugin's own file using the same primitive.
 */

import type { AdminRegistry } from "@/shell/registry";
import type { NavItem } from "@/contracts/nav";

/** Map resource id → list-view base path, derived from nav items. Used by
 *  AutoConnectionsPanel to build deep-links. */
function buildBasePathMap(registry: AdminRegistry): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (items: readonly NavItem[]) => {
    for (const n of items) {
      if (n.view && n.path) {
        const v = registry.views[n.view];
        if (v && "resource" in v && typeof v.resource === "string" && v.type === "list") {
          out[v.resource] = n.path;
        }
      }
      if (n.children) walk(n.children);
    }
  };
  walk(registry.nav);
  return out;
}

function Icon({ name }: { name?: string }) {
  if (!name) return null;
  const C = (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[name];
  if (!C) return null;
  return <C className="h-5 w-5 text-accent" />;
}

/** Resolve a human display value from a record using the plugin's primary
 *  display field, falling back to `name` or the id. */
function displayName(
  record: Record<string, unknown>,
  resource: DomainResourceConfig,
): string {
  const primary = record[resource.displayField ?? "name"];
  if (typeof primary === "string" && primary.length > 0) return primary;
  if (typeof record.code === "string") return record.code;
  return String(record.id ?? "Untitled");
}

/** Resolve a status label + intent from the record using a conventional
 *  "status" field — plugins can override by passing a statusResolver in
 *  the resource config (future extension). */
function resolveStatus(
  record: Record<string, unknown>,
  resource: DomainResourceConfig,
): { label: string; intent: Intent } | undefined {
  const statusField = resource.fields.find(
    (f) => f.kind === "enum" && (f.name === "status" || f.name === "stage"),
  );
  if (!statusField) return undefined;
  const val = record[statusField.name];
  if (typeof val !== "string") return undefined;
  const match = statusField.options?.find((o) => o.value === val);
  return {
    label: match?.label ?? val,
    intent: (match?.intent as Intent | undefined) ?? "neutral",
  };
}

/** Build a compact metric strip from the resource's most salient fields
 *  (currency, number, date) — never more than 4. */
function pickMetrics(
  record: Record<string, unknown>,
  resource: DomainResourceConfig,
) {
  const preferred = resource.fields
    .filter((f) => {
      if (f.kind === "currency" || f.kind === "number") return true;
      if (f.kind === "date" || f.kind === "datetime") return true;
      return false;
    })
    .slice(0, 4);
  return preferred.map((f) => ({
    label: f.label ?? humanize(f.name),
    value: renderValue(record[f.name], f),
    helper: undefined,
    intent: undefined,
  }));
}

function humanize(s: string): string {
  return s
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (c) => c.toUpperCase())
    .replace(/-/g, " ")
    .trim();
}

export function RichDealDetailPage({
  plugin,
  resource,
}: {
  plugin: DomainPluginConfig;
  resource: DomainResourceConfig;
}) {
  const hash = useHash();
  const runtime = useRuntime();
  const registry = useRegistry();
  const host = usePluginHost2();
  const fullResourceId = `${plugin.id}.${resource.id}`;

  // Extract record id from the hash path. Convention: <basePath>/<id>.
  const id = hash.split("/").pop() ?? "";
  const { data: record, loading, error } = useRecord(fullResourceId, id);
  // Audit endpoint is global; filter client-side to the current record.
  const { data: auditPage } = useLiveAudit({ pageSize: 100 });
  const events = React.useMemo(
    () =>
      (auditPage?.rows ?? []).filter(
        (e) => e.resource === fullResourceId && (!id || e.recordId === id),
      ),
    [auditPage, fullResourceId, id],
  );

  // ALL hooks must run before any early return — moving the
  // view-extensions resolver up above the missing-record short-circuit
  // keeps React's hook count stable across renders. Otherwise navigating
  // to a non-existent id would crash the plugin with "Rendered fewer
  // hooks than expected."
  const rec = (record ?? {}) as Record<string, unknown>;
  const detailViewId = `${fullResourceId}-detail.view`;
  const ext = React.useMemo(
    () =>
      resolveViewExtensions(host, {
        id: detailViewId,
        type: "custom",
        title: resource.singular,
        resource: fullResourceId,
        render: () => null,
      } as unknown as Parameters<typeof resolveViewExtensions>[1]),
    [host, detailViewId, fullResourceId, resource.singular],
  );

  if (!record && !loading) {
    return (
      <RichDetailPage
        loading={false}
        error={new Error(`${resource.singular} ${id} not found`)}
        onRetry={() => navigateTo(resource.path)}
        title=""
        tabs={[]}
      />
    );
  }

  // After early-return guard: derived view data.
  const identifier = displayName(rec, resource);
  const status = resolveStatus(rec, resource);
  const metrics = pickMetrics(rec, resource);

  const editPath = `${resource.path}/${id}/edit`;

  // `ext` already computed above (kept here as a no-op reference for
  // readers tracing the original layout).

  return (
    <RichDetailPage
      loading={loading && !record}
      error={error ? new Error(String(error)) : null}
      breadcrumb={[
        { label: plugin.label, path: resource.path },
        { label: resource.plural, path: resource.path },
        { label: identifier },
      ]}
      avatar={
        <div className="h-12 w-12 rounded-md bg-accent-subtle flex items-center justify-center">
          <Icon name={resource.icon ?? plugin.icon} />
        </div>
      }
      title={identifier}
      subtitle={
        <span className="inline-flex items-center gap-2">
          <code className="font-mono text-xs text-text-secondary">{String(rec.id ?? id)}</code>
          <span className="text-text-muted">·</span>
          <span>{resource.singular}</span>
        </span>
      }
      status={status}
      metrics={metrics}
      lastUpdatedAt={rec.updatedAt as string | undefined}
      primaryAction={
        resource.readOnly
          ? undefined
          : {
              id: "edit",
              label: "Edit",
              icon: <Icons.Pencil className="h-3.5 w-3.5" />,
              onClick: () => navigateTo(editPath),
            }
      }
      secondaryActions={[
        {
          id: "duplicate",
          label: "Duplicate",
          icon: <Icons.Copy className="h-3.5 w-3.5" />,
          onClick: async () => {
            const copy = { ...rec };
            delete copy.id;
            delete copy.createdAt;
            delete copy.updatedAt;
            const created = await runtime.resources.create(fullResourceId, copy);
            runtime.actions.toast({
              title: `Duplicated ${resource.singular}`,
              intent: "success",
            });
            navigateTo(`${resource.path}/${(created as { id: string }).id}`);
          },
          hidden: resource.readOnly,
        },
      ]}
      extraActions={[
        {
          id: "copy-id",
          label: "Copy ID",
          icon: <Icons.Hash className="h-3.5 w-3.5" />,
          onClick: async () => {
            try {
              await navigator.clipboard.writeText(String(rec.id ?? id));
              runtime.actions.toast({ title: "Copied", intent: "success" });
            } catch {
              /* clipboard may be unavailable */
            }
          },
        },
        {
          id: "delete",
          label: "Delete",
          intent: "danger",
          icon: <Icons.Trash2 className="h-3.5 w-3.5 text-intent-danger" />,
          onClick: async () => {
            const ok = await runtime.actions.confirm({
              title: `Delete ${resource.singular.toLowerCase()}?`,
              description: "This cannot be undone.",
              destructive: true,
            });
            if (!ok) return;
            await runtime.resources.delete(fullResourceId, id);
            runtime.actions.toast({
              title: `${resource.singular} deleted`,
              intent: "danger",
            });
            navigateTo(resource.path);
          },
          hidden: resource.readOnly,
        },
      ]}
      tabs={[
        {
          id: "overview",
          label: "Overview",
          render: () => (
            <OverviewSections record={rec} fields={resource.fields} />
          ),
        },
        {
          id: "bi",
          label: "BI",
          render: () => (
            <BIPanel
              resource={fullResourceId}
              record={rec}
              fields={resource.fields}
            />
          ),
        },
        {
          id: "connections",
          label: "Connections",
          render: () =>
            registry ? (
              <AutoConnectionsPanel
                resource={fullResourceId}
                recordId={id}
                registry={registry}
                basePathMap={buildBasePathMap(registry)}
              />
            ) : (
              <TabEmpty title="Registry unavailable" />
            ),
        },
        {
          id: "actions",
          label: "Actions",
          render: () => (
            <ActionsPanel
              actions={resource.actions ?? []}
              record={rec}
              resource={fullResourceId}
              onNavigateEdit={() => navigateTo(editPath)}
            />
          ),
        },
        {
          id: "activity",
          label: "Activity",
          count: events.length,
          render: () =>
            events.length === 0 ? (
              <TabEmpty
                title="No activity yet"
                description="Every mutation to this record will appear here."
              />
            ) : (
              <Card>
                <CardContent className="p-3">
                  <Timeline
                    items={events.slice(0, 30).map((e) => ({
                      id: e.id,
                      title: e.action,
                      description: e.actor,
                      occurredAt: new Date(e.occurredAt),
                      intent:
                        e.level === "error"
                          ? "danger"
                          : e.level === "warn"
                            ? "warning"
                            : "info",
                    }))}
                  />
                </CardContent>
              </Card>
            ),
        },
        ...ext.tabs
          .filter((t) => !t.visibleWhen || t.visibleWhen(rec))
          .map((t) => ({
            id: t.id,
            label: t.label,
            render: () => (
              <PluginExtensionBoundary pluginId={t.contributor} label={t.label}>
                {t.render(rec)}
              </PluginExtensionBoundary>
            ),
          })),
        {
          id: "audit",
          label: "Audit",
          count: events.length,
          render: () => (
            <Card>
              <CardHeader>
                <CardTitle>Audit trail</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {events.length === 0 ? (
                  <TabEmpty title="No audit events recorded" />
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-xs uppercase tracking-wider text-text-muted">
                        <th className="text-left px-3 py-2">When</th>
                        <th className="text-left px-3 py-2">Actor</th>
                        <th className="text-left px-3 py-2">Action</th>
                        <th className="text-left px-3 py-2">Level</th>
                      </tr>
                    </thead>
                    <tbody>
                      {events.map((e) => (
                        <tr
                          key={e.id}
                          className="border-b border-border-subtle last:border-b-0"
                        >
                          <td className="px-3 py-2 text-text-secondary">
                            {new Date(e.occurredAt).toLocaleString()}
                          </td>
                          <td className="px-3 py-2 text-text-secondary">
                            {e.actor}
                          </td>
                          <td className="px-3 py-2 text-text-primary font-mono text-xs">
                            {e.action}
                          </td>
                          <td className="px-3 py-2">
                            <Badge
                              intent={
                                e.level === "error"
                                  ? "danger"
                                  : e.level === "warn"
                                    ? "warning"
                                    : "info"
                              }
                            >
                              {e.level ?? "info"}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>
          ),
        },
      ]}
      rail={[
        {
          id: "metadata",
          priority: 100,
          render: () => (
            <MetadataRailCard
              items={[
                { label: "Id", value: <code className="font-mono text-xs">{String(rec.id ?? id)}</code> },
                {
                  label: "Created",
                  value: rec.createdAt
                    ? new Date(rec.createdAt as string).toLocaleString()
                    : "—",
                },
                {
                  label: "Updated",
                  value: rec.updatedAt
                    ? new Date(rec.updatedAt as string).toLocaleString()
                    : "—",
                },
                {
                  label: "Owner",
                  value: (rec.owner as string) ?? "—",
                },
              ]}
            />
          ),
        },
        {
          id: "connections",
          priority: 60,
          render: () =>
            plugin.connections ? (
              <ConnectionsPanel descriptor={plugin.connections} parent={rec} />
            ) : null,
        },
        {
          id: "automation",
          priority: 40,
          render: () => (
            <AutomationHookPanel
              hooks={[]}
              onConfigure={() => navigateTo("/automation/triggers")}
            />
          ),
        },
        {
          id: "ai",
          priority: 20,
          render: () => (
            <AIInsightPanel
              insights={[]}
              loading={false}
            />
          ),
        },
        ...ext.railCards.map((c) => ({
          id: `ext::${c.contributor}::${c.id}`,
          priority: c.priority,
          render: () => (
            <PluginExtensionBoundary pluginId={c.contributor} label={c.id}>
              {c.render(rec)}
            </PluginExtensionBoundary>
          ),
        })),
      ]}
    />
  );
}

/** Per-extension error boundary wrapper — uses the shared PluginBoundary so
 *  a single plugin's extension crashing doesn't take out the whole detail
 *  view. */
function PluginExtensionBoundary({
  pluginId,
  label,
  children,
}: {
  pluginId: string;
  label?: string;
  children: React.ReactNode;
}) {
  return (
    <PluginBoundary pluginId={pluginId} label={label}>
      {children}
    </PluginBoundary>
  );
}
