import { describe, expect, it } from "bun:test";
import { executeAction } from "@platform/schema";
import manifest from "../../package";
import { registerPersonAction } from "../../src/actions/default.action";
import { registerPerson } from "../../src/services/main.service";

describe("plugin manifest", () => {
  it("keeps a stable package id and primary capability", () => {
    expect(manifest.id).toBe("user-directory");
    expect(manifest.providesCapabilities).toContain("directory.people");
  });

  it("normalizes directory keys to lowercase email addresses", () => {
    expect(
      registerPerson({
        personId: "1e1a5246-fba3-4d26-934f-692da7df7a2c",
        tenantId: "85d8fd9e-242c-4fd7-8821-864d54e17799",
        fullName: "Ada Lovelace",
        email: "Ada@example.com",
        employmentType: "employee",
        reason: "invite"
      })
    ).toEqual({
      ok: true,
      nextStatus: "invited",
      directoryKey: "ada@example.com"
    });
  });

  it("keeps the registration action contract stable", async () => {
    const result = await executeAction(registerPersonAction, {
      personId: "1e1a5246-fba3-4d26-934f-692da7df7a2c",
      tenantId: "85d8fd9e-242c-4fd7-8821-864d54e17799",
      fullName: "Ada Lovelace",
      email: "Ada@example.com",
      employmentType: "employee",
      reason: "onboard employee"
    });

    expect(result).toEqual({
      ok: true,
      nextStatus: "active",
      directoryKey: "ada@example.com"
    });
  });
});
