import * as React from "react";
import { z, type ZodTypeAny } from "zod";
import {
  defineCustomView,
  defineDetailView,
  defineFormView,
  defineListView,
  definePlugin,
  defineResource,
} from "@/builders";
import type { FieldDescriptor, EnumOption } from "@/contracts/fields";
import type { NavItem, NavSection } from "@/contracts/nav";
import type { Plugin } from "@/contracts/plugin";
import type { ActionDescriptor } from "@/contracts/actions";
import type {
  DashboardWidget,
  ColumnDescriptor,
  View,
} from "@/contracts/views";
import { RichDealDetailPage } from "./richDetailFactory";

/** Compact per-field config that produces: zod schema, form input, list column,
 *  and detail renderer — everything aligned, nothing duplicated. */
export interface DomainFieldConfig {
  name: string;
  label?: string;
  kind: FieldDescriptor["kind"];
  required?: boolean;
  help?: string;
  placeholder?: string;
  options?: readonly EnumOption[];
  currency?: string;
  /** Show in list view? Default true for primitive fields, false for textarea/json. */
  list?: boolean;
  sortable?: boolean;
  width?: number | string;
  align?: "left" | "right" | "center";
  readonly?: boolean;
  formSection?: string;   // name of form section (default "Details")
}

export interface DomainResourceConfig {
  /** Short id — will be namespaced as `<plugin>.<id>`. */
  id: string;
  singular: string;
  plural: string;
  icon?: string;
  /** Path under which list / form / detail are mounted (e.g. "/invoices"). */
  path: string;
  /** Optional section label — defaults to the plugin's section. */
  navOrder?: number;
  /** Name of the field used as the record's display name. Default "name". */
  displayField?: string;
  fields: readonly DomainFieldConfig[];
  /** Rows to seed into the mock backend. */
  seed?: (i: number) => Record<string, unknown>;
  seedCount?: number;
  /** Actions to attach to the list view. */
  actions?: readonly ActionDescriptor[];
  /** Extra dashboard widgets contributed globally. */
  widgets?: readonly DashboardWidget[];
  /** Default sort. */
  defaultSort?: { field: string; dir: "asc" | "desc" };
  /** Default page size. */
  pageSize?: number;
  /** Hide form view (read-only resource, e.g. audit-like logs). */
  readOnly?: boolean;
}

export interface DomainPluginConfig {
  id: string;
  label: string;
  icon?: string;
  description?: string;
  section: NavSection;
  /** Nav order within the section, applied to the first resource. */
  order?: number;
  resources: readonly DomainResourceConfig[];
  /** Extra commands to contribute to the palette. */
  commands?: Plugin["admin"] extends { commands?: infer C } ? C : never;
  /** Custom views (dashboards, kanban, calendar, analytics, settings, etc.) — merged
   *  with the auto-generated list/form/detail views. */
  extraViews?: readonly View[];
  /** Extra nav items for custom pages. Each one typically points at one of
   *  the extraViews via `view: "<id>"`. */
  extraNav?: readonly NavItem[];
  /** Per-plugin ConnectionsPanel — shown on the rich detail rail. Plugins
   *  describe what related resources exist for their records here (e.g. for
   *  CRM contacts: "Deals", "Invoices", "Tickets"). */
  connections?: import("@/contracts/widgets").ConnectionDescriptor;
  /** Opt out of the auto-generated RichDetailPage (custom layout in the
   *  plugin file takes over). Default: generated. */
  disableRichDetail?: boolean;
}

