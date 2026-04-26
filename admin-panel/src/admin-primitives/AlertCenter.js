import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Bell, Check, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/primitives/Popover";
import { Badge } from "@/primitives/Badge";
import { Button } from "@/primitives/Button";
import { cn } from "@/lib/cn";
function intentClass(intent) {
    switch (intent) {
        case "danger":
            return "text-intent-danger bg-intent-danger-bg";
        case "warning":
            return "text-intent-warning bg-intent-warning-bg";
        case "success":
            return "text-intent-success bg-intent-success-bg";
        default:
            return "text-intent-info bg-intent-info-bg";
    }
}
export function AlertCenter({ alerts, onAck, onSnooze, onDismiss, onOpen, className, }) {
    const now = Date.now();
    const active = alerts.filter((a) => {
        if (a.acked)
            return false;
        if (a.snoozedUntil && Date.parse(a.snoozedUntil) > now)
            return false;
        return true;
    });
    const unackedCount = active.length;
    return (_jsxs(Popover, { children: [_jsx(PopoverTrigger, { asChild: true, children: _jsxs("button", { type: "button", "aria-label": `Alerts (${unackedCount} unread)`, className: cn("relative h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-surface-2 text-text-muted", className), children: [_jsx(Bell, { className: "h-4 w-4" }), unackedCount > 0 && (_jsx("span", { className: "absolute top-0.5 right-0.5 h-4 min-w-4 px-1 rounded-full bg-intent-danger text-white text-[10px] font-semibold inline-flex items-center justify-center leading-none tabular-nums", children: unackedCount > 99 ? "99+" : unackedCount }))] }) }), _jsxs(PopoverContent, { className: "w-80 p-0", align: "end", children: [_jsxs("div", { className: "px-3 py-2 border-b border-border flex items-center justify-between", children: [_jsx("div", { className: "text-xs font-semibold text-text-primary uppercase tracking-wider", children: "Alerts" }), _jsxs("span", { className: "text-xs text-text-muted tabular-nums", children: [unackedCount, " active"] })] }), _jsx("ul", { className: "max-h-96 overflow-y-auto divide-y divide-border-subtle", children: active.length === 0 ? (_jsx("li", { className: "px-3 py-6 text-center text-xs text-text-muted", children: "All clear." })) : (active.map((a) => (_jsxs("li", { className: "px-3 py-2.5", children: [_jsxs("div", { className: "flex items-start gap-2", children: [_jsx("div", { className: cn("h-6 w-6 rounded-full flex items-center justify-center shrink-0", intentClass(a.intent)), children: _jsx(Bell, { className: "h-3 w-3" }) }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("button", { type: "button", onClick: () => onOpen?.(a), className: "text-sm font-medium text-text-primary text-left hover:underline", children: a.title }), a.body && (_jsx("div", { className: "text-xs text-text-secondary mt-0.5", children: a.body })), _jsxs("div", { className: "flex items-center gap-2 mt-1.5", children: [_jsx("span", { className: "text-xs text-text-muted", children: new Date(a.createdAt).toLocaleTimeString() }), a.source && (_jsx(Badge, { intent: a.intent === "danger" ? "danger" : "info", children: a.source }))] })] })] }), _jsxs("div", { className: "flex items-center gap-1.5 mt-2", children: [_jsx(Button, { variant: "ghost", size: "sm", iconLeft: _jsx(Check, { className: "h-3 w-3" }), onClick: () => onAck(a.id), children: "Acknowledge" }), onSnooze && (_jsx(Button, { variant: "ghost", size: "sm", onClick: () => onSnooze(a.id, 60), children: "Snooze 1h" })), onDismiss && (_jsx("button", { type: "button", onClick: () => onDismiss(a.id), className: "ml-auto h-6 w-6 flex items-center justify-center rounded hover:bg-surface-2 text-text-muted", "aria-label": "Dismiss", children: _jsx(X, { className: "h-3 w-3" }) }))] })] }, a.id)))) })] })] }));
}
