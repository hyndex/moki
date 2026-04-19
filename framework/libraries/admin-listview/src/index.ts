import type { ResourceDefinition } from "@platform/schema";
import type { PlatformQueryScope } from "@platform/query";
import type { PlatformFilterState, PlatformSortState, PlatformTableState } from "@platform/data-table";

export const packageId = "admin-listview" as const;
export const packageDisplayName = "Admin List View" as const;
export const packageDescription = "List view DSLs, saved views, and resource-derived admin table helpers." as const;

export type ListColumnDefinition = {
  key: string;
  label: string;
  sortable?: boolean | undefined;
  searchable?: boolean | undefined;
};

export type ListFilterDefinition = {
  key: string;
  type: "text" | "date" | "date-range" | "select" | "number" | "user-select";
};

export type BulkActionDefinition = {
  id: string;
  action: string;
  permission?: string | undefined;
};

export type SavedViewDefinition = {
  id: string;
  label: string;
  filterState: PlatformFilterState;
  sortState: PlatformSortState;
  columnVisibility: Record<string, boolean>;
};

export type ListViewDefinition = {
  id: string;
  resource: string;
  columns: ListColumnDefinition[];
  filters: ListFilterDefinition[];
  bulkActions: BulkActionDefinition[];
  rowActions?: BulkActionDefinition[] | undefined;
  export?: Array<"csv" | "xlsx" | "json"> | undefined;
};

export type ListViewState = {
  queryScope: PlatformQueryScope;
  table: PlatformTableState;
  search: string;
  savedViewId?: string | undefined;
};

export function defineListView(definition: ListViewDefinition): ListViewDefinition {
  return Object.freeze({
    ...definition,
    columns: [...definition.columns].sort((left, right) => left.key.localeCompare(right.key)),
    filters: [...definition.filters].sort((left, right) => left.key.localeCompare(right.key)),
    bulkActions: [...definition.bulkActions].sort((left, right) => left.id.localeCompare(right.id)),
    rowActions: [...(definition.rowActions ?? [])].sort((left, right) => left.id.localeCompare(right.id)),
    export: [...(definition.export ?? ["csv"])].sort((left, right) => left.localeCompare(right))
  });
}

export function createListState(input: {
  resource: string;
  workspace: string;
  tenantId: string;
  actorId: string;
  table: PlatformTableState;
  search?: string | undefined;
  savedViewId?: string | undefined;
}): ListViewState {
  const queryScope: PlatformQueryScope = ["admin", input.workspace, input.resource, input.tenantId, input.actorId];

  return {
    queryScope,
    table: input.table,
    search: input.search ?? "",
    savedViewId: input.savedViewId
  };
}

export function serializeSavedView(savedView: SavedViewDefinition): string {
  return JSON.stringify(savedView);
}

export function deserializeSavedView(serialized: string): SavedViewDefinition {
  return JSON.parse(serialized) as SavedViewDefinition;
}

export function createListViewFromResource(resource: ResourceDefinition): ListViewDefinition {
  return defineListView({
    id: `${resource.id}.auto-list`,
    resource: resource.id,
    columns: resource.admin.defaultColumns.map((field) => ({
      key: field,
      label: resource.fields[field]?.label ?? field,
      sortable: resource.fields[field]?.sortable ?? false,
      searchable: resource.fields[field]?.searchable ?? false
    })),
    filters: Object.entries(resource.fields)
      .filter(([, config]) => config.filter)
      .map(([field, config]) => ({
        key: field,
        type: config.filter ?? "text"
      })),
    bulkActions: [],
    export: ["csv", "xlsx", "json"]
  });
}
