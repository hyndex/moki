import { describe, expect, it } from "bun:test";
import { z } from "zod";

import {
  HttpError,
  createHttpHandler,
  defineHttpServer,
  defineRoute,
  matchHttpRoute,
  packageId,
  parseJsonBody
} from "../../src";

describe("http", () => {
  it("exposes a stable package id", () => {
    expect(packageId).toBe("http");
  });

  it("matches parameterized routes deterministically", () => {
    const matched = matchHttpRoute(
      [
        defineRoute({
          id: "contacts.get",
          method: "GET",
          path: "/api/contacts/:id",
          handler: () => new Response("ok")
        })
      ],
      "GET",
      "/api/contacts/contact-1"
    );

    expect(matched?.route.id).toBe("contacts.get");
    expect(matched?.params).toEqual({
      id: "contact-1"
    });
  });

  it("runs middleware and handlers with request correlation context", async () => {
    const calls: string[] = [];
    const handler = createHttpHandler(
      defineHttpServer({
        name: "platform-http-test",
        middleware: [
          async (_request, context, next) => {
            calls.push(`mw:${context.requestId}`);
            return next(_request, context);
          }
        ],
        routes: [
          defineRoute({
            id: "contacts.get",
            method: "GET",
            path: "/api/contacts/:id",
            handler: (_request, context) => {
              calls.push(`handler:${context.params.id}`);
              return Response.json({
                requestId: context.requestId,
                id: context.params.id,
                tenantId: context.tenantId
              });
            }
          })
        ]
      })
    );

    const response = await handler(
      new Request("https://platform.example.test/api/contacts/contact-1", {
        headers: {
          "x-request-id": "req-1",
          "x-tenant-id": "tenant-a"
        }
      })
    );

    expect(await response.json()).toEqual({
      requestId: "req-1",
      id: "contact-1",
      tenantId: "tenant-a"
    });
    expect(calls).toEqual(["mw:req-1", "handler:contact-1"]);
  });

  it("maps invalid json bodies into explicit 400 responses", async () => {
    const handler = createHttpHandler({
      name: "platform-http-test",
      routes: [
        defineRoute({
          id: "contacts.create",
          method: "POST",
          path: "/api/contacts",
          handler: async (request) => {
            await parseJsonBody(request);
            return new Response("ok");
          }
        })
      ]
    });

    const response = await handler(
      new Request("https://platform.example.test/api/contacts", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: "{bad"
      })
    );

    expect(response.status).toBe(400);
    const body = z.object({
      error: z.object({
        code: z.string()
      })
    }).parse((await response.json()) as unknown);
    expect(body.error.code).toBe("http.body.invalid-json");
  });

  it("exposes health and readiness probes", async () => {
    const handler = createHttpHandler({
      name: "platform-http-test",
      readinessCheck: () => undefined,
      routes: []
    });

    expect((await handler(new Request("https://platform.example.test/healthz"))).status).toBe(200);
    expect((await handler(new Request("https://platform.example.test/readyz"))).status).toBe(200);
  });

  it("returns structured errors for unknown routes and thrown http errors", async () => {
    const handler = createHttpHandler({
      name: "platform-http-test",
      routes: [
        defineRoute({
          id: "contacts.forbidden",
          method: "GET",
          path: "/api/forbidden",
          handler: () => {
            throw new HttpError(403, "contacts.denied", "Permission denied");
          }
        })
      ]
    });

    expect((await handler(new Request("https://platform.example.test/missing"))).status).toBe(404);
    expect((await handler(new Request("https://platform.example.test/api/forbidden"))).status).toBe(403);
  });
});
