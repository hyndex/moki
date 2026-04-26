import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import * as React from "react";
import { Building2, Check, ChevronDown, Plus } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, } from "@/primitives/DropdownMenu";
import { authStore, fetchMemberships, fetchPlatformConfig, switchTenant, } from "@/runtime/auth";
import { useRuntime } from "@/runtime/context";
import { cn } from "@/lib/cn";
/** Tenant switcher for the top bar.
 *
 *  Renders the active tenant name + chevron; dropdown lists available tenants
 *  with the active one checked. Switching triggers a backend session update,
 *  cache invalidation, and a page reload so all queries re-issue against the
 *  newly active tenant.
 *
 *  In single-site mode (per /api/config) the switcher is still functional but
 *  self-hides when there's only one tenant.
 */
export function WorkspaceSwitcher() {
    const runtime = useRuntime();
    const [active, setActive] = React.useState(authStore.activeTenant);
    const [available, setAvailable] = React.useState(authStore.availableTenants);
    const [multisite, setMultisite] = React.useState(false);
    const [busy, setBusy] = React.useState(false);
    React.useEffect(() => {
        const unsub = authStore.emitter.on("tenant", ({ active, available }) => {
            setActive(active);
            setAvailable(available);
        });
        void fetchMemberships().catch(() => { });
        void fetchPlatformConfig()
            .then((c) => setMultisite(c.multisite))
            .catch(() => { });
        return unsub;
    }, []);
    const handleSwitch = async (tenant) => {
        if (tenant.id === active?.id || busy)
            return;
        setBusy(true);
        try {
            await switchTenant(tenant.id);
            // Invalidate every cached query — the new tenant has a different record set.
            runtime.resources.cache.clear?.();
            runtime.analytics.setMeta({ tenantId: tenant.id });
            runtime.actions.toast({
                title: `Switched to ${tenant.name}`,
                intent: "success",
            });
            // Full reload so realtime sockets reconnect with the new tenant.
            setTimeout(() => window.location.reload(), 200);
        }
        catch (err) {
            runtime.actions.toast({
                title: "Could not switch tenant",
                description: err instanceof Error ? err.message : "Unknown error",
                intent: "danger",
            });
        }
        finally {
            setBusy(false);
        }
    };
    // Hide when there's only one tenant and single-site mode.
    if (!multisite && available.length <= 1)
        return null;
    if (available.length === 0)
        return null;
    const label = active?.name ?? "Select workspace";
    return (_jsxs(DropdownMenu, { children: [_jsx(DropdownMenuTrigger, { asChild: true, children: _jsxs("button", { type: "button", className: cn("inline-flex items-center gap-2 h-8 px-2.5 rounded-md border border-border bg-surface-1 text-sm text-text-primary hover:bg-surface-2 transition-colors max-w-[220px]", busy && "opacity-60 cursor-wait"), "aria-label": "Switch workspace", children: [_jsx(Building2, { className: "h-3.5 w-3.5 text-text-muted shrink-0" }), _jsx("span", { className: "flex-1 text-left truncate", children: label }), _jsx(ChevronDown, { className: "h-3 w-3 text-text-muted shrink-0" })] }) }), _jsxs(DropdownMenuContent, { align: "start", className: "w-64", children: [_jsx(DropdownMenuLabel, { className: "text-xs text-text-muted", children: "Workspaces" }), available.map((t) => (_jsxs(DropdownMenuItem, { onSelect: () => void handleSwitch(t), className: "flex items-center gap-2", children: [_jsx(Building2, { className: "h-3.5 w-3.5 text-text-muted" }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("div", { className: "text-sm text-text-primary truncate", children: t.name }), _jsxs("div", { className: "text-xs text-text-muted truncate", children: [t.slug, t.role && ` · ${t.role}`, t.status === "archived" && " · archived"] })] }), active?.id === t.id && _jsx(Check, { className: "h-3.5 w-3.5 text-accent" })] }, t.id))), multisite && (_jsxs(_Fragment, { children: [_jsx(DropdownMenuSeparator, {}), _jsxs(DropdownMenuItem, { onSelect: () => (window.location.hash = "/platform/tenants"), children: [_jsx(Plus, { className: "h-3.5 w-3.5" }), _jsx("span", { children: "Manage workspaces" })] })] }))] })] }));
}
