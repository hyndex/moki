import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import * as React from "react";
import * as Icons from "lucide-react";
import { RichDetailPage, MetadataRailCard, TabEmpty, ConnectionsPanel, AutomationHookPanel, AIInsightPanel, Card, CardContent, CardHeader, CardTitle, } from "@/admin-primitives";
import { Badge } from "@/primitives/Badge";
import { useRecord } from "@/runtime/hooks";
import { useLiveAudit } from "@/runtime/audit";
import { useHash, navigateTo } from "@/views/useRoute";
import { useRuntime } from "@/runtime/context";
import { renderValue } from "./renderValue";
import { OverviewSections, BIPanel, AutoConnectionsPanel, ActionsPanel, ActivityTabPanel, RecentActivityRailCard, CustomFieldsRailCard, } from "./detailSections";
import { useRegistry } from "@/shell/registry";
import { usePluginHost2 } from "@/host/pluginHostContext";
import { resolveViewExtensions } from "@/host/viewExtensions";
import { PluginBoundary } from "@/host/PluginBoundary";
/** Map resource id → list-view base path, derived from nav items. Used by
 *  AutoConnectionsPanel to build deep-links. */
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
        return null;
    const C = Icons[name];
    if (!C)
        return null;
    return _jsx(C, { className: "h-5 w-5 text-accent" });
}
/** Resolve a human display value from a record using the plugin's primary
 *  display field, falling back to `name` or the id. */
