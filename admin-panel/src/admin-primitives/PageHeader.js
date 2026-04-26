import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { cn } from "@/lib/cn";
export function PageHeader({ title, description, breadcrumbs, actions, className, }) {
    return (_jsxs("header", { className: cn("flex flex-col gap-2 pb-4 border-b border-border-subtle", className), children: [breadcrumbs, _jsxs("div", { className: "flex items-start justify-between gap-4", children: [_jsxs("div", { className: "min-w-0", children: [_jsx("h1", { className: "text-xl font-semibold text-text-primary truncate", children: title }), description && (_jsx("p", { className: "text-sm text-text-muted mt-0.5", children: description }))] }), actions && (_jsx("div", { className: "flex items-center gap-2 shrink-0", children: actions }))] })] }));
}
