import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { cn } from "@/lib/cn";
import { Badge } from "@/primitives/Badge";
/** Static kanban board — groups items into columns by status.
 *  Drag-to-reorder is intentionally omitted: HTML5 DnD is fiddly and a real
 *  implementation should use dnd-kit. This renders the visual + counts. */
export function Kanban({ columns, renderItem, onItemClick, rowKey = (t) => String(t.id ?? Math.random()), className, }) {
    return (_jsx("div", { className: cn("grid gap-3 overflow-x-auto pb-2", "grid-cols-[repeat(auto-fit,minmax(240px,1fr))]", className), role: "list", children: columns.map((col) => (_jsxs("section", { className: "flex flex-col gap-2 bg-surface-1 border border-border rounded-lg p-2 min-h-[180px]", "aria-label": col.title, children: [_jsx("header", { className: "flex items-center justify-between px-1", children: _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "text-xs font-semibold uppercase tracking-wider text-text-secondary", children: col.title }), _jsx(Badge, { intent: col.intent ?? "neutral", children: col.items.length })] }) }), _jsx("div", { className: "flex flex-col gap-2", children: col.items.length === 0 ? (_jsx("div", { className: "text-center text-xs text-text-muted py-4", children: "Nothing here" })) : (col.items.map((item) => (_jsx("button", { type: "button", className: cn("text-left bg-surface-0 border border-border rounded-md p-2 text-sm", "transition-colors hover:border-accent hover:shadow-xs", "focus-visible:outline-none focus-visible:shadow-focus"), onClick: () => onItemClick?.(item), children: renderItem(item) }, rowKey(item))))) })] }, col.id))) }));
}
