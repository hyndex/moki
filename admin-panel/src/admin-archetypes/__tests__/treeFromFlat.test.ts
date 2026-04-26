/** Pure-function tests for the tree builder used by Tree Explorer pages
 *  (BOM, OBC, folder views). Covers single-root, multi-root, orphan
 *  promotion, and stable sibling ordering. */

import { describe, test, expect } from "bun:test";
import { buildTreeFromFlat } from "../widgets/_treeFromFlat";

describe("buildTreeFromFlat", () => {
  test("returns empty array for empty input", () => {
    expect(buildTreeFromFlat([])).toEqual([]);
  });

  test("builds a single-root tree", () => {
    const rows = [
      { id: "A", parentId: null, sortKey: "01" },
      { id: "B", parentId: "A", sortKey: "01.01" },
      { id: "C", parentId: "A", sortKey: "01.02" },
      { id: "D", parentId: "B", sortKey: "01.01.01" },
    ];
    const roots = buildTreeFromFlat(rows);
    expect(roots.length).toBe(1);
    expect(roots[0]!.row.id).toBe("A");
    expect(roots[0]!.children.map((c) => c.row.id)).toEqual(["B", "C"]);
    expect(roots[0]!.children[0]!.children[0]!.row.id).toBe("D");
  });

  test("supports multiple roots", () => {
    const rows = [
      { id: "X", parentId: null, sortKey: "01" },
      { id: "Y", parentId: null, sortKey: "02" },
      { id: "X1", parentId: "X" },
    ];
    const roots = buildTreeFromFlat(rows);
    expect(roots.map((r) => r.row.id)).toEqual(["X", "Y"]);
    expect(roots[0]!.children[0]!.row.id).toBe("X1");
  });

  test("promotes orphans to roots without dropping rows", () => {
    const rows = [
      { id: "A", parentId: null, sortKey: "01" },
      { id: "Z", parentId: "missing-parent", sortKey: "99" },
    ];
    const roots = buildTreeFromFlat(rows);
    expect(roots.length).toBe(2);
    expect(roots.map((r) => r.row.id).sort()).toEqual(["A", "Z"]);
  });

  test("uses sortKey for stable sibling order regardless of input order", () => {
    const a = [
      { id: "ROOT", parentId: null, sortKey: "01" },
      { id: "C", parentId: "ROOT", sortKey: "01.03" },
      { id: "A", parentId: "ROOT", sortKey: "01.01" },
      { id: "B", parentId: "ROOT", sortKey: "01.02" },
    ];
    const b = [a[0]!, a[2]!, a[3]!, a[1]!]; // shuffled — different order
    const aSiblings = buildTreeFromFlat(a)[0]!.children.map((c) => c.row.id);
    const bSiblings = buildTreeFromFlat(b)[0]!.children.map((c) => c.row.id);
    expect(aSiblings).toEqual(["A", "B", "C"]);
    expect(bSiblings).toEqual(["A", "B", "C"]);
  });

  test("treats empty-string parentId as no parent", () => {
    const rows = [
      { id: "A", parentId: "", sortKey: "01" },
      { id: "B", parentId: "A", sortKey: "01.01" },
    ];
    const roots = buildTreeFromFlat(rows);
    expect(roots.length).toBe(1);
    expect(roots[0]!.row.id).toBe("A");
    expect(roots[0]!.children[0]!.row.id).toBe("B");
  });
});
