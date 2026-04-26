import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Inbox, Search as SearchIcon, ShieldAlert, Sparkles, WifiOff, Wrench, } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/primitives/Button";
import { EmptyState } from "./EmptyState";
const DEFAULTS = {
    "first-time": {
        icon: _jsx(Sparkles, { className: "h-6 w-6" }),
        title: "Nothing here yet",
        description: "Create your first record to get started.",
    },
    "no-results": {
        icon: _jsx(SearchIcon, { className: "h-6 w-6" }),
        title: "No results match",
        description: "Try removing a filter or broadening your search.",
    },
    cleared: {
        icon: _jsx(Inbox, { className: "h-6 w-6" }),
        title: "You're all caught up",
        description: "Nothing left in this view.",
    },
    denied: {
        icon: _jsx(ShieldAlert, { className: "h-6 w-6" }),
        title: "You don't have access",
        description: "Ask an admin to grant the required role.",
    },
    offline: {
        icon: _jsx(WifiOff, { className: "h-6 w-6" }),
        title: "You're offline",
        description: "Showing the last cached data. Changes will sync when you reconnect.",
    },
    error: {
        icon: _jsx(Wrench, { className: "h-6 w-6" }),
        title: "Something broke",
        description: "We couldn't load this view. Retry or contact support.",
    },
    "coming-soon": {
        icon: _jsx(Sparkles, { className: "h-6 w-6" }),
        title: "Coming soon",
        description: "This surface is on the roadmap.",
    },
};
export function EmptyStateFramework({ kind, title, description, primary, secondary, illustration, className, }) {
    const defaults = DEFAULTS[kind];
    return (_jsx(EmptyState, { icon: illustration ?? defaults.icon, title: title ?? defaults.title, description: description ?? defaults.description, action: (primary || secondary) && (_jsxs("div", { className: "flex items-center gap-2 mt-1", children: [primary && (_jsx(Button, { variant: "primary", size: "sm", onClick: primary.href
                        ? () => (window.location.hash = primary.href)
                        : primary.onClick, children: primary.label })), secondary && (_jsx(Button, { variant: "ghost", size: "sm", onClick: secondary.href
                        ? () => (window.location.hash = secondary.href)
                        : secondary.onClick, children: secondary.label }))] })), className: cn(className) }));
}
