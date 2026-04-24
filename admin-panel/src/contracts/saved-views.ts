/** Saved view contract — filters + sort + columns + grouping per user/team/tenant. */

export type SavedViewScope = "personal" | "team" | "tenant";

export interface SortSpec {
  field: string;
  dir: "asc" | "desc";
}

/** Operator set — ERPNext-parity and beyond.
 *
 *  Value-taking operators:
 *    eq, neq, lt, lte, gt, gte, in, nin, contains, starts_with, ends_with,
 *    between (value = [min, max]), last_n_days (value = number)
 *  Unary (no value):
 *    is_empty, is_not_empty, is_null, is_not_null
 *  Relative date (no value — resolved server/client-side at evaluation time):
 *    today, yesterday, this_week, this_month, this_quarter, this_year,
 *    mtd, qtd, ytd, last_week, last_month, last_quarter, last_year
 */
export type FilterOp =
  | "eq"
  | "neq"
  | "lt"
  | "lte"
  | "gt"
  | "gte"
  | "in"
  | "nin"
  | "contains"
  | "not_contains"
  | "starts_with"
  | "ends_with"
  | "between"
  | "last_n_days"
  | "is_empty"
  | "is_not_empty"
  | "is_null"
  | "is_not_null"
  // date-relative (no value)
  | "today"
  | "yesterday"
  | "this_week"
  | "this_month"
  | "this_quarter"
  | "this_year"
  | "mtd"
  | "qtd"
  | "ytd"
  | "last_week"
  | "last_month"
  | "last_quarter"
  | "last_year";

export interface FilterLeaf {
  field: string;
  op: FilterOp;
  value?: unknown;
}

export type FilterTree =
  | FilterLeaf
  | { and: FilterTree[] }
  | { or: FilterTree[] };

export interface SavedView {
  id: string;
  resource: string;
  label: string;
  scope: SavedViewScope;
  ownerUserId?: string;
  teamId?: string;
  tenantId?: string;
  filter?: FilterTree;
  sort?: SortSpec[];
  columns?: readonly string[];
  grouping?: string;
  density?: "comfortable" | "compact" | "dense";
  pageSize?: number;
  pinned?: boolean;
  createdAt: string;
  updatedAt: string;
  isDefault?: boolean;
}

export interface SavedViewStore {
  list(resource: string): readonly SavedView[];
  get(id: string): SavedView | null;
  save(view: Omit<SavedView, "id" | "createdAt" | "updatedAt"> & { id?: string }): SavedView;
  delete(id: string): void;
  setDefault(resource: string, id: string | null): void;
  getDefault(resource: string): SavedView | null;
  subscribe(listener: () => void): () => void;
}
