import * as React from "react";
import * as Icons from "lucide-react";
import type { ZodTypeAny } from "zod";
import { z } from "zod";
import {
  RichDetailPage,
  MetadataRailCard,
  TabEmpty,
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
import { defineCustomView } from "@/builders";
import type { CustomView } from "@/contracts/views";
import type { DomainFieldConfig } from "./buildDomainPlugin";
import { renderValue } from "./renderValue";
import {
  OverviewSections,
  BIPanel,
  AutoConnectionsPanel,
  ActionsPanel,
} from "./detailSections";
import { useRegistry, type AdminRegistry } from "@/shell/registry";
import type { NavItem } from "@/contracts/nav";
import { usePluginHost2 } from "@/host/pluginHostContext";
import { resolveViewExtensions } from "@/host/viewExtensions";
import { PluginBoundary } from "@/host/PluginBoundary";

/** Rich detail page generated directly from a Zod schema.
 *
 *  Used for hand-rolled `defineResource({ schema })` resources that don't go
 *  through buildDomainPlugin. Produces the same enterprise layout:
 *    - Hero with icon, title, status badge, up-to-4 metrics, actions
 *    - Tabs: Overview (all fields as dl), Activity, Audit
 *    - Right rail: Metadata, Automation, AI Insights
 *
 *  The Zod shape is introspected — enum types become Badge-rendered values,
 *  number/currency/date fields are promoted to hero metrics, etc.
 */

export interface DetailFromZodArgs {
  /** Full resource id, e.g. "booking.service". */
  resource: string;
  /** Singular label (e.g. "Service"). */
  singular: string;
  /** Plural label (e.g. "Services"). */
  plural: string;
  /** Plugin label for the breadcrumb root. */
  pluginLabel: string;
  /** Base path for the resource (e.g. "/bookings/services"). */
  path: string;
  /** Optional lucide icon name. */
  icon?: string;
  /** Zod object schema that defines the record shape. */
  schema: z.ZodObject<Record<string, ZodTypeAny>>;
  /** Preferred display field. Default "name". */
  displayField?: string;
  /** Per-field overrides (labels, enum option intents, explicit kind, hide). */
  overrides?: Record<string, Partial<DomainFieldConfig> & { hidden?: boolean }>;
  /** Read-only resources hide edit + delete. */
  readOnly?: boolean;
  /** Custom id for the returned CustomView. Defaults to `<resource>-detail.view`. */
  viewId?: string;
}

/** Convenience — returns a CustomView wired to the Zod-powered detail page.
 *  Matches the `<id>-detail.view` convention so `resolveCustomDetailView` in
 *  AppShell picks it up automatically for the resource. */
export function detailViewFromZod(args: DetailFromZodArgs): CustomView {
  return defineCustomView({
    id: args.viewId ?? `${args.resource}-detail.view`,
    title: args.singular,
    description: `Rich ${args.singular.toLowerCase()} detail page.`,
    resource: args.resource,
    render: () => <RichZodDetailPage args={args} />,
  });
}

/* ------------------------------------------------------------------------ */
/* Implementation                                                            */
/* ------------------------------------------------------------------------ */

function RichZodDetailPage({ args }: { args: DetailFromZodArgs }) {
  const hash = useHash();
  const runtime = useRuntime();
  const registry = useRegistry();
  const host = usePluginHost2();
  const id = hash.split("/").pop() ?? "";
  const { data: record, loading, error } = useRecord(args.resource, id);
  const { data: auditPage } = useLiveAudit({ pageSize: 100 });
  const events = React.useMemo(
    () =>
      (auditPage?.rows ?? []).filter(
        (e) => e.resource === args.resource && (!id || e.recordId === id),
      ),
    [auditPage, args.resource, id],
  );

  const fields = React.useMemo(() => schemaToFields(args.schema, args.overrides), [
    args.schema,
    args.overrides,
  ]);

  if (!record && !loading) {
    return (
      <RichDetailPage
        loading={false}
        error={new Error(`${args.singular} ${id} not found`)}
        onRetry={() => navigateTo(args.path)}
        title=""
        tabs={[]}
      />
    );
  }

  const rec = (record ?? {}) as Record<string, unknown>;
  const identifier = displayName(rec, args.displayField);
  const status = resolveStatus(rec, fields);
  const metrics = pickMetrics(rec, fields);
  const editPath = `${args.path}/${id}/edit`;

  /* View extensions contributed by other plugins. */
  const detailViewId = args.viewId ?? `${args.resource}-detail.view`;
  const ext = resolveViewExtensions(host, {
    id: detailViewId,
    type: "custom",
    title: args.singular,
    resource: args.resource,
    render: () => null,
  } as unknown as Parameters<typeof resolveViewExtensions>[1]);

  return (
    <RichDetailPage
      loading={loading && !record}
      error={error ? new Error(String(error)) : null}
      breadcrumb={[
        { label: args.pluginLabel, path: args.path },
        { label: args.plural, path: args.path },
        { label: identifier },
      ]}
      avatar={
        <div className="h-12 w-12 rounded-md bg-accent-subtle flex items-center justify-center">
          <Icon name={args.icon} />
        </div>
      }
      title={identifier}
      subtitle={
        <span className="inline-flex items-center gap-2">
          <code className="font-mono text-xs text-text-secondary">
            {String(rec.id ?? id)}
          </code>
          <span className="text-text-muted">·</span>
          <span>{args.singular}</span>
        </span>
      }
      status={status}
      metrics={metrics}
      lastUpdatedAt={rec.updatedAt as string | undefined}
      primaryAction={
        args.readOnly
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
            const created = await runtime.resources.create(args.resource, copy);
            runtime.actions.toast({
              title: `Duplicated ${args.singular}`,
              intent: "success",
            });
            navigateTo(`${args.path}/${(created as { id: string }).id}`);
          },
          hidden: args.readOnly,
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
              /* clipboard unavailable */
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
              title: `Delete ${args.singular.toLowerCase()}?`,
              description: "This cannot be undone.",
              destructive: true,
            });
            if (!ok) return;
            await runtime.resources.delete(args.resource, id);
            runtime.actions.toast({
              title: `${args.singular} deleted`,
              intent: "danger",
            });
            navigateTo(args.path);
          },
          hidden: args.readOnly,
        },
      ]}
      tabs={[
        {
          id: "overview",
          label: "Overview",
          render: () => <OverviewSections record={rec} fields={fields} />,
        },
        {
          id: "bi",
          label: "BI",
          render: () => (
            <BIPanel resource={args.resource} record={rec} fields={fields} />
          ),
        },
        {
          id: "connections",
          label: "Connections",
          render: () =>
            registry ? (
              <AutoConnectionsPanel
                resource={args.resource}
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
              actions={[]}
              record={rec}
              resource={args.resource}
              onNavigateEdit={() => navigateTo(editPath)}
            />
          ),
        },
        ...ext.tabs
          .filter((t) => !t.visibleWhen || t.visibleWhen(rec))
          .map((t) => ({
            id: t.id,
            label: t.label,
            render: () => (
              <PluginBoundary pluginId={t.contributor} label={t.label}>
                {t.render(rec)}
              </PluginBoundary>
            ),
          })),
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
                {
                  label: "Id",
                  value: (
                    <code className="font-mono text-xs">
                      {String(rec.id ?? id)}
                    </code>
                  ),
                },
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
          render: () => <AIInsightPanel insights={[]} loading={false} />,
        },
        ...ext.railCards.map((c) => ({
          id: `ext::${c.contributor}::${c.id}`,
          priority: c.priority,
          render: () => (
            <PluginBoundary pluginId={c.contributor} label={c.id}>
              {c.render(rec)}
            </PluginBoundary>
          ),
        })),
      ]}
    />
  );
}

