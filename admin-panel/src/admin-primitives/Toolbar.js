import { jsx as _jsx } from "react/jsx-runtime";
import { cn } from "@/lib/cn";
export function Toolbar({ className, children, ...props }) {
    return (_jsx("div", { className: cn("flex items-center gap-2 flex-wrap", className), role: "toolbar", ...props, children: children }));
}
export function ToolbarSeparator({ className }) {
    return (_jsx("div", { className: cn("h-4 w-px bg-border mx-1", className), role: "separator", "aria-orientation": "vertical" }));
}
