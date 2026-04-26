import { jsx as _jsx } from "react/jsx-runtime";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";
export const Spinner = ({ className, size = 16, ...props }) => (_jsx(Loader2, { className: cn("animate-spin text-text-muted", className), width: size, height: size, "aria-label": "Loading", ...props }));