/* ------------------------------------------------------------------------ */
/* Helpers                                                                   */
/* ------------------------------------------------------------------------ */

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
  if (!name) return <Icons.FileText className="h-5 w-5 text-accent" />;
  const C = (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[name];
  if (!C) return <Icons.FileText className="h-5 w-5 text-accent" />;
  return <C className="h-5 w-5 text-accent" />;
}

function displayName(rec: Record<string, unknown>, displayField?: string): string {
  const primary = rec[displayField ?? "name"];
  if (typeof primary === "string" && primary.length > 0) return primary;
  if (typeof rec.code === "string") return rec.code;
  if (typeof rec.title === "string") return rec.title;
  return String(rec.id ?? "Untitled");
}

function resolveStatus(
  rec: Record<string, unknown>,
  fields: readonly DomainFieldConfig[],
): { label: string; intent: Intent } | undefined {
  const statusField = fields.find(
    (f) => f.kind === "enum" && (f.name === "status" || f.name === "stage"),
  );
  if (!statusField) return undefined;
  const val = rec[statusField.name];
  if (typeof val !== "string") return undefined;
  const match = statusField.options?.find((o) => o.value === val);
  return {
    label: match?.label ?? val,
    intent: (match?.intent as Intent | undefined) ?? "neutral",
  };
}