/** Single builder that takes the compact config and produces a full plugin. */
export function buildDomainPlugin(cfg: DomainPluginConfig): Plugin {
  const resources = cfg.resources.map((r) => buildResource(cfg, r));
  const navItems: NavItem[] = cfg.resources.map((r, idx) => ({
    id: `${cfg.id}.${r.id}.nav`,
    label: r.plural,
    icon: r.icon ?? cfg.icon,
    path: r.path,
    view: `${cfg.id}.${r.id}.list`,
    section: cfg.section.id,
    order: (cfg.order ?? 0) * 100 + (r.navOrder ?? idx),
  }));

  const views = cfg.resources.flatMap((r) => buildViews(cfg, r));
  const widgets = cfg.resources.flatMap((r) => r.widgets ?? []);

  const extraNavNormalized: NavItem[] = (cfg.extraNav ?? []).map((n, i) => ({
    section: cfg.section.id,
    order: (cfg.order ?? 0) * 100 + 50 + i,
    ...n,
  }));

  return definePlugin({
    id: cfg.id,
    label: cfg.label,
    icon: cfg.icon,
    description: cfg.description,
    version: "0.1.0",
    admin: {
      navSections: [cfg.section],
      nav: [...navItems, ...extraNavNormalized],
      resources,
      views: [...views, ...(cfg.extraViews ?? [])],
      widgets: widgets.length > 0 ? widgets : undefined,
      commands: cfg.commands as never,
    },
  });
}

function buildResource(cfg: DomainPluginConfig, r: DomainResourceConfig) {
  const shape: Record<string, ZodTypeAny> = { id: z.string() };
  for (const f of r.fields) {
    shape[f.name] = fieldToZod(f);
  }
  const schema = z.object(shape);
  const resource = defineResource({
    id: `${cfg.id}.${r.id}`,
    singular: r.singular,
    plural: r.plural,
    schema,
    displayField: r.displayField ?? "name",
    icon: r.icon,
    searchable: r.fields
      .filter((f) => ["text", "email", "textarea"].includes(f.kind))
      .map((f) => f.name),
  });

  if (r.seed && (r.seedCount ?? 0) > 0) {
    const rows = Array.from({ length: r.seedCount! }, (_, i) => {
      const row = r.seed!(i);
      return { id: row.id ?? `${cfg.id}_${r.id}_${i + 1}`, ...row };
    });
    (resource as unknown as { __seed: Record<string, unknown>[] }).__seed = rows;
  }
  return resource;
}

function buildViews(cfg: DomainPluginConfig, r: DomainResourceConfig) {
  const resourceId = `${cfg.id}.${r.id}`;

  const listCols: ColumnDescriptor[] = r.fields
    .filter((f) => shouldListField(f))
    .map<ColumnDescriptor>((f) => ({
      field: f.name,
      label: f.label,
      sortable: f.sortable,
      width: f.width,
      align: f.align,
      kind: f.kind,
      options: f.options,
    }));

  const list = defineListView({
    id: `${resourceId}.list`,
    title: r.plural,
    description: `Manage ${r.plural.toLowerCase()}.`,
    resource: resourceId,
    search: true,
    pageSize: r.pageSize ?? 10,
    defaultSort: r.defaultSort,
    columns: listCols,
    filters: r.fields
      .filter((f) => f.kind === "enum" || f.kind === "boolean")
      .map((f) => ({
        field: f.name,
        label: f.label,
        kind: f.kind === "enum" ? ("enum" as const) : ("boolean" as const),
        options: f.options,
      })),
    actions: r.readOnly
      ? (r.actions ?? [])
      : [
          {
            id: `${resourceId}.new`,
            label: `New ${r.singular.toLowerCase()}`,
            placement: ["page"],
            run: ({ runtime }) => runtime.navigate(`${r.path}/new`),
          },
          {
            id: `${resourceId}.delete`,
            label: "Delete",
            intent: "danger",
            placement: ["row", "bulk"],
            confirm: {
              title: `Delete ${r.singular.toLowerCase()}?`,
              description: "This cannot be undone.",
              destructive: true,
            },
            run: async ({ records, resource, runtime }) => {
              await Promise.all(
                records.map((rec) => runtime.delete(resource, String(rec.id))),
              );
              runtime.toast({
                title: `Deleted ${records.length}`,
                intent: "danger",
              });
            },
          },
          ...(r.actions ?? []),
        ],
  });

  const views: View[] = [list];

  if (!r.readOnly) {
    const sectionMap = new Map<string, DomainFieldConfig[]>();
    for (const f of r.fields) {
      const s = f.formSection ?? "Details";
      if (!sectionMap.has(s)) sectionMap.set(s, []);
      sectionMap.get(s)!.push(f);
    }
    const form = defineFormView({
      id: `${resourceId}.form`,
      title: r.singular,
      resource: resourceId,
      sections: Array.from(sectionMap.entries()).map(([title, fields], i) => ({
        id: `section-${i}`,
        title,
        columns: fields.length > 4 ? 2 : 1,
        fields: fields.map<FieldDescriptor>((f) => ({
          name: f.name,
          label: f.label,
          kind: f.kind,
          required: f.required,
          help: f.help,
          placeholder: f.placeholder,
          options: f.options,
          currency: f.currency,
          readonly: f.readonly,
        })),
      })),
    });
    views.push(form);
  }

  const detail = defineDetailView({
    id: `${resourceId}.detail`,
    title: r.singular,
    resource: resourceId,
    header: (rec) => <>{String(rec[r.displayField ?? "name"] ?? rec.id)}</>,
    tabs: [
      {
        id: "overview",
        label: "Overview",
        render: (rec) => (
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            {r.fields.map((f) => (
              <React.Fragment key={f.name}>
                <dt className="text-text-muted">
                  {f.label ?? humanize(f.name)}
                </dt>
                <dd className="text-text-primary break-words">
                  {renderValue(rec[f.name], f)}
                </dd>
              </React.Fragment>
            ))}
          </dl>
        ),
      },
    ],
  });
  views.push(detail);

  // Auto-generated RichDetailPage — named `<resource>-detail.view` so the
  // shell's router prefers it over the plain detail view when it's a custom
  // view (see resolveCustomDetailView in shell/AppShell.tsx).
  //
  // Skip if the plugin already supplies a custom detail view with the same
  // id or any `*-detail.view` / `*.detail.view` for this resource — the
  // hand-written one wins.
  const hasCustomDetail = (cfg.extraViews ?? []).some(
    (v) =>
      v.type === "custom" &&
      v.resource === resourceId &&
      (v.id.endsWith("-detail.view") || v.id.endsWith(".detail.view")),
  );
  if (!cfg.disableRichDetail && !hasCustomDetail) {
    views.push(
      defineCustomView({
        id: `${resourceId}-detail.view`,
        title: r.singular,
        description: `Rich ${r.singular.toLowerCase()} detail page.`,
        resource: resourceId,
        render: () => <RichDealDetailPage plugin={cfg} resource={r} />,
      }),
    );
  }

  return views;
}

