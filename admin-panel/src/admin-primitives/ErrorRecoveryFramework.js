import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import * as React from "react";
import { AlertTriangle, Copy, LifeBuoy, RotateCcw } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/primitives/Button";
export function ErrorRecoveryFramework({ message, code, requestId, onRetry, onReport, onContactOwner, onReload, className, }) {
    const [copied, setCopied] = React.useState(false);
    const copyRequestId = async () => {
        if (!requestId)
            return;
        try {
            await navigator.clipboard.writeText(requestId);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        }
        catch {
            /* clipboard may be unavailable */
        }
    };
    return (_jsxs("div", { role: "alert", className: cn("flex flex-col items-center gap-4 py-10 px-6 text-center", className), children: [_jsx("div", { className: "flex h-12 w-12 items-center justify-center rounded-full bg-intent-danger-bg text-intent-danger", children: _jsx(AlertTriangle, { className: "h-6 w-6" }) }), _jsxs("div", { className: "max-w-md", children: [_jsx("div", { className: "text-sm font-medium text-text-primary", children: message }), (code || requestId) && (_jsxs("div", { className: "mt-2 flex items-center justify-center gap-2 text-xs font-mono text-text-muted", children: [code && _jsx("code", { className: "bg-surface-2 rounded px-1.5 py-0.5", children: code }), requestId && (_jsxs("button", { type: "button", onClick: copyRequestId, className: "inline-flex items-center gap-1 hover:text-text-primary transition-colors", "aria-label": "Copy request ID", children: [_jsx(Copy, { className: "h-3 w-3" }), copied ? "Copied" : requestId] }))] }))] }), _jsxs("div", { className: "flex flex-wrap items-center justify-center gap-2", children: [onRetry && (_jsx(Button, { variant: "primary", size: "sm", onClick: onRetry, iconLeft: _jsx(RotateCcw, { className: "h-3.5 w-3.5" }), children: "Retry" })), onReport && (_jsx(Button, { variant: "ghost", size: "sm", onClick: onReport, iconLeft: _jsx(LifeBuoy, { className: "h-3.5 w-3.5" }), children: "Report" })), onContactOwner && (_jsx(Button, { variant: "ghost", size: "sm", onClick: onContactOwner, children: "Contact owner" })), onReload && (_jsx(Button, { variant: "ghost", size: "sm", onClick: onReload, children: "Reload page" }))] })] }));
}
