import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import * as React from "react";
import { Columns3, GripVertical, Pin, PinOff } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/primitives/Popover";
import { Button } from "@/primitives/Button";
import { Checkbox } from "@/primitives/Checkbox";
import { cn } from "@/lib/cn";
export function SmartColumnConfigurator({ columns, value, onChange, onReset, className, }) {
    const [dragIndex, setDragIndex] = React.useState(null);
    const toggle = (field, visible) => {
        const next = value.map((c) => (c.field === field ? { ...c, visible } : c));
        onChange(next);
    };
    const togglePin = (field) => {
        const next = value.map((c) => c.field === field ? { ...c, pinned: c.pinned === "left" ? null : "left" } : c);
        onChange(next);
    };
    const onDragStart = (idx) => setDragIndex(idx);
    const onDragOver = (e) => e.preventDefault();
    const onDrop = (idx) => {
        if (dragIndex === null || dragIndex === idx)
            return;
        const next = [...value];
        const [moved] = next.splice(dragIndex, 1);
        next.splice(idx, 0, moved);
        onChange(next);
        setDragIndex(null);
    };
    const visibleCount = value.filter((c) => c.visible).length;
    return (_jsxs(Popover, { children: [_jsx(PopoverTrigger, { asChild: true, children: _jsxs(Button, { variant: "ghost", size: "sm", iconLeft: _jsx(Columns3, { className: "h-3.5 w-3.5" }), className: className, "aria-label": "Configure columns", children: ["Columns", _jsxs("span", { className: "ml-1 text-xs text-text-muted tabular-nums", children: [visibleCount, "/", value.length] })] }) }), _jsxs(PopoverContent, { className: "w-72 p-0", align: "end", children: [_jsxs("div", { className: "px-3 py-2 border-b border-border flex items-center justify-between", children: [_jsx("div", { className: "text-xs font-semibold text-text-primary uppercase tracking-wider", children: "Columns" }), onReset && (_jsx("button", { type: "button", onClick: onReset, className: "text-xs text-text-muted hover:text-text-primary", children: "Reset" }))] }), _jsx("ul", { className: "max-h-80 overflow-y-auto py-1", role: "listbox", "aria-label": "Columns", children: value.map((cfg, idx) => {
                            const def = columns.find((c) => c.field === cfg.field);
                            if (!def)
                                return null;
                            return (_jsxs("li", { draggable: true, onDragStart: () => onDragStart(idx), onDragOver: onDragOver, onDrop: () => onDrop(idx), className: cn("flex items-center gap-2 px-2 py-1.5 hover:bg-surface-1 cursor-grab active:cursor-grabbing group", dragIndex === idx && "opacity-50"), children: [_jsx(GripVertical, { className: "h-3.5 w-3.5 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity" }), _jsx(Checkbox, { checked: cfg.visible, disabled: def.required, onCheckedChange: (v) => toggle(cfg.field, Boolean(v)), "aria-label": `Toggle ${def.label}` }), _jsx("span", { className: "flex-1 text-sm text-text-primary truncate", children: def.label }), def.pinnable && (_jsx("button", { type: "button", onClick: () => togglePin(cfg.field), className: cn("h-6 w-6 flex items-center justify-center rounded hover:bg-surface-2", cfg.pinned ? "text-accent" : "text-text-muted"), "aria-label": cfg.pinned ? "Unpin column" : "Pin column", children: cfg.pinned ? (_jsx(Pin, { className: "h-3.5 w-3.5" })) : (_jsx(PinOff, { className: "h-3.5 w-3.5" })) }))] }, cfg.field));
                        }) })] })] }));
}
