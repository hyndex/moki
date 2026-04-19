import { describe, expect, it } from "bun:test";
import { appId } from "../../src/index";

describe("app scaffold", () => {
  it("exposes a stable app id", () => {
    expect(appId).toBe("platform-dev-console");
  });
});