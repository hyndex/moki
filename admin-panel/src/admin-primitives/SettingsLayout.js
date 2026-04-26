import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import * as React from "react";
import { cn } from "@/lib/cn";
import { NavIcon } from "@/shell/NavIcon";
export function SettingsLayout({ sections, defaultSection, className, }) {
    const [active, setActive] = React.useState(defaultSection ?? sections[0]?.id ?? "");
    const current = sections.find((s) => s.id === active) ?? sections[0];
    return (_jsxs("div", { className: cn("grid gap-6 grid-cols-1 lg:grid-cols-[220px_1fr]", className), children: [_jsx("aside", { className: "flex flex-col gap-0.5", children: sections.map((s) => (_jsxs("button", { type: "button", onClick: () => setActive(s.id), className: cn("flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-left transition-colors", s.id === active
                        ? "bg-accent-subtle text-accent font-medium"
                        : "text-text-secondary hover:text-text-primary hover:bg-surface-2"), children: [_jsx(NavIcon, { name: s.icon, className: "h-4 w-4 shrink-0" }), _jsx("span", { className: "min-w-0 truncate", children: s.label })] }, s.id))) }), _jsxs("section", { className: "min-w-0", children: [current && (_jsxs("header", { className: "mb-4", children: [_jsx("h2", { className: "text-lg font-semibold text-text-primary", children: current.label }), current.description && (_jsx("p", { className: "text-sm text-text-muted mt-0.5", children: current.description }))] })), current?.render()] })] }));
}
