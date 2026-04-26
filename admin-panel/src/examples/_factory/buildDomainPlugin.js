import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import * as React from "react";
import { z } from "zod";
import { defineCustomView, defineDetailView, defineFormView, defineListView, defineResource, } from "@/builders";
import { RichDealDetailPage } from "./richDetailFactory";
import { buildReportLibrary } from "./reportLibraryHelper";
import { navigateTo } from "@/views/useRoute";
import { definePlugin } from "@/contracts/plugin-v2";
/** Core helper — registers every domain contribution (resources, nav,
 *  views, widgets, commands) in a single activate() call. Exposed so
 *  plugins that want to compose additional behaviour (extra field kinds,
 *  view extensions, etc.) can layer it on without re-implementing the
 *  domain boilerplate. */
export function contributeDomain(ctx, cfg) {
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
    const navItems = cfg.resources.map((r, idx) => ({
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
    const reportNav = reportViews
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
    const extraNavNormalized = (cfg.extraNav ?? []).map((n, i) => ({
        section: cfg.section.id,
        order: (cfg.order ?? 0) * 100 + 50 + i,
        ...n,
    }));
    if (resources.length > 0)
        ctx.contribute.resources(resources);
    ctx.contribute.navSections([cfg.section]);
    const allNav = [...navItems, ...reportNav, ...extraNavNormalized];
    if (allNav.length > 0)
        ctx.contribute.nav(allNav);
    const allViews = [
        ...views,
        ...(reportViews ? [reportViews.indexView, reportViews.detailView] : []),
        ...(cfg.extraViews ?? []),
    ];
    if (allViews.length > 0)
        ctx.contribute.views(allViews);
    if (widgets.length > 0)
        ctx.contribute.widgets(widgets);
    const commands = [...generatedCommands, ...(cfg.commands ?? [])];
    if (commands.length)
        ctx.contribute.commands(commands);
    if (cfg.connections)
        ctx.contribute.connections(cfg.connections);
}
/** Build a v2 plugin from a compact domain config. */
export function buildDomainPlugin(cfg) {
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
function buildGeneratedCommands(cfg, reportBasePath) {
    const commands = [];
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
function normalizePath(path) {
    const trimmed = path.trim();
    if (!trimmed)
        return "/";
    return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}
function buildResource(cfg, r) {
    const shape = { id: z.string() };
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
        const rows = Array.from({ length: r.seedCount }, (_, i) => {
            const row = r.seed(i);
            return { id: row.id ?? `${cfg.id}_${r.id}_${i + 1}`, ...row };
        });
        resource.__seed = rows;
    }
    return resource;
}
function buildViews(cfg, r) {
    const resourceId = `${cfg.id}.${r.id}`;
    const listCols = r.fields
        .filter((f) => shouldListField(f))
        .map((f) => ({
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
            kind: f.kind === "enum" ? "enum" : "boolean",
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
                        await Promise.all(records.map((rec) => runtime.delete(resource, String(rec.id))));
                        runtime.toast({
                            title: `Deleted ${records.length}`,
                            intent: "danger",
                        });
                    },
                },
                ...(r.actions ?? []),
            ],
    });
    const views = [list];
    if (!r.readOnly) {
        const sectionMap = new Map();
        for (const f of r.fields) {
            const s = f.formSection ?? "Details";
            if (!sectionMap.has(s))
                sectionMap.set(s, []);
            sectionMap.get(s).push(f);
        }
        const form = defineFormView({
            id: `${resourceId}.form`,
            title: r.singular,
            resource: resourceId,
            sections: [
                ...Array.from(sectionMap.entries()).map(([title, fields], i) => ({
                    id: `section-${i}`,
                    title,
                    columns: (fields.length > 4 ? 2 : 1),
                    fields: fields.map((f) => ({
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
                    columns: 1,
                    fields: [
                        {
                            name: table.field,
                            label: table.label,
                            kind: "table",
                            table,
                            colSpan: "full",
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
        header: (rec) => _jsx(_Fragment, { children: String(rec[r.displayField ?? "name"] ?? rec.id) }),
        tabs: [
            {
                id: "overview",
                label: "Overview",
                render: (rec) => (_jsx("dl", { className: "grid grid-cols-2 gap-x-6 gap-y-3 text-sm", children: r.fields.map((f) => (_jsxs(React.Fragment, { children: [_jsx("dt", { className: "text-text-muted", children: f.label ?? humanize(f.name) }), _jsx("dd", { className: "text-text-primary break-words", children: renderValue(rec[f.name], f) })] }, f.name))) })),
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
    const hasCustomDetail = (cfg.extraViews ?? []).some((v) => v.type === "custom" &&
        v.resource === resourceId &&
        (v.id === `${resourceId}-detail.view` ||
            v.id === `${resourceId}.detail.view`));
    if (!cfg.disableRichDetail && !hasCustomDetail) {
        views.push(defineCustomView({
            id: `${resourceId}-detail.view`,
            title: r.singular,
            description: `Rich ${r.singular.toLowerCase()} detail page.`,
            resource: resourceId,
            render: () => _jsx(RichDealDetailPage, { plugin: cfg, resource: r }),
        }));
    }
    return views;
}
function shouldListField(f) {
    if (f.list === false)
        return false;
    if (f.list === true)
        return true;
    // default: include primitives, exclude textarea/json
    return !["textarea", "json"].includes(f.kind);
}
/** Pick a default totaling function for a domain field. Currency columns
 *  always sum; numeric columns sum only when the field name suggests it's
 *  naturally aggregatable (amount, revenue, qty, cost, etc.). The author
 *  can override with `totaling: "avg" | "count" | false` on the field. */
const AGGREGATABLE_NUMBER_NAMES = new RegExp([
    "amount", "amt", "revenue", "cost", "subtotal", "total", "price",
    "value", "volume", "quantity", "qty", "count", "hours", "hrs",
    "days", "units", "income", "expense", "balance", "savings",
    "tax", "discount", "fee", "fees", "margin", "spend", "budget",
    "paid", "unpaid", "due", "outstanding", "limit", "utilized", "target",
    "gross", "net", "profit", "loss", "capacity", "allocation", "stock",
    "inventory", "onhand", "reorder", "reserved", "available", "credits",
    "debits", "commission", "bonus", "deduction", "earnings", "salary",
    "rate", "wage", "ytd", "mtd", "qtd", "receivables", "payables",
].join("|"), "i");
function resolveTotaling(f) {
    if (f.totaling === false)
        return undefined;
    if (f.totaling)
        return f.totaling;
    if (f.kind === "currency")
        return "sum";
    if (f.kind === "number") {
        // Heuristic: only sum if the field name hints it's a naturally additive
        // metric. Avoids accidentally summing version numbers, priority, ratings.
        if (AGGREGATABLE_NUMBER_NAMES.test(f.name))
            return "sum";
    }
    return undefined;
}
function fieldToZod(f) {
    let base;
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
                base = z.enum(f.options.map((o) => o.value));
            }
            else
                base = z.string();
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
function humanize(s) {
    return s
        .replace(/([A-Z])/g, " $1")
        .replace(/^./, (c) => c.toUpperCase())
        .replace(/[-_]/g, " ")
        .trim();
}
function renderValue(v, f) {
    if (v === null || v === undefined || v === "")
        return "—";
    if (f.kind === "boolean")
        return v ? "Yes" : "No";
    if (f.kind === "enum") {
        const opt = f.options?.find((o) => o.value === v);
        return opt?.label ?? String(v);
    }
    if (f.kind === "currency")
        return `$${Number(v).toLocaleString()}`;
    if (f.kind === "date" || f.kind === "datetime") {
        const d = new Date(String(v));
        return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString();
    }
    if (f.kind === "textarea")
        return String(v);
    if (f.kind === "json")
        return (_jsx("code", { className: "font-mono text-xs", children: JSON.stringify(v, null, 2) }));
    return String(v);
}
