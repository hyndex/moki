import { describe, expect, it } from "bun:test";
import { z } from "zod";

import { createJobRegistry, createInMemoryJobQueueAdapter, defineJob } from "@platform/jobs";

import { bindSessionToJobDispatch, resolveSessionContext } from "../../src";

describe("auth session propagation integration", () => {
  it("propagates request, tenant, and actor context into dispatched jobs", async () => {
    let observed:
      | {
          requestId: string | undefined;
          tenantId: string | undefined;
          actorId: string | undefined;
        }
      | undefined;

    const registry = createJobRegistry([
      defineJob({
        id: "billing.sync",
        queue: "billing",
        payload: z.object({
          accountId: z.string()
        }),
        handler: (context) => {
          observed = {
            requestId: context.requestId,
            tenantId: context.tenantId,
            actorId: context.actorId
          };
        }
      })
    ]);
    const adapter = createInMemoryJobQueueAdapter();
    const session = resolveSessionContext({
      session: {
        sessionId: "session-1",
        userId: "user-1",
        tenantId: "tenant-a",
        claims: ["role:admin"]
      },
      requestId: "req-1"
    });

    const queued = await registry.dispatch(
      adapter,
      bindSessionToJobDispatch(
        {
          jobDefinitionId: "billing.sync",
          payload: {
            accountId: "acct-1"
          }
        },
        session
      )
    );
    const envelope = adapter.enqueued.find((entry) => entry.jobId === queued.jobId);
    if (!envelope) {
      throw new Error("expected job to be queued");
    }

    const result = await registry.run(envelope);

    expect(result.status).toBe("completed");
    expect(observed).toEqual({
      requestId: "req-1",
      tenantId: "tenant-a",
      actorId: "user-1"
    });
  });
});
