import { describe, expect, it } from "bun:test";
import { z } from "zod";

import { defineAction, defineResource, executeAction, normalizeActionInput, toJsonSchema } from "../../src";

describe("schema DSLs", () => {
  it("defines resources with deterministic field ordering", () => {
    const resource = defineResource({
      id: "crm.contacts",
      description: "Canonical contact records for revenue operations.",
      businessPurpose: "Track the lifecycle and ownership of customer-facing contacts.",
      invariants: ["A contact must always belong to one tenant."],
      table: {},
      contract: z.object({
        id: z.string(),
        label: z.string()
      }),
      fields: {
        label: { label: "Label", description: "Human-readable contact label.", searchable: true },
        createdAt: { label: "Created", description: "Creation timestamp for audit ordering.", sortable: true }
      },
      admin: {
        autoCrud: true,
        defaultColumns: ["label"]
      },
      portal: {
        enabled: false
      }
    });

    expect(Object.keys(resource.fields)).toEqual(["createdAt", "label"]);
    expect(resource.description).toBe("Canonical contact records for revenue operations.");
    expect(resource.fields.label?.description).toBe("Human-readable contact label.");
  });

  it("executes typed actions with input and output validation", async () => {
    const action = defineAction({
      id: "crm.contacts.archive",
      description: "Archive a contact without losing historical attribution.",
      businessPurpose: "Preserve reporting history while removing inactive records from active workflows.",
      preconditions: ["The acting user must have archive permission."],
      sideEffects: ["Audit history is emitted."],
      input: z.object({
        id: z.string()
      }),
      output: z.object({
        ok: z.literal(true)
      }),
      permission: "crm.contacts.archive",
      idempotent: true,
      audit: true,
      handler: ({ input }) => ({ ok: input.id.length > 0 as true })
    });

    expect(await executeAction(action, { id: "contact_1" })).toEqual({ ok: true });
  });

  it("normalizes action inputs deterministically", () => {
    expect(normalizeActionInput({ b: 2, a: 1 })).toEqual({ a: 1, b: 2 });
  });

  it("converts Zod contracts to JSON Schema", () => {
    const schema = toJsonSchema(z.object({ id: z.string() }));
    expect(schema.type).toBe("object");
  });
});
