import { jsx as _jsx } from "react/jsx-runtime";
import { cn } from "@/lib/cn";
const INTENT_CLASS = {
    neutral: "bg-surface-3",
    success: "bg-intent-success",
    warning: "bg-intent-warning",
    danger: "bg-intent-danger",
    info: "bg-intent-info",
    accent: "bg-accent",
};
export function StatusDot({ intent = "neutral", pulse = false, className, }) {
    return (_jsx("span", { className: cn("inline-block w-2 h-2 rounded-full shrink-0", INTENT_CLASS[intent], pulse && "animate-pulse", className), "aria-hidden": true }));
}
