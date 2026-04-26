import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { ChevronRight } from "lucide-react";
import * as Icons from "lucide-react";
import { Card, CardContent } from "../Card";
import { useAggregation } from "@/runtime/useAggregation";
import { formatValue } from "./formatters";
import { cn } from "@/lib/cn";
function Icon({ name }) {
    if (!name)
        return null;
    const C = Icons[name];
    if (!C)
        return null;
    return _jsx(C, { className: "h-4 w-4 text-text-muted" });
}
export function ShortcutCardWidget({ widget }) {
    const { data } = useAggregation(widget.aggregation ?? null);
    const showStat = Boolean(widget.aggregation);
    return (_jsx(Card, { className: "h-full cursor-pointer hover:border-accent/50 transition-colors", onClick: () => (window.location.hash = widget.href), children: _jsxs(CardContent, { className: "flex flex-col gap-2 py-4", children: [_jsxs("div", { className: "flex items-start gap-2", children: [_jsx(Icon, { name: widget.icon }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("div", { className: "text-sm font-medium text-text-primary truncate", children: widget.label }), widget.description && (_jsx("div", { className: "text-xs text-text-muted mt-0.5 line-clamp-2", children: widget.description }))] }), _jsx(ChevronRight, { className: "h-4 w-4 text-text-muted" })] }), showStat && data && (_jsx("div", { className: cn("text-lg font-semibold tabular-nums text-text-primary", widget.intent === "danger" && "text-intent-danger", widget.intent === "warning" && "text-intent-warning", widget.intent === "success" && "text-intent-success"), children: formatValue(data.value, "compact") }))] }) }));
}
