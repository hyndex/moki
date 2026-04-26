import { jsx as _jsx } from "react/jsx-runtime";
import { cn } from "@/lib/cn";
export function Separator({ orientation = "horizontal", className, }) {
    return (_jsx("div", { role: "separator", className: cn("bg-border", orientation === "horizontal" ? "h-px w-full" : "w-px h-full", className) }));
}
