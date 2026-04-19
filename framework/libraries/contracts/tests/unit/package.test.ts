import { describe, expect, it } from "bun:test";

import { packageId, z } from "../../src";

describe("contracts", () => {
  it("exposes a stable package id", () => {
    expect(packageId).toBe("contracts");
  });

  it("re-exports zod for contract authors", () => {
    const schema = z.object({
      name: z.string()
    });

    expect(schema.parse({ name: "Ada" }).name).toBe("Ada");
  });
});
