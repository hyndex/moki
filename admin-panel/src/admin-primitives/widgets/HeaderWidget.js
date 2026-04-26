import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { cn } from "@/lib/cn";
export function HeaderWidget({ widget }) {
    const level = widget.level ?? 2;
    const Tag = `h${level + 1}`;
    return (_jsxs("div", { className: "flex flex-col gap-0.5", children: [_jsx(Tag, { className: cn("text-text-primary font-semibold tracking-tight", level === 1 && "text-lg", level === 2 && "text-sm uppercase tracking-wider text-text-muted font-medium", level === 3 && "text-xs uppercase tracking-wider text-text-muted"), children: widget.label }), widget.description && (_jsx("p", { className: "text-sm text-text-muted", children: widget.description }))] }));
}
