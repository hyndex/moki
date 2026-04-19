import {
  type ColumnDef,
  type RowData,
  getCoreRowModel,
  useReactTable
} from "@tanstack/react-table";

export const packageId = "ui-table" as const;
export const packageDisplayName = "UI Table" as const;
export const packageDescription = "TanStack Table wrapper APIs." as const;

export type PlatformColumnMeta = {
  kind: "text" | "number" | "enum" | "date";
  header: string;
};

export type PlatformSortState = Array<{ id: string; desc: boolean }>;
export type PlatformFilterValue = string | number | boolean | readonly string[] | null;
export type PlatformFilterState = Record<string, PlatformFilterValue>;
export type PlatformSelectionState = Record<string, boolean>;
export type PlatformPaginationState = {
  pageIndex: number;
  pageSize: number;
};
export type PlatformTableState = {
  sorting: PlatformSortState;
  filters: PlatformFilterState;
  selection: PlatformSelectionState;
  columnVisibility: Record<string, boolean>;
  pagination: PlatformPaginationState;
};

type ColumnBuilderOptions = {
  header: string;
};

export const column = {
  text<TData extends RowData>(accessorKey: keyof TData & string, options: ColumnBuilderOptions): ColumnDef<TData> {
    return {
      accessorKey,
      header: options.header,
      meta: {
        kind: "text",
        header: options.header
      } satisfies PlatformColumnMeta
    };
  },
  number<TData extends RowData>(accessorKey: keyof TData & string, options: ColumnBuilderOptions): ColumnDef<TData> {
    return {
      accessorKey,
      header: options.header,
      meta: {
        kind: "number",
        header: options.header
      } satisfies PlatformColumnMeta
    };
  },
  enum<TData extends RowData>(accessorKey: keyof TData & string, options: ColumnBuilderOptions): ColumnDef<TData> {
    return {
      accessorKey,
      header: options.header,
      meta: {
        kind: "enum",
        header: options.header
      } satisfies PlatformColumnMeta
    };
  },
  date<TData extends RowData>(accessorKey: keyof TData & string, options: ColumnBuilderOptions): ColumnDef<TData> {
    return {
      accessorKey,
      header: options.header,
      meta: {
        kind: "date",
        header: options.header
      } satisfies PlatformColumnMeta
    };
  }
};

export function createPlatformTableOptions<TData extends RowData>(input: {
  data: TData[];
  columns: ColumnDef<TData>[];
}) {
  return {
    data: input.data,
    columns: input.columns,
    getCoreRowModel: getCoreRowModel()
  };
}

export function usePlatformTable<TData extends RowData>(input: {
  data: TData[];
  columns: ColumnDef<TData>[];
}) {
  return useReactTable(createPlatformTableOptions(input));
}

export function createPlatformTableState(
  input: Partial<PlatformTableState> = {}
): PlatformTableState {
  return {
    sorting: [...(input.sorting ?? [])],
    filters: { ...(input.filters ?? {}) },
    selection: { ...(input.selection ?? {}) },
    columnVisibility: { ...(input.columnVisibility ?? {}) },
    pagination: {
      pageIndex: input.pagination?.pageIndex ?? 0,
      pageSize: input.pagination?.pageSize ?? 25
    }
  };
}

export function togglePlatformRowSelection(state: PlatformTableState, rowId: string): PlatformTableState {
  return createPlatformTableState({
    ...state,
    selection: {
      ...state.selection,
      [rowId]: !state.selection[rowId]
    }
  });
}

export function setPlatformColumnVisibility(
  state: PlatformTableState,
  columnId: string,
  visible: boolean
): PlatformTableState {
  return createPlatformTableState({
    ...state,
    columnVisibility: {
      ...state.columnVisibility,
      [columnId]: visible
    }
  });
}

export function setPlatformSorting(
  state: PlatformTableState,
  sorting: PlatformSortState
): PlatformTableState {
  return createPlatformTableState({
    ...state,
    sorting
  });
}

export function setPlatformFilter(
  state: PlatformTableState,
  filterKey: string,
  value: PlatformFilterValue
): PlatformTableState {
  return createPlatformTableState({
    ...state,
    filters: {
      ...state.filters,
      [filterKey]: value
    }
  });
}
