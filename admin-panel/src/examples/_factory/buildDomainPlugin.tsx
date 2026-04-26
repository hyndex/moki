import * as React from "react";
import { z, type ZodTypeAny } from "zod";
import {
  defineCustomView,
  defineDetailView,
  defineFormView,
  defineListView,
  defineResource,
} from "@/builders";
import type { FieldDescriptor, EnumOption } from "@/contracts/fields";
import type { ErpFieldDependency, ErpLinkFilter, ErpResourceMetadata } from "@/contracts/erp-metadata";
import type { NavItem, NavSection } from "@/contracts/nav";
import type { ActionDescriptor } from "@/contracts/actions";
import type { CommandDescriptor } from "@/contracts/commands";
import type {
  DashboardWidget,
  ColumnDescriptor,
  View,
} from "@/contracts/views";
import type { ConnectionDescriptor, ReportDefinition } from "@/contracts/widgets";
import { RichDealDetailPage } from "./richDetailFactory";
import { buildReportLibrary } from "./reportLibraryHelper";
import { navigateTo } from "@/views/useRoute";
import { definePlugin, type PluginV2 } from "@/contracts/plugin-v2";

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
  referenceTo?: string;
  dynamicReferenceField?: string;
  linkFilters?: readonly ErpLinkFilter[];
  dependsOn?: readonly ErpFieldDependency[];
  fetchFrom?: string;
  colSpan?: FieldDescriptor["colSpan"];
  sortable?: boolean;
  width?: number | string;
  align?: "left" | "right" | "center";
  readonly?: boolean;
  formSection?: string;   // name of form section (default "Details")
  /** Aggregate this column in ListView's totals-footer. Inferred automatically
   *  from `kind` + name heuristics when omitted; pass `false` to suppress. */
  totaling?: "sum" | "avg" | "count" | "min" | "max" | false;
  /** Safe arithmetic expression evaluated per row. Exposes the computed value
   *  as `field.name`. Example: `"revenue - cost"`. */
  expr?: string;
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
  /** ERPNext-parity metadata for child tables, document links, print, portal, and workspace builders. */
  erp?: ErpResourceMetadata;
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
  commands?: readonly CommandDescriptor[];
  /** Custom views (dashboards, kanban, calendar, analytics, settings, etc.) — merged
   *  with the auto-generated list/form/detail views. */
  extraViews?: readonly View[];
  /** Extra nav items for custom pages. Each one typically points at one of
   *  the extraViews via `view: "<id>"`. */
  extraNav?: readonly NavItem[];
  /** Declarative ReportBuilder library. The factory contributes the index
   *  and detail routes, a Reports nav item, and command-palette shortcuts. */
  reports?: readonly ReportDefinition[];
  /** Route for the generated reports library. Defaults to `/<plugin>/reports`. */
  reportsBasePath?: string;
  /** Optional title/description/resource metadata for the generated reports view. */
  reportsTitle?: string;
  reportsDescription?: string;
  reportsResource?: string;
  /** Declarative workflow descriptors are registered into commands/nav by
   *  convention; resource-level `erp.workflow` powers the detail rail actions. */
  workflows?: readonly {
    id: string;
    label: string;
    resourceId: string;
    description?: string;
  }[];
  /** Per-plugin ConnectionsPanel — shown on the rich detail rail. Plugins
   *  describe what related resources exist for their records here (e.g. for
   *  CRM contacts: "Deals", "Invoices", "Tickets"). */
  connections?: ConnectionDescriptor;
  /** Opt out of the auto-generated RichDetailPage (custom layout in the
   *  plugin file takes over). Default: generated. */
  disableRichDetail?: boolean;
}

/** Core helper — registers every domain contribution (resources, nav,
 *  views, widgets, commands) in a single activate() call. Exposed so
 *  plugins that want to compose additional behaviour (extra field kinds,
 *  view extensions, etc.) can layer it on without re-implementing the
 *  domain boilerplate. */
