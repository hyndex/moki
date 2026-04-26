import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { cn } from "@/lib/cn";
import { Avatar } from "./Avatar";
export function AvatarGroup({ names, max = 4, size = "sm", className }) {
    const shown = names.slice(0, max);
    const rest = names.length - shown.length;
    return (_jsxs("span", { className: cn("inline-flex items-center -space-x-1.5", className), children: [shown.map((n, i) => (_jsx(Avatar, { name: n, size: size, className: "ring-2 ring-surface-0" }, i))), rest > 0 && (_jsxs("span", { className: cn("inline-flex items-center justify-center rounded-full ring-2 ring-surface-0", "bg-surface-3 text-text-secondary font-semibold", size === "xs" && "w-5 h-5 text-[9px]", size === "sm" && "w-6 h-6 text-[10px]", size === "md" && "w-8 h-8 text-xs", size === "lg" && "w-10 h-10 text-sm", size === "xl" && "w-14 h-14 text-base"), children: ["+", rest] }))] }));
}
