import { jsx as _jsx } from "react/jsx-runtime";
import * as React from "react";
import { cn } from "@/lib/cn";
export const Textarea = React.forwardRef(({ className, invalid, rows = 4, ...props }, ref) => (_jsx("textarea", { ref: ref, rows: rows, className: cn("w-full bg-surface-0 border rounded-md px-2.5 py-1.5 text-sm outline-none resize-y", "placeholder:text-text-muted transition-colors", "focus:shadow-focus focus:border-accent", "disabled:opacity-50 disabled:cursor-not-allowed", invalid ? "border-intent-danger" : "border-border", className), "aria-invalid": invalid || undefined, ...props })));
Textarea.displayName = "Textarea";
