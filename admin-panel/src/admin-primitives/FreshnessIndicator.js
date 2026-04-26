import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import * as React from "react";
import { cn } from "@/lib/cn";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/primitives/Tooltip";
function toMillis(v) {
    if (v === null || v === undefined)
        return null;
    if (v instanceof Date)
        return v.getTime();
    if (typeof v === "number")
        return v;
    const parsed = Date.parse(v);
    return Number.isNaN(parsed) ? null : parsed;
}
function formatRel(ms) {
    const diff = Date.now() - ms;
    if (diff < 5_000)
        return "just now";
    if (diff < 60_000)
        return `${Math.floor(diff / 1000)}s ago`;
    if (diff < 3_600_000)
        return `${Math.floor(diff / 60_000)}m ago`;
    if (diff < 86_400_000)
        return `${Math.floor(diff / 3_600_000)}h ago`;
    return `${Math.floor(diff / 86_400_000)}d ago`;
}
export function FreshnessIndicator({ lastUpdatedAt, staleAfter = 60_000, offlineAfter = 300_000, live, className, }) {
    const [, tick] = React.useState(0);
    React.useEffect(() => {
        const i = setInterval(() => tick((n) => n + 1), 15_000);
        return () => clearInterval(i);
    }, []);
    const ms = toMillis(lastUpdatedAt);
    const age = ms === null ? null : Date.now() - ms;
    const state = live
        ? "live"
        : age === null
            ? "unknown"
            : age > offlineAfter
                ? "offline"
                : age > staleAfter
                    ? "stale"
                    : "fresh";
    const intentClass = state === "live"
        ? "text-intent-success"
        : state === "fresh"
            ? "text-text-muted"
            : state === "stale"
                ? "text-intent-warning"
                : state === "offline"
                    ? "text-intent-danger"
                    : "text-text-muted";
    const label = state === "live"
        ? "Live"
        : state === "unknown"
            ? "No data"
            : formatRel(ms);
    const tooltip = state === "live"
        ? "Data updates in realtime via WebSocket."
        : ms
            ? `Last updated ${new Date(ms).toLocaleString()}`
            : "No data";
    return (_jsxs(Tooltip, { children: [_jsx(TooltipTrigger, { asChild: true, children: _jsxs("span", { className: cn("inline-flex items-center gap-1.5 text-xs tabular-nums", intentClass, className), "aria-label": `Freshness: ${label}`, children: [_jsx("span", { className: cn("inline-block w-1.5 h-1.5 rounded-full", state === "live" && "bg-intent-success animate-pulse", state === "fresh" && "bg-intent-success", state === "stale" && "bg-intent-warning", state === "offline" && "bg-intent-danger", state === "unknown" && "bg-text-muted") }), label] }) }), _jsx(TooltipContent, { children: tooltip })] }));
}
