import { describe, expect, it } from "bun:test";
import { z } from "zod";

import {
  createAsyncFieldValidationAdapter,
  createDirtyStateGuard,
  createFieldRegistry,
  createFormDefaults,
  createRelationFieldAdapter,
  mapSubmissionErrors,
  packageId,
  resolveFieldPresentation
} from "../../src";

describe("ui-form", () => {
  it("exposes a stable package id", () => {
    expect(packageId).toBe("ui-form");
  });

  it("maps zod errors into field errors", () => {
    const result = z.object({
      email: z.string().email()
    }).safeParse({
      email: "not-an-email"
    });

    if (result.success) {
      throw new Error("expected parse to fail");
    }

    expect(mapSubmissionErrors(result.error).fieldErrors.email).toBeDefined();
  });

  it("creates form defaults through the form schema", () => {
    const schema = z.object({
      name: z.string().min(1),
      active: z.boolean().default(true)
    });

    expect(
      createFormDefaults(schema, {
        name: "Ada",
        active: true
      })
    ).toEqual({
      name: "Ada",
      active: true
    });
  });

  it("provides registry, relation, async validation, and dirty-state helpers", async () => {
    const registry = createFieldRegistry([
      { kind: "relation", componentId: "RelationField", supportsReadonly: true }
    ]);
    const relation = createRelationFieldAdapter({
      loadOptions(query) {
        return [{ id: query, label: query.toUpperCase() }];
      },
      resolveLabel(id) {
        return id.toUpperCase();
      }
    });
    const validate = createAsyncFieldValidationAdapter((value: string) =>
      value.includes("@") ? undefined : "email required"
    );
    const guard = createDirtyStateGuard({ email: "ada@example.com" });

    expect(registry.get("relation")?.componentId).toBe("RelationField");
    expect(await relation.loadOptions("ada")).toEqual([{ id: "ada", label: "ADA" }]);
    expect(await relation.resolveLabel("ada")).toBe("ADA");
    expect(await validate("ada")).toBe("email required");
    expect(await validate("ada@example.com")).toBe(true);
    expect(guard.isDirty({ email: "ada@example.com" })).toBe(false);
    expect(guard.isDirty({ email: "grace@example.com" })).toBe(true);
    expect(resolveFieldPresentation({ readOnly: true, masked: false })).toEqual({ readOnly: true, masked: false });
  });
});
