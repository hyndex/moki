import { afterAll, describe, expect, it } from "bun:test";
import { defineAction } from "@platform/schema";
import { startHttpServer } from "@platform/http";
import { z } from "zod";

import { createGraphqlAdapter, createGraphqlHttpServer } from "../../src";

describe("api-graphql HTTP bridge integration", () => {
  const adapter = createGraphqlAdapter({
    resources: [],
    actions: [
      defineAction({
        id: "crm.contacts.archive",
        input: z.object({ contactId: z.string() }),
        output: z.object({ ok: z.boolean() }),
        permission: "crm.contacts.archive",
        idempotent: true,
        audit: true,
        handler: ({ input, ctx }) => ({
          ok: input.contactId.length > 0 && (ctx?.tenantId as string | undefined) === "tenant-a"
        })
      })
    ]
  });

  const server = startHttpServer(
    createGraphqlHttpServer({
      name: "graphql-bridge",
      adapter
    }),
    { port: 0 }
  );

  afterAll(() => {
    void server.stop(true);
  });

  it("serves GraphQL POST requests through the HTTP bridge", async () => {
    const response = await fetch(`${server.url}/graphql`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-tenant-id": "tenant-a",
        "x-grants": "crm.contacts.archive"
      },
      body: JSON.stringify({
        query: "mutation Archive($input: JSON!) { crm_contacts_archive(input: $input) }",
        variables: {
          input: {
            contactId: "contact-1"
          }
        }
      })
    });

    expect(response.status).toBe(200);
    const body = z.object({
      data: z.object({
        crm_contacts_archive: z.object({
          ok: z.boolean()
        })
      })
    }).parse((await response.json()) as unknown);

    expect(body.data.crm_contacts_archive.ok).toBe(true);
  });

  it("rejects malformed GraphQL variable payloads on GET requests", async () => {
    const response = await fetch(
      `${server.url}/graphql?query=${encodeURIComponent("{ platform_status }")}&variables=not-json`
    );

    expect(response.status).toBe(400);
    const body = z.object({
      error: z.object({
        code: z.string(),
        message: z.string()
      })
    }).parse((await response.json()) as unknown);

    expect(body.error.code).toBe("graphql.variables.invalid");
  });
});
