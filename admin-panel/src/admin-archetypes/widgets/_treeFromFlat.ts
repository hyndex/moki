/** Build a tree from a flat list of parent-pointer rows. Used by Tree
 *  Explorer pages (BOM, OBC, folder views) that read the rows from a
 *  resource and want to render them hierarchically without a recursive
 *  backend query.
 *
 *  Sibling order is anchored on the optional `sortKey` field — pages can
 *  hand the backend a deterministic key so renders stay stable across
 *  refetches. Falls back to `id` lex order when no sortKey is present. */

export interface FlatTreeRow {
  id: string;
  parentId?: string | null;
  sortKey?: string;
}

export interface TreeNode<T extends FlatTreeRow> {
  row: T;
  children: Array<TreeNode<T>>;
}

/** Reconstruct one or more trees. Returns the array of root nodes — for
 *  single-root trees the caller can read `result[0]`. Orphans (rows whose
 *  parent isn't in the input) are promoted to roots so nothing is dropped. */
export function buildTreeFromFlat<T extends FlatTreeRow>(rows: readonly T[]): Array<TreeNode<T>> {
  if (rows.length === 0) return [];
  const sorted = [...rows].sort((a, b) =>
    (a.sortKey ?? a.id ?? "").localeCompare(b.sortKey ?? b.id ?? ""),
  );
  const map = new Map<string, TreeNode<T>>();
  for (const row of sorted) {
    map.set(row.id, { row, children: [] });
  }
  const roots: Array<TreeNode<T>> = [];
  for (const row of sorted) {
    const node = map.get(row.id)!;
    const parentId = row.parentId && row.parentId.length > 0 ? row.parentId : null;
    if (!parentId) {
      roots.push(node);
      continue;
    }
    const parent = map.get(parentId);
    if (parent) parent.children.push(node);
    else roots.push(node); // orphan
  }
  return roots;
}
