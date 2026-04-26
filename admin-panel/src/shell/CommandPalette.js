import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import * as React from "react";
import { Command } from "cmdk";
import { Dialog, DialogPortal, DialogOverlay } from "@/primitives/Dialog";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "@/lib/cn";
import { NavIcon } from "./NavIcon";
import { navigateTo } from "@/views/useRoute";
import { authStore } from "@/runtime/auth";
export function CommandPalette({ open, onOpenChange, registry, }) {
    const [query, setQuery] = React.useState("");
    const [searchGroups, setSearchGroups] = React.useState([]);
    const [searching, setSearching] = React.useState(false);
    React.useEffect(() => {
        if (!open) {
            setQuery("");
            setSearchGroups([]);
        }
    }, [open]);
    // Global record search — debounced to avoid hitting the API on
    // every keystroke. Backend caps results at 20; we group by
    // resource for rendering. ACL filtering happens server-side so
    // we always get a safe-to-show result set.
    React.useEffect(() => {
        if (!open || query.trim().length < 2) {
            setSearchGroups([]);
            return;
        }
        const handle = setTimeout(async () => {
            setSearching(true);
            try {
                const headers = {};
                if (authStore.token)
                    headers.Authorization = `Bearer ${authStore.token}`;
                if (authStore.activeTenant?.id)
                    headers["x-tenant"] = authStore.activeTenant.id;
                const res = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}&limit=20`, { headers, credentials: "include" });
                if (!res.ok) {
                    setSearchGroups([]);
                    return;
                }
                const data = (await res.json());
                setSearchGroups(data.groups ?? []);
            }
            catch {
                setSearchGroups([]);
            }
            finally {
                setSearching(false);
            }
        }, 180);
        return () => clearTimeout(handle);
    }, [open, query]);
    return (_jsx(Dialog, { open: open, onOpenChange: onOpenChange, children: _jsxs(DialogPortal, { children: [_jsx(DialogOverlay, {}), _jsxs(DialogPrimitive.Content, { className: cn("fixed left-1/2 top-[15%] z-50 w-full max-w-xl -translate-x-1/2", "rounded-lg border border-border bg-surface-0 shadow-lg overflow-hidden animate-scale-in"), children: [_jsx(DialogPrimitive.Title, { className: "sr-only", children: "Command palette" }), _jsxs(Command, { shouldFilter: true, className: "flex flex-col bg-transparent", filter: (value, search) => {
                                const v = value.toLowerCase();
                                const q = search.toLowerCase();
                                if (!q)
                                    return 1;
                                // Server-side search hits are prefixed `record` — they're
                                // already filtered by the API, so let them through
                                // regardless of the cmdk client-filter.
                                if (v.startsWith("record"))
                                    return 1;
                                if (v.includes(q))
                                    return 1;
                                return 0;
                            }, children: [_jsx(Command.Input, { autoFocus: true, placeholder: "Search navigation, actions, records\u2026", value: query, onValueChange: setQuery, className: "w-full h-11 px-4 bg-transparent text-sm outline-none border-b border-border placeholder:text-text-muted" }), _jsxs(Command.List, { className: "max-h-[360px] overflow-y-auto p-1", children: [_jsx(Command.Empty, { className: "py-6 text-center text-sm text-text-muted", children: "No results found." }), _jsx(Command.Group, { heading: "Navigation", className: "[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:text-text-muted [&_[cmdk-group-heading]]:font-semibold", children: flattenNav(registry.nav).map((n) => n.path ? (_jsxs(CommandItem, { onSelect: () => {
                                                    navigateTo(n.path);
                                                    onOpenChange(false);
                                                }, value: `nav ${n.label} ${n.path}`, children: [_jsx(NavIcon, { name: n.icon, className: "h-4 w-4" }), _jsx("span", { children: n.label }), _jsx("span", { className: "ml-auto text-xs text-text-muted font-mono", children: n.path })] }, n.id)) : null) }), registry.commands.length > 0 && (_jsx(Command.Group, { heading: "Actions", className: "[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:text-text-muted [&_[cmdk-group-heading]]:font-semibold", children: registry.commands.map((c) => (_jsxs(CommandItem, { onSelect: async () => {
                                                    onOpenChange(false);
                                                    await c.run();
                                                }, value: `cmd ${c.label} ${(c.keywords ?? []).join(" ")}`, children: [_jsx(NavIcon, { name: c.icon ?? "Sparkles", className: "h-4 w-4" }), _jsx("span", { children: c.label }), c.shortcut && (_jsx("span", { className: "ml-auto text-xs text-text-muted font-mono", children: c.shortcut }))] }, c.id))) })), searchGroups.map((g) => (_jsx(Command.Group, { heading: g.label, className: "[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:text-text-muted [&_[cmdk-group-heading]]:font-semibold", children: g.hits.map((h) => (_jsxs(CommandItem, { value: `record ${g.label} ${h.title} ${h.subtitle ?? ""} ${h.matchedSnippet ?? ""}`, onSelect: () => {
                                                    if (h.url)
                                                        navigateTo(h.url);
                                                    onOpenChange(false);
                                                }, children: [_jsx(NavIcon, { name: "FileText", className: "h-4 w-4" }), _jsx("span", { className: "truncate flex-1", children: h.title }), h.subtitle && (_jsx("span", { className: "ml-2 text-xs text-text-muted truncate", children: h.subtitle }))] }, `${g.resource}:${h.id}`))) }, g.resource))), searching && query.trim().length >= 2 && searchGroups.length === 0 && (_jsx("div", { className: "py-4 text-center text-xs text-text-muted", children: "Searching\u2026" }))] })] })] })] }) }));
}
function CommandItem({ onSelect, value, children, }) {
    return (_jsx(Command.Item, { value: value, onSelect: onSelect, className: cn("flex items-center gap-2 px-2 py-1.5 rounded-sm text-sm text-text-primary cursor-pointer", "data-[selected=true]:bg-surface-2"), children: children }));
}
function flattenNav(nav, out = []) {
    for (const item of nav) {
        out.push(item);
        if (item.children)
            flattenNav(item.children, out);
    }
    return out;
}
