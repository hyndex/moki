import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Play, Plus, Settings2, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./Card";
import { StatusDot } from "./StatusDot";
import { Button } from "@/primitives/Button";
import { Badge } from "@/primitives/Badge";
import { useRuntime } from "@/runtime/context";
export function AutomationHookPanel({ title = "Automation", hooks, onConfigure, onRun, onCreate, }) {
    const { analytics } = useRuntime();
    const handleRun = (hook) => {
        onRun?.(hook.id);
        analytics.emit("page.action.invoked", {
            actionId: `automation.run:${hook.id}`,
            placement: "panel",
            recordCount: 1,
        });
    };
    return (_jsxs(Card, { children: [_jsx(CardHeader, { children: _jsxs("div", { className: "flex items-center justify-between w-full", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Zap, { className: "h-3.5 w-3.5 text-text-muted" }), _jsx(CardTitle, { children: title })] }), onCreate && (_jsx(Button, { variant: "ghost", size: "sm", onClick: onCreate, iconLeft: _jsx(Plus, { className: "h-3 w-3" }), children: "New" }))] }) }), _jsx(CardContent, { className: "p-0", children: hooks.length === 0 ? (_jsx("div", { className: "px-3 py-4 text-xs text-text-muted", children: "No automations bound to this record." })) : (_jsx("ul", { className: "divide-y divide-border-subtle", children: hooks.map((h) => (_jsxs("li", { className: "flex items-center gap-3 px-3 py-2.5 group", children: [_jsx(StatusDot, { intent: h.enabled ? h.lastRunIntent ?? "success" : "neutral" }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("div", { className: "text-sm font-medium text-text-primary truncate", children: h.label }), _jsxs("div", { className: "text-xs text-text-muted truncate", children: ["on ", _jsx("code", { className: "font-mono text-text-secondary", children: h.trigger }), h.runs24h !== undefined && ` · ${h.runs24h} runs 24h`] })] }), !h.enabled && _jsx(Badge, { intent: "neutral", children: "disabled" }), onRun && (_jsx("button", { type: "button", onClick: () => handleRun(h), className: "h-6 w-6 flex items-center justify-center rounded hover:bg-surface-2 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity", "aria-label": "Run now", children: _jsx(Play, { className: "h-3 w-3" }) })), onConfigure && (_jsx("button", { type: "button", onClick: () => onConfigure(h.id), className: "h-6 w-6 flex items-center justify-center rounded hover:bg-surface-2 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity", "aria-label": "Configure", children: _jsx(Settings2, { className: "h-3 w-3" }) }))] }, h.id))) })) })] }));
}
