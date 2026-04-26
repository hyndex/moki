import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import * as React from "react";
import { DndContext, PointerSensor, KeyboardSensor, useSensor, useSensors, closestCenter, } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, rectSortingStrategy, } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Eye, EyeOff, GripVertical, Pencil, RotateCcw, Save, X } from "lucide-react";
import { PageHeader } from "@/admin-primitives/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/admin-primitives/Card";
import { Button } from "@/primitives/Button";
import { cn } from "@/lib/cn";
const STORAGE_PREFIX = "gutu-dashboard-";
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
export function DashboardViewRenderer({ view }) {
    const key = view.id;
    const [personalization, setPersonalization] = React.useState(() => loadPersonalization(key));
    const [editMode, setEditMode] = React.useState(false);
    const [draft, setDraft] = React.useState(personalization);
    const orderedWidgets = React.useMemo(() => {
        const widgets = [...view.widgets];
        const hidden = new Set(personalization.hidden ?? []);
        const filtered = widgets.filter((w) => !hidden.has(w.id));
        const order = personalization.order;
        if (order) {
            const idx = new Map(order.map((id, i) => [id, i]));
            filtered.sort((a, b) => (idx.get(a.id) ?? filtered.length) - (idx.get(b.id) ?? filtered.length));
        }
        return filtered;
    }, [view.widgets, personalization]);
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
    const resetEdit = () => setDraft({});
    if (editMode) {
        return (_jsx(EditModeDashboard, { view: view, draft: draft, onDraftChange: setDraft, onCancel: cancelEdit, onSave: saveEdit, onReset: resetEdit }));
    }
    return (_jsxs("div", { className: "flex flex-col gap-4", children: [_jsx(PageHeader, { title: view.title, description: view.description, actions: view.widgets.length > 1 ? (_jsx(Button, { variant: "ghost", size: "xs", iconLeft: _jsx(Pencil, { className: "h-3 w-3" }), onClick: enterEdit, children: "Customize" })) : undefined }), _jsx(Grid, { widgets: orderedWidgets })] }));
}
function EditModeDashboard({ view, draft, onDraftChange, onCancel, onSave, onReset, }) {
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
    const ids = React.useMemo(() => {
        const stored = draft.order ?? [];
        const knownIds = new Set(stored);
        const tail = view.widgets.map((w) => w.id).filter((id) => !knownIds.has(id));
        return [...stored.filter((id) => view.widgets.some((w) => w.id === id)), ...tail];
    }, [draft.order, view.widgets]);
    const widgetsById = React.useMemo(() => {
        const m = new Map();
        for (const w of view.widgets)
            m.set(w.id, w);
        return m;
    }, [view.widgets]);
    const handleDragEnd = (e) => {
        if (!e.over || e.active.id === e.over.id)
            return;
        const oldIdx = ids.indexOf(String(e.active.id));
        const newIdx = ids.indexOf(String(e.over.id));
        if (oldIdx === -1 || newIdx === -1)
            return;
        onDraftChange({ ...draft, order: arrayMove(ids, oldIdx, newIdx) });
    };
    const toggleHidden = (id) => {
        const hidden = new Set(draft.hidden ?? []);
        if (hidden.has(id))
            hidden.delete(id);
        else
            hidden.add(id);
        onDraftChange({ ...draft, hidden: [...hidden] });
    };
    return (_jsxs("div", { className: "flex flex-col gap-4", children: [_jsx(PageHeader, { title: view.title, description: view.description }), _jsxs("div", { className: "flex items-center justify-between gap-2 px-3 py-2 border border-accent/40 bg-accent-subtle rounded-md", children: [_jsx("div", { className: "text-sm font-medium text-text-primary", children: "Customizing \u2014 drag to reorder, toggle eye to hide/show." }), _jsxs("div", { className: "flex items-center gap-1", children: [_jsx(Button, { variant: "ghost", size: "xs", iconLeft: _jsx(RotateCcw, { className: "h-3 w-3" }), onClick: onReset, children: "Reset" }), _jsx(Button, { variant: "ghost", size: "xs", iconLeft: _jsx(X, { className: "h-3 w-3" }), onClick: onCancel, children: "Cancel" }), _jsx(Button, { variant: "primary", size: "xs", iconLeft: _jsx(Save, { className: "h-3 w-3" }), onClick: onSave, children: "Done" })] })] }), _jsx(DndContext, { sensors: sensors, collisionDetection: closestCenter, onDragEnd: handleDragEnd, children: _jsx(SortableContext, { items: ids, strategy: rectSortingStrategy, children: _jsx("div", { className: "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 auto-rows-[minmax(120px,auto)]", children: ids.map((id) => {
                            const w = widgetsById.get(id);
                            if (!w)
                                return null;
                            const hidden = (draft.hidden ?? []).includes(id);
                            return (_jsx(SortableDashboardTile, { widget: w, hidden: hidden, onToggleHidden: () => toggleHidden(id) }, id));
                        }) }) }) })] }));
}
function SortableDashboardTile({ widget, hidden, onToggleHidden, }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: widget.id });
    const style = {
        transform: CSS.Translate.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : hidden ? 0.4 : 1,
    };
    return (_jsx("div", { ref: setNodeRef, style: style, className: cn(sizeToClass(widget.size), "relative", hidden ? "grayscale" : ""), children: _jsxs(Card, { className: cn("h-full border-2 border-dashed", hidden ? "border-border" : "border-accent/30 hover:border-accent"), children: [_jsxs("div", { className: "absolute top-1 right-1 z-10 flex items-center gap-0.5 bg-surface-0/80 backdrop-blur rounded border border-border px-1 py-0.5", children: [_jsx("button", { type: "button", "aria-label": hidden ? "Show widget" : "Hide widget", onClick: onToggleHidden, className: "h-5 w-5 flex items-center justify-center rounded hover:bg-surface-2 text-text-muted hover:text-text-primary", children: hidden ? _jsx(EyeOff, { className: "h-3 w-3" }) : _jsx(Eye, { className: "h-3 w-3" }) }), _jsx("button", { type: "button", "aria-label": "Drag widget", ...attributes, ...listeners, className: "h-5 w-5 flex items-center justify-center rounded hover:bg-surface-2 text-text-muted hover:text-text-primary cursor-grab active:cursor-grabbing", children: _jsx(GripVertical, { className: "h-3 w-3" }) })] }), widget.title && (_jsx(CardHeader, { children: _jsx(CardTitle, { children: widget.title }) })), _jsx(CardContent, { className: "pointer-events-none", children: widget.render() })] }) }));
}
function Grid({ widgets }) {
    return (_jsx("div", { className: "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 auto-rows-[minmax(120px,auto)]", children: widgets.map((w) => (_jsxs(Card, { className: sizeToClass(w.size), children: [w.title && (_jsx(CardHeader, { children: _jsx(CardTitle, { children: w.title }) })), _jsx(CardContent, { children: w.render() })] }, w.id))) }));
}
function sizeToClass(size) {
    return cn(size === "sm" && "col-span-1", size === "md" && "col-span-1 md:col-span-2", size === "lg" && "col-span-1 md:col-span-2 xl:col-span-3", size === "xl" && "col-span-1 md:col-span-2 xl:col-span-4", !size && "col-span-1");
}