function shouldListField(f: DomainFieldConfig): boolean {
  if (f.list === false) return false;
  if (f.list === true) return true;
  // default: include primitives, exclude textarea/json
  return !["textarea", "json"].includes(f.kind);
}

function fieldToZod(f: DomainFieldConfig): ZodTypeAny {
  let base: ZodTypeAny;
  switch (f.kind) {
    case "number":
    case "currency":
      base = z.number();
      break;
    case "boolean":
      base = z.boolean();
      break;
    case "email":
      base = z.string().email();
      break;
    case "url":
      base = z.string().url();
      break;
    case "enum":
      if (f.options?.length) {
        base = z.enum(
          f.options.map((o) => o.value) as unknown as [string, ...string[]],
        );
      } else base = z.string();
      break;
    case "multi-enum":
      base = z.array(z.string());
      break;
    case "json":
      base = z.unknown();
      break;
    case "date":
    case "datetime":
    case "textarea":
    case "text":
    case "phone":
    default:
      base = z.string();
  }
  return f.required ? base : base.optional();
}

function humanize(s: string): string {
  return s
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (c) => c.toUpperCase())
    .replace(/[-_]/g, " ")
    .trim();
}

function renderValue(v: unknown, f: DomainFieldConfig): React.ReactNode {
  if (v === null || v === undefined || v === "") return "—";
  if (f.kind === "boolean") return v ? "Yes" : "No";
  if (f.kind === "enum") {
    const opt = f.options?.find((o) => o.value === v);
    return opt?.label ?? String(v);
  }
  if (f.kind === "currency") return `$${Number(v).toLocaleString()}`;
  if (f.kind === "date" || f.kind === "datetime") {
    const d = new Date(String(v));
    return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString();
  }
  if (f.kind === "textarea") return String(v);
  if (f.kind === "json")
    return (
      <code className="font-mono text-xs">{JSON.stringify(v, null, 2)}</code>
    );
  return String(v);
}
