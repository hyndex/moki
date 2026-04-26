import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import * as React from "react";
import { Check, CircleDot } from "lucide-react";
import { cn } from "@/lib/cn";
export function WorkflowStepper({ steps, activeId, orientation = "horizontal", onStepClick, className, }) {
    const effectiveSteps = React.useMemo(() => {
        if (!activeId)
            return steps;
        const activeIdx = steps.findIndex((s) => s.id === activeId);
        return steps.map((s, i) => {
            if (s.status)
                return s;
            if (i < activeIdx)
                return { ...s, status: "completed" };
            if (i === activeIdx)
                return { ...s, status: "active" };
            return { ...s, status: "pending" };
        });
    }, [steps, activeId]);
    return (_jsx("ol", { className: cn(orientation === "horizontal"
            ? "flex items-start gap-0 w-full"
            : "flex flex-col gap-0", className), "aria-label": "Workflow", children: effectiveSteps.map((s, i) => {
            const isLast = i === effectiveSteps.length - 1;
            const status = s.status ?? "pending";
            return (_jsxs("li", { className: cn(orientation === "horizontal" ? "flex-1 flex items-start" : "flex items-start gap-3", !isLast && orientation === "horizontal" && "relative"), children: [_jsxs("button", { type: "button", disabled: !onStepClick, onClick: () => onStepClick?.(s.id), className: cn("flex items-start gap-2 text-left shrink-0", onStepClick && "cursor-pointer hover:opacity-80", !onStepClick && "cursor-default"), "aria-current": status === "active" ? "step" : undefined, children: [_jsx("div", { className: cn("h-6 w-6 rounded-full flex items-center justify-center shrink-0 mt-0.5", status === "completed" && "bg-intent-success text-white", status === "active" && "bg-accent text-accent-fg", status === "error" && "bg-intent-danger text-white", status === "skipped" && "bg-surface-2 text-text-muted", status === "pending" && "bg-surface-2 text-text-muted"), children: status === "completed" ? (_jsx(Check, { className: "h-3 w-3" })) : status === "active" ? (_jsx(CircleDot, { className: "h-3 w-3" })) : (_jsx("span", { className: "text-xs tabular-nums font-semibold", children: i + 1 })) }), _jsxs("div", { className: "min-w-0", children: [_jsx("div", { className: cn("text-xs font-medium", status === "active" && "text-text-primary", status === "pending" && "text-text-muted", status === "completed" && "text-text-primary"), children: s.label }), s.description && (_jsx("div", { className: "text-xs text-text-muted mt-0.5", children: s.description }))] })] }), !isLast && (_jsx("div", { className: cn(orientation === "horizontal"
                            ? "flex-1 h-px mt-3 mx-2"
                            : "w-px flex-1 ml-3 my-1", status === "completed" ? "bg-intent-success" : "bg-border") }))] }, s.id));
        }) }));
}
