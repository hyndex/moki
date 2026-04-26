import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { cn } from "@/lib/cn";
import { formatRelative } from "@/lib/format";
const INTENT_DOT = {
    neutral: "bg-surface-3",
    accent: "bg-accent",
    success: "bg-intent-success",
    warning: "bg-intent-warning",
    danger: "bg-intent-danger",
    info: "bg-intent-info",
};
export function Timeline({ items, className, }) {
    return (_jsxs("ol", { className: cn("relative flex flex-col gap-3 pl-5", className), children: [_jsx("span", { className: "absolute left-2 top-1 bottom-1 w-px bg-border", "aria-hidden": true }), items.map((it) => (_jsxs("li", { className: "relative", children: [_jsx("span", { className: cn("absolute -left-3.5 top-1.5 h-2 w-2 rounded-full ring-4 ring-surface-0", INTENT_DOT[it.intent ?? "neutral"]), "aria-hidden": true }), _jsxs("div", { className: "flex flex-col gap-0.5", children: [_jsxs("div", { className: "text-sm text-text-primary flex items-center gap-2", children: [it.icon, _jsx("span", { className: "min-w-0 truncate", children: it.title }), _jsx("span", { className: "ml-auto text-xs text-text-muted shrink-0", children: formatRelative(it.occurredAt) })] }), it.description && (_jsx("div", { className: "text-xs text-text-muted", children: it.description }))] })] }, it.id)))] }));
}
