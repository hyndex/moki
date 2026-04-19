import { afterAll, describe, expect, it } from "bun:test";
import { defineResource } from "@platform/schema";
import { startHttpServer } from "@platform/http";
import { z } from "zod";

import { createRestApi, createRestHttpServer } from "../../src";

describe("api-rest HTTP bridge integration", () => {
  const server = startHttpServer(
    createRestHttpServer({
      name: "rest-bridge",
      api: createRestApi({
        resources: [
          defineResource({
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
          })
        ],
        actions: [],
        resourceHandlers: {
          "catalog.products": {
            get: (id, context) => ({
              id,
              name: `Desk for ${context.tenantId ?? "public"}`
            })
          }
        }
      })
    }),
    { port: 0 }
  );

  afterAll(() => {
    void server.stop(true);
  });

  it("serves parameterized routes with request context propagated from HTTP headers", async () => {
    const response = await fetch(`${server.url}/api/v1/catalog/products/p-1`, {
      headers: {
        "x-request-id": "req-rest-1",
        "x-tenant-id": "tenant-a",
        "x-grants": "catalog.products.read"
      }
    });

    expect(response.status).toBe(200);
    const body = z.object({
      id: z.string(),
      name: z.string()
    }).parse((await response.json()) as unknown);

    expect(body).toEqual({
      id: "p-1",
      name: "Desk for tenant-a"
    });
  });

  it("maps permission failures into HTTP problem responses", async () => {
    const response = await fetch(`${server.url}/api/v1/catalog/products/p-1`);

    expect(response.status).toBe(403);
    const body = z.object({
      error: z.object({
        code: z.string(),
        message: z.string(),
        requestId: z.string()
      })
    }).parse((await response.json()) as unknown);

    expect(body.error.code).toBe("rest.permission-denied");
    expect(body.error.requestId.length).toBeGreaterThan(0);
  });
});