function pickMetrics(
  rec: Record<string, unknown>,
  fields: readonly DomainFieldConfig[],
) {
  const preferred = fields
    .filter((f) => {
      if (f.name === "id") return false;
      if (f.kind === "currency" || f.kind === "number") return true;
      if (f.kind === "date" || f.kind === "datetime") return true;
      return false;
    })
    .slice(0, 4);
  return preferred.map((f) => ({
    label: f.label ?? humanize(f.name),
    value: renderValue(rec[f.name], f),
    helper: undefined,
    intent: undefined,
  }));
}

function humanize(s: string): string {
  return s
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (c) => c.toUpperCase())
    .replace(/-/g, " ")
    .replace(/_/g, " ")
    .trim();
}

/* ---- Zod → DomainFieldConfig[] (for reusing DomainFieldConfig-shaped renderers) ---- */

function schemaToFields(
  schema: z.ZodObject<Record<string, ZodTypeAny>>,
  overrides?: Record<string, Partial<DomainFieldConfig> & { hidden?: boolean }>,
): DomainFieldConfig[] {
  const out: DomainFieldConfig[] = [];
  for (const [name, zod] of Object.entries(schema.shape)) {
    if (overrides?.[name]?.hidden) continue;
    if (name === "id") continue;
    const base = inferField(name, zod);
    const override = overrides?.[name] ?? {};
    out.push({ ...base, ...override });
  }
  return out;
}

function inferField(name: string, zod: ZodTypeAny): DomainFieldConfig {
  const inner = unwrap(zod);
  const kind = inferKind(inner, name);
  const options =
    inner._def?.typeName === "ZodEnum"
      ? (inner._def.values as readonly string[]).map((v) => ({
          value: v,
          label: humanize(v),
        }))
      : undefined;
  return {
    name,
    label: humanize(name),
    kind,
    options,
  };
}

function unwrap(t: ZodTypeAny): ZodTypeAny {
  const def = (t as unknown as { _def?: { typeName?: string; innerType?: ZodTypeAny } })._def;
  const tn = def?.typeName;
  if (
    (tn === "ZodOptional" ||
      tn === "ZodNullable" ||
      tn === "ZodDefault" ||
      tn === "ZodEffects") &&
    def?.innerType
  ) {
    return unwrap(def.innerType);
  }
  return t;
}

function inferKind(t: ZodTypeAny, name: string): DomainFieldConfig["kind"] {
  const tn = (t as unknown as { _def: { typeName: string } })._def.typeName;
  if (tn === "ZodString") {
    const lower = name.toLowerCase();
    if (lower.includes("email")) return "email";
    if (lower.includes("url") || lower.includes("website")) return "url";
    if (lower.includes("phone")) return "phone";
    if (lower.endsWith("at") || lower.endsWith("date")) return "datetime";
    if (lower.includes("description") || lower.includes("notes")) return "textarea";
    return "text";
  }
  if (tn === "ZodNumber") {
    const lower = name.toLowerCase();
    if (
      lower.includes("price") ||
      lower.includes("amount") ||
      lower.includes("cost") ||
      lower.includes("rate") ||
      lower.includes("revenue")
    )
      return "currency";
    return "number";
  }
  if (tn === "ZodBoolean") return "boolean";
  if (tn === "ZodEnum") return "enum";
  if (tn === "ZodArray") return "json";
  if (tn === "ZodObject") return "json";
  return "text";
}
