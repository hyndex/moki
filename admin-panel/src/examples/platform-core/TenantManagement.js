import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import * as React from "react";
import { Building2, Plus, Trash2, Archive } from "lucide-react";
import { PageHeader } from "@/admin-primitives/PageHeader";
import { Card, CardContent } from "@/admin-primitives/Card";
import { Button } from "@/primitives/Button";
import { Input } from "@/primitives/Input";
import { Label } from "@/primitives/Label";
import { Badge } from "@/primitives/Badge";
import { Dialog, DialogContent } from "@/primitives/Dialog";
import { StatusDot } from "@/admin-primitives/StatusDot";
import { FreshnessIndicator } from "@/admin-primitives/FreshnessIndicator";
import { EmptyStateFramework } from "@/admin-primitives/EmptyStateFramework";
import { ErrorRecoveryFramework } from "@/admin-primitives/ErrorRecoveryFramework";
import { apiFetch, fetchPlatformConfig, authStore } from "@/runtime/auth";
import { useRuntime } from "@/runtime/context";
async function loadTenants() {
    const r = await apiFetch("/tenants");
    return r.tenants;
}
export function TenantManagementPage() {
    const runtime = useRuntime();
    const [rows, setRows] = React.useState(null);
    const [error, setError] = React.useState(null);
    const [lastUpdated, setLastUpdated] = React.useState(new Date());
    const [multisite, setMultisite] = React.useState(false);
    const [creating, setCreating] = React.useState(false);
    const [busyId, setBusyId] = React.useState(null);
    const refresh = React.useCallback(async () => {
        try {
            const r = await loadTenants();
            setRows(r);
            setError(null);
            setLastUpdated(new Date());
        }
        catch (err) {
            setError(err instanceof Error ? err : new Error(String(err)));
        }
    }, []);
    React.useEffect(() => {
        void refresh();
        void fetchPlatformConfig().then((c) => setMultisite(c.multisite));
    }, [refresh]);
    const archive = async (t) => {
        setBusyId(t.id);
        try {
            await apiFetch(`/tenants/${t.id}/archive`, { method: "POST" });
            runtime.actions.toast({ title: `Archived ${t.name}`, intent: "warning" });
            await refresh();
        }
        catch (err) {
            runtime.actions.toast({
                title: "Archive failed",
                description: err instanceof Error ? err.message : undefined,
                intent: "danger",
            });
        }
        finally {
            setBusyId(null);
        }
    };
    const hardDelete = async (t) => {
        const confirmed = await runtime.actions.confirm({
            title: `Permanently delete ${t.name}?`,
            description: `Type "${t.slug}" to confirm. This drops the tenant schema, memberships, domains, and all files. Cannot be undone.`,
            destructive: true,
        });
        if (!confirmed)
            return;
        setBusyId(t.id);
        try {
            await apiFetch(`/tenants/${t.id}/delete-hard`, {
                method: "POST",
                body: JSON.stringify({ confirm: "DELETE", slug: t.slug }),
            });
            runtime.actions.toast({ title: `Deleted ${t.name}`, intent: "danger" });
            await refresh();
        }
        catch (err) {
            runtime.actions.toast({
                title: "Delete failed",
                description: err instanceof Error ? err.message : undefined,
                intent: "danger",
            });
        }
        finally {
            setBusyId(null);
        }
    };
    const isAdmin = (authStore.user?.role ?? "") === "admin";
    return (_jsxs("div", { className: "flex flex-col gap-4", children: [_jsx(PageHeader, { title: "Tenants", description: "Workspaces, schema provisioning, memberships, and domains. Every mutation is audited.", actions: _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(FreshnessIndicator, { lastUpdatedAt: lastUpdated }), isAdmin && (_jsx(Button, { variant: "primary", size: "sm", iconLeft: _jsx(Plus, { className: "h-3.5 w-3.5" }), onClick: () => setCreating(true), children: "New tenant" }))] }) }), !multisite && (_jsx(Card, { children: _jsxs(CardContent, { className: "py-3 text-xs text-text-muted flex items-start gap-2", children: [_jsx(Building2, { className: "h-3.5 w-3.5 mt-0.5 text-accent" }), _jsxs("div", { children: [_jsx("div", { className: "text-text-primary font-medium", children: "Single-site mode" }), "Multi-tenancy is installed but disabled. Set", " ", _jsx("code", { className: "font-mono", children: "MULTISITE=1" }), " (requires Postgres) to enable schema-per-tenant isolation and domain-based routing. The default ", _jsx("strong", { children: "Main" }), " tenant below is used for all requests."] })] }) })), error ? (_jsx(ErrorRecoveryFramework, { message: error.message, onRetry: refresh })) : rows === null ? (_jsx(Card, { children: _jsx(CardContent, { className: "py-10 text-center text-xs text-text-muted", children: "Loading\u2026" }) })) : rows.length === 0 ? (_jsx(Card, { children: _jsx(CardContent, { children: _jsx(EmptyStateFramework, { kind: "first-time", title: "No tenants yet", description: "Create your first workspace.", primary: { label: "New tenant", onClick: () => setCreating(true) } }) }) })) : (_jsx(Card, { children: _jsx(CardContent, { className: "p-0", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "border-b border-border text-xs uppercase tracking-wider text-text-muted", children: [_jsx("th", { className: "text-left p-3", children: "Name" }), _jsx("th", { className: "text-left p-3", children: "Slug" }), _jsx("th", { className: "text-left p-3", children: "Plan" }), _jsx("th", { className: "text-left p-3", children: "Status" }), _jsx("th", { className: "text-left p-3", children: "Created" }), _jsx("th", { className: "text-right p-3", children: "Actions" })] }) }), _jsx("tbody", { children: rows.map((t) => (_jsxs("tr", { className: "border-b border-border-subtle last:border-b-0 hover:bg-surface-1", children: [_jsx("td", { className: "p-3", children: _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Building2, { className: "h-3.5 w-3.5 text-text-muted" }), _jsx("span", { className: "text-text-primary font-medium", children: t.name })] }) }), _jsx("td", { className: "p-3 font-mono text-xs text-text-secondary", children: t.slug }), _jsx("td", { className: "p-3", children: _jsx(Badge, { intent: "info", children: t.plan }) }), _jsx("td", { className: "p-3", children: _jsxs("div", { className: "inline-flex items-center gap-1.5", children: [_jsx(StatusDot, { intent: t.status === "active"
                                                            ? "success"
                                                            : t.status === "suspended"
                                                                ? "warning"
                                                                : "neutral" }), _jsx("span", { className: "text-xs text-text-secondary", children: t.status })] }) }), _jsx("td", { className: "p-3 text-xs text-text-muted", children: new Date(t.createdAt).toLocaleDateString() }), _jsx("td", { className: "p-3 text-right", children: _jsxs("div", { className: "inline-flex items-center gap-1", children: [isAdmin && t.status === "active" && (_jsx(Button, { variant: "ghost", size: "sm", loading: busyId === t.id, iconLeft: _jsx(Archive, { className: "h-3 w-3" }), onClick: () => void archive(t), children: "Archive" })), isAdmin && t.plan !== "builtin" && (_jsx(Button, { variant: "ghost", size: "sm", loading: busyId === t.id, iconLeft: _jsx(Trash2, { className: "h-3 w-3 text-intent-danger" }), onClick: () => void hardDelete(t), children: "Delete" }))] }) })] }, t.id))) })] }) }) })), _jsx(CreateTenantDialog, { open: creating, onOpenChange: setCreating, onCreated: async () => {
                    await refresh();
                    setCreating(false);
                } })] }));
}
function CreateTenantDialog({ open, onOpenChange, onCreated, }) {
    const runtime = useRuntime();
    const [slug, setSlug] = React.useState("");
    const [name, setName] = React.useState("");
    const [plan, setPlan] = React.useState("free");
    const [busy, setBusy] = React.useState(false);
    const [error, setError] = React.useState(null);
    React.useEffect(() => {
        if (!open) {
            setSlug("");
            setName("");
            setPlan("free");
            setError(null);
        }
    }, [open]);
    const submit = async () => {
        setBusy(true);
        setError(null);
        try {
            await apiFetch("/tenants", {
                method: "POST",
                body: JSON.stringify({ slug: slug.trim(), name: name.trim(), plan }),
            });
            runtime.actions.toast({ title: `Created ${name}`, intent: "success" });
            await onCreated();
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "Failed to create");
        }
        finally {
            setBusy(false);
        }
    };
    return (_jsx(Dialog, { open: open, onOpenChange: onOpenChange, children: _jsxs(DialogContent, { className: "max-w-md", children: [_jsxs("div", { className: "px-5 py-4 border-b border-border", children: [_jsx("div", { className: "text-sm font-semibold text-text-primary", children: "New tenant" }), _jsx("div", { className: "text-xs text-text-muted mt-0.5", children: "Provisions a new schema and makes you its owner." })] }), _jsxs("div", { className: "p-5 flex flex-col gap-3", children: [_jsxs("div", { className: "flex flex-col gap-1", children: [_jsx(Label, { htmlFor: "t-slug", children: "Slug" }), _jsx(Input, { id: "t-slug", autoFocus: true, placeholder: "acme", value: slug, onChange: (e) => setSlug(e.target.value
                                        .toLowerCase()
                                        .replace(/[^a-z0-9_-]/g, "")
                                        .slice(0, 63)) }), _jsx("span", { className: "text-xs text-text-muted", children: "URL-safe. Used as the Postgres schema name (a\u2013z, 0\u20139, _, -). 2\u201363 chars." })] }), _jsxs("div", { className: "flex flex-col gap-1", children: [_jsx(Label, { htmlFor: "t-name", children: "Display name" }), _jsx(Input, { id: "t-name", placeholder: "Acme Corp", value: name, onChange: (e) => setName(e.target.value.slice(0, 120)) })] }), _jsxs("div", { className: "flex flex-col gap-1", children: [_jsx(Label, { htmlFor: "t-plan", children: "Plan" }), _jsx(Input, { id: "t-plan", value: plan, onChange: (e) => setPlan(e.target.value) })] }), error && _jsx("div", { className: "text-xs text-intent-danger", children: error })] }), _jsxs("div", { className: "px-5 py-3 border-t border-border flex items-center justify-end gap-2", children: [_jsx(Button, { variant: "ghost", size: "sm", onClick: () => onOpenChange(false), children: "Cancel" }), _jsx(Button, { variant: "primary", size: "sm", loading: busy, disabled: slug.length < 2 || name.length < 1, onClick: submit, iconLeft: _jsx(Building2, { className: "h-3.5 w-3.5" }), children: "Create tenant" })] })] }) }));
}
