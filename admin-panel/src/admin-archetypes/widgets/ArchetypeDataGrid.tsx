import * as React from "react";
import {
  AdvancedDataTable,
  selectionColumn,
  type AdvancedDataTableProps,
} from "@/admin-primitives/AdvancedDataTable";
import type { ColumnDef } from "@tanstack/react-table";

/** Archetype-flavoured wrapper around the existing virtualised
 *  AdvancedDataTable. Used as the canonical S5 main canvas inside
 *  SmartList pages.
 *
 *  Features inherited from the underlying table:
 *    • Column pinning, reorder, resize, visibility persistence
 *    • Multi-column sort (shift-click)
 *    • Virtualised body for >200 rows (60fps target up to 100k)
 *    • Sticky header with shadow on scroll
 *    • Keyboard nav, accessible grid roles
 *
 *  This wrapper integrates with `useSelection<T['id']>()` from the
 *  archetype runtime: pass `selection={...}` and the grid syncs.
 *  Density is read from the page's data-density CSS var when not
 *  explicitly provided. */

export interface ArchetypeDataGridProps<T extends { id: string }> {
  rows: readonly T[];
  columns: readonly ColumnDef<T, unknown>[];
  /** Optional Set of selected row ids (e.g. from useSelection). */
  selectedIds?: ReadonlySet<string>;
  /** Called whenever the grid's selection changes. */
  onSelectionChange?: (next: Set<string>) => void;
  /** When true, prepend a checkbox column for selection. Default: true
   *  if `selectedIds` provided, else false. */
  selectable?: boolean;
  /** Row click handler. */
  onRowClick?: (row: T) => void;
  /** Density override; defaults to the page-level density. */
  density?: AdvancedDataTableProps<T>["density"];
  /** State key for persisting column config across mounts. */
  stateKey?: string;
  /** Loading state shown over the body. */
  loading?: boolean;
  /** Empty-state copy. */
  emptyTitle?: string;
  emptyDescription?: string;
  className?: string;
}

export function ArchetypeDataGrid<T extends { id: string }>(
  props: ArchetypeDataGridProps<T>,
): React.ReactElement {
  const {
    rows,
    columns,
    selectedIds,
    onSelectionChange,
    selectable,
    onRowClick,
    density,
    stateKey,
    loading,
    emptyTitle,
    emptyDescription,
    className,
  } = props;

  const allColumns = React.useMemo<ColumnDef<T, unknown>[]>(() => {
    const list = [...columns];
    if (selectable ?? !!selectedIds) {
      list.unshift(selectionColumn<T>());
    }
    return list;
  }, [columns, selectable, selectedIds]);

  // Bridge AdvancedDataTable's selection callback to the archetype Set.
  const onSel = React.useCallback(
    (ids: string[]) => {
      onSelectionChange?.(new Set(ids));
    },
    [onSelectionChange],
  );

  return (
    <AdvancedDataTable<T>
      rows={rows}
      columns={allColumns}
      getRowId={(row) => row.id}
      loading={loading}
      density={density}
      stateKey={stateKey}
      emptyTitle={emptyTitle ?? "No matching rows"}
      emptyDescription={emptyDescription ?? "Try adjusting filters or search."}
      onRowClick={onRowClick}
      onSelectionChange={onSel}
      className={className}
    />
  );
}

/** Helper that wires a `useSelection` hook's value into the data grid
 *  more ergonomically. */
export function bridgeSelection<Id extends string>(
  selection: { ids: ReadonlySet<Id>; setAll: (ids: Iterable<Id>) => void },
): {
  selectedIds: ReadonlySet<string>;
  onSelectionChange: (next: Set<string>) => void;
} {
  return {
    selectedIds: selection.ids as unknown as ReadonlySet<string>,
    onSelectionChange: (next) => selection.setAll(Array.from(next) as unknown as Id[]),
  };
}
