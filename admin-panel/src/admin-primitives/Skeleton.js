import { jsx as _jsx } from "react/jsx-runtime";
import { cn } from "@/lib/cn";
export function Skeleton({ className }) {
    return (_jsx("div", { className: cn("relative overflow-hidden rounded-sm bg-surface-2", "after:absolute after:inset-0 after:-translate-x-full", "after:bg-gradient-to-r after:from-transparent after:via-surface-3/60 after:to-transparent", "after:animate-[shimmer_1.6s_infinite]", className), style: {
        // inline keyframes avoid a tailwind plugin dependency
        // (tailwind doesn't ship `shimmer` by default)
        } }));
}
