import { describe, expect, it } from "bun:test";

import { defineResource } from "@platform/schema";
import { createPlatformTableState } from "@platform/data-table";
import { z } from "zod";

import {
  createListState,
  createListViewFromResource,
  defineListView,
  deserializeSavedView,
  packageId,
  serializeSavedView
} from "../../src";

describe("admin-listview", () => {
  it("exposes a stable package id", () => {
    expect(packageId).toBe("admin-listview");
  });

  it("creates deterministic list definitions and saved views", () => {
    const definition = defineListView({
      id: "crm.contacts.list",
      resource: "crm.contacts",
      columns: [{ key: "fullName", label: "Name", sortable: true }],
      filters: [{ key: "status", type: "select" }],
      bulkActions: [{ id: "archive", action: "crm.contacts.archive" }]
    });

    const serialized = serializeSavedView({
      id: "default",
      label: "Default",
      filterState: { status: "active" },
      sortState: [{ id: "createdAt", desc: true }],
      columnVisibility: { fullName: true }
    });

    expect(definition.export).toEqual(["csv"]);
    expect(deserializeSavedView(serialized).label).toBe("Default");
  });

  it("derives list definitions from resource admin metadata and list state", () => {
    const resource = defineResource({
      id: "crm.contacts",
      table: "contacts",
      contract: z.object({
        id: z.string(),
        fullName: z.string(),
        status: z.string()
      }),
      fields: {
        fullName: { label: "Name", searchable: true, sortable: true },
        status: { label: "Status", filter: "select" }
      },
      admin: {
        autoCrud: true,
        defaultColumns: ["fullName", "status"]
      },
      portal: { enabled: false }
    });

    const listView = createListViewFromResource(resource);
    const state = createListState({
      resource: resource.id,
      workspace: "crm",
      tenantId: "tenant-1",
      actorId: "actor-1",
      table: createPlatformTableState()
    });

    expect(listView.columns.map((column) => column.key)).toEqual(["fullName", "status"]);
    expect(listView.filters[0]?.key).toBe("status");
    expect(state.queryScope).toEqual(["admin", "crm", "crm.contacts", "tenant-1", "actor-1"]);
  });
});
