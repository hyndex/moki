import { describe, expect, it } from "bun:test";
import { z } from "zod";

import { createJobRegistry, defineJob } from "@platform/jobs";

import {
  createBullMqAdapterConfig,
  createBullMqTestAdapter,
  packageId
} from "../../src";

describe("jobs-bullmq", () => {
  it("exposes a stable package id", () => {
    expect(packageId).toBe("jobs-bullmq");
  });

  it("applies safe adapter defaults", () => {
    expect(
      createBullMqAdapterConfig({
        connection: {
          host: "127.0.0.1",
          port: 6379
        }
      })
    ).toMatchObject({
      defaultJobOptions: {
        removeOnComplete: 100
      },
      workerDefaults: {
        concurrency: 5
      }
    });
  });

  it("provides a test adapter for queue-free contract tests", async () => {
    const registry = createJobRegistry([
      defineJob({
        id: "crm.sync",
        queue: "sync",
        payload: z.object({
          contactId: z.string()
        }),
        handler: () => undefined
      })
    ]);
    const adapter = createBullMqTestAdapter();
    const result = await registry.dispatch(adapter, {
      jobDefinitionId: "crm.sync",
      payload: {
        contactId: "contact-1"
      }
    });

    expect(result.status).toBe("queued");
    expect(adapter.enqueued).toHaveLength(1);
  });
});
