import { describe, expect, it } from "bun:test";
import { createNextZone, packageId } from "../../src";

describe("ui-zone-next", () => {
  it("exposes a stable package id", () => {
    expect(packageId).toBe("ui-zone-next");
  });

  it("creates a next zone with platform session defaults", () => {
    const zone = createNextZone({
      id: "ott-control-room",
      mountPath: "/studio/ott"
    });

    expect(zone.adapter).toBe("nextjs");
    expect(zone.assetPrefix).toBe("/studio/ott/_next");
    expect(zone.authMode).toBe("platform-session");
  });
});
