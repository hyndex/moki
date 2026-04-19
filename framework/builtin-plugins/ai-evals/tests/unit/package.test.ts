import { describe, expect, it } from "bun:test";
import manifest from "../../package";

describe("plugin manifest", () => {
  it("keeps a stable package id and primary capability", () => {
    expect(manifest.id).toBe("ai-evals");
    expect(manifest.kind).toBe("ai-pack");
    expect(manifest.providesCapabilities).toContain("ai.evals");
  });
});
