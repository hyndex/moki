import { defaultRangeExtractor, useVirtualizer } from "@tanstack/react-virtual";

export const packageId = "data-table" as const;
export const packageDisplayName = "Data Table" as const;
export const packageDescription = "Canonical data-table wrapper with TanStack Table and Virtual helpers." as const;

export * from "@platform/ui-table";

export type PlatformVirtualWindowState = {
  count: number;
  estimateSize: number;
  viewportSize: number;
  scrollOffset: number;
  overscan: number;
};

export type PlatformVirtualRow = {
  index: number;
  key: string;
  start: number;
  end: number;
  size: number;
};

export type PlatformSavedViewSnapshot = {
  id: string;
  label: string;
  sorting: Array<{ id: string; desc: boolean }>;
  filters: Record<string, string | number | boolean | readonly string[] | null>;
  columnVisibility: Record<string, boolean>;
};

export function createVirtualWindowState(input: Partial<PlatformVirtualWindowState> & Pick<PlatformVirtualWindowState, "count">): PlatformVirtualWindowState {
  return {
    count: input.count,
    estimateSize: input.estimateSize ?? 48,
    viewportSize: input.viewportSize ?? 480,
    scrollOffset: input.scrollOffset ?? 0,
    overscan: input.overscan ?? 4
  };
}

export function getVirtualRows(state: PlatformVirtualWindowState): PlatformVirtualRow[] {
  if (state.count === 0) {
    return [];
  }

  const visibleStart = Math.max(0, Math.floor(state.scrollOffset / state.estimateSize));
  const visibleEnd = Math.min(
    state.count - 1,
    Math.ceil((state.scrollOffset + state.viewportSize) / state.estimateSize)
  );
  const indexes = defaultRangeExtractor({
    count: state.count,
    startIndex: visibleStart,
    endIndex: visibleEnd,
    overscan: state.overscan
  });

  return indexes.map((index) => ({
    index,
    key: `row-${index}`,
    start: index * state.estimateSize,
    end: index * state.estimateSize + state.estimateSize,
    size: state.estimateSize
  }));
}

export function usePlatformVirtualRows(input: {
  count: number;
  estimateSize: number;
  overscan?: number | undefined;
  getScrollElement: () => HTMLElement | null;
}) {
  return useVirtualizer({
    count: input.count,
    estimateSize: () => input.estimateSize,
    getScrollElement: input.getScrollElement,
    overscan: input.overscan ?? 4
  });
}

export function createSavedViewSnapshot(input: PlatformSavedViewSnapshot): PlatformSavedViewSnapshot {
  return Object.freeze({
    ...input,
    sorting: [...input.sorting],
    filters: { ...input.filters },
    columnVisibility: { ...input.columnVisibility }
  });
}

export function applySavedViewSnapshot<TState extends {
  sorting: Array<{ id: string; desc: boolean }>;
  filters: Record<string, string | number | boolean | readonly string[] | null>;
  columnVisibility: Record<string, boolean>;
}>(state: TState, snapshot: PlatformSavedViewSnapshot): TState {
  return {
    ...state,
    sorting: [...snapshot.sorting],
    filters: { ...snapshot.filters },
    columnVisibility: { ...snapshot.columnVisibility }
  };
}

export function filterPermittedActions<TAction extends { permission?: string | undefined }>(
  actions: TAction[],
  grantedPermissions: string[]
): TAction[] {
  const granted = new Set(grantedPermissions);
  return actions.filter((action) => !action.permission || granted.has(action.permission));
}
