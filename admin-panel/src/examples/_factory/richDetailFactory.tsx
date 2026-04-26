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
import { useRecord } from "@/runtime/hooks";
import { useLiveAudit } from "@/runtime/audit";
import { useHash, navigateTo } from "@/views/useRoute";
import { useRuntime } from "@/runtime/context";
import type {
  DomainFieldConfig,
  DomainPluginConfig,
  DomainResourceConfig,
} from "./buildDomainPlugin";
import type { ErpDocumentMappingAction, ErpWorkflowTransitionDefinition } from "@/contracts/erp-metadata";
import { renderValue } from "./renderValue";
import {
  OverviewSections,
  BIPanel,
  AutoConnectionsPanel,
  ActionsPanel,
  ActivityTabPanel,
  RecentActivityRailCard,
  CustomFieldsRailCard,
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

function openPrintableDocument(title: string, html: string): void {
  const win = window.open("", "_blank");
  if (win) {
    win.opener = null;
    win.document.open();
    win.document.write(html);
    win.document.close();
    win.document.title = title;
    window.setTimeout(() => {
      win.focus();
      win.print();
    }, 150);
    return;
  }

  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener,noreferrer");
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

function absoluteAppUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${window.location.origin}${path.startsWith("/") ? "" : "/"}${path}`;
}

function defaultPortalExpiry(): string {
  const expires = new Date();
  expires.setDate(expires.getDate() + 30);
  return expires.toISOString();
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

function ErpDocumentTab({
  record,
  resource,
}: {
  record: Record<string, unknown>;
  resource: DomainResourceConfig;
}) {
  const erp = resource.erp;
  if (!erp) return null;
  const childTables = erp.childTables ?? [];
  const links = erp.links ?? [];
  const workspaceLinks = erp.workspaceLinks ?? [];
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Document model</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-text-muted">Document type</dt>
              <dd className="font-mono text-text-primary">{erp.documentType ?? resource.singular}</dd>
            </div>
            <div>
              <dt className="text-text-muted">Naming series</dt>
              <dd className="font-mono text-text-primary">{erp.namingSeries ?? "Manual"}</dd>
            </div>
            <div>
              <dt className="text-text-muted">Submitted states</dt>
              <dd className="text-text-primary">{erp.submittedStatuses?.join(", ") || "Not configured"}</dd>
            </div>
            <div>
              <dt className="text-text-muted">Search fields</dt>
              <dd className="text-text-primary">{erp.searchFields?.join(", ") || resource.fields.slice(0, 3).map((field) => field.name).join(", ")}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {childTables.map((table) => {
        const rows = Array.isArray(record[table.field]) ? record[table.field] as Record<string, unknown>[] : [];
        return (
          <Card key={table.field}>
            <CardHeader>
              <CardTitle>{table.label}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {rows.length === 0 ? (
                <div className="px-4 py-6 text-sm text-text-muted">
                  No line rows captured yet. Columns: {table.fields.map((field) => field.label ?? humanize(field.name)).join(", ")}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-xs uppercase text-text-muted">
                        {table.fields.map((field) => (
                          <th key={field.name} className="px-3 py-2 text-left">
                            {field.label ?? humanize(field.name)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, index) => (
                        <tr key={String(row.id ?? index)} className="border-b border-border-subtle last:border-b-0">
                          {table.fields.map((field) => (
                            <td key={field.name} className="px-3 py-2 text-text-secondary">
                              {String(row[field.name] ?? "—")}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      {(links.length > 0 || workspaceLinks.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle>Links and drilldowns</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 text-sm md:grid-cols-2">
              <div>
                <h4 className="mb-2 font-medium text-text-primary">Document links</h4>
                <ul className="space-y-2">
                  {links.map((link) => (
                    <li key={`${link.field}:${link.targetResourceId}`} className="flex items-center justify-between gap-3 rounded-md border border-border-subtle px-3 py-2">
                      <span>{link.label ?? humanize(link.field)}</span>
                      <code className="text-xs text-text-muted">{link.targetResourceId}</code>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="mb-2 font-medium text-text-primary">Workspace drilldowns</h4>
                <ul className="space-y-2">
                  {workspaceLinks.map((link) => (
                    <li key={`${link.kind}:${link.path}`} className="flex items-center justify-between gap-3 rounded-md border border-border-subtle px-3 py-2">
                      <a className="text-accent hover:underline" href={`#${link.path}`}>{link.label}</a>
                      <span className="text-xs uppercase text-text-muted">{link.kind}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ErpDocumentRailCard({
  record,
  resource,
  busyActionId,
  busyPrintFormatId,
  busyWorkflowId,
  busyPortal,
  onMapDocument,
  onTransition,
  onPrint,
  onCreatePortalLink,
}: {
  record: Record<string, unknown>;
  resource: DomainResourceConfig;
  busyActionId?: string | null;
  busyPrintFormatId?: string | null;
  busyWorkflowId?: string | null;
  busyPortal?: boolean;
  onMapDocument: (action: ErpDocumentMappingAction) => Promise<void>;
  onTransition: (transition: ErpWorkflowTransitionDefinition) => Promise<void>;
  onPrint: (formatId: string) => Promise<void>;
  onCreatePortalLink: () => Promise<void>;
}) {
  const erp = resource.erp;
  if (!erp) return null;
  const status = String(record[erp.statusField ?? "status"] ?? "");
  const transitions = (erp.workflow?.transitions ?? []).filter((transition) => String(transition.from) === status);
  return (
    <Card>
      <CardHeader>
        <CardTitle>ERP document</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="space-y-1">
          <div className="text-text-muted">Next actions</div>
          {(erp.mappingActions ?? []).length === 0 ? (
            <div className="text-text-secondary">No mapped actions configured.</div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {(erp.mappingActions ?? []).map((action) => {
                const ineligible = Boolean(action.visibleInStatuses?.length) && !action.visibleInStatuses?.includes(status);
                const busy = busyActionId === action.id;
                return (
                  <button
                    key={action.id}
                    type="button"
                    className="rounded-md border border-border px-2.5 py-1.5 text-xs text-text-primary hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-55"
                    disabled={busy || ineligible}
                    title={ineligible ? `Available in: ${action.visibleInStatuses?.join(", ")}` : action.label}
                    onClick={() => void onMapDocument(action)}
                  >
                    {busy ? "Creating..." : action.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        {erp.workflow ? (
          <div className="space-y-1">
            <div className="text-text-muted">Workflow</div>
            {transitions.length === 0 ? (
              <div className="text-text-secondary">
                No transitions available from {status || erp.workflow.initialState}.
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {transitions.map((transition) => {
                  const key = `${transition.from}:${transition.to}`;
                  const busy = busyWorkflowId === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      className="rounded-md border border-border px-2.5 py-1.5 text-xs text-text-primary hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-55"
                      disabled={busy}
                      onClick={() => void onTransition(transition)}
                    >
                      {busy ? "Updating..." : transition.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ) : null}
        {(erp.printFormats?.length || erp.portal) && (
          <div className="flex flex-wrap gap-2">
            {erp.printFormats?.map((format) => (
              <button
                key={format.id}
                type="button"
                className="rounded-md border border-border px-2.5 py-1.5 text-xs text-text-primary hover:bg-surface-muted"
                disabled={busyPrintFormatId === format.id}
                onClick={() => void onPrint(format.id)}
              >
                {busyPrintFormatId === format.id ? "Preparing..." : `Print ${format.label}`}
              </button>
            ))}
            {erp.portal ? (
              <button
                type="button"
                className="rounded-md border border-border px-2.5 py-1.5 text-xs text-text-primary hover:bg-surface-muted"
                disabled={busyPortal}
                onClick={() => void onCreatePortalLink()}
              >
                {busyPortal ? "Creating link..." : "Create portal link"}
              </button>
            ) : null}
          </div>
        )}
        {erp.builderSurfaces?.length ? (
          <div className="space-y-1">
            <div className="text-text-muted">Builder surfaces</div>
            <ul className="space-y-1">
              {erp.builderSurfaces.map((surface) => (
                <li key={surface.id}>
                  <a className="text-accent hover:underline" href={`#${surface.path}`}>{surface.label}</a>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
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
  const [busyErpActionId, setBusyErpActionId] = React.useState<string | null>(null);
  const [busyPrintFormatId, setBusyPrintFormatId] = React.useState<string | null>(null);
  const [busyWorkflowId, setBusyWorkflowId] = React.useState<string | null>(null);
  const [busyPortal, setBusyPortal] = React.useState(false);

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
  const basePathMap = React.useMemo(
    () => (registry ? buildBasePathMap(registry) : {}),
    [registry],
  );
  const editPath = `${resource.path}/${id}/edit`;
  const handleMapDocument = React.useCallback(
    async (action: ErpDocumentMappingAction) => {
      if (!resource.erp) return;
      setBusyErpActionId(action.id);
      try {
        const result = await runtime.erp.mapDocument({
          sourceResource: fullResourceId,
          sourceId: id,
          statusField: resource.erp.statusField,
          action,
        });
        runtime.resources.refresh(fullResourceId);
        runtime.resources.refresh(action.targetResourceId);
        runtime.actions.toast({
          title: result.reused ? "Existing document opened" : `${action.label} created`,
          intent: "success",
          description: `${action.targetResourceId} ${String(result.target.id ?? result.mapping.targetId)}`,
        });
        const targetBasePath = basePathMap[action.targetResourceId];
        if (targetBasePath) {
          navigateTo(`${targetBasePath}/${String(result.target.id ?? result.mapping.targetId)}`);
        }
      } catch (err) {
        runtime.actions.toast({
          title: `${action.label} failed`,
          description: err instanceof Error ? err.message : "The document action could not be completed.",
          intent: "danger",
        });
      } finally {
        setBusyErpActionId(null);
      }
    },
    [basePathMap, fullResourceId, id, resource.erp, runtime],
  );
  const handlePrint = React.useCallback(
    async (formatId: string) => {
      setBusyPrintFormatId(formatId);
      try {
        const document = await runtime.erp.renderPrint(fullResourceId, id, formatId);
        openPrintableDocument(document.title, document.html);
        runtime.actions.toast({
          title: "Print view ready",
          description: `${document.formatId} generated for ${document.title}`,
          intent: "success",
        });
      } catch (err) {
        runtime.actions.toast({
          title: "Print view failed",
          description: err instanceof Error ? err.message : "The print document could not be generated.",
          intent: "danger",
        });
      } finally {
        setBusyPrintFormatId(null);
      }
    },
    [fullResourceId, id, runtime],
  );
  const handleWorkflowTransition = React.useCallback(
    async (transition: ErpWorkflowTransitionDefinition) => {
      if (!resource.erp?.workflow) return;
      const key = `${transition.from}:${transition.to}`;
      setBusyWorkflowId(key);
      try {
        let reason: string | undefined;
        if (transition.reasonRequired) {
          reason = window.prompt(`Reason for ${transition.label.toLowerCase()}`) ?? undefined;
          if (!reason?.trim()) {
            setBusyWorkflowId(null);
            return;
          }
        }
        await runtime.erp.transitionWorkflow({
          resource: fullResourceId,
          recordId: id,
          stateField: resource.erp.workflow.stateField,
          from: String(transition.from),
          to: String(transition.to),
          reason,
        });
        runtime.resources.refresh(fullResourceId);
        runtime.actions.toast({
          title: transition.label,
          description: `${resource.singular} moved to ${transition.to}.`,
          intent: "success",
        });
      } catch (err) {
        runtime.actions.toast({
          title: "Workflow transition failed",
          description: err instanceof Error ? err.message : "The document state could not be changed.",
          intent: "danger",
        });
      } finally {
        setBusyWorkflowId(null);
      }
    },
    [fullResourceId, id, resource, runtime],
  );
  const handleCreatePortalLink = React.useCallback(
    async () => {
      if (!resource.erp?.portal) return;
      setBusyPortal(true);
      try {
        const defaultFormat = resource.erp.printFormats?.find((format) => format.default)
          ?? resource.erp.printFormats?.[0];
        const link = await runtime.erp.createPortalLink({
          resource: fullResourceId,
          recordId: id,
          audience: resource.erp.portal.audience,
          formatId: defaultFormat?.id,
          title: displayName(rec, resource),
          expiresAt: defaultPortalExpiry(),
        });
        const url = absoluteAppUrl(link.url);
        try {
          await navigator.clipboard?.writeText(url);
        } catch {
          /* clipboard can be unavailable in restricted browsers */
        }
        window.open(url, "_blank", "noopener,noreferrer");
        runtime.actions.toast({
          title: "Portal link ready",
          description: "The secure link was copied and opened in a new tab.",
          intent: "success",
        });
      } catch (err) {
        runtime.actions.toast({
          title: "Portal link failed",
          description: err instanceof Error ? err.message : "The portal link could not be created.",
          intent: "danger",
        });
      } finally {
        setBusyPortal(false);
      }
    },
    [fullResourceId, id, rec, resource, runtime],
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
      favoriteTarget={{
        resource: fullResourceId,
        recordId: id,
        label: identifier,
      }}
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
        ...(resource.erp
          ? [
              {
                id: "document",
                label: "Document",
                render: () => (
                  <ErpDocumentTab record={rec} resource={resource} />
                ),
              },
            ]
          : []),
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
                basePathMap={basePathMap}
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
          // Per-record activity feed — backed by `/api/timeline/<resource>/<id>`.
          // The audit-events count above is the closest live signal we have
          // for "is there anything here", so we surface it as the badge while
          // the actual feed loads its own data.
          count: events.length || undefined,
          render: () => (
            <ActivityTabPanel resource={fullResourceId} recordId={id} />
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
        ...(resource.erp
          ? [
              {
                id: "erp-document",
                priority: 90,
                render: () => (
                  <ErpDocumentRailCard
                    record={rec}
                    resource={resource}
                    busyActionId={busyErpActionId}
                    busyPrintFormatId={busyPrintFormatId}
                    busyWorkflowId={busyWorkflowId}
                    busyPortal={busyPortal}
                    onMapDocument={handleMapDocument}
                    onTransition={handleWorkflowTransition}
                    onPrint={handlePrint}
                    onCreatePortalLink={handleCreatePortalLink}
                  />
                ),
              },
            ]
          : []),
        // Custom fields rail — auto-renders only when the resource has
        // fields registered in field_metadata. Inline-editable with
        // optimistic write-through; rolls back + toasts on failure.
        // The component itself returns null when fields.length === 0,
        // so leaving it in the array is safe even for resources with
        // none.
        {
          id: "custom-fields",
          priority: 80,
          render: () => (
            <CustomFieldsRailCard
              resource={fullResourceId}
              recordId={id}
              record={rec}
              editable={!resource.readOnly}
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
        // Recent-activity rail — last 10 events from the per-record
        // timeline so users can see what changed without switching to
        // the Activity tab.
        {
          id: "recent-activity",
          priority: 50,
          render: () => (
            <RecentActivityRailCard
              resource={fullResourceId}
              recordId={id}
            />
          ),
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
