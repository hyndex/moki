import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import * as React from "react";
import { DndContext, PointerSensor, KeyboardSensor, useSensor, useSensors, closestCenter, } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, rectSortingStrategy, } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Eye, EyeOff, Filter, GripVertical, Pencil, RotateCcw, Save, X } from "lucide-react";
import { Button } from "@/primitives/Button";
import { cn } from "@/lib/cn";
import { NumberCardWidget } from "./NumberCardWidget";
import { ChartWidget } from "./ChartWidget";
import { ShortcutCardWidget } from "./ShortcutCardWidget";
import { HeaderWidget } from "./HeaderWidget";
import { SpacerWidget } from "./SpacerWidget";
import { QuickListWidget } from "./QuickListWidget";
import { WorkspaceFilterContext, buildFilterState, } from "./workspaceFilter";
import { useRegistries } from "@/host/pluginHostContext";
const STORAGE_PREFIX = "gutu-workspace-";
function loadPersonalization(key) {
    if (typeof window === "undefined")
        return {};
    try {
        const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${key}`);
        return raw ? JSON.parse(raw) : {};
    }
    catch {
        return {};
    }
}
function savePersonalization(key, p) {
    if (typeof window === "undefined")
        return;
    try {
        window.localStorage.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(p));
    }
    catch {
        /* quota */
    }
}
function applyPersonalization(widgets, p) {
    let out = [...widgets];
    if (p.hidden)
        out = out.filter((w) => !p.hidden.includes(w.id));
    if (p.order) {
        const idx = new Map(p.order.map((id, i) => [id, i]));
        out.sort((a, b) => {
            const ai = idx.has(a.id) ? idx.get(a.id) : out.length;
            const bi = idx.has(b.id) ? idx.get(b.id) : out.length;
            return ai - bi;
        });
    }
    return out;
}
/** WorkspaceRenderer — production workspace dashboard with edit mode.
 *
 *  View mode (default):
 *    - Widgets rendered on a 12-col grid, ordered + filtered per user's
 *      stored personalization.
 *    - Small "Customize" button in the top-right toggles to edit mode.
 *
 *  Edit mode:
 *    - Every widget gets a drag handle (dnd-kit, pointer+keyboard sensors)
 *    - Every widget gets a hide toggle (hidden widgets show as greyed,
 *      still draggable, and come back on unhide)
 *    - Reset button clears the user's personalization back to the
 *      workspace's declared defaults
 *    - Done / Cancel buttons — Cancel discards pending edits
 *
 *  Personalization is persisted to localStorage under `gutu-workspace-<key>`.
 *  When `workspace.personalizable === false`, edit mode is hidden entirely.
 */
export function WorkspaceRenderer({ workspace, }) {
    const key = workspace.storageKey ?? workspace.id;
    const personalizable = workspace.personalizable !== false;
    // Persisted state
    const [personalization, setPersonalization] = React.useState(() => loadPersonalization(key));
    // Edit-mode working copy (not persisted until Save)
    const [editMode, setEditMode] = React.useState(false);
    const [draft, setDraft] = React.useState(personalization);
    // Workspace-level filter bar (session-only). Empty values skipped.
    const [filterValues, setFilterValues] = React.useState({});
    const workspaceFilter = React.useMemo(() => workspace.filterBar
        ? buildFilterState(workspace.filterBar, filterValues)
        : undefined, [workspace.filterBar, filterValues]);
    const widgetsForView = React.useMemo(() => personalizable
        ? applyPersonalization(workspace.widgets, personalization)
        : [...workspace.widgets], [workspace, personalization, personalizable]);
    const enterEdit = () => {
        setDraft(personalization);
        setEditMode(true);
    };
    const cancelEdit = () => {
        setDraft(personalization);
        setEditMode(false);
    };
    const saveEdit = () => {
        savePersonalization(key, draft);
        setPersonalization(draft);
        setEditMode(false);
    };
    const resetEdit = () => {
        const cleared = {};
        setDraft(cleared);
    };
    if (!personalizable || !editMode) {
        return (_jsx(WorkspaceFilterContext.Provider, { value: workspaceFilter, children: _jsxs("div", { className: "flex flex-col gap-3", children: [(workspace.filterBar && workspace.filterBar.length > 0) ||
                        (personalizable && workspace.widgets.length > 1) ? (_jsxs("div", { className: "flex items-center gap-2", children: [workspace.filterBar && workspace.filterBar.length > 0 && (_jsx(WorkspaceFilterBar, { fields: workspace.filterBar, values: filterValues, onChange: setFilterValues })), _jsx("div", { className: "ml-auto flex items-center gap-1", children: personalizable && workspace.widgets.length > 1 && (_jsx(Button, { variant: "ghost", size: "xs", iconLeft: _jsx(Pencil, { className: "h-3 w-3" }), onClick: enterEdit, "aria-label": "Customize dashboard", children: "Customize" })) })] })) : null, _jsx(WidgetGrid, { widgets: widgetsForView })] }) }));
    }
    return (_jsx(EditModeGrid, { workspace: workspace, draft: draft, onDraftChange: setDraft, onCancel: cancelEdit, onSave: saveEdit, onReset: resetEdit }));
}
/* ------------------------------------------------------------------------ */
/* Edit mode                                                                 */
/* ------------------------------------------------------------------------ */
function EditModeGrid({ workspace, draft, onDraftChange, onCancel, onSave, onReset, }) {
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
    // Drive order from draft; fallback to workspace order.
    const orderedIds = React.useMemo(() => {
        if (draft.order && draft.order.length === workspace.widgets.length) {
            return [...draft.order];
        }
        // Merge stored order with any new widgets appended at the end.
        const stored = draft.order ?? [];
        const knownIds = new Set(stored);
        const tail = workspace.widgets
            .map((w) => w.id)
            .filter((id) => !knownIds.has(id));
        return [...stored.filter((id) => workspace.widgets.some((w) => w.id === id)), ...tail];
    }, [draft.order, workspace.widgets]);
    const widgetsById = React.useMemo(() => {
        const m = new Map();
        for (const w of workspace.widgets)
            m.set(w.id, w);
        return m;
    }, [workspace.widgets]);
    const handleDragEnd = (e) => {
        if (!e.over || e.active.id === e.over.id)
            return;
        const oldIdx = orderedIds.indexOf(String(e.active.id));
        const newIdx = orderedIds.indexOf(String(e.over.id));
        if (oldIdx === -1 || newIdx === -1)
            return;
        const nextOrder = arrayMove(orderedIds, oldIdx, newIdx);
        onDraftChange({ ...draft, order: nextOrder });
    };
    const toggleHidden = (id) => {
        const hidden = new Set(draft.hidden ?? []);
        if (hidden.has(id))
            hidden.delete(id);
        else
            hidden.add(id);
        onDraftChange({ ...draft, hidden: [...hidden] });
    };
    return (_jsxs("div", { className: "flex flex-col gap-3", children: [_jsxs("div", { className: "flex items-center justify-between gap-2 px-3 py-2 border border-accent/40 bg-accent-subtle rounded-md", children: [_jsx("div", { className: "text-sm font-medium text-text-primary", children: "Customizing \u2014 drag to rearrange, click eye to hide/show." }), _jsxs("div", { className: "flex items-center gap-1", children: [_jsx(Button, { variant: "ghost", size: "xs", iconLeft: _jsx(RotateCcw, { className: "h-3 w-3" }), onClick: onReset, children: "Reset" }), _jsx(Button, { variant: "ghost", size: "xs", iconLeft: _jsx(X, { className: "h-3 w-3" }), onClick: onCancel, children: "Cancel" }), _jsx(Button, { variant: "primary", size: "xs", iconLeft: _jsx(Save, { className: "h-3 w-3" }), onClick: onSave, children: "Done" })] })] }), _jsx(DndContext, { sensors: sensors, collisionDetection: closestCenter, onDragEnd: handleDragEnd, children: _jsx(SortableContext, { items: orderedIds, strategy: rectSortingStrategy, children: _jsx("div", { className: "grid gap-3 [grid-template-columns:repeat(12,minmax(0,1fr))]", children: orderedIds.map((id) => {
                            const w = widgetsById.get(id);
                            if (!w)
                                return null;
                            const hidden = (draft.hidden ?? []).includes(id);
                            return (_jsx(SortableWidgetShell, { widget: w, hidden: hidden, onToggleHidden: () => toggleHidden(id) }, id));
                        }) }) }) })] }));
}
function SortableWidgetShell({ widget, hidden, onToggleHidden, }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: widget.id });
    const style = {
        transform: CSS.Translate.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : hidden ? 0.4 : 1,
        gridColumn: `span ${clampCol(widget.col)} / span ${clampCol(widget.col)}`,
    };
    return (_jsxs("div", { ref: setNodeRef, style: style, className: cn(widget.row === "tall" ? "row-span-2" : "row-span-1", "min-w-0 relative border-2 border-dashed rounded-md transition-colors", hidden
            ? "border-border bg-surface-1/50 grayscale"
            : "border-accent/30 hover:border-accent"), children: [_jsxs("div", { className: "absolute top-1 right-1 z-10 flex items-center gap-0.5 bg-surface-0/80 backdrop-blur rounded border border-border px-1 py-0.5", children: [_jsx("button", { type: "button", "aria-label": hidden ? `Show ${widget.id}` : `Hide ${widget.id}`, onClick: onToggleHidden, className: "h-5 w-5 flex items-center justify-center rounded hover:bg-surface-2 text-text-muted hover:text-text-primary", children: hidden ? (_jsx(EyeOff, { className: "h-3 w-3" })) : (_jsx(Eye, { className: "h-3 w-3" })) }), _jsx("button", { type: "button", "aria-label": `Drag ${widget.id}`, ...attributes, ...listeners, className: "h-5 w-5 flex items-center justify-center rounded hover:bg-surface-2 text-text-muted hover:text-text-primary cursor-grab active:cursor-grabbing", children: _jsx(GripVertical, { className: "h-3 w-3" }) })] }), _jsx("div", { className: "pointer-events-none", children: _jsx(WidgetSwitch, { widget: widget }) })] }));
}
/* ------------------------------------------------------------------------ */
/* View mode grid (unchanged)                                                */
/* ------------------------------------------------------------------------ */
function WidgetGrid({ widgets }) {
    return (_jsx("div", { className: "grid gap-3 [grid-template-columns:repeat(12,minmax(0,1fr))]", children: widgets.map((w) => (_jsx("div", { style: {
                gridColumn: `span ${clampCol(w.col)} / span ${clampCol(w.col)}`,
            }, className: cn(w.row === "tall" ? "row-span-2" : "row-span-1", "min-w-0"), children: _jsx(WidgetSwitch, { widget: w }) }, w.id))) }));
}
function clampCol(col) {
    if (!Number.isFinite(col))
        return 12;
    return Math.min(12, Math.max(1, Math.round(col)));
}
/* ------------------------------------------------------------------------ */
/* Workspace filter bar                                                      */
/* ------------------------------------------------------------------------ */
function WorkspaceFilterBar({ fields, values, onChange, }) {
    const active = fields.filter((f) => {
        const v = values[f.field];
        return v !== undefined && v !== null && v !== "";
    }).length;
    const clearAll = () => onChange({});
    return (_jsxs("div", { className: "flex flex-wrap items-center gap-2 px-2 py-1 border border-border rounded-md bg-surface-1", children: [_jsxs("span", { className: "inline-flex items-center gap-1 text-xs text-text-muted", children: [_jsx(Filter, { className: "h-3 w-3" }), "Filters"] }), fields.map((f) => (_jsx(WorkspaceFilterInput, { field: f, value: values[f.field], onChange: (v) => onChange({
                    ...values,
                    [f.field]: v === undefined || v === "" ? undefined : v,
                }) }, f.field))), active > 0 && (_jsx(Button, { variant: "ghost", size: "xs", onClick: clearAll, "aria-label": "Clear all filters", children: "Clear" }))] }));
}
function WorkspaceFilterInput({ field, value, onChange, }) {
    if (field.kind === "enum" && field.options) {
        return (_jsxs("select", { "aria-label": field.label, value: value ?? "", onChange: (e) => onChange(e.target.value || undefined), className: "h-7 rounded border border-border bg-surface-0 px-2 text-xs", children: [_jsxs("option", { value: "", children: [field.label, ": any"] }), field.options.map((o) => (_jsx("option", { value: o.value, children: o.label }, o.value)))] }));
    }
    if (field.kind === "boolean") {
        return (_jsxs("select", { "aria-label": field.label, value: value ?? "", onChange: (e) => onChange(e.target.value || undefined), className: "h-7 rounded border border-border bg-surface-0 px-2 text-xs", children: [_jsxs("option", { value: "", children: [field.label, ": any"] }), _jsx("option", { value: "true", children: "Yes" }), _jsx("option", { value: "false", children: "No" })] }));
    }
    if (field.kind === "date-range") {
        const [from, to] = Array.isArray(value) ? value : ["", ""];
        return (_jsxs("span", { className: "inline-flex items-center gap-1 text-xs", children: [_jsx("span", { className: "text-text-muted", children: field.label }), _jsx("input", { type: "date", "aria-label": `${field.label} from`, value: from ?? "", onChange: (e) => onChange([e.target.value, to ?? ""]), className: "h-7 rounded border border-border bg-surface-0 px-1" }), _jsx("span", { children: "\u2192" }), _jsx("input", { type: "date", "aria-label": `${field.label} to`, value: to ?? "", onChange: (e) => onChange([from ?? "", e.target.value]), className: "h-7 rounded border border-border bg-surface-0 px-1" })] }));
    }
    return (_jsx("input", { type: "text", "aria-label": field.label, value: value ?? "", placeholder: field.placeholder ?? field.label, onChange: (e) => onChange(e.target.value), className: "h-7 rounded border border-border bg-surface-0 px-2 text-xs" }));
}
function WidgetSwitch({ widget }) {
    switch (widget.type) {
        case "number_card":
            return _jsx(NumberCardWidget, { widget: widget });
        case "chart":
            return _jsx(ChartWidget, { widget: widget });
        case "shortcut":
            return _jsx(ShortcutCardWidget, { widget: widget });
        case "header":
            return _jsx(HeaderWidget, { widget: widget });
        case "spacer":
            return _jsx(SpacerWidget, { widget: widget });
        case "quick_list":
            return _jsx(QuickListWidget, { widget: widget });
        case "custom":
            return _jsx(_Fragment, { children: widget.render() });
        default:
            return _jsx(PluginContributedWidget, { widget: widget });
    }
}
/** Render a widget type that was contributed by a plugin via
 *  `ctx.registries.widgetTypes.register(...)`. Falls back to a friendly
 *  "unknown widget type" card if no plugin has provided a renderer. */
function PluginContributedWidget({ widget }) {
    const registries = useRegistries();
    const type = widget.type ?? "unknown";
    const spec = registries?.widgetTypes.get(type);
    if (!spec) {
        return (_jsxs("div", { className: "rounded-md border border-intent-warning/40 bg-intent-warning/5 p-3 text-xs", children: [_jsxs("div", { className: "font-medium text-intent-warning", children: ["Unknown widget type: ", _jsx("code", { className: "font-mono", children: type })] }), _jsx("div", { className: "text-text-muted mt-1", children: "No plugin has registered a renderer for this widget type." })] }));
    }
    const Render = spec.render;
    return _jsx(Render, { widget: widget });
}
