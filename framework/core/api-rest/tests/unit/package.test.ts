import { describe, expect, it } from "bun:test";
import { defineAction, defineResource } from "@platform/schema";
import { z } from "zod";

import {
  buildActionPath,
  buildOpenApiDocument,
  createRestHttpServer,
  createActionToolContracts,
  createRestApi,
  executeRestRequest,
  createWebhookEnvelope,
  matchRestRoute,
  packageId,
  verifyWebhookSignature
} from "../../src";

describe("api-rest", () => {
  it("exposes a stable package id", () => {
    expect(packageId).toBe("api-rest");
  });

  it("generates canonical resource and action routes", () => {
    const api = createRestApi({
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
      actions: [
      defineAction({
        id: "crm.contacts.archive",
        input: z.object({ contactId: z.string() }),
        output: z.object({ ok: z.literal(true) }),
        permission: "crm.contacts.archive",
        idempotent: true,
        audit: true,
        handler: () => ({ ok: true as const })
      })
      ],
      allowDeleteResources: ["crm.contacts"]
    });

    expect(api.routes.map((route) => route.path)).toContain("/api/v1/crm/contacts");
    expect(api.routes.map((route) => route.path)).toContain(buildActionPath("crm.contacts.archive"));
  });

  it("executes an action endpoint with permission enforcement", async () => {
    const action = defineAction({
      id: "crm.contacts.archive",
      input: z.object({ contactId: z.string() }),
      output: z.object({ ok: z.literal(true) }),
      permission: "crm.contacts.archive",
      idempotent: true,
      audit: true,
      handler: ({ input }) => ({ ok: (input.contactId.length > 0) as true })
    });

    const api = createRestApi({
      resources: [],
      actions: [action]
    });

    const result = await executeRestRequest(api, {
      method: "POST",
      path: "/api/v1/actions/crm.contacts.archive",
      body: { contactId: "abc" },
      context: {
        grants: ["crm.contacts.archive"]
      }
    });

    expect(result).toEqual({ ok: true });
  });

  it("executes resource handlers and validates the public response", async () => {
    const resource = defineResource({
      id: "catalog.products",
      table: "products",
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
        enabled: true
      }
    });

    const api = createRestApi({
      resources: [resource],
      actions: [],
      resourceHandlers: {
        "catalog.products": {
          list: () => [{ id: "p1", name: "Desk" }]
        }
      }
    });

    const result = await executeRestRequest(api, {
      method: "GET",
      path: "/api/v1/catalog/products",
      context: {
        grants: ["catalog.products.read"]
      }
    });

    expect(result).toEqual([{ id: "p1", name: "Desk" }]);
  });

  it("matches parameterized resource paths and extracts params without manual injection", async () => {
    const resource = defineResource({
      id: "catalog.products",
      table: "products",
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
        enabled: true
      }
    });

    const api = createRestApi({
      resources: [resource],
      actions: [],
      resourceHandlers: {
        "catalog.products": {
          get: (id) => ({ id, name: "Desk" })
        }
      }
    });

    expect(matchRestRoute(api, "GET", "/api/v1/catalog/products/p1")?.params).toEqual({ id: "p1" });
    const result = await executeRestRequest(api, {
      method: "GET",
      path: "/api/v1/catalog/products/p1",
      context: {
        grants: ["catalog.products.read"]
      }
    });

    expect(result).toEqual({ id: "p1", name: "Desk" });
  });

  it("builds an OpenAPI document from the same source contracts", () => {
    const resource = defineResource({
      id: "finance.invoices",
      table: "invoices",
      contract: z.object({
        id: z.string(),
        amount: z.number()
      }),
      fields: {
        amount: { label: "Amount", sortable: true }
      },
      admin: {
        autoCrud: true,
        defaultColumns: ["amount"]
      },
      portal: {
        enabled: false
      }
    });

    const api = createRestApi({
      resources: [resource],
      actions: []
    });

    const openapi = buildOpenApiDocument(api, {
      title: "Finance API",
      version: "1.0.0"
    });

    const paths = openapi.paths as Record<string, unknown>;
    expect(Object.keys(paths)).toContain("/api/v1/finance/invoices");
  });

  it("generates AI tool contracts from actions", () => {
    const tools = createActionToolContracts([
      defineAction({
        id: "hr.employees.activate",
        input: z.object({ employeeId: z.string() }),
        output: z.object({ ok: z.literal(true) }),
        permission: "hr.employees.activate",
        idempotent: true,
        audit: true,
        handler: () => ({ ok: true as const })
      })
    ]);

    expect(tools[0]?.id).toBe("hr.employees.activate");
    expect(tools[0]?.inputSchema).toBeDefined();
  });

  it("signs and verifies webhook payloads", () => {
    const envelope = createWebhookEnvelope({
      event: "orders.created",
      payload: JSON.stringify({ id: "o1" }),
      secret: "secret",
      idempotencyKey: "evt-1",
      timestamp: "2026-04-18T00:00:00.000Z"
    });

    expect(
      verifyWebhookSignature({
        secret: "secret",
        timestamp: envelope.timestamp,
        payload: envelope.payload,
        signature: envelope.signature
      })
    ).toBe(true);
  });

  it("creates an HTTP bridge with the API routes mounted", () => {
    const api = createRestApi({
      resources: [],
      actions: []
    });

    const server = createRestHttpServer({
      name: "rest",
      api
    });

    expect(server.routes).toEqual([]);
    expect(server.name).toBe("rest");
  });
});
