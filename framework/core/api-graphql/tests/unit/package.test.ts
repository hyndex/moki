import { describe, expect, it } from "bun:test";
import { defineAction, defineResource } from "@platform/schema";
import { z } from "zod";

import { createGraphqlAdapter, createGraphqlHttpServer, executeGraphql, packageId, toGraphqlName } from "../../src";

describe("api-graphql", () => {
  it("exposes a stable package id", () => {
    expect(packageId).toBe("api-graphql");
  });

  it("sanitizes dotted ids into graphql field names", () => {
    expect(toGraphqlName("crm.contacts.archive")).toBe("crm_contacts_archive");
  });

  it("executes generated resource queries", async () => {
    const adapter = createGraphqlAdapter({
      resources: [
        defineResource({
          id: "crm.contacts",
          table: "contacts",
          contract: z.object({
            id: z.string(),
            name: z.string()
          }),
          fields: {
            name: { label: "Name", searchable: true }
          },
          admin: {
            autoCrud: true,
            defaultColumns: ["name"]
          },
          portal: {
            enabled: false
          }
        })
      ],
      actions: [],
      resourceResolvers: {
        "crm.contacts": {
          list: () => [{ id: "c1", name: "Ada" }]
        }
      }
    });

    const result = await executeGraphql(adapter, {
      source: "{ crm_contacts }",
      contextValue: {
        grants: ["crm.contacts.read"]
      }
    });

    expect(result.errors).toBeUndefined();
    expect(result.data?.crm_contacts).toEqual([{ id: "c1", name: "Ada" }]);
  });

  it("executes generated action mutations", async () => {
    const adapter = createGraphqlAdapter({
      resources: [],
      actions: [
        defineAction({
          id: "crm.contacts.archive",
          input: z.object({ contactId: z.string() }),
          output: z.object({ ok: z.literal(true) }),
          permission: "crm.contacts.archive",
          idempotent: true,
          audit: true,
          handler: ({ input }) => ({ ok: (input.contactId.length > 0) as true })
        })
      ]
    });

    const result = await executeGraphql(adapter, {
      source: "mutation Archive($input: JSON!) { crm_contacts_archive(input: $input) }",
      variableValues: {
        input: {
          contactId: "c1"
        }
      },
      contextValue: {
        grants: ["crm.contacts.archive"]
      }
    });

    expect(result.errors).toBeUndefined();
    expect(result.data?.crm_contacts_archive).toEqual({ ok: true });
  });

  it("creates an optional HTTP mount only when GraphQL is enabled", () => {
    const disabled = createGraphqlHttpServer({
      name: "graphql",
      adapter: createGraphqlAdapter({
        resources: [],
        actions: [],
        enabled: false
      })
    });

    expect(disabled.routes).toEqual([]);
  });
});
