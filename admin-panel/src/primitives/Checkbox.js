import { jsx as _jsx } from "react/jsx-runtime";
import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/cn";
export const Checkbox = React.forwardRef(({ className, ...props }, ref) => (_jsx(CheckboxPrimitive.Root, { ref: ref, className: cn("peer h-4 w-4 shrink-0 rounded-sm border border-border-strong", "bg-surface-0 transition-colors duration-fast", "data-[state=checked]:bg-accent data-[state=checked]:text-accent-fg data-[state=checked]:border-accent", "data-[state=indeterminate]:bg-accent data-[state=indeterminate]:text-accent-fg data-[state=indeterminate]:border-accent", "focus-visible:outline-none focus-visible:shadow-focus", "disabled:cursor-not-allowed disabled:opacity-50", className), ...props, children: _jsx(CheckboxPrimitive.Indicator, { className: cn("flex items-center justify-center"), children: props.checked === "indeterminate" ? (_jsx(Minus, { className: "h-3 w-3" })) : (_jsx(Check, { className: "h-3 w-3", strokeWidth: 3 })) }) })));
Checkbox.displayName = "Checkbox";
