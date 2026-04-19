import { describe, expect, it } from "bun:test";

import { createPlatformTableState } from "@platform/ui-table";

import {
  applySavedViewSnapshot,
  createSavedViewSnapshot,
  createVirtualWindowState,
  filterPermittedActions,
  getVirtualRows,
  packageId
} from "../../src";

describe("data-table", () => {
  it("exposes a stable package id", () => {
    expect(packageId).toBe("data-table");
  });

  it("creates virtual row windows and applies saved views", () => {
    const virtualRows = getVirtualRows(
      createVirtualWindowState({
        count: 100,
        viewportSize: 120,
        estimateSize: 30,
        scrollOffset: 60
      })
    );
    const snapshot = createSavedViewSnapshot({
      id: "contacts.active",
      label: "Active Contacts",
      sorting: [{ id: "createdAt", desc: true }],
      filters: { lifecycleStatus: "active" },
      columnVisibility: { email: true, phone: false }
    });
    const nextState = applySavedViewSnapshot(createPlatformTableState(), snapshot);

    expect(virtualRows[0]?.index).toBeLessThanOrEqual(2);
    expect(virtualRows.at(-1)?.index).toBeGreaterThanOrEqual(6);
    expect(nextState.filters.lifecycleStatus).toBe("active");
  });

  it("filters actions by permission", () => {
    const actions = filterPermittedActions(
      [
        { id: "export", permission: "contacts.export" },
        { id: "view" }
      ],
      ["contacts.view"]
    );

    expect(actions).toHaveLength(1);
    expect(actions[0]?.id).toBe("view");
  });
});
