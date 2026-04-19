import { describe, expect, it } from "bun:test";
import { createStaticZone, packageId } from "../../src";

describe("ui-zone-static", () => {
  it("exposes a stable package id", () => {
    expect(packageId).toBe("ui-zone-static");
  });

  it("creates a static react zone with deterministic asset paths", () => {
    const zone = createStaticZone({
      id: "dispatch-board",
      mountPath: "/ops/dispatch"
    });

    expect(zone.adapter).toBe("static-react");
    expect(zone.assetPrefix).toBe("/ops/dispatch/assets");
    expect(zone.routeOwnership).toEqual(["/ops/dispatch"]);
  });
});
