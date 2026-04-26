import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Sparkles, Check, X, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./Card";
import { Button } from "@/primitives/Button";
import { Badge } from "@/primitives/Badge";
import { useRuntime } from "@/runtime/context";
export function AIInsightPanel({ title = "AI insights", insights, loading, onDismiss, className, }) {
    const { analytics } = useRuntime();
    const handleApply = (insight, actionId, handler) => {
        handler();
        analytics.emit("page.ai.applied", { actionId });
        void insight;
    };
    return (_jsxs(Card, { className: className, children: [_jsx(CardHeader, { children: _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Sparkles, { className: "h-3.5 w-3.5 text-accent" }), _jsx(CardTitle, { children: title })] }) }), _jsx(CardContent, { className: "p-0", children: loading ? (_jsx("div", { className: "px-3 py-4 text-xs text-text-muted", children: "Generating insights\u2026" })) : insights.length === 0 ? (_jsx("div", { className: "px-3 py-4 text-xs text-text-muted", children: "No insights \u2014 this record looks normal." })) : (_jsx("ul", { className: "divide-y divide-border-subtle", children: insights.map((ins) => (_jsxs("li", { className: "px-3 py-2.5", children: [_jsxs("div", { className: "flex items-start justify-between gap-2", children: [_jsxs("div", { className: "flex-1", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: "text-sm font-medium text-text-primary", children: ins.title }), ins.confidence !== undefined && ins.confidence < 0.6 && (_jsxs(Badge, { intent: "warning", children: [Math.round(ins.confidence * 100), "% confidence"] }))] }), _jsx("div", { className: "text-sm text-text-secondary mt-1", children: ins.body }), ins.citations && ins.citations.length > 0 && (_jsx("div", { className: "flex flex-wrap items-center gap-2 mt-2", children: ins.citations.map((c, i) => (_jsxs("a", { href: c.href, className: "inline-flex items-center gap-1 text-xs text-accent hover:underline", children: [_jsx(ExternalLink, { className: "h-3 w-3" }), c.label] }, i))) }))] }), onDismiss && (_jsx("button", { type: "button", onClick: () => onDismiss(ins.id), className: "h-6 w-6 flex items-center justify-center rounded hover:bg-surface-2 text-text-muted", "aria-label": "Dismiss insight", children: _jsx(X, { className: "h-3 w-3" }) }))] }), ins.actions && ins.actions.length > 0 && (_jsx("div", { className: "flex items-center gap-1.5 mt-2", children: ins.actions.map((a) => (_jsx(Button, { variant: a.intent === "primary" ? "primary" : "ghost", size: "sm", onClick: () => handleApply(ins, a.id, a.onClick), iconLeft: a.intent === "primary" ? _jsx(Check, { className: "h-3 w-3" }) : undefined, children: a.label }, a.id))) }))] }, ins.id))) })) })] }));
}
