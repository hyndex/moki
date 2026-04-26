import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/primitives/Button";
const INTENT_CLASS = {
    neutral: "bg-surface-2 text-text-secondary",
    accent: "bg-accent-subtle text-accent",
    success: "bg-intent-success-bg text-intent-success",
    warning: "bg-intent-warning-bg text-intent-warning",
    danger: "bg-intent-danger-bg text-intent-danger",
    info: "bg-intent-info-bg text-intent-info",
};
/** Month-grid calendar — read-only, good for surfacing bookings / jobs /
 *  field-service visits. The primitive stays dumb: events come in, clicks go
 *  out. No time-zone magic. */
export function Calendar({ events, className, onEventClick }) {
    const [cursor, setCursor] = React.useState(() => startOfMonth(new Date()));
    const monthLabel = cursor.toLocaleDateString(undefined, {
        month: "long",
        year: "numeric",
    });
    const grid = React.useMemo(() => buildMonthGrid(cursor), [cursor]);
    const byDay = React.useMemo(() => {
        const map = new Map();
        for (const e of events) {
            const d = new Date(e.date);
            const key = ymd(d);
            const arr = map.get(key) ?? [];
            arr.push(e);
            map.set(key, arr);
        }
        return map;
    }, [events]);
    return (_jsxs("div", { className: cn("flex flex-col gap-2 bg-surface-0 border border-border rounded-lg p-3", className), children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("h3", { className: "text-sm font-semibold text-text-primary", children: monthLabel }), _jsxs("div", { className: "flex items-center gap-1", children: [_jsx(Button, { size: "sm", variant: "ghost", onClick: () => setCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1)), "aria-label": "Previous month", children: _jsx(ChevronLeft, { className: "h-3.5 w-3.5" }) }), _jsx(Button, { size: "sm", variant: "ghost", onClick: () => setCursor(startOfMonth(new Date())), children: "Today" }), _jsx(Button, { size: "sm", variant: "ghost", onClick: () => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1)), "aria-label": "Next month", children: _jsx(ChevronRight, { className: "h-3.5 w-3.5" }) })] })] }), _jsx("div", { className: "grid grid-cols-7 text-[10px] font-medium uppercase text-text-muted", children: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (_jsx("div", { className: "px-1 py-1", children: d }, d))) }), _jsx("div", { className: "grid grid-cols-7 gap-px bg-border rounded-md overflow-hidden", children: grid.map((d, i) => {
                    const isCur = d.getMonth() === cursor.getMonth();
                    const isToday = ymd(d) === ymd(new Date());
                    const items = byDay.get(ymd(d)) ?? [];
                    return (_jsxs("div", { className: cn("min-h-[72px] bg-surface-0 p-1.5 flex flex-col gap-0.5", !isCur && "bg-surface-1"), children: [_jsx("div", { className: cn("text-[10px] font-medium", isCur ? "text-text-secondary" : "text-text-muted", isToday && "text-accent"), children: d.getDate() }), items.slice(0, 3).map((e) => (_jsx("button", { type: "button", onClick: () => onEventClick?.(e), className: cn("text-[10px] text-left truncate rounded px-1 py-0.5", INTENT_CLASS[e.intent ?? "neutral"], "hover:opacity-80"), title: e.title, children: e.title }, e.id))), items.length > 3 && (_jsxs("div", { className: "text-[10px] text-text-muted", children: ["+", items.length - 3, " more"] }))] }, i));
                }) })] }));
}
function startOfMonth(d) {
    return new Date(d.getFullYear(), d.getMonth(), 1);
}
function ymd(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function buildMonthGrid(cursor) {
    const first = startOfMonth(cursor);
    const startWeekday = first.getDay();
    const start = new Date(first.getFullYear(), first.getMonth(), 1 - startWeekday);
    return Array.from({ length: 42 }, (_, i) => {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        return d;
    });
}
