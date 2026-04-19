import { describe, expect, it } from "bun:test";
import { adminContributions } from "../../src/ui/admin.contributions";
import { uiSurface } from "../../src/ui/surfaces";

describe("ui surface registration", () => {
  it("keeps a compatibility admin page for eval review", () => {
    expect(uiSurface.embeddedPages).toHaveLength(1);
    expect(uiSurface.embeddedPages[0]?.route).toBe("/admin/ai-evals");
  });

  it("registers eval review surfaces in the shared AI workspace", () => {
    expect(adminContributions.workspaces).toHaveLength(0);
    expect(adminContributions.pages[0]?.route).toBe("/admin/ai/evals");
    expect(adminContributions.reports[0]?.route).toBe("/admin/reports/ai-regressions");
  });
});
