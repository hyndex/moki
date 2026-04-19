import { describe, expect, it } from "bun:test";

import { adminContributions } from "../../src/ui/admin.contributions";
import { pageBuilderZone } from "../../src/ui/zone";

describe("page builder admin contributions", () => {
  it("registers tool workspace, builder route, and governed zone launcher", () => {
    expect(adminContributions.workspaces[0]?.id).toBe("tools");
    expect(adminContributions.builders[0]?.route).toBe("/admin/tools/page-builder");
    expect(adminContributions.zoneLaunchers[0]?.route).toBe("/apps/page-builder");
    expect(pageBuilderZone.mountPath).toBe("/apps/page-builder");
  });
});
