import * as React from "react";
import { Spinner } from "@/primitives/Spinner";
import { useList } from "@/runtime/hooks";
import { useRuntime } from "@/runtime/context";
import { DnDKanban, type DnDKanbanColumn } from "./DnDKanban";
import { ErrorState } from "./ErrorState";

/** Production live-data Kanban —
 *
 *  Fetches rows from the configured resource, groups them into columns by
 *  `statusField`, and wires `onMove` to a real `update()` mutation that
 *  persists the new column. Optimistic via dnd-kit's internal override, and
 *  confirmed when the realtime invalidation fires and the cache refetches.
 *
 *  Everything ERPNext's kanban does + more:
 *    - Drag between columns (and backend gets updated)
 *    - Drag to reorder within a column (persisted in localStorage; server
 *      doesn't need to store order)
 *    - WIP limits per column (amber header over cap)
 *    - Pointer / touch / keyboard sensors (a11y)
 *    - Error + empty + loading states
 *    - Real-time: auto-refetch on realtime:resource-changed events
 *
 *  The caller supplies the columns, the status field, and a card renderer;
 *  the hook does the rest.
 */

export interface LiveDnDKanbanProps<T extends { id: unknown }> {
  resource: string;
  /** Field on the row whose value is the column id (e.g. "status"). */
  statusField: keyof T & string;
  columns: readonly DnDKanbanColumn<T>[];
  renderCard: (row: T) => React.ReactNode;
  /** Optional row filter (e.g. exclude archived) applied client-side. */
  filter?: (row: T) => boolean;
  /** Page size for the initial fetch. Default 200 — enough for typical boards. */
  pageSize?: number;
  /** Custom mutation. Default: `runtime.resources.update(resource, id, { [statusField]: toColumn })`. */
  onMove?: (row: T, fromColumn: string, toColumn: string) => Promise<void> | void;
  /** Optional click-to-open for cards. */
  onCardClick?: (row: T) => void;
  stateKey?: string;
  className?: string;
}

export function LiveDnDKanban<T extends { id: unknown }>({
  resource,
  statusField,
  columns,
  renderCard,
  filter,
  pageSize = 200,
  onMove,
  onCardClick,
  stateKey,
  className,
}: LiveDnDKanbanProps<T>) {
  const runtime = useRuntime();
  const { data, loading, error, refetch } = useList(resource, { page: 1, pageSize });

  const rows = React.useMemo(() => {
    const base = (data?.rows ?? []) as unknown as T[];
    return filter ? base.filter(filter) : base;
  }, [data?.rows, filter]);

  const handleMove = React.useCallback(
    async (row: T, fromColumn: string, toColumn: string /*, _idx: number */) => {
      // Custom hook wins if provided.
      if (onMove) {
        try {
          await onMove(row, fromColumn, toColumn);
          return;
        } catch (err) {
          runtime.actions.toast({
            title: "Move failed",
            description: err instanceof Error ? err.message : String(err),
            intent: "danger",
          });
          return;
        }
      }
      // Default: patch the status field.
      const id = String((row as unknown as { id: unknown }).id);
      try {
        await runtime.resources.update(resource, id, {
          [statusField]: toColumn,
        } as Partial<Record<string, unknown>>);
        runtime.actions.toast({
          title: `Moved to ${toColumn}`,
          intent: "success",
        });
      } catch (err) {
        runtime.actions.toast({
          title: "Move failed",
          description: err instanceof Error ? err.message : String(err),
          intent: "danger",
        });
        // Force refetch to snap the card back.
        refetch();
      }
    },
    [onMove, runtime, resource, statusField, refetch],
  );

  if (error) return <ErrorState error={error} onRetry={refetch} />;
  if (loading && rows.length === 0) {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-xs text-text-muted">
        <Spinner size={12} /> Loading board…
      </div>
    );
  }

  return (
    <div className={className} onClick={(e) => e.stopPropagation()}>
      <DnDKanban<T>
        columns={columns}
        rows={rows}
        rowId={(r) => String((r as unknown as { id: unknown }).id)}
        columnOf={(r) => String(r[statusField] ?? columns[0]?.id ?? "")}
        renderCard={(r) =>
          onCardClick ? (
            <div
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onCardClick(r);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onCardClick(r);
                }
              }}
            >
              {renderCard(r)}
            </div>
          ) : (
            renderCard(r)
          )
        }
        onMove={(row, from, to /*, idx */) => void handleMove(row, from, to)}
        stateKey={stateKey ?? resource}
      />
    </div>
  );
}
