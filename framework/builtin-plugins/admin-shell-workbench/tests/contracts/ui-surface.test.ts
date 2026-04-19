import { describe, expect, it } from "bun:test";

import { uiSurface } from "../../src/ui/surfaces";

describe("admin shell workbench ui surface", () => {
  it("registers a desk-status admin page", () => {
    expect(uiSurface.embeddedPages).toHaveLength(1);
    expect(uiSurface.embeddedPages[0]?.route).toBe("/admin/desk-status");
  });
});
