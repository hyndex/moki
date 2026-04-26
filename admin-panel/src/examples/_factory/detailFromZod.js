import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import * as React from "react";
import * as Icons from "lucide-react";
import { RichDetailPage, MetadataRailCard, TabEmpty, AutomationHookPanel, AIInsightPanel, Card, CardContent, CardHeader, CardTitle, } from "@/admin-primitives";
import { Badge } from "@/primitives/Badge";
import { useRecord } from "@/runtime/hooks";
import { useLiveAudit } from "@/runtime/audit";
import { useHash, navigateTo } from "@/views/useRoute";
import { useRuntime } from "@/runtime/context";
import { defineCustomView } from "@/builders";
import { renderValue } from "./renderValue";
import { OverviewSections, BIPanel, AutoConnectionsPanel, ActionsPanel, ActivityTabPanel, RecentActivityRailCard, CustomFieldsRailCard, } from "./detailSections";
import { useRegistry } from "@/shell/registry";
import { usePluginHost2 } from "@/host/pluginHostContext";
import { resolveViewExtensions } from "@/host/viewExtensions";
import { PluginBoundary } from "@/host/PluginBoundary";
/** Convenience — returns a CustomView wired to the Zod-powered detail page.
 *  Matches the `<id>-detail.view` convention so `resolveCustomDetailView` in
 *  AppShell picks it up automatically for the resource. */
