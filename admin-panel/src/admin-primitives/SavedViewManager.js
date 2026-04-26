import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import * as React from "react";
import { BookmarkPlus, Check, ChevronDown, MoreHorizontal, Pin, Star, Trash2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/primitives/Popover";
import { Button } from "@/primitives/Button";
import { Input } from "@/primitives/Input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, } from "@/primitives/DropdownMenu";
import { cn } from "@/lib/cn";
import { useRuntime } from "@/runtime/context";
import { useFavorites } from "@/runtime/useFavorites";
export function SavedViewManager({ resource, currentState, activeId, onSelect, onSaved, className, }) {
    const { savedViews, analytics } = useRuntime();
    const favorites = useFavorites();
    const [, rerender] = React.useReducer((n) => n + 1, 0);
    const [creating, setCreating] = React.useState(false);
    const [label, setLabel] = React.useState("");
    React.useEffect(() => {
        return savedViews.subscribe(() => rerender());
    }, [savedViews]);
    const views = savedViews.list(resource);
    const active = activeId ? savedViews.get(activeId) : null;
    const handleSelect = (view) => {
        onSelect(view);
        if (view) {
            analytics.emit("page.saved_view.applied", { viewId: view.id, scope: view.scope });
        }
    };
    const handleSave = () => {
        const trimmed = label.trim();
        if (!trimmed)
            return;
        const saved = savedViews.save({
            resource,
            label: trimmed,
            scope: "personal",
            ...currentState,
        });
        analytics.emit("page.saved_view.saved", { viewId: saved.id, scope: saved.scope });
        setLabel("");
        setCreating(false);
        onSaved?.(saved);
        handleSelect(saved);
    };
    return (_jsx("div", { className: cn("inline-flex items-center", className), children: _jsxs(Popover, { children: [_jsx(PopoverTrigger, { asChild: true, children: _jsx(Button, { variant: "ghost", size: "sm", iconRight: _jsx(ChevronDown, { className: "h-3 w-3" }), children: active ? active.label : "All records" }) }), _jsxs(PopoverContent, { className: "w-72 p-0", align: "start", children: [_jsxs("div", { className: "px-3 py-2 border-b border-border flex items-center justify-between", children: [_jsx("div", { className: "text-xs font-semibold uppercase tracking-wider text-text-primary", children: "Saved views" }), _jsxs("button", { type: "button", className: "text-xs text-text-muted hover:text-text-primary inline-flex items-center gap-1", onClick: () => setCreating((c) => !c), children: [_jsx(BookmarkPlus, { className: "h-3 w-3" }), "New"] })] }), creating && (_jsxs("div", { className: "p-2 border-b border-border flex items-center gap-2", children: [_jsx(Input, { autoFocus: true, value: label, onChange: (e) => setLabel(e.target.value), placeholder: "View name", onKeyDown: (e) => {
                                        if (e.key === "Enter")
                                            handleSave();
                                        if (e.key === "Escape")
                                            setCreating(false);
                                    } }), _jsx(Button, { size: "sm", variant: "primary", onClick: handleSave, disabled: !label.trim(), children: "Save" })] })), _jsxs("ul", { className: "max-h-72 overflow-y-auto py-1", role: "listbox", children: [_jsx("li", { children: _jsxs("button", { type: "button", onClick: () => handleSelect(null), className: cn("w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left hover:bg-surface-1", !active && "text-accent"), children: [!active && _jsx(Check, { className: "h-3.5 w-3.5" }), _jsx("span", { className: cn(active && "ml-[22px]"), children: "All records (default)" })] }) }), views.map((v) => {
                                    const starred = favorites.isFavorite("view", v.id);
                                    return (_jsx("li", { className: "group", children: _jsxs("div", { className: "flex items-center gap-1 pr-1 hover:bg-surface-1", children: [_jsxs("button", { type: "button", onClick: () => handleSelect(v), className: cn("flex-1 flex items-center gap-2 px-3 py-1.5 text-sm text-left", active?.id === v.id && "text-accent"), children: [active?.id === v.id ? (_jsx(Check, { className: "h-3.5 w-3.5" })) : v.pinned ? (_jsx(Pin, { className: "h-3.5 w-3.5 text-text-muted" })) : (_jsx("span", { className: "w-3.5" })), _jsx("span", { className: "flex-1 truncate", children: v.label }), v.scope !== "personal" && (_jsx("span", { className: "text-xs text-text-muted uppercase", children: v.scope }))] }), _jsx("button", { type: "button", onClick: (e) => {
                                                        e.stopPropagation();
                                                        if (starred) {
                                                            void favorites.remove("view", v.id);
                                                        }
                                                        else {
                                                            void favorites.add({
                                                                kind: "view",
                                                                targetId: v.id,
                                                                label: v.label,
                                                            });
                                                        }
                                                    }, "aria-pressed": starred, "aria-label": starred
                                                        ? `Unstar ${v.label}`
                                                        : `Star ${v.label}`, title: starred
                                                        ? "Remove from sidebar Favorites"
                                                        : "Add to sidebar Favorites", className: cn("h-7 w-7 flex items-center justify-center rounded transition-colors", starred
                                                        ? "text-amber-500 opacity-100"
                                                        : "text-text-muted opacity-0 group-hover:opacity-100 hover:text-text-primary"), children: _jsx(Star, { className: cn("h-3.5 w-3.5", starred && "fill-current"), "aria-hidden": true }) }), _jsxs(DropdownMenu, { children: [_jsx(DropdownMenuTrigger, { asChild: true, children: _jsx("button", { type: "button", className: "h-7 w-7 flex items-center justify-center rounded hover:bg-surface-2 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity", "aria-label": `Manage ${v.label}`, children: _jsx(MoreHorizontal, { className: "h-3.5 w-3.5" }) }) }), _jsxs(DropdownMenuContent, { align: "end", children: [_jsxs(DropdownMenuItem, { onSelect: () => savedViews.save({ ...v, pinned: !v.pinned, id: v.id }), children: [_jsx(Pin, { className: "h-3.5 w-3.5 mr-2" }), v.pinned ? "Unpin" : "Pin"] }), _jsxs(DropdownMenuItem, { onSelect: () => savedViews.setDefault(resource, v.id), children: [_jsx(Star, { className: "h-3.5 w-3.5 mr-2" }), "Set as default"] }), _jsxs(DropdownMenuItem, { onSelect: () => {
                                                                        savedViews.delete(v.id);
                                                                        if (active?.id === v.id)
                                                                            handleSelect(null);
                                                                    }, children: [_jsx(Trash2, { className: "h-3.5 w-3.5 mr-2 text-intent-danger" }), "Delete"] })] })] })] }) }, v.id));
                                }), views.length === 0 && !creating && (_jsx("li", { className: "px-3 py-4 text-xs text-text-muted text-center", children: "No saved views yet" }))] })] })] }) }));
}
