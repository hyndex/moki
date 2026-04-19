import { describe, expect, it } from "bun:test";
import { uiSurface } from "../../src/ui/surfaces";

describe("ui surface registration", () => {
  it("registers admin and portal surfaces", () => {
    expect(uiSurface.embeddedPages).toHaveLength(2);
    expect(uiSurface.embeddedPages.map((page) => page.route)).toEqual(["/admin/portal-core", "/portal/home"]);
    expect(uiSurface.widgets).toHaveLength(1);
    expect(uiSurface.widgets[0]?.slot).toBe("portal.overview.summary");
  });
});
