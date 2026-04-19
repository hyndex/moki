import { afterAll, describe, expect, it } from "bun:test";

import { HttpError, defineRoute, startHttpServer } from "../../src";

const servers: Array<ReturnType<typeof Bun.serve>> = [];

afterAll(() => {
  for (const server of servers) {
    void server.stop(true);
  }
});

describe("http server integration", () => {
  it("serves live Bun routes with correlation and readiness behavior", async () => {
    const server = startHttpServer(
      {
        name: "http-integration",
        readinessCheck: () => undefined,
        routes: [
          defineRoute({
            id: "echo",
            method: "GET",
            path: "/echo/:id",
            handler: (_request, context) =>
              Response.json({
                id: context.params.id,
                requestId: context.requestId
              })
          }),
          defineRoute({
            id: "denied",
            method: "GET",
            path: "/denied",
            handler: () => {
              throw new HttpError(403, "http.denied", "denied");
            }
          })
        ]
      },
      {
        port: 0
      }
    );
    servers.push(server);

    const baseUrl = `http://127.0.0.1:${server.port}`;
    const echoResponse = await fetch(`${baseUrl}/echo/contact-1`, {
      headers: {
        "x-request-id": "req-http-1"
      }
    });
    const readinessResponse = await fetch(`${baseUrl}/readyz`);
    const deniedResponse = await fetch(`${baseUrl}/denied`);

    expect(echoResponse.status).toBe(200);
    expect(await echoResponse.json()).toEqual({
      id: "contact-1",
      requestId: "req-http-1"
    });
    expect(readinessResponse.status).toBe(200);
    expect(deniedResponse.status).toBe(403);
  });
});
