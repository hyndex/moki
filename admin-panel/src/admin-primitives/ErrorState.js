import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/primitives/Button";
import { cn } from "@/lib/cn";
export function ErrorState({ title = "Something went wrong", description, error, onRetry, className, }) {
    const message = description ??
        (error instanceof Error
            ? error.message
            : typeof error === "string"
                ? error
                : "Unable to load this view.");
    return (_jsxs("div", { role: "alert", className: cn("flex flex-col items-center justify-center gap-3 py-10 text-center", "border border-intent-danger/30 bg-intent-danger-bg/40 rounded-lg", className), children: [_jsx("div", { className: "flex h-10 w-10 items-center justify-center rounded-full bg-intent-danger/10 text-intent-danger", children: _jsx(AlertTriangle, { className: "h-5 w-5" }) }), _jsxs("div", { children: [_jsx("div", { className: "text-sm font-medium text-text-primary", children: title }), _jsx("div", { className: "text-xs text-text-muted max-w-md mt-0.5", children: message })] }), onRetry && (_jsx(Button, { size: "sm", variant: "secondary", onClick: onRetry, children: "Retry" }))] }));
}
