import { describe, expect, it } from "bun:test";
import manifest from "../../package";

describe("plugin manifest", () => {
  it("keeps a stable package id and primary capability", () => {
    expect(manifest.id).toBe("document-core");
    expect(manifest.providesCapabilities).toContain("document.records");
  });
});