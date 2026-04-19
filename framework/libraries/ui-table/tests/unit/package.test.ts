import { describe, expect, it } from "bun:test";
import {
  column,
  createPlatformTableOptions,
  createPlatformTableState,
  packageId,
  setPlatformColumnVisibility,
  setPlatformFilter,
  setPlatformSorting,
  togglePlatformRowSelection
} from "../../src";

describe("ui-table", () => {
  it("exposes a stable package id", () => {
    expect(packageId).toBe("ui-table");
  });

  it("builds standardized column definitions", () => {
    const columns = [
      column.text<{ name: string }>("name", { header: "Name" })
    ];

    expect(columns[0]?.meta).toEqual({
      kind: "text",
      header: "Name"
    });
  });

  it("creates table options with the core row model", () => {
    const options = createPlatformTableOptions({
      data: [{ name: "Ada" }],
      columns: [column.text<{ name: string }>("name", { header: "Name" })]
    });

    expect(options.data).toEqual([{ name: "Ada" }]);
    expect(options.columns).toHaveLength(1);
  });

  it("manages controlled admin-style table state", () => {
    let state = createPlatformTableState();
    state = togglePlatformRowSelection(state, "row-1");
    state = setPlatformColumnVisibility(state, "email", false);
    state = setPlatformSorting(state, [{ id: "createdAt", desc: true }]);
    state = setPlatformFilter(state, "status", "active");

    expect(state.selection["row-1"]).toBe(true);
    expect(state.columnVisibility.email).toBe(false);
    expect(state.sorting[0]).toEqual({ id: "createdAt", desc: true });
    expect(state.filters.status).toBe("active");
  });
});
