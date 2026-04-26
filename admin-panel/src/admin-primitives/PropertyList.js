import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import * as React from "react";
import { cn } from "@/lib/cn";
export function PropertyList({ items, columns = 1, className, }) {
    return (_jsx("dl", { className: cn("grid gap-y-2.5 text-sm", columns === 2
            ? "grid-cols-[auto_minmax(0,1fr)] gap-x-6 lg:grid-cols-[auto_minmax(0,1fr)_auto_minmax(0,1fr)]"
            : "grid-cols-[auto_minmax(0,1fr)] gap-x-6", className), children: items.map((item, i) => (_jsxs(React.Fragment, { children: [_jsx("dt", { className: "text-text-muted whitespace-nowrap", children: item.label }), _jsx("dd", { className: "text-text-primary break-words min-w-0", children: item.value })] }, i))) }));
}