export function contributeDomain(
  ctx: import("@/contracts/plugin-v2").PluginContext,
  cfg: DomainPluginConfig,
): void {
  const resources = cfg.resources.map((r) => buildResource(cfg, r));
  const reportBasePath = normalizePath(cfg.reportsBasePath ?? `/${cfg.id}/reports`);
  const reportViews = cfg.reports?.length
    ? buildReportLibrary({
        indexViewId: `${cfg.id}.reports.view`,
        detailViewId: `${cfg.id}.reports.detail.view`,
        resource: cfg.reportsResource ?? resources[0]?.id ?? `${cfg.id}.reports`,
        title: cfg.reportsTitle ?? `${cfg.label} Reports`,
        description: cfg.reportsDescription ?? `Standard operational reports for ${cfg.label}.`,
        basePath: reportBasePath,
        reports: cfg.reports,
      })
    : null;
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
  const reportNav: NavItem[] = reportViews
    ? [
        {
          id: `${cfg.id}.reports.nav`,
          label: "Reports",
          icon: "BarChart3",
          path: reportBasePath,
          view: reportViews.indexView.id,
          section: cfg.section.id,
          order: (cfg.order ?? 0) * 100 + 40,
        },
      ]
    : [];
  const generatedCommands = buildGeneratedCommands(cfg, reportBasePath);
  const extraNavNormalized: NavItem[] = (cfg.extraNav ?? []).map((n, i) => ({
    section: cfg.section.id,
    order: (cfg.order ?? 0) * 100 + 50 + i,
    ...n,
  }));

  if (resources.length > 0) ctx.contribute.resources(resources);
  ctx.contribute.navSections([cfg.section]);
  const allNav = [...navItems, ...reportNav, ...extraNavNormalized];
  if (allNav.length > 0) ctx.contribute.nav(allNav);
  const allViews = [
    ...views,
    ...(reportViews ? [reportViews.indexView, reportViews.detailView] : []),
    ...(cfg.extraViews ?? []),
  ];
  if (allViews.length > 0) ctx.contribute.views(allViews);
  if (widgets.length > 0) ctx.contribute.widgets(widgets);
  const commands = [...generatedCommands, ...(cfg.commands ?? [])];
  if (commands.length) ctx.contribute.commands(commands);
  if (cfg.connections) ctx.contribute.connections(cfg.connections);
}

/** Build a v2 plugin from a compact domain config. */
export function buildDomainPlugin(cfg: DomainPluginConfig): PluginV2 {
  return definePlugin({
    manifest: {
      id: cfg.id,
      version: "0.1.0",
      label: cfg.label,
      description: cfg.description,
      icon: cfg.icon,
      requires: {
        shell: "*",
        capabilities: [
          "resources:read",
          "resources:write",
          "resources:delete",
          "nav",
          "commands",
          "storage",
        ],
      },
      activationEvents: [{ kind: "onStart" }],
      origin: { kind: "explicit" },
    },
    async activate(ctx) {
      contributeDomain(ctx, cfg);
    },
  });
}

function buildGeneratedCommands(
  cfg: DomainPluginConfig,
  reportBasePath: string,
): CommandDescriptor[] {
  const commands: CommandDescriptor[] = [];
  if (cfg.reports?.length) {
    commands.push({
      id: `${cfg.id}.reports.open`,
      label: `${cfg.label}: Open reports`,
      keywords: [cfg.label, "reports", "reporting", "analytics"],
      icon: "BarChart3",
      run: () => navigateTo(reportBasePath),
    });
    for (const report of cfg.reports) {
      commands.push({
        id: `${cfg.id}.reports.${report.id}`,
        label: `${cfg.label}: ${report.label}`,
        keywords: [cfg.label, report.label, report.id, "report"],
        icon: report.icon ?? "FileBarChart",
        run: () => navigateTo(`${reportBasePath}/${report.id}`),
      });
    }
  }
  for (const workflow of cfg.workflows ?? []) {
    commands.push({
      id: `${cfg.id}.workflow.${workflow.id}`,
      label: `${cfg.label}: ${workflow.label}`,
      keywords: [cfg.label, workflow.label, workflow.id, "workflow"],
      icon: "Workflow",
      run: () => {
        const resource = cfg.resources.find((candidate) => {
          const fullId = `${cfg.id}.${candidate.id}`;
          return candidate.id === workflow.resourceId || fullId === workflow.resourceId;
        });
        navigateTo(resource?.path ?? `/${cfg.id}`);
      },
    });
  }
  return commands;
}

