import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import * as React from "react";
import { Search, Sun, Moon, LayoutList, Rows3, Rows4, User, Settings, LogOut, } from "lucide-react";
import { Button } from "@/primitives/Button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuShortcut, } from "@/primitives/DropdownMenu";
import { getDensity, getTheme, setDensity, setTheme } from "@/tokens";
import { authStore, logout } from "@/runtime/auth";
import { AlertCenter } from "@/admin-primitives/AlertCenter";
import { useRuntime } from "@/runtime/context";
import { Keyboard } from "lucide-react";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";
export function Topbar({ onOpenCommand, onOpenShortcuts, breadcrumbs }) {
    const [, force] = React.useReducer((x) => x + 1, 0);
    const theme = getTheme();
    const density = getDensity();
    return (_jsxs("header", { className: "flex items-center gap-3 h-topbar-h px-4 bg-surface-0 border-b border-border sticky top-0 z-20", role: "banner", children: [_jsxs("div", { className: "flex-1 min-w-0 flex items-center gap-3", children: [_jsx(WorkspaceSwitcher, {}), breadcrumbs ?? _jsx("div", {})] }), _jsxs("button", { type: "button", onClick: onOpenCommand, className: "inline-flex items-center gap-2 h-8 px-2.5 rounded-md border border-border bg-surface-1 text-sm text-text-muted hover:bg-surface-2 transition-colors min-w-[240px]", "aria-label": "Open command palette", children: [_jsx(Search, { className: "h-3.5 w-3.5" }), _jsx("span", { className: "flex-1 text-left", children: "Search\u2026" }), _jsx("kbd", { className: "text-[10px] px-1 py-0.5 rounded bg-surface-3 text-text-secondary border border-border-subtle font-mono", children: "\u2318K" })] }), _jsx(AlertCenterMount, {}), onOpenShortcuts && (_jsx(Button, { variant: "ghost", size: "icon", "aria-label": "Keyboard shortcuts", onClick: onOpenShortcuts, children: _jsx(Keyboard, { className: "h-4 w-4" }) })), _jsxs(DropdownMenu, { children: [_jsx(DropdownMenuTrigger, { asChild: true, children: _jsx(Button, { variant: "ghost", size: "icon", "aria-label": "Appearance", children: theme === "dark" ? (_jsx(Moon, { className: "h-4 w-4" })) : (_jsx(Sun, { className: "h-4 w-4" })) }) }), _jsxs(DropdownMenuContent, { align: "end", className: "w-56", children: [_jsx(DropdownMenuLabel, { children: "Theme" }), _jsxs(DropdownMenuItem, { onSelect: () => {
                                    setTheme("light");
                                    force();
                                }, children: [_jsx(Sun, { className: "h-4 w-4" }), " Light", theme === "light" && _jsx("span", { className: "ml-auto", children: "\u2713" })] }), _jsxs(DropdownMenuItem, { onSelect: () => {
                                    setTheme("dark");
                                    force();
                                }, children: [_jsx(Moon, { className: "h-4 w-4" }), " Dark", theme === "dark" && _jsx("span", { className: "ml-auto", children: "\u2713" })] }), _jsx(DropdownMenuSeparator, {}), _jsx(DropdownMenuLabel, { children: "Density" }), _jsxs(DropdownMenuItem, { onSelect: () => {
                                    setDensity("comfortable");
                                    force();
                                }, children: [_jsx(Rows3, { className: "h-4 w-4" }), " Comfortable", density === "comfortable" && _jsx("span", { className: "ml-auto", children: "\u2713" })] }), _jsxs(DropdownMenuItem, { onSelect: () => {
                                    setDensity("compact");
                                    force();
                                }, children: [_jsx(LayoutList, { className: "h-4 w-4" }), " Compact", density === "compact" && _jsx("span", { className: "ml-auto", children: "\u2713" })] }), _jsxs(DropdownMenuItem, { onSelect: () => {
                                    setDensity("dense");
                                    force();
                                }, children: [_jsx(Rows4, { className: "h-4 w-4" }), " Dense", density === "dense" && _jsx("span", { className: "ml-auto", children: "\u2713" })] })] })] }), _jsx(AccountMenu, {})] }));
}
function AlertCenterMount() {
    const { bus } = useRuntime();
    const [alerts, setAlerts] = React.useState([]);
    React.useEffect(() => {
        // Mirror toast events into alerts. Real alerts come from notifications plugin.
        return bus.on("toast:add", (t) => {
            if (t.intent === "danger" || t.intent === "warning") {
                const alert = {
                    id: t.id,
                    title: t.title,
                    body: t.description,
                    intent: t.intent,
                    createdAt: new Date().toISOString(),
                    source: "system",
                };
                setAlerts((prev) => [alert, ...prev].slice(0, 50));
            }
        });
    }, [bus]);
    return (_jsx(AlertCenter, { alerts: alerts, onAck: (id) => setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, acked: true } : a))), onSnooze: (id, minutes) => {
            const until = new Date(Date.now() + minutes * 60_000).toISOString();
            setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, snoozedUntil: until } : a)));
        }, onDismiss: (id) => setAlerts((prev) => prev.filter((a) => a.id !== id)) }));
}
function AccountMenu() {
    // Subscribe to authStore so initials/name/email update on login, logout,
    // profile changes, or tenant switch (all of which fire `change`).
    const [, rerender] = React.useReducer((n) => n + 1, 0);
    React.useEffect(() => authStore.emitter.on("change", () => rerender()), []);
    const user = authStore.user;
    const initials = user
        ? user.name
            .split(/\s+/)
            .map((p) => p[0])
            .slice(0, 2)
            .join("")
            .toUpperCase()
        : "?";
    return (_jsxs(DropdownMenu, { children: [_jsx(DropdownMenuTrigger, { asChild: true, children: _jsx("button", { type: "button", className: "flex items-center gap-2 h-8 px-1 rounded-md hover:bg-surface-2 transition-colors", "aria-label": "Account", children: _jsx("div", { className: "w-6 h-6 rounded-full bg-accent-subtle text-accent flex items-center justify-center text-xs font-medium", children: initials }) }) }), _jsxs(DropdownMenuContent, { align: "end", className: "w-60", children: [_jsxs(DropdownMenuLabel, { children: [_jsx("div", { className: "text-sm font-medium text-text-primary", children: user?.name ?? "Guest" }), _jsx("div", { className: "text-xs text-text-muted font-normal normal-case tracking-normal", children: user?.email })] }), _jsxs(DropdownMenuItem, { onSelect: () => (window.location.hash = "/profile"), children: [_jsx(User, { className: "h-4 w-4" }), " Profile", _jsx(DropdownMenuShortcut, { children: "\u2318P" })] }), _jsxs(DropdownMenuItem, { onSelect: () => (window.location.hash = "/settings"), children: [_jsx(Settings, { className: "h-4 w-4" }), " Settings", _jsx(DropdownMenuShortcut, { children: "\u2318," })] }), _jsx(DropdownMenuSeparator, {}), _jsxs(DropdownMenuItem, { intent: "danger", onSelect: () => {
                            void logout();
                        }, children: [_jsx(LogOut, { className: "h-4 w-4" }), " Sign out"] })] })] }));
}
