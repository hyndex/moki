import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { cn } from "@/lib/cn";
/** Pill-style quick-filter strip — for top-of-list filters like
 *  "All · Active · Archived · Mine". */
export function QuickFilterBar({ filters, active, onChange, className, }) {
    return (_jsx("div", { className: cn("inline-flex items-center gap-1 p-1 rounded-md bg-surface-2", className), children: filters.map((f) => {
            const isActive = f.id === active;
            return (_jsxs("button", { type: "button", onClick: () => onChange(f.id), className: cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-sm font-medium transition-colors", isActive
                    ? "bg-surface-0 text-text-primary shadow-xs"
                    : "text-text-secondary hover:text-text-primary"), children: [f.label, f.count !== undefined && (_jsx("span", { className: cn("tabular-nums text-xs", isActive ? "text-text-muted" : "text-text-muted"), children: f.count }))] }, f.id));
        }) }));
}
