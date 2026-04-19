import { describe, expect, it } from "bun:test";

import { defineResource } from "@platform/schema";
import { z } from "zod";

import {
  createAsyncFieldValidationAdapter,
  createDetailViewFromResource,
  createDirtyStateGuard,
  createFormViewFromResource,
  defineFormView,
  packageId
} from "../../src";

describe("admin-formview", () => {
  it("exposes a stable package id", () => {
    expect(packageId).toBe("admin-formview");
  });

  it("defines form views and reuses dirty/validation adapters", async () => {
    const formView = defineFormView({
      id: "crm.contacts.form",
      resource: "crm.contacts",
      layout: [{ section: "Basics", fields: ["fullName"] }],
      actions: [{ id: "archive", action: "crm.contacts.archive" }]
    });
    const guard = createDirtyStateGuard({ fullName: "Ada" });
    const validate = createAsyncFieldValidationAdapter((value: string) =>
      value.length >= 2 ? undefined : "too short"
    );

    expect(formView.actions[0]?.id).toBe("archive");
    expect(guard.isDirty({ fullName: "Ada" })).toBe(false);
    expect(await validate("A")).toBe("too short");
  });

  it("derives form/detail layouts from resource metadata", () => {
    const resource = defineResource({
      id: "crm.contacts",
      table: "contacts",
      contract: z.object({
        id: z.string(),
        fullName: z.string(),
        createdAt: z.string()
      }),
      fields: {
        fullName: { label: "Name", searchable: true },
        createdAt: { label: "Created", sortable: true }
      },
      admin: {
        autoCrud: true,
        defaultColumns: ["fullName", "createdAt"]
      },
      portal: { enabled: false }
    });

    const form = createFormViewFromResource(resource);
    const detail = createDetailViewFromResource(resource);

    expect(form.layout.map((section) => section.section)).toEqual(["Basics", "Metadata"]);
    expect(detail.layout[0]?.readonly).toBe(true);
    expect(detail.layout[1]?.readonly).toBe(true);
  });
});
