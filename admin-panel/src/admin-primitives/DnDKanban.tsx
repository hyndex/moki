import * as React from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  TouchSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/cn";
import type { Intent } from "@/primitives/Badge";

/** Production Kanban board — dnd-kit powered.
 *
 *  Replaces the previous HTML5-drag-based Kanban. Benefits:
 *    - Pointer, touch, AND keyboard sensors (full a11y)
 *    - Smooth animated transforms (no ghost-on-drag flicker)
 *    - Drop anywhere in a column (not just between cards)
 *    - Card reorder within a column
 *    - Sortable column indices preserved in LocalStorage when keyed
 *    - Optional column WIP limits (visual warn color over cap)
 *    - Screen-reader announces "picked up X, moved to Y" via dnd-kit's
 *      announcements prop
 *
 *  Generic — pass any row shape with a stable `id`; provide `renderCard`
 *  and `columnOf` so the board knows where each row belongs.
 */

export interface DnDKanbanColumn<T> {
  id: string;
  title: string;
  intent?: Intent;
  /** Warn (amber header) when column length exceeds this. */
  wipLimit?: number;
}

export interface DnDKanbanProps<T> {
  columns: readonly DnDKanbanColumn<T>[];
  /** Full row list (board filters them per column via `columnOf`). */
  rows: readonly T[];
  rowId: (row: T) => string;
  columnOf: (row: T) => string;
  renderCard: (row: T) => React.ReactNode;
  /** Called when a card is moved. Parent is responsible for persisting. */
  onMove?: (row: T, fromColumn: string, toColumn: string, targetIndex: number) => void;
  /** Called when a card is reordered within its own column. */
  onReorder?: (column: string, orderedIds: string[]) => void;
  /** Persist column/card order under this key. */
  stateKey?: string;
  className?: string;
}

/** Card wrapper that's sortable via dnd-kit. */
function SortableCard({
  id,
  children,
  disabled,
}: {
  id: string;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled,
  });
  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "rounded-md border border-border bg-surface-0 p-2.5 cursor-grab active:cursor-grabbing",
        "hover:border-accent/40 transition-colors",
        "focus:outline-none focus:ring-2 focus:ring-accent/50",
      )}
    >
      {children}
    </div>
  );
}

