import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { cn } from "@/lib/cn";
import { Avatar } from "@/primitives/Avatar";
export function DetailHeader({ title, subtitle, avatar, badges, breadcrumbs, meta, actions, className, }) {
    return (_jsxs("header", { className: cn("flex flex-col gap-3 pb-4 border-b border-border-subtle", className), children: [breadcrumbs, _jsxs("div", { className: "flex items-start gap-4", children: [avatar && _jsx(Avatar, { name: avatar.name, src: avatar.src, size: "xl" }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsxs("div", { className: "flex items-center gap-2 flex-wrap", children: [_jsx("h1", { className: "text-xl font-semibold text-text-primary truncate", children: title }), badges] }), subtitle && (_jsx("div", { className: "text-sm text-text-secondary mt-0.5", children: subtitle })), meta && (_jsx("div", { className: "text-xs text-text-muted mt-2 flex flex-wrap items-center gap-3", children: meta }))] }), actions && (_jsx("div", { className: "flex items-center gap-2 shrink-0", children: actions }))] })] }));
}
