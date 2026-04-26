import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import * as React from "react";
import { Activity } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./Card";
import { StatusDot } from "./StatusDot";
import { Sparkline } from "./charts/Sparkline";
import { cn } from "@/lib/cn";
function classifyIntent(latest, warn, danger, invert) {
    if (warn === undefined && danger === undefined)
        return "success";
    const isAbove = (a, b) => b !== undefined && (invert ? a <= b : a >= b);
    if (isAbove(latest, danger))
        return "danger";
    if (isAbove(latest, warn))
        return "warning";
    return "success";
}
export function HealthMonitorWidget({ title, windowLabel = "last 60 min", series, className, }) {
    const overall = React.useMemo(() => {
        const intents = series.map((s) => {
            const latest = s.data[s.data.length - 1] ?? 0;
            return classifyIntent(latest, s.warn, s.danger, s.invert);
        });
        if (intents.includes("danger"))
            return "danger";
        if (intents.includes("warning"))
            return "warning";
        return "success";
    }, [series]);
    return (_jsxs(Card, { className: className, children: [_jsx(CardHeader, { children: _jsxs("div", { className: "flex items-center justify-between w-full", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Activity, { className: "h-3.5 w-3.5 text-text-muted" }), _jsx(CardTitle, { children: title })] }), _jsxs("div", { className: "flex items-center gap-2 text-xs text-text-muted", children: [_jsx(StatusDot, { intent: overall }), _jsx("span", { children: windowLabel })] })] }) }), _jsx(CardContent, { children: _jsx("ul", { className: "divide-y divide-border-subtle", children: series.map((s) => {
                        const latest = s.data[s.data.length - 1] ?? 0;
                        const intent = classifyIntent(latest, s.warn, s.danger, s.invert);
                        return (_jsxs("li", { className: "flex items-center gap-3 py-2 first:pt-0 last:pb-0", children: [_jsx(StatusDot, { intent: intent }), _jsx("span", { className: "flex-1 text-sm text-text-primary", children: s.label }), _jsx(Sparkline, { data: s.data, color: intent === "danger"
                                        ? "rgb(var(--intent-danger))"
                                        : intent === "warning"
                                            ? "rgb(var(--intent-warning))"
                                            : "rgb(var(--intent-success))" }), _jsx("span", { className: cn("text-xs tabular-nums w-20 text-right", intent === "danger" && "text-intent-danger", intent === "warning" && "text-intent-warning", intent === "success" && "text-text-primary"), children: s.format ? s.format(latest) : latest })] }, s.label));
                    }) }) })] }));
}