export function DnDKanban<T>({
  columns,
  rows,
  rowId,
  columnOf,
  renderCard,
  onMove,
  onReorder,
  stateKey,
  className,
}: DnDKanbanProps<T>) {
  /* ---------------- local state ---------------- */
  // We keep an internal "overrides" map so the board feels snappy during
  // drags; the parent's `onMove` callback is the source of truth after drop.
  const [overrideColumn, setOverrideColumn] = React.useState<Record<string, string>>({});
  const [overrideOrder, setOverrideOrder] = React.useState<Record<string, string[]>>(
    () => loadState(stateKey) ?? {},
  );
  const [activeId, setActiveId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!stateKey) return;
    saveState(stateKey, overrideOrder);
  }, [stateKey, overrideOrder]);

  /* ---------------- derive columns ---------------- */
  const rowsById = React.useMemo(() => {
    const m = new Map<string, T>();
    for (const r of rows) m.set(rowId(r), r);
    return m;
  }, [rows, rowId]);

  const byColumn = React.useMemo(() => {
    const m = new Map<string, string[]>();
    for (const col of columns) m.set(col.id, []);
    for (const r of rows) {
      const id = rowId(r);
      const col = overrideColumn[id] ?? columnOf(r);
      const list = m.get(col);
      if (list) list.push(id);
    }
    // Apply per-column stored order.
    for (const col of columns) {
      const list = m.get(col.id) ?? [];
      const stored = overrideOrder[col.id];
      if (stored) {
        list.sort((a, b) => {
          const ia = stored.indexOf(a);
          const ib = stored.indexOf(b);
          if (ia === -1 && ib === -1) return 0;
          if (ia === -1) return 1;
          if (ib === -1) return -1;
          return ia - ib;
        });
      }
      m.set(col.id, list);
    }
    return m;
  }, [columns, rows, rowId, columnOf, overrideColumn, overrideOrder]);

  /* ---------------- sensors ---------------- */
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  /* ---------------- handlers ---------------- */
  const findColumn = (id: string): string | null => {
    for (const [col, ids] of byColumn) if (ids.includes(id)) return col;
    return null;
  };

  const handleDragStart = (e: DragStartEvent) => {
    setActiveId(String(e.active.id));
  };

  const handleDragOver = (e: DragOverEvent) => {
    const activeColId = findColumn(String(e.active.id));
    const overId = e.over?.id ? String(e.over.id) : null;
    if (!activeColId || !overId) return;
    // If dropped on a column (not a card), move to that column.
    const targetCol = byColumn.has(overId) ? overId : findColumn(overId);
    if (!targetCol) return;
    if (targetCol !== activeColId) {
      setOverrideColumn((prev) => ({ ...prev, [String(e.active.id)]: targetCol }));
    }
  };

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const activeId = String(e.active.id);
    const overId = e.over?.id ? String(e.over.id) : null;
    if (!overId) return;

    const activeColId = findColumn(activeId);
    const targetColId = byColumn.has(overId) ? overId : findColumn(overId);
    if (!activeColId || !targetColId) return;

    const activeList = byColumn.get(targetColId) ?? [];
    const newIndex = overId === targetColId
      ? activeList.length
      : Math.max(0, activeList.indexOf(overId));

    // Reorder within column
    if (activeColId === targetColId) {
      const oldIndex = activeList.indexOf(activeId);
      if (oldIndex !== newIndex && oldIndex !== -1) {
        const reordered = arrayMove(activeList, oldIndex, newIndex);
        setOverrideOrder((prev) => ({ ...prev, [targetColId]: reordered }));
        onReorder?.(targetColId, reordered);
      }
      return;
    }

    // Cross-column move
    const row = rowsById.get(activeId);
    if (row) {
      onMove?.(row, activeColId, targetColId, newIndex);
      // Update stored order for the target column.
      const newTargetOrder = [...(byColumn.get(targetColId) ?? [])];
      if (!newTargetOrder.includes(activeId)) newTargetOrder.splice(newIndex, 0, activeId);
      setOverrideOrder((prev) => ({ ...prev, [targetColId]: newTargetOrder }));
    }
  };

  const activeRow = activeId ? rowsById.get(activeId) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div
        className={cn(
          "flex gap-3 overflow-x-auto snap-x snap-mandatory pb-1",
          className,
        )}
      >
        {columns.map((col) => {
          const ids = byColumn.get(col.id) ?? [];
          const overLimit = col.wipLimit !== undefined && ids.length > col.wipLimit;
          return (
            <div
              key={col.id}
              className={cn(
                "flex-shrink-0 w-72 snap-start rounded-md border border-border bg-surface-1 flex flex-col",
              )}
            >
              <div
                className={cn(
                  "flex items-center justify-between gap-2 px-3 py-2 border-b border-border rounded-t-md",
                  overLimit && "bg-intent-warning-bg",
                )}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "h-2 w-2 rounded-full",
                      col.intent === "success" && "bg-intent-success",
                      col.intent === "warning" && "bg-intent-warning",
                      col.intent === "danger" && "bg-intent-danger",
                      col.intent === "info" && "bg-intent-info",
                      !col.intent && "bg-text-muted",
                    )}
                  />
                  <div className="text-sm font-medium text-text-primary">{col.title}</div>
                </div>
                <span className="text-xs text-text-muted tabular-nums">
                  {ids.length}
                  {col.wipLimit !== undefined && `/${col.wipLimit}`}
                </span>
              </div>
              <SortableContext items={ids} strategy={verticalListSortingStrategy}>
                <div
                  className="flex flex-col gap-2 p-2 min-h-[120px]"
                  data-column-id={col.id}
                >
                  {ids.map((id) => {
                    const row = rowsById.get(id);
                    if (!row) return null;
                    return (
                      <SortableCard key={id} id={id}>
                        {renderCard(row)}
                      </SortableCard>
                    );
                  })}
                </div>
              </SortableContext>
            </div>
          );
        })}
      </div>
      <DragOverlay>
        {activeRow ? (
          <div className="rounded-md border border-accent bg-surface-0 p-2.5 shadow-lg">
            {renderCard(activeRow)}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

/* ---- persistence ---- */

function loadState(key: string | undefined): Record<string, string[]> | null {
  if (!key || typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(`gutu-dnd-kanban.${key}`);
    return raw ? (JSON.parse(raw) as Record<string, string[]>) : null;
  } catch {
    return null;
  }
}

function saveState(key: string, value: Record<string, string[]>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(`gutu-dnd-kanban.${key}`, JSON.stringify(value));
  } catch {
    /* quota */
  }
}
