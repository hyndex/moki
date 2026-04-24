import * as React from "react";
import type { FilterTree } from "@/contracts/saved-views";
import type { WorkspaceFilterField } from "@/contracts/widgets";

/** The live filter tree for the surrounding workspace (may be undefined when
 *  there's no filter bar, or all fields are cleared). Each NumberCard / Chart /
 *  QuickList widget reads this and AND-merges it into its own spec. */
export const WorkspaceFilterContext = React.createContext<FilterTree | undefined>(
  undefined,
);

/** Hook — returns the current workspace filter (or undefined). */
export function useWorkspaceFilter(): FilterTree | undefined {
  return React.useContext(WorkspaceFilterContext);
}

/** AND-merge two filter trees. Returns undefined only when both are undefined.
 *  Collapses nested `and` groups to keep the shape flat. */
export function mergeFilters(
  a: FilterTree | undefined,
  b: FilterTree | undefined,
): FilterTree | undefined {
  if (!a) return b;
  if (!b) return a;
  const aAnd = "and" in a ? a.and : [a];
  const bAnd = "and" in b ? b.and : [b];
  const merged = [...aAnd, ...bAnd];
  if (merged.length === 1) return merged[0];
  return { and: merged };
}

/** Build a FilterTree from a bag of `{field: value}` entries, skipping empty
 *  values and translating per-field kind. */
export function buildFilterTree(
  fields: readonly WorkspaceFilterField[],
  values: Record<string, unknown>,
): FilterTree | undefined {
  const leaves: FilterTree[] = [];
  for (const f of fields) {
    const v = values[f.field];
    if (v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0)) {
      continue;
    }
    if (f.kind === "text") {
      leaves.push({ field: f.field, op: "contains", value: String(v) });
    } else if (f.kind === "enum") {
      leaves.push({ field: f.field, op: "eq", value: v });
    } else if (f.kind === "boolean") {
      leaves.push({ field: f.field, op: "eq", value: v === "true" || v === true });
    } else if (f.kind === "date-range" && Array.isArray(v) && v.length === 2) {
      const [from, to] = v as [string, string];
      if (from && to) {
        leaves.push({ field: f.field, op: "between", value: [from, to] });
      } else if (from) {
        leaves.push({ field: f.field, op: "gte", value: from });
      } else if (to) {
        leaves.push({ field: f.field, op: "lte", value: to });
      }
    }
  }
  if (leaves.length === 0) return undefined;
  if (leaves.length === 1) return leaves[0];
  return { and: leaves };
}