export function detailViewFromZod(args) {
    return defineCustomView({
        id: args.viewId ?? `${args.resource}-detail.view`,
        title: args.singular,
        description: `Rich ${args.singular.toLowerCase()} detail page.`,
        resource: args.resource,
        render: () => _jsx(RichZodDetailPage, { args: args }),
    });
}
/* ------------------------------------------------------------------------ */
/* Implementation                                                            */
/* ------------------------------------------------------------------------ */
function RichZodDetailPage({ args }) {
    const hash = useHash();
    const runtime = useRuntime();
    const registry = useRegistry();
    const host = usePluginHost2();
    const id = hash.split("/").pop() ?? "";
    const { data: record, loading, error } = useRecord(args.resource, id);
    const { data: auditPage } = useLiveAudit({ pageSize: 100 });
    const events = React.useMemo(() => (auditPage?.rows ?? []).filter((e) => e.resource === args.resource && (!id || e.recordId === id)), [auditPage, args.resource, id]);
    const fields = React.useMemo(() => schemaToFields(args.schema, args.overrides), [
        args.schema,
        args.overrides,
    ]);
    if (!record && !loading) {
        return (_jsx(RichDetailPage, { loading: false, error: new Error(`${args.singular} ${id} not found`), onRetry: () => navigateTo(args.path), title: "", tabs: [] }));
    }
    const rec = (record ?? {});
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
    });
    return (_jsx(RichDetailPage, { loading: loading && !record, error: error ? new Error(String(error)) : null, breadcrumb: [
            { label: args.pluginLabel, path: args.path },
            { label: args.plural, path: args.path },
            { label: identifier },
        ], avatar: _jsx("div", { className: "h-12 w-12 rounded-md bg-accent-subtle flex items-center justify-center", children: _jsx(Icon, { name: args.icon }) }), title: identifier, subtitle: _jsxs("span", { className: "inline-flex items-center gap-2", children: [_jsx("code", { className: "font-mono text-xs text-text-secondary", children: String(rec.id ?? id) }), _jsx("span", { className: "text-text-muted", children: "\u00B7" }), _jsx("span", { children: args.singular })] }), status: status, metrics: metrics, lastUpdatedAt: rec.updatedAt, primaryAction: args.readOnly
            ? undefined
            : {
                id: "edit",
                label: "Edit",
                icon: _jsx(Icons.Pencil, { className: "h-3.5 w-3.5" }),
                onClick: () => navigateTo(editPath),
            }, secondaryActions: [
            {
                id: "duplicate",
                label: "Duplicate",
                icon: _jsx(Icons.Copy, { className: "h-3.5 w-3.5" }),
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
                    navigateTo(`${args.path}/${created.id}`);
                },
                hidden: args.readOnly,
            },
        ], extraActions: [
            {
                id: "copy-id",
                label: "Copy ID",
                icon: _jsx(Icons.Hash, { className: "h-3.5 w-3.5" }),
                onClick: async () => {
                    try {
                        await navigator.clipboard.writeText(String(rec.id ?? id));
                        runtime.actions.toast({ title: "Copied", intent: "success" });
                    }
                    catch {
                        /* clipboard unavailable */
                    }
                },
            },
            {
                id: "delete",
                label: "Delete",
                intent: "danger",
                icon: _jsx(Icons.Trash2, { className: "h-3.5 w-3.5 text-intent-danger" }),
                onClick: async () => {
                    const ok = await runtime.actions.confirm({
                        title: `Delete ${args.singular.toLowerCase()}?`,
                        description: "This cannot be undone.",
                        destructive: true,
                    });
                    if (!ok)
                        return;
                    await runtime.resources.delete(args.resource, id);
                    runtime.actions.toast({
                        title: `${args.singular} deleted`,
                        intent: "danger",
                    });
                    navigateTo(args.path);
                },
                hidden: args.readOnly,
            },
        ], tabs: [
            {
                id: "overview",
                label: "Overview",
                render: () => _jsx(OverviewSections, { record: rec, fields: fields }),
            },
            {
                id: "bi",
                label: "BI",
                render: () => (_jsx(BIPanel, { resource: args.resource, record: rec, fields: fields })),
            },
            {
                id: "connections",
                label: "Connections",
                render: () => registry ? (_jsx(AutoConnectionsPanel, { resource: args.resource, recordId: id, registry: registry, basePathMap: buildBasePathMap(registry) })) : (_jsx(TabEmpty, { title: "Registry unavailable" })),
            },
            {
                id: "actions",
                label: "Actions",
                render: () => (_jsx(ActionsPanel, { actions: [], record: rec, resource: args.resource, onNavigateEdit: () => navigateTo(editPath) })),
            },
            ...ext.tabs
                .filter((t) => !t.visibleWhen || t.visibleWhen(rec))
                .map((t) => ({
                id: t.id,
                label: t.label,
                render: () => (_jsx(PluginBoundary, { pluginId: t.contributor, label: t.label, children: t.render(rec) })),
            })),
            {
                id: "activity",
                label: "Activity",
                // Per-record activity feed — backed by `/api/timeline/<resource>/<id>`.
                // The audit-events count is the closest live signal we have for
                // "is there anything here", so we surface it as the badge while
                // the actual feed loads its own data.
                count: events.length || undefined,
                render: () => (_jsx(ActivityTabPanel, { resource: args.resource, recordId: id })),
            },
            {
                id: "audit",
                label: "Audit",
                count: events.length,
                render: () => (_jsxs(Card, { children: [_jsx(CardHeader, { children: _jsx(CardTitle, { children: "Audit trail" }) }), _jsx(CardContent, { className: "p-0", children: events.length === 0 ? (_jsx(TabEmpty, { title: "No audit events recorded" })) : (_jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "border-b border-border text-xs uppercase tracking-wider text-text-muted", children: [_jsx("th", { className: "text-left px-3 py-2", children: "When" }), _jsx("th", { className: "text-left px-3 py-2", children: "Actor" }), _jsx("th", { className: "text-left px-3 py-2", children: "Action" }), _jsx("th", { className: "text-left px-3 py-2", children: "Level" })] }) }), _jsx("tbody", { children: events.map((e) => (_jsxs("tr", { className: "border-b border-border-subtle last:border-b-0", children: [_jsx("td", { className: "px-3 py-2 text-text-secondary", children: new Date(e.occurredAt).toLocaleString() }), _jsx("td", { className: "px-3 py-2 text-text-secondary", children: e.actor }), _jsx("td", { className: "px-3 py-2 text-text-primary font-mono text-xs", children: e.action }), _jsx("td", { className: "px-3 py-2", children: _jsx(Badge, { intent: e.level === "error"
                                                            ? "danger"
                                                            : e.level === "warn"
                                                                ? "warning"
                                                                : "info", children: e.level ?? "info" }) })] }, e.id))) })] })) })] })),
            },
        ], rail: [
            {
                id: "metadata",
                priority: 100,
                render: () => (_jsx(MetadataRailCard, { items: [
                        {
                            label: "Id",
                            value: (_jsx("code", { className: "font-mono text-xs", children: String(rec.id ?? id) })),
                        },
                        {
                            label: "Created",
                            value: rec.createdAt
                                ? new Date(rec.createdAt).toLocaleString()
                                : "—",
                        },
                        {
                            label: "Updated",
                            value: rec.updatedAt
                                ? new Date(rec.updatedAt).toLocaleString()
                                : "—",
                        },
                        {
                            label: "Owner",
                            value: rec.owner ?? "—",
                        },
                    ] })),
            },
            // Custom fields rail — auto-renders only when the resource has
            // fields registered in field_metadata. Inline-editable with
            // optimistic write-through; rolls back + toasts on failure.
            // The component itself returns null when fields.length === 0.
            {
                id: "custom-fields",
                priority: 80,
                render: () => (_jsx(CustomFieldsRailCard, { resource: args.resource, recordId: id, record: rec, editable: !args.readOnly })),
            },
            // Recent-activity rail — last 10 events from the per-record
            // timeline so users can see what changed without switching to
            // the Activity tab.
            {
                id: "recent-activity",
                priority: 50,
                render: () => (_jsx(RecentActivityRailCard, { resource: args.resource, recordId: id })),
            },
            {
                id: "automation",
                priority: 40,
                render: () => (_jsx(AutomationHookPanel, { hooks: [], onConfigure: () => navigateTo("/automation/triggers") })),
            },
            {
                id: "ai",
                priority: 20,
                render: () => _jsx(AIInsightPanel, { insights: [], loading: false }),
            },
            ...ext.railCards.map((c) => ({
                id: `ext::${c.contributor}::${c.id}`,
                priority: c.priority,
                render: () => (_jsx(PluginBoundary, { pluginId: c.contributor, label: c.id, children: c.render(rec) })),
            })),
        ] }));
}
/* ------------------------------------------------------------------------ */
/* Helpers                                                                   */
/* ------------------------------------------------------------------------ */
function buildBasePathMap(registry) {
    const out = {};
    const walk = (items) => {
        for (const n of items) {
            if (n.view && n.path) {
                const v = registry.views[n.view];
                if (v && "resource" in v && typeof v.resource === "string" && v.type === "list") {
                    out[v.resource] = n.path;
                }
            }
            if (n.children)
                walk(n.children);
        }
    };
    walk(registry.nav);
    return out;
}
function Icon({ name }) {
    if (!name)
        return _jsx(Icons.FileText, { className: "h-5 w-5 text-accent" });
    const C = Icons[name];
    if (!C)
        return _jsx(Icons.FileText, { className: "h-5 w-5 text-accent" });
    return _jsx(C, { className: "h-5 w-5 text-accent" });
}
function displayName(rec, displayField) {
    const primary = rec[displayField ?? "name"];
    if (typeof primary === "string" && primary.length > 0)
        return primary;
    if (typeof rec.code === "string")
        return rec.code;
    if (typeof rec.title === "string")
        return rec.title;
    return String(rec.id ?? "Untitled");
}
function resolveStatus(rec, fields) {
    const statusField = fields.find((f) => f.kind === "enum" && (f.name === "status" || f.name === "stage"));
    if (!statusField)
        return undefined;
    const val = rec[statusField.name];
    if (typeof val !== "string")
        return undefined;
    const match = statusField.options?.find((o) => o.value === val);
    return {
        label: match?.label ?? val,
        intent: match?.intent ?? "neutral",
    };
}
function pickMetrics(rec, fields) {
    const preferred = fields
        .filter((f) => {
        if (f.name === "id")
            return false;
        if (f.kind === "currency" || f.kind === "number")
            return true;
        if (f.kind === "date" || f.kind === "datetime")
            return true;
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
function humanize(s) {
    return s
        .replace(/([A-Z])/g, " $1")
        .replace(/^./, (c) => c.toUpperCase())
        .replace(/-/g, " ")
        .replace(/_/g, " ")
        .trim();
}
/* ---- Zod → DomainFieldConfig[] (for reusing DomainFieldConfig-shaped renderers) ---- */
function schemaToFields(schema, overrides) {
    const out = [];
    for (const [name, zod] of Object.entries(schema.shape)) {
        if (overrides?.[name]?.hidden)
            continue;
        if (name === "id")
            continue;
        const base = inferField(name, zod);
        const override = overrides?.[name] ?? {};
        out.push({ ...base, ...override });
    }
    return out;
}
function inferField(name, zod) {
    const inner = unwrap(zod);
    const kind = inferKind(inner, name);
    const options = inner._def?.typeName === "ZodEnum"
        ? inner._def.values.map((v) => ({
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
function unwrap(t) {
    const def = t._def;
    const tn = def?.typeName;
    if ((tn === "ZodOptional" ||
        tn === "ZodNullable" ||
        tn === "ZodDefault" ||
        tn === "ZodEffects") &&
        def?.innerType) {
        return unwrap(def.innerType);
    }
    return t;
}
function inferKind(t, name) {
    const tn = t._def.typeName;
    if (tn === "ZodString") {
        const lower = name.toLowerCase();
        if (lower.includes("email"))
            return "email";
        if (lower.includes("url") || lower.includes("website"))
            return "url";
        if (lower.includes("phone"))
            return "phone";
        if (lower.endsWith("at") || lower.endsWith("date"))
            return "datetime";
        if (lower.includes("description") || lower.includes("notes"))
            return "textarea";
        return "text";
    }
    if (tn === "ZodNumber") {
        const lower = name.toLowerCase();
        if (lower.includes("price") ||
            lower.includes("amount") ||
            lower.includes("cost") ||
            lower.includes("rate") ||
            lower.includes("revenue"))
            return "currency";
        return "number";
    }
    if (tn === "ZodBoolean")
        return "boolean";
    if (tn === "ZodEnum")
        return "enum";
    if (tn === "ZodArray")
        return "json";
    if (tn === "ZodObject")
        return "json";
    return "text";
}
