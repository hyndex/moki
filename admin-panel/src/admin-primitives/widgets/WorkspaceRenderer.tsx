import * as React from "react";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Eye, EyeOff, Filter, GripVertical, Pencil, RotateCcw, Save, X } from "lucide-react";
import { Button } from "@/primitives/Button";
import { cn } from "@/lib/cn";
import type { Widget, WorkspaceDescriptor, WorkspaceFilterField } from "@/contracts/widgets";
import { NumberCardWidget } from "./NumberCardWidget";
import { ChartWidget } from "./ChartWidget";
import { ShortcutCardWidget } from "./ShortcutCardWidget";
import { HeaderWidget } from "./HeaderWidget";
import { SpacerWidget } from "./SpacerWidget";
import { QuickListWidget } from "./QuickListWidget";
import {
  WorkspaceFilterContext,
  buildFilterTree,
} from "./workspaceFilter";

const STORAGE_PREFIX = "gutu-workspace-";

interface WorkspacePersonalization {
  hidden?: string[];
  order?: string[];
}

function loadPersonalization(key: string): WorkspacePersonalization {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${key}`);
    return raw ? (JSON.parse(raw) as WorkspacePersonalization) : {};
  } catch {
    return {};
  }
}

function savePersonalization(key: string, p: WorkspacePersonalization): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(p));
  } catch {
    /* quota */
  }
}

function applyPersonalization(
  widgets: readonly Widget[],
  p: WorkspacePersonalization,
): Widget[] {
  let out = [...widgets];
  if (p.hidden) out = out.filter((w) => !p.hidden!.includes(w.id));
  if (p.order) {
    const idx = new Map(p.order.map((id, i) => [id, i]));
    out.sort((a, b) => {
      const ai = idx.has(a.id) ? idx.get(a.id)! : out.length;
      const bi = idx.has(b.id) ? idx.get(b.id)! : out.length;
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
export function WorkspaceRenderer({
  workspace,
}: {
  workspace: WorkspaceDescriptor;
}) {
  const key = workspace.storageKey ?? workspace.id;
  const personalizable = workspace.personalizable !== false;

  // Persisted state
  const [personalization, setPersonalization] = React.useState<WorkspacePersonalization>(
    () => loadPersonalization(key),
  );

  // Edit-mode working copy (not persisted until Save)
  const [editMode, setEditMode] = React.useState(false);
  const [draft, setDraft] = React.useState<WorkspacePersonalization>(personalization);

  // Workspace-level filter bar (session-only). Empty values skipped.
  const [filterValues, setFilterValues] = React.useState<Record<string, unknown>>(
    {},
  );
  const workspaceFilter = React.useMemo(
    () =>
      workspace.filterBar
        ? buildFilterTree(workspace.filterBar, filterValues)
        : undefined,
    [workspace.filterBar, filterValues],
  );

  const widgetsForView = React.useMemo(
    () =>
      personalizable
        ? applyPersonalization(workspace.widgets, personalization)
        : [...workspace.widgets],
    [workspace, personalization, personalizable],
  );

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
    const cleared: WorkspacePersonalization = {};
    setDraft(cleared);
  };

  if (!personalizable || !editMode) {
    return (
      <WorkspaceFilterContext.Provider value={workspaceFilter}>
        <div className="flex flex-col gap-3">
          {(workspace.filterBar && workspace.filterBar.length > 0) ||
          (personalizable && workspace.widgets.length > 1) ? (
            <div className="flex items-center gap-2">
              {workspace.filterBar && workspace.filterBar.length > 0 && (
                <WorkspaceFilterBar
                  fields={workspace.filterBar}
                  values={filterValues}
                  onChange={setFilterValues}
                />
              )}
              <div className="ml-auto flex items-center gap-1">
                {personalizable && workspace.widgets.length > 1 && (
                  <Button
                    variant="ghost"
                    size="xs"
                    iconLeft={<Pencil className="h-3 w-3" />}
                    onClick={enterEdit}
                    aria-label="Customize dashboard"
                  >
                    Customize
                  </Button>
                )}
              </div>
            </div>
          ) : null}
          <WidgetGrid widgets={widgetsForView} />
        </div>
      </WorkspaceFilterContext.Provider>
    );
  }

  return (
    <EditModeGrid
      workspace={workspace}
      draft={draft}
      onDraftChange={setDraft}
      onCancel={cancelEdit}
      onSave={saveEdit}
      onReset={resetEdit}
    />
  );
}

/* ------------------------------------------------------------------------ */
/* Edit mode                                                                 */
/* ------------------------------------------------------------------------ */

function EditModeGrid({
  workspace,
  draft,
  onDraftChange,
  onCancel,
  onSave,
  onReset,
}: {
  workspace: WorkspaceDescriptor;
  draft: WorkspacePersonalization;
  onDraftChange: (next: WorkspacePersonalization) => void;
  onCancel: () => void;
  onSave: () => void;
  onReset: () => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

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
    const m = new Map<string, Widget>();
    for (const w of workspace.widgets) m.set(w.id, w);
    return m;
  }, [workspace.widgets]);

  const handleDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const oldIdx = orderedIds.indexOf(String(e.active.id));
    const newIdx = orderedIds.indexOf(String(e.over.id));
    if (oldIdx === -1 || newIdx === -1) return;
    const nextOrder = arrayMove(orderedIds, oldIdx, newIdx);
    onDraftChange({ ...draft, order: nextOrder });
  };

  const toggleHidden = (id: string) => {
    const hidden = new Set(draft.hidden ?? []);
    if (hidden.has(id)) hidden.delete(id);
    else hidden.add(id);
    onDraftChange({ ...draft, hidden: [...hidden] });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2 px-3 py-2 border border-accent/40 bg-accent-subtle rounded-md">
        <div className="text-sm font-medium text-text-primary">
          Customizing — drag to rearrange, click eye to hide/show.
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="xs" iconLeft={<RotateCcw className="h-3 w-3" />} onClick={onReset}>
            Reset
          </Button>
          <Button variant="ghost" size="xs" iconLeft={<X className="h-3 w-3" />} onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="primary" size="xs" iconLeft={<Save className="h-3 w-3" />} onClick={onSave}>
            Done
          </Button>
        </div>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={orderedIds} strategy={rectSortingStrategy}>
          <div className="grid gap-3 [grid-template-columns:repeat(12,minmax(0,1fr))]">
            {orderedIds.map((id) => {
              const w = widgetsById.get(id);
              if (!w) return null;
              const hidden = (draft.hidden ?? []).includes(id);
              return (
                <SortableWidgetShell
                  key={id}
                  widget={w}
                  hidden={hidden}
                  onToggleHidden={() => toggleHidden(id)}
                />
              );
            })}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

function SortableWidgetShell({
  widget,
  hidden,
  onToggleHidden,
}: {
  widget: Widget;
  hidden: boolean;
  onToggleHidden: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: widget.id });
  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : hidden ? 0.4 : 1,
    gridColumn: `span ${clampCol(widget.col)} / span ${clampCol(widget.col)}`,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        widget.row === "tall" ? "row-span-2" : "row-span-1",
        "min-w-0 relative border-2 border-dashed rounded-md transition-colors",
        hidden
          ? "border-border bg-surface-1/50 grayscale"
          : "border-accent/30 hover:border-accent",
      )}
    >
      <div className="absolute top-1 right-1 z-10 flex items-center gap-0.5 bg-surface-0/80 backdrop-blur rounded border border-border px-1 py-0.5">
        <button
          type="button"
          aria-label={hidden ? `Show ${widget.id}` : `Hide ${widget.id}`}
          onClick={onToggleHidden}
          className="h-5 w-5 flex items-center justify-center rounded hover:bg-surface-2 text-text-muted hover:text-text-primary"
        >
          {hidden ? (
            <EyeOff className="h-3 w-3" />
          ) : (
            <Eye className="h-3 w-3" />
          )}
        </button>
        <button
          type="button"
          aria-label={`Drag ${widget.id}`}
          {...attributes}
          {...listeners}
          className="h-5 w-5 flex items-center justify-center rounded hover:bg-surface-2 text-text-muted hover:text-text-primary cursor-grab active:cursor-grabbing"
        >
          <GripVertical className="h-3 w-3" />
        </button>
      </div>
      <div className="pointer-events-none">
        <WidgetSwitch widget={widget} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------ */
/* View mode grid (unchanged)                                                */
/* ------------------------------------------------------------------------ */

function WidgetGrid({ widgets }: { widgets: readonly Widget[] }) {
  return (
    <div className="grid gap-3 [grid-template-columns:repeat(12,minmax(0,1fr))]">
      {widgets.map((w) => (
        <div
          key={w.id}
          style={{
            gridColumn: `span ${clampCol(w.col)} / span ${clampCol(w.col)}`,
          }}
          className={cn(
            w.row === "tall" ? "row-span-2" : "row-span-1",
            "min-w-0",
          )}
        >
          <WidgetSwitch widget={w} />
        </div>
      ))}
    </div>
  );
}

function clampCol(col: number): number {
  if (!Number.isFinite(col)) return 12;
  return Math.min(12, Math.max(1, Math.round(col)));
}

/* ------------------------------------------------------------------------ */
/* Workspace filter bar                                                      */
/* ------------------------------------------------------------------------ */

function WorkspaceFilterBar({
  fields,
  values,
  onChange,
}: {
  fields: readonly WorkspaceFilterField[];
  values: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}) {
  const active = fields.filter((f) => {
    const v = values[f.field];
    return v !== undefined && v !== null && v !== "";
  }).length;
  const clearAll = () => onChange({});

  return (
    <div className="flex flex-wrap items-center gap-2 px-2 py-1 border border-border rounded-md bg-surface-1">
      <span className="inline-flex items-center gap-1 text-xs text-text-muted">
        <Filter className="h-3 w-3" />
        Filters
      </span>
      {fields.map((f) => (
        <WorkspaceFilterInput
          key={f.field}
          field={f}
          value={values[f.field]}
          onChange={(v) =>
            onChange({
              ...values,
              [f.field]: v === undefined || v === "" ? undefined : v,
            })
          }
        />
      ))}
      {active > 0 && (
        <Button
          variant="ghost"
          size="xs"
          onClick={clearAll}
          aria-label="Clear all filters"
        >
          Clear
        </Button>
      )}
    </div>
  );
}

function WorkspaceFilterInput({
  field,
  value,
  onChange,
}: {
  field: WorkspaceFilterField;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  if (field.kind === "enum" && field.options) {
    return (
      <select
        aria-label={field.label}
        value={(value as string) ?? ""}
        onChange={(e) => onChange(e.target.value || undefined)}
        className="h-7 rounded border border-border bg-surface-0 px-2 text-xs"
      >
        <option value="">{field.label}: any</option>
        {field.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
  }
  if (field.kind === "boolean") {
    return (
      <select
        aria-label={field.label}
        value={(value as string) ?? ""}
        onChange={(e) => onChange(e.target.value || undefined)}
        className="h-7 rounded border border-border bg-surface-0 px-2 text-xs"
      >
        <option value="">{field.label}: any</option>
        <option value="true">Yes</option>
        <option value="false">No</option>
      </select>
    );
  }
  if (field.kind === "date-range") {
    const [from, to] = Array.isArray(value) ? (value as [string, string]) : ["", ""];
    return (
      <span className="inline-flex items-center gap-1 text-xs">
        <span className="text-text-muted">{field.label}</span>
        <input
          type="date"
          aria-label={`${field.label} from`}
          value={from ?? ""}
          onChange={(e) => onChange([e.target.value, to ?? ""])}
          className="h-7 rounded border border-border bg-surface-0 px-1"
        />
        <span>→</span>
        <input
          type="date"
          aria-label={`${field.label} to`}
          value={to ?? ""}
          onChange={(e) => onChange([from ?? "", e.target.value])}
          className="h-7 rounded border border-border bg-surface-0 px-1"
        />
      </span>
    );
  }
  return (
    <input
      type="text"
      aria-label={field.label}
      value={(value as string) ?? ""}
      placeholder={field.placeholder ?? field.label}
      onChange={(e) => onChange(e.target.value)}
      className="h-7 rounded border border-border bg-surface-0 px-2 text-xs"
    />
  );
}

function WidgetSwitch({ widget }: { widget: Widget }) {
  switch (widget.type) {
    case "number_card":
      return <NumberCardWidget widget={widget} />;
    case "chart":
      return <ChartWidget widget={widget} />;
    case "shortcut":
      return <ShortcutCardWidget widget={widget} />;
    case "header":
      return <HeaderWidget widget={widget} />;
    case "spacer":
      return <SpacerWidget widget={widget} />;
    case "quick_list":
      return <QuickListWidget widget={widget} />;
    case "custom":
      return <>{widget.render()}</>;
  }
}
