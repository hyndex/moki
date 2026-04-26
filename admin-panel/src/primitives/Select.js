import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/cn";
export const Select = SelectPrimitive.Root;
export const SelectValue = SelectPrimitive.Value;
export const SelectGroup = SelectPrimitive.Group;
export const SelectTrigger = React.forwardRef(({ className, children, invalid, ...props }, ref) => (_jsxs(SelectPrimitive.Trigger, { ref: ref, className: cn("flex h-field-h w-full items-center justify-between rounded-md border bg-surface-0", "px-2.5 text-sm outline-none transition-colors", "focus:shadow-focus focus:border-accent", "disabled:cursor-not-allowed disabled:opacity-50", "data-[placeholder]:text-text-muted", invalid ? "border-intent-danger" : "border-border", className), ...props, children: [children, _jsx(SelectPrimitive.Icon, { asChild: true, children: _jsx(ChevronDown, { className: "h-4 w-4 opacity-60" }) })] })));
SelectTrigger.displayName = "SelectTrigger";
export const SelectContent = React.forwardRef(({ className, children, position = "popper", ...props }, ref) => (_jsx(SelectPrimitive.Portal, { children: _jsxs(SelectPrimitive.Content, { ref: ref, className: cn("relative z-50 min-w-[8rem] overflow-hidden rounded-md border border-border", "bg-surface-0 text-text-primary shadow-lg animate-scale-in", position === "popper" &&
            "data-[side=bottom]:translate-y-1 data-[side=top]:-translate-y-1", className), position: position, ...props, children: [_jsx(SelectPrimitive.ScrollUpButton, { className: "flex h-6 items-center justify-center", children: _jsx(ChevronUp, { className: "h-4 w-4" }) }), _jsx(SelectPrimitive.Viewport, { className: "p-1", children: children }), _jsx(SelectPrimitive.ScrollDownButton, { className: "flex h-6 items-center justify-center", children: _jsx(ChevronDown, { className: "h-4 w-4" }) })] }) })));
SelectContent.displayName = "SelectContent";
export const SelectItem = React.forwardRef(({ className, children, ...props }, ref) => (_jsxs(SelectPrimitive.Item, { ref: ref, className: cn("relative flex cursor-pointer select-none items-center rounded-sm", "py-1.5 pl-8 pr-2 text-sm outline-none", "focus:bg-surface-2", "data-[disabled]:pointer-events-none data-[disabled]:opacity-50", className), ...props, children: [_jsx("span", { className: "absolute left-2 flex h-3.5 w-3.5 items-center justify-center", children: _jsx(SelectPrimitive.ItemIndicator, { children: _jsx(Check, { className: "h-4 w-4" }) }) }), _jsx(SelectPrimitive.ItemText, { children: children })] })));
SelectItem.displayName = "SelectItem";
export const SelectSeparator = React.forwardRef(({ className, ...props }, ref) => (_jsx(SelectPrimitive.Separator, { ref: ref, className: cn("-mx-1 my-1 h-px bg-border", className), ...props })));
SelectSeparator.displayName = "SelectSeparator";
