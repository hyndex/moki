import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import * as React from "react";
import { cn } from "@/lib/cn";
export const Input = React.forwardRef(({ className, invalid, prefix, suffix, ...props }, ref) => {
    if (prefix || suffix) {
        return (_jsxs("div", { className: cn("flex items-stretch bg-surface-0 border rounded-md transition-colors", "focus-within:shadow-focus focus-within:border-accent", invalid ? "border-intent-danger" : "border-border"), children: [prefix && (_jsx("span", { className: "flex items-center pl-2 text-text-muted", children: prefix })), _jsx("input", { ref: ref, className: cn("flex-1 min-w-0 bg-transparent h-field-h px-2.5 text-sm outline-none", "placeholder:text-text-muted", "disabled:opacity-50 disabled:cursor-not-allowed", className), "aria-invalid": invalid || undefined, ...props }), suffix && (_jsx("span", { className: "flex items-center pr-2 text-text-muted", children: suffix }))] }));
    }
    return (_jsx("input", { ref: ref, className: cn("w-full bg-surface-0 border rounded-md h-field-h px-2.5 text-sm outline-none", "placeholder:text-text-muted transition-colors", "focus:shadow-focus focus:border-accent", "disabled:opacity-50 disabled:cursor-not-allowed", invalid ? "border-intent-danger" : "border-border", className), "aria-invalid": invalid || undefined, ...props }));
});
Input.displayName = "Input";
