import { describe, expect, it } from "bun:test";
import { adminContributions } from "../../src/ui/admin.contributions";
import { uiSurface } from "../../src/ui/surfaces";

describe("ui surface registration", () => {
  it("keeps a compatibility admin page for memory operations", () => {
    expect(uiSurface.embeddedPages).toHaveLength(1);
    expect(uiSurface.embeddedPages[0]?.route).toBe("/admin/ai-rag");
  });

  it("registers retrieval and memory diagnostics into the shared AI workspace", () => {
    expect(adminContributions.workspaces).toHaveLength(0);
    expect(adminContributions.pages.map((page) => page.route)).toContain("/admin/ai/memory");
    expect(adminContributions.pages.map((page) => page.route)).toContain("/admin/ai/retrieval");
    expect(adminContributions.reports[0]?.route).toBe("/admin/reports/ai-retrieval");
  });
});
