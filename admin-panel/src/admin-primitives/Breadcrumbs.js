import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import * as React from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";
export function Breadcrumbs({ items, className, }) {
    return (_jsx("nav", { "aria-label": "Breadcrumb", className: cn("flex items-center gap-1 text-xs text-text-muted", className), children: items.map((c, i) => {
            const isLast = i === items.length - 1;
            return (_jsxs(React.Fragment, { children: [c.path && !isLast ? (_jsx("a", { href: `#${c.path}`, className: "hover:text-text-primary transition-colors", children: c.label })) : (_jsx("span", { className: cn(isLast && "text-text-secondary"), children: c.label })), !isLast && _jsx(ChevronRight, { className: "h-3 w-3 opacity-50" })] }, i));
        }) }));
}
