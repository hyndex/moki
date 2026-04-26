import * as React from "react";
import { X, Plus } from "lucide-react";
import { Button } from "@/primitives/Button";
import { Page } from "../slots/Page";
import { PageHeaderSlot } from "../slots/PageHeaderSlot";
import { MainCanvas } from "../slots/MainCanvas";
import { cn } from "@/lib/cn";
import type { Density } from "../types";

export interface ComparatorRow<T> {
  /** Stable id for the row (for keying). */
  id: string;
  /** Render the cell for the given entity in this row. */
  render: (entity: T) => React.ReactNode;
  /** Display label (rendered in the leftmost / sticky column). */
  label: React.ReactNode;
  /** When true, the row is highlighted with a difference indicator if
   *  values differ across entities. */
  diff?: boolean;
  /** Comparator used by `diff` to detect differences. By default the
   *  `JSON.stringify` of the rendered ReactNode is compared (cheap and
   *  works for primitive cells; pass a custom function for objects). */
  equals?: (a: T, b: T) => boolean;
}

export interface ComparatorArchetypeProps<T> {
  id: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Entities to compare. Order is preserved. */
  entities: readonly T[];
  /** Stable id getter for each entity. */
  getEntityId: (entity: T) => string;
  /** Display label for the column header. */
  getEntityLabel: (entity: T) => React.ReactNode;
  /** Rows of comparison metrics. */
  rows: readonly ComparatorRow<T>[];
  /** Optional callback to remove an entity from the compare set. */
  onRemove?: (entity: T) => void;
  /** Optional callback to add an entity (e.g., open a picker). */
  onAdd?: () => void;
  /** Right-side actions on the page header. */
  actions?: React.ReactNode;
  density?: Density;
  className?: string;
}

/** Half-archetype: side-by-side comparator. The leftmost column is
 *  sticky (for scroll); each subsequent column is one entity. Rows
 *  marked `diff: true` highlight cells that differ across entities.
 *
 *  Pages: pass any `T[]` (people, deals, products, plans, etc.) and a
 *  list of rows. The comparator handles layout, scroll, removal, and
 *  diff highlighting; consumers focus on rendering individual cells. */
export function ComparatorArchetype<T>({
  id,
  title,
  subtitle,
  entities,
  getEntityId,
  getEntityLabel,
  rows,
  onRemove,
  onAdd,
  actions,
  density = "comfortable",
  className,
}: ComparatorArchetypeProps<T>) {
  const headerCellW = 200;

  return (
    <Page archetype="detail-rich" id={id} density={density} className={className}>
      <PageHeaderSlot title={title} subtitle={subtitle} actions={actions} />
      <MainCanvas>
        <div className="rounded-lg border border-border overflow-x-auto bg-surface-0">
          <div
            role="grid"
            aria-label={typeof title === "string" ? title : "Comparison"}
            className="grid"
            style={{
              gridTemplateColumns: `${headerCellW}px repeat(${entities.length}, minmax(220px, 1fr))`,
            }}
          >
            {/* Header row */}
            <div role="columnheader" className="sticky left-0 bg-surface-1 px-3 py-2 border-b border-r border-border text-[10px] font-semibold uppercase tracking-wide text-text-muted">
              Compare
            </div>
            {entities.map((e) => (
              <div
                key={getEntityId(e)}
                role="columnheader"
                className="px-3 py-2 border-b border-border bg-surface-1 flex items-center justify-between gap-2"
              >
                <span className="text-sm font-semibold text-text-primary truncate">
                  {getEntityLabel(e)}
                </span>
                {onRemove && (
                  <button
                    type="button"
                    onClick={() => onRemove(e)}
                    aria-label={`Remove ${typeof getEntityLabel(e) === "string" ? getEntityLabel(e) : "entity"} from comparison`}
                    className="p-0.5 rounded hover:bg-surface-2 text-text-muted hover:text-text-primary"
                  >
                    <X className="h-3 w-3" aria-hidden />
                  </button>
                )}
              </div>
            ))}

            {/* Body */}
            {rows.map((row) => {
              const cells = entities.map((e) => row.render(e));
              const showDiff =
                row.diff === true && entities.length > 1 && (
                  row.equals
                    ? !entities.every((e, i) => i === 0 || row.equals!(entities[0], e))
                    : new Set(cells.map((c) => JSON.stringify(c))).size > 1
                );
              return (
                <React.Fragment key={row.id}>
                  <div
                    role="rowheader"
                    className={cn(
                      "sticky left-0 bg-surface-canvas px-3 py-2 border-b border-r border-border-subtle text-sm text-text-muted",
                      showDiff && "bg-warning-soft/15",
                    )}
                  >
                    <span className="flex items-center gap-1.5">
                      {row.label}
                      {showDiff && <span className="h-1.5 w-1.5 rounded-full bg-warning" aria-hidden title="Differs across entities" />}
                    </span>
                  </div>
                  {cells.map((cell, i) => (
                    <div
                      key={`${row.id}-${i}`}
                      role="gridcell"
                      className={cn(
                        "px-3 py-2 border-b border-border-subtle text-sm text-text-primary",
                        showDiff && "bg-warning-soft/5",
                      )}
                    >
                      {cell}
                    </div>
                  ))}
                </React.Fragment>
              );
            })}
          </div>
        </div>
        {onAdd && (
          <Button variant="outline" size="sm" onClick={onAdd}>
            <Plus className="h-4 w-4 mr-1" aria-hidden /> Add to compare
          </Button>
        )}
      </MainCanvas>
    </Page>
  );
}
