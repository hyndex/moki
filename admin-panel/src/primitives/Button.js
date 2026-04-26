import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";
export const buttonVariants = cva([
    "inline-flex items-center justify-center gap-1.5 whitespace-nowrap",
    "rounded-md font-medium select-none",
    "transition-colors duration-fast ease-out",
    "focus-visible:outline-none focus-visible:shadow-focus",
    "disabled:pointer-events-none disabled:opacity-50",
].join(" "), {
    variants: {
        variant: {
            primary: "bg-accent text-accent-fg hover:bg-accent-hover",
            secondary: "bg-surface-2 text-text-primary border border-border hover:bg-surface-3",
            ghost: "text-text-secondary hover:bg-surface-2 hover:text-text-primary",
            danger: "bg-intent-danger text-white hover:opacity-90",
            outline: "border border-border bg-transparent text-text-primary hover:bg-surface-2",
            link: "text-text-link underline-offset-4 hover:underline px-0",
        },
        size: {
            xs: "h-6 px-2 text-xs",
            sm: "h-8 px-2.5 text-sm",
            md: "h-9 px-3 text-sm",
            lg: "h-10 px-4 text-base",
            icon: "h-8 w-8 p-0",
        },
    },
    defaultVariants: { variant: "secondary", size: "md" },
});
export const Button = React.forwardRef(({ className, variant, size, asChild, loading, disabled, iconLeft, iconRight, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (_jsxs(Comp, { ref: ref, className: cn(buttonVariants({ variant, size, className })), disabled: disabled || loading, "data-loading": loading || undefined, ...props, children: [loading ? (_jsx(Loader2, { className: "h-3.5 w-3.5 animate-spin", "aria-hidden": true })) : (iconLeft), children, iconRight] }));
});
Button.displayName = "Button";
