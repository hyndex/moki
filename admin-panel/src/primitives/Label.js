import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";
import { cn } from "@/lib/cn";
export const Label = React.forwardRef(({ className, required, children, ...props }, ref) => (_jsxs(LabelPrimitive.Root, { ref: ref, className: cn("text-sm font-medium text-text-secondary leading-none", "peer-disabled:cursor-not-allowed peer-disabled:opacity-50", className), ...props, children: [children, required ? (_jsx("span", { className: "text-intent-danger ml-0.5", "aria-hidden": true, children: "*" })) : null] })));
Label.displayName = "Label";
