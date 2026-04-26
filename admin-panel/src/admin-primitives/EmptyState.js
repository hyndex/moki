import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { cn } from "@/lib/cn";
import { Inbox } from "lucide-react";
export function EmptyState({ icon, title, description, action, className, }) {
    return (_jsxs("div", { className: cn("flex flex-col items-center justify-center gap-3 py-10 text-center", className), children: [_jsx("div", { className: "flex h-12 w-12 items-center justify-center rounded-full bg-surface-2 text-text-muted", children: icon ?? _jsx(Inbox, { className: "h-6 w-6" }) }), _jsxs("div", { children: [_jsx("div", { className: "text-sm font-medium text-text-primary", children: title }), description && (_jsx("div", { className: "text-sm text-text-muted mt-0.5 max-w-sm", children: description }))] }), action] }));
}
