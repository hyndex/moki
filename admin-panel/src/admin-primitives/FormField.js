import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { cn } from "@/lib/cn";
import { Label } from "@/primitives/Label";
export function FormField({ id, label, required, help, error, className, children, }) {
    return (_jsxs("div", { className: cn("flex flex-col gap-1.5", className), children: [label && (_jsx(Label, { htmlFor: id, required: required, children: label })), children, error ? (_jsx("p", { className: "text-xs text-intent-danger mt-0.5", children: error })) : help ? (_jsx("p", { className: "text-xs text-text-muted mt-0.5", children: help })) : null] }));
}
