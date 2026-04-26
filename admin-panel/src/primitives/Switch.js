import { jsx as _jsx } from "react/jsx-runtime";
import * as React from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cn } from "@/lib/cn";
export const Switch = React.forwardRef(({ className, ...props }, ref) => (_jsx(SwitchPrimitive.Root, { ref: ref, className: cn("peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center", "rounded-full border-2 border-transparent transition-colors", "focus-visible:outline-none focus-visible:shadow-focus", "data-[state=checked]:bg-accent data-[state=unchecked]:bg-surface-3", "disabled:cursor-not-allowed disabled:opacity-50", className), ...props, children: _jsx(SwitchPrimitive.Thumb, { className: cn("pointer-events-none block h-4 w-4 rounded-full bg-white shadow-sm", "transition-transform", "data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0") }) })));
Switch.displayName = "Switch";
