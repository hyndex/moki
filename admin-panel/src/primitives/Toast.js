import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import * as React from "react";
import * as ToastPrimitive from "@radix-ui/react-toast";
import { X, CheckCircle2, AlertCircle, AlertTriangle, Info } from "lucide-react";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/cn";
export const ToastProvider = ToastPrimitive.Provider;
export const ToastViewport = React.forwardRef(({ className, ...props }, ref) => (_jsx(ToastPrimitive.Viewport, { ref: ref, className: cn("fixed bottom-0 right-0 z-[100] flex max-h-screen w-full flex-col-reverse gap-2 p-4 sm:max-w-[380px]", className), ...props })));
ToastViewport.displayName = "ToastViewport";
const toastVariants = cva([
    "group pointer-events-auto relative flex w-full items-start gap-2 overflow-hidden",
    "rounded-md border p-3 pr-8 shadow-md animate-slide-up",
    "data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)]",
    "data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none",
    "data-[state=open]:animate-slide-up data-[state=closed]:animate-fade-in",
    "data-[swipe=end]:animate-out",
].join(" "), {
    variants: {
        intent: {
            default: "bg-surface-0 border-border text-text-primary",
            success: "bg-intent-success-bg border-intent-success text-intent-success",
            warning: "bg-intent-warning-bg border-intent-warning text-intent-warning",
            danger: "bg-intent-danger-bg border-intent-danger text-intent-danger",
            info: "bg-intent-info-bg border-intent-info text-intent-info",
        },
    },
    defaultVariants: { intent: "default" },
});
const iconMap = {
    default: Info,
    success: CheckCircle2,
    warning: AlertTriangle,
    danger: AlertCircle,
    info: Info,
};
export const Toast = React.forwardRef(({ className, intent = "default", children, ...props }, ref) => {
    const Icon = iconMap[intent ?? "default"];
    return (_jsxs(ToastPrimitive.Root, { ref: ref, className: cn(toastVariants({ intent }), className), ...props, children: [_jsx(Icon, { className: "h-4 w-4 mt-0.5 shrink-0", "aria-hidden": true }), _jsx("div", { className: "flex-1 min-w-0", children: children }), _jsx(ToastPrimitive.Close, { className: "absolute right-1.5 top-1.5 rounded-sm p-0.5 opacity-70 hover:opacity-100", "aria-label": "Close", children: _jsx(X, { className: "h-3.5 w-3.5" }) })] }));
});
Toast.displayName = "Toast";
export const ToastTitle = React.forwardRef(({ className, ...props }, ref) => (_jsx(ToastPrimitive.Title, { ref: ref, className: cn("text-sm font-semibold leading-tight", className), ...props })));
ToastTitle.displayName = "ToastTitle";
export const ToastDescription = React.forwardRef(({ className, ...props }, ref) => (_jsx(ToastPrimitive.Description, { ref: ref, className: cn("text-sm opacity-90 mt-0.5", className), ...props })));
ToastDescription.displayName = "ToastDescription";
