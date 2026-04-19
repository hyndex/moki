import { describe, expect, it } from "bun:test";
import manifest from "../../package";

describe("admin shell workbench manifest", () => {
  it("claims the primary admin shell slots", () => {
    expect(manifest.id).toBe("admin-shell-workbench");
    expect(manifest.slotClaims).toContain("primary-admin-shell");
    expect(manifest.providesCapabilities).toContain("ui.admin.pages");
  });
});