function normalizePath(path: string): string {
  const trimmed = path.trim();
  if (!trimmed) return "/";
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

function buildResource(cfg: DomainPluginConfig, r: DomainResourceConfig) {
  const shape: Record<string, ZodTypeAny> = { id: z.string() };
  for (const f of r.fields) {
    shape[f.name] = fieldToZod(f);
  }
  for (const childTable of r.erp?.childTables ?? []) {
    if (!shape[childTable.field]) {
      shape[childTable.field] = z.array(z.record(z.unknown())).optional();
    }
  }
  const schema = z.object(shape);
  const resource = defineResource({
    id: `${cfg.id}.${r.id}`,
    singular: r.singular,
    plural: r.plural,
    schema,
    displayField: r.displayField ?? "name",
    icon: r.icon,
    erp: r.erp,
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
      expr: f.expr,
      totaling: resolveTotaling(f),
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
      sections: [
        ...Array.from(sectionMap.entries()).map(([title, fields], i) => ({
          id: `section-${i}`,
          title,
          columns: (fields.length > 4 ? 2 : 1) as 1 | 2,
          fields: fields.map<FieldDescriptor>((f) => ({
            name: f.name,
            label: f.label,
            kind: f.kind,
            required: f.required,
            help: f.help,
            placeholder: f.placeholder,
            options: f.options,
            referenceTo: f.referenceTo,
            dynamicReferenceField: f.dynamicReferenceField,
            linkFilters: f.linkFilters,
            dependsOn: f.dependsOn,
            fetchFrom: f.fetchFrom,
            currency: f.currency,
            readonly: f.readonly,
            colSpan: f.colSpan,
          })),
        })),
        ...(r.erp?.childTables ?? []).map((table, i) => ({
          id: `child-table-${i}`,
          title: table.label,
          columns: 1 as const,
          fields: [
            {
              name: table.field,
              label: table.label,
              kind: "table" as const,
              table,
              colSpan: "full" as const,
            },
          ],
        })),
      ],
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
      (v.id === `${resourceId}-detail.view` ||
        v.id === `${resourceId}.detail.view`),
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

/** Pick a default totaling function for a domain field. Currency columns
 *  always sum; numeric columns sum only when the field name suggests it's
 *  naturally aggregatable (amount, revenue, qty, cost, etc.). The author
 *  can override with `totaling: "avg" | "count" | false` on the field. */
const AGGREGATABLE_NUMBER_NAMES = new RegExp(
  [
    "amount", "amt", "revenue", "cost", "subtotal", "total", "price",
    "value", "volume", "quantity", "qty", "count", "hours", "hrs",
    "days", "units", "income", "expense", "balance", "savings",
    "tax", "discount", "fee", "fees", "margin", "spend", "budget",
    "paid", "unpaid", "due", "outstanding", "limit", "utilized", "target",
    "gross", "net", "profit", "loss", "capacity", "allocation", "stock",
    "inventory", "onhand", "reorder", "reserved", "available", "credits",
    "debits", "commission", "bonus", "deduction", "earnings", "salary",
    "rate", "wage", "ytd", "mtd", "qtd", "receivables", "payables",
  ].join("|"),
  "i",
);

function resolveTotaling(
  f: DomainFieldConfig,
): ColumnDescriptor["totaling"] {
  if (f.totaling === false) return undefined;
  if (f.totaling) return f.totaling;
  if (f.kind === "currency") return "sum";
  if (f.kind === "number") {
    // Heuristic: only sum if the field name hints it's a naturally additive
    // metric. Avoids accidentally summing version numbers, priority, ratings.
    if (AGGREGATABLE_NUMBER_NAMES.test(f.name)) return "sum";
  }
  return undefined;
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
    case "table":
      base = z.array(z.record(z.unknown()));
      break;
    case "json":
      base = z.unknown();
      break;
    case "link":
    case "dynamic-link":
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
