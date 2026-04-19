import { describe, expect, it } from "bun:test";

import { createAutosaveController, packageId, resolveFieldAccess } from "../../src";

describe("form", () => {
  it("exposes a stable package id", () => {
    expect(packageId).toBe("form");
  });

  it("resolves field access and autosaves values", async () => {
    const state = resolveFieldAccess({
      field: "salary",
      rules: [
        {
          field: "salary",
          permission: "hr.salary.read",
          whenDenied: "masked"
        }
      ],
      grantedPermissions: []
    });
    const saves: string[] = [];
    const autosave = createAutosaveController({
      delayMs: 0,
      onSave(value: { name: string }) {
        saves.push(value.name);
      }
    });

    autosave.schedule({ name: "Ada" });
    await autosave.flush();

    expect(state.masked).toBe(true);
    expect(saves).toEqual(["Ada"]);
  });
});
