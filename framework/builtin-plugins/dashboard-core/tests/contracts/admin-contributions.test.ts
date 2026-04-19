import { describe, expect, it } from "bun:test";

import { adminContributions } from "../../src/ui/admin.contributions";

describe("dashboard core admin contributions", () => {
  it("registers overview workspaces, operator surfaces, widgets, reports, and builders", () => {
    expect(adminContributions.workspaces.map((workspace) => workspace.id)).toEqual(["overview", "reports"]);
    expect(adminContributions.pages[0]?.route).toBe("/admin");
    expect(adminContributions.widgets.map((widget) => widget.slot)).toContain("dashboard.home");
    expect(adminContributions.reports[0]?.route).toBe("/admin/reports/dashboard-activity");
    expect(adminContributions.builders.map((builder) => builder.route)).toContain("/admin/tools/report-builder");
    expect(adminContributions.nav.some((group) => group.workspace === "tools")).toBe(true);
  });
});