function displayName(record, resource) {
    const primary = record[resource.displayField ?? "name"];
    if (typeof primary === "string" && primary.length > 0)
        return primary;
    if (typeof record.code === "string")
        return record.code;
    return String(record.id ?? "Untitled");
}
function openPrintableDocument(title, html) {
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
function absoluteAppUrl(path) {
    if (/^https?:\/\//i.test(path))
        return path;
    return `${window.location.origin}${path.startsWith("/") ? "" : "/"}${path}`;
}
function defaultPortalExpiry() {
    const expires = new Date();
    expires.setDate(expires.getDate() + 30);
    return expires.toISOString();
}
/** Resolve a status label + intent from the record using a conventional
 *  "status" field — plugins can override by passing a statusResolver in
 *  the resource config (future extension). */
function resolveStatus(record, resource) {
    const statusField = resource.fields.find((f) => f.kind === "enum" && (f.name === "status" || f.name === "stage"));
    if (!statusField)
        return undefined;
    const val = record[statusField.name];
    if (typeof val !== "string")
        return undefined;
    const match = statusField.options?.find((o) => o.value === val);
    return {
        label: match?.label ?? val,
        intent: match?.intent ?? "neutral",
    };
}
/** Build a compact metric strip from the resource's most salient fields
 *  (currency, number, date) — never more than 4. */
function pickMetrics(record, resource) {
    const preferred = resource.fields
        .filter((f) => {
        if (f.kind === "currency" || f.kind === "number")
            return true;
        if (f.kind === "date" || f.kind === "datetime")
            return true;
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
function humanize(s) {
    return s
        .replace(/([A-Z])/g, " $1")
        .replace(/^./, (c) => c.toUpperCase())
        .replace(/-/g, " ")
        .trim();
}
function ErpDocumentTab({ record, resource, }) {
    const erp = resource.erp;
    if (!erp)
        return null;
    const childTables = erp.childTables ?? [];
    const links = erp.links ?? [];
    const workspaceLinks = erp.workspaceLinks ?? [];
    return (_jsxs("div", { className: "space-y-4", children: [_jsxs(Card, { children: [_jsx(CardHeader, { children: _jsx(CardTitle, { children: "Document model" }) }), _jsx(CardContent, { children: _jsxs("dl", { className: "grid gap-3 text-sm sm:grid-cols-2", children: [_jsxs("div", { children: [_jsx("dt", { className: "text-text-muted", children: "Document type" }), _jsx("dd", { className: "font-mono text-text-primary", children: erp.documentType ?? resource.singular })] }), _jsxs("div", { children: [_jsx("dt", { className: "text-text-muted", children: "Naming series" }), _jsx("dd", { className: "font-mono text-text-primary", children: erp.namingSeries ?? "Manual" })] }), _jsxs("div", { children: [_jsx("dt", { className: "text-text-muted", children: "Submitted states" }), _jsx("dd", { className: "text-text-primary", children: erp.submittedStatuses?.join(", ") || "Not configured" })] }), _jsxs("div", { children: [_jsx("dt", { className: "text-text-muted", children: "Search fields" }), _jsx("dd", { className: "text-text-primary", children: erp.searchFields?.join(", ") || resource.fields.slice(0, 3).map((field) => field.name).join(", ") })] })] }) })] }), childTables.map((table) => {
                const rows = Array.isArray(record[table.field]) ? record[table.field] : [];
                return (_jsxs(Card, { children: [_jsx(CardHeader, { children: _jsx(CardTitle, { children: table.label }) }), _jsx(CardContent, { className: "p-0", children: rows.length === 0 ? (_jsxs("div", { className: "px-4 py-6 text-sm text-text-muted", children: ["No line rows captured yet. Columns: ", table.fields.map((field) => field.label ?? humanize(field.name)).join(", ")] })) : (_jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { children: _jsx("tr", { className: "border-b border-border text-xs uppercase text-text-muted", children: table.fields.map((field) => (_jsx("th", { className: "px-3 py-2 text-left", children: field.label ?? humanize(field.name) }, field.name))) }) }), _jsx("tbody", { children: rows.map((row, index) => (_jsx("tr", { className: "border-b border-border-subtle last:border-b-0", children: table.fields.map((field) => (_jsx("td", { className: "px-3 py-2 text-text-secondary", children: String(row[field.name] ?? "—") }, field.name))) }, String(row.id ?? index)))) })] }) })) })] }, table.field));
            }), (links.length > 0 || workspaceLinks.length > 0) && (_jsxs(Card, { children: [_jsx(CardHeader, { children: _jsx(CardTitle, { children: "Links and drilldowns" }) }), _jsx(CardContent, { children: _jsxs("div", { className: "grid gap-4 text-sm md:grid-cols-2", children: [_jsxs("div", { children: [_jsx("h4", { className: "mb-2 font-medium text-text-primary", children: "Document links" }), _jsx("ul", { className: "space-y-2", children: links.map((link) => (_jsxs("li", { className: "flex items-center justify-between gap-3 rounded-md border border-border-subtle px-3 py-2", children: [_jsx("span", { children: link.label ?? humanize(link.field) }), _jsx("code", { className: "text-xs text-text-muted", children: link.targetResourceId })] }, `${link.field}:${link.targetResourceId}`))) })] }), _jsxs("div", { children: [_jsx("h4", { className: "mb-2 font-medium text-text-primary", children: "Workspace drilldowns" }), _jsx("ul", { className: "space-y-2", children: workspaceLinks.map((link) => (_jsxs("li", { className: "flex items-center justify-between gap-3 rounded-md border border-border-subtle px-3 py-2", children: [_jsx("a", { className: "text-accent hover:underline", href: `#${link.path}`, children: link.label }), _jsx("span", { className: "text-xs uppercase text-text-muted", children: link.kind })] }, `${link.kind}:${link.path}`))) })] })] }) })] }))] }));
}
function ErpDocumentRailCard({ record, resource, busyActionId, busyPrintFormatId, busyWorkflowId, busyPortal, onMapDocument, onTransition, onPrint, onCreatePortalLink, }) {
    const erp = resource.erp;
    if (!erp)
        return null;
    const status = String(record[erp.statusField ?? "status"] ?? "");
    const transitions = (erp.workflow?.transitions ?? []).filter((transition) => String(transition.from) === status);
    return (_jsxs(Card, { children: [_jsx(CardHeader, { children: _jsx(CardTitle, { children: "ERP document" }) }), _jsxs(CardContent, { className: "space-y-3 text-sm", children: [_jsxs("div", { className: "space-y-1", children: [_jsx("div", { className: "text-text-muted", children: "Next actions" }), (erp.mappingActions ?? []).length === 0 ? (_jsx("div", { className: "text-text-secondary", children: "No mapped actions configured." })) : (_jsx("div", { className: "flex flex-wrap gap-2", children: (erp.mappingActions ?? []).map((action) => {
                                    const ineligible = Boolean(action.visibleInStatuses?.length) && !action.visibleInStatuses?.includes(status);
                                    const busy = busyActionId === action.id;
                                    return (_jsx("button", { type: "button", className: "rounded-md border border-border px-2.5 py-1.5 text-xs text-text-primary hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-55", disabled: busy || ineligible, title: ineligible ? `Available in: ${action.visibleInStatuses?.join(", ")}` : action.label, onClick: () => void onMapDocument(action), children: busy ? "Creating..." : action.label }, action.id));
                                }) }))] }), erp.workflow ? (_jsxs("div", { className: "space-y-1", children: [_jsx("div", { className: "text-text-muted", children: "Workflow" }), transitions.length === 0 ? (_jsxs("div", { className: "text-text-secondary", children: ["No transitions available from ", status || erp.workflow.initialState, "."] })) : (_jsx("div", { className: "flex flex-wrap gap-2", children: transitions.map((transition) => {
                                    const key = `${transition.from}:${transition.to}`;
                                    const busy = busyWorkflowId === key;
                                    return (_jsx("button", { type: "button", className: "rounded-md border border-border px-2.5 py-1.5 text-xs text-text-primary hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-55", disabled: busy, onClick: () => void onTransition(transition), children: busy ? "Updating..." : transition.label }, key));
                                }) }))] })) : null, (erp.printFormats?.length || erp.portal) && (_jsxs("div", { className: "flex flex-wrap gap-2", children: [erp.printFormats?.map((format) => (_jsx("button", { type: "button", className: "rounded-md border border-border px-2.5 py-1.5 text-xs text-text-primary hover:bg-surface-muted", disabled: busyPrintFormatId === format.id, onClick: () => void onPrint(format.id), children: busyPrintFormatId === format.id ? "Preparing..." : `Print ${format.label}` }, format.id))), erp.portal ? (_jsx("button", { type: "button", className: "rounded-md border border-border px-2.5 py-1.5 text-xs text-text-primary hover:bg-surface-muted", disabled: busyPortal, onClick: () => void onCreatePortalLink(), children: busyPortal ? "Creating link..." : "Create portal link" })) : null] })), erp.builderSurfaces?.length ? (_jsxs("div", { className: "space-y-1", children: [_jsx("div", { className: "text-text-muted", children: "Builder surfaces" }), _jsx("ul", { className: "space-y-1", children: erp.builderSurfaces.map((surface) => (_jsx("li", { children: _jsx("a", { className: "text-accent hover:underline", href: `#${surface.path}`, children: surface.label }) }, surface.id))) })] })) : null] })] }));
}
export function RichDealDetailPage({ plugin, resource, }) {
    const hash = useHash();
    const runtime = useRuntime();
    const registry = useRegistry();
    const host = usePluginHost2();
    const fullResourceId = `${plugin.id}.${resource.id}`;
    const [busyErpActionId, setBusyErpActionId] = React.useState(null);
    const [busyPrintFormatId, setBusyPrintFormatId] = React.useState(null);
    const [busyWorkflowId, setBusyWorkflowId] = React.useState(null);
    const [busyPortal, setBusyPortal] = React.useState(false);
    // Extract record id from the hash path. Convention: <basePath>/<id>.
    const id = hash.split("/").pop() ?? "";
    const { data: record, loading, error } = useRecord(fullResourceId, id);
    // Audit endpoint is global; filter client-side to the current record.
    const { data: auditPage } = useLiveAudit({ pageSize: 100 });
    const events = React.useMemo(() => (auditPage?.rows ?? []).filter((e) => e.resource === fullResourceId && (!id || e.recordId === id)), [auditPage, fullResourceId, id]);
    // ALL hooks must run before any early return — moving the
    // view-extensions resolver up above the missing-record short-circuit
    // keeps React's hook count stable across renders. Otherwise navigating
    // to a non-existent id would crash the plugin with "Rendered fewer
    // hooks than expected."
    const rec = (record ?? {});
    const detailViewId = `${fullResourceId}-detail.view`;
    const ext = React.useMemo(() => resolveViewExtensions(host, {
        id: detailViewId,
        type: "custom",
        title: resource.singular,
        resource: fullResourceId,
        render: () => null,
    }), [host, detailViewId, fullResourceId, resource.singular]);
    const basePathMap = React.useMemo(() => (registry ? buildBasePathMap(registry) : {}), [registry]);
    const editPath = `${resource.path}/${id}/edit`;
    const handleMapDocument = React.useCallback(async (action) => {
        if (!resource.erp)
            return;
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
        }
        catch (err) {
            runtime.actions.toast({
                title: `${action.label} failed`,
                description: err instanceof Error ? err.message : "The document action could not be completed.",
                intent: "danger",
            });
        }
        finally {
            setBusyErpActionId(null);
        }
    }, [basePathMap, fullResourceId, id, resource.erp, runtime]);
    const handlePrint = React.useCallback(async (formatId) => {
        setBusyPrintFormatId(formatId);
        try {
            const document = await runtime.erp.renderPrint(fullResourceId, id, formatId);
            openPrintableDocument(document.title, document.html);
            runtime.actions.toast({
                title: "Print view ready",
                description: `${document.formatId} generated for ${document.title}`,
                intent: "success",
            });
        }
        catch (err) {
            runtime.actions.toast({
                title: "Print view failed",
                description: err instanceof Error ? err.message : "The print document could not be generated.",
                intent: "danger",
            });
        }
        finally {
            setBusyPrintFormatId(null);
        }
    }, [fullResourceId, id, runtime]);
    const handleWorkflowTransition = React.useCallback(async (transition) => {
        if (!resource.erp?.workflow)
            return;
        const key = `${transition.from}:${transition.to}`;
        setBusyWorkflowId(key);
        try {
            let reason;
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
        }
        catch (err) {
            runtime.actions.toast({
                title: "Workflow transition failed",
                description: err instanceof Error ? err.message : "The document state could not be changed.",
                intent: "danger",
            });
        }
        finally {
            setBusyWorkflowId(null);
        }
    }, [fullResourceId, id, resource, runtime]);
    const handleCreatePortalLink = React.useCallback(async () => {
        if (!resource.erp?.portal)
            return;
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
            }
            catch {
                /* clipboard can be unavailable in restricted browsers */
            }
            window.open(url, "_blank", "noopener,noreferrer");
            runtime.actions.toast({
                title: "Portal link ready",
                description: "The secure link was copied and opened in a new tab.",
                intent: "success",
            });
        }
        catch (err) {
            runtime.actions.toast({
                title: "Portal link failed",
                description: err instanceof Error ? err.message : "The portal link could not be created.",
                intent: "danger",
            });
        }
        finally {
            setBusyPortal(false);
        }
    }, [fullResourceId, id, rec, resource, runtime]);
    if (!record && !loading) {
        return (_jsx(RichDetailPage, { loading: false, error: new Error(`${resource.singular} ${id} not found`), onRetry: () => navigateTo(resource.path), title: "", tabs: [] }));
    }
    // After early-return guard: derived view data.
    const identifier = displayName(rec, resource);
    const status = resolveStatus(rec, resource);
    const metrics = pickMetrics(rec, resource);
    // `ext` already computed above (kept here as a no-op reference for
    // readers tracing the original layout).
    return (_jsx(RichDetailPage, { loading: loading && !record, error: error ? new Error(String(error)) : null, breadcrumb: [
            { label: plugin.label, path: resource.path },
            { label: resource.plural, path: resource.path },
            { label: identifier },
        ], avatar: _jsx("div", { className: "h-12 w-12 rounded-md bg-accent-subtle flex items-center justify-center", children: _jsx(Icon, { name: resource.icon ?? plugin.icon }) }), title: identifier, subtitle: _jsxs("span", { className: "inline-flex items-center gap-2", children: [_jsx("code", { className: "font-mono text-xs text-text-secondary", children: String(rec.id ?? id) }), _jsx("span", { className: "text-text-muted", children: "\u00B7" }), _jsx("span", { children: resource.singular })] }), favoriteTarget: {
            resource: fullResourceId,
            recordId: id,
            label: identifier,
        }, status: status, metrics: metrics, lastUpdatedAt: rec.updatedAt, primaryAction: resource.readOnly
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
                    const created = await runtime.resources.create(fullResourceId, copy);
                    runtime.actions.toast({
                        title: `Duplicated ${resource.singular}`,
                        intent: "success",
                    });
                    navigateTo(`${resource.path}/${created.id}`);
                },
                hidden: resource.readOnly,
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
                        /* clipboard may be unavailable */
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
                        title: `Delete ${resource.singular.toLowerCase()}?`,
                        description: "This cannot be undone.",
                        destructive: true,
                    });
                    if (!ok)
                        return;
                    await runtime.resources.delete(fullResourceId, id);
                    runtime.actions.toast({
                        title: `${resource.singular} deleted`,
                        intent: "danger",
                    });
                    navigateTo(resource.path);
                },
                hidden: resource.readOnly,
            },
        ], tabs: [
            {
                id: "overview",
                label: "Overview",
                render: () => (_jsx(OverviewSections, { record: rec, fields: resource.fields })),
            },
            ...(resource.erp
                ? [
                    {
                        id: "document",
                        label: "Document",
                        render: () => (_jsx(ErpDocumentTab, { record: rec, resource: resource })),
                    },
                ]
                : []),
            {
                id: "bi",
                label: "BI",
                render: () => (_jsx(BIPanel, { resource: fullResourceId, record: rec, fields: resource.fields })),
            },
            {
                id: "connections",
                label: "Connections",
                render: () => registry ? (_jsx(AutoConnectionsPanel, { resource: fullResourceId, recordId: id, registry: registry, basePathMap: basePathMap })) : (_jsx(TabEmpty, { title: "Registry unavailable" })),
            },
            {
                id: "actions",
                label: "Actions",
                render: () => (_jsx(ActionsPanel, { actions: resource.actions ?? [], record: rec, resource: fullResourceId, onNavigateEdit: () => navigateTo(editPath) })),
            },
            {
                id: "activity",
                label: "Activity",
                // Per-record activity feed — backed by `/api/timeline/<resource>/<id>`.
                // The audit-events count above is the closest live signal we have
                // for "is there anything here", so we surface it as the badge while
                // the actual feed loads its own data.
                count: events.length || undefined,
                render: () => (_jsx(ActivityTabPanel, { resource: fullResourceId, recordId: id })),
            },
            ...ext.tabs
                .filter((t) => !t.visibleWhen || t.visibleWhen(rec))
                .map((t) => ({
                id: t.id,
                label: t.label,
                render: () => (_jsx(PluginExtensionBoundary, { pluginId: t.contributor, label: t.label, children: t.render(rec) })),
            })),
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
                        { label: "Id", value: _jsx("code", { className: "font-mono text-xs", children: String(rec.id ?? id) }) },
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
            ...(resource.erp
                ? [
                    {
                        id: "erp-document",
                        priority: 90,
                        render: () => (_jsx(ErpDocumentRailCard, { record: rec, resource: resource, busyActionId: busyErpActionId, busyPrintFormatId: busyPrintFormatId, busyWorkflowId: busyWorkflowId, busyPortal: busyPortal, onMapDocument: handleMapDocument, onTransition: handleWorkflowTransition, onPrint: handlePrint, onCreatePortalLink: handleCreatePortalLink })),
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
                render: () => (_jsx(CustomFieldsRailCard, { resource: fullResourceId, recordId: id, record: rec, editable: !resource.readOnly })),
            },
            {
                id: "connections",
                priority: 60,
                render: () => plugin.connections ? (_jsx(ConnectionsPanel, { descriptor: plugin.connections, parent: rec })) : null,
            },
            // Recent-activity rail — last 10 events from the per-record
            // timeline so users can see what changed without switching to
            // the Activity tab.
            {
                id: "recent-activity",
                priority: 50,
                render: () => (_jsx(RecentActivityRailCard, { resource: fullResourceId, recordId: id })),
            },
            {
                id: "automation",
                priority: 40,
                render: () => (_jsx(AutomationHookPanel, { hooks: [], onConfigure: () => navigateTo("/automation/triggers") })),
            },
            {
                id: "ai",
                priority: 20,
                render: () => (_jsx(AIInsightPanel, { insights: [], loading: false })),
            },
            ...ext.railCards.map((c) => ({
                id: `ext::${c.contributor}::${c.id}`,
                priority: c.priority,
                render: () => (_jsx(PluginExtensionBoundary, { pluginId: c.contributor, label: c.id, children: c.render(rec) })),
            })),
        ] }));
}
/** Per-extension error boundary wrapper — uses the shared PluginBoundary so
 *  a single plugin's extension crashing doesn't take out the whole detail
 *  view. */
function PluginExtensionBoundary({ pluginId, label, children, }) {
    return (_jsx(PluginBoundary, { pluginId: pluginId, label: label, children: children }));
}
