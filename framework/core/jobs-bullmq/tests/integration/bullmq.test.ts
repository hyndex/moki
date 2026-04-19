import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { spawn } from "node:child_process";
import net from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import Redis from "ioredis";
import { z } from "zod";

import { createJobRegistry, defineJob } from "@platform/jobs";

import { createBullMqQueueAdapter, createBullMqWorker } from "../../src";

let redisProcess: ReturnType<typeof spawn> | null = null;
let redisClient: Redis | null = null;
let redisPort = 0;

beforeAll(async () => {
  redisPort = await findFreePort();
  redisProcess = spawn("/opt/homebrew/bin/redis-server", ["--port", String(redisPort), "--save", "", "--appendonly", "no"], {
    stdio: "ignore"
  });

  redisClient = new Redis({
    host: "127.0.0.1",
    port: redisPort,
    maxRetriesPerRequest: null
  });
  redisClient.on("error", () => undefined);

  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      if ((await redisClient.ping()) === "PONG") {
        return;
      }
    } catch {
      await delay(100);
    }
  }

  throw new Error("redis-server failed to start for BullMQ integration tests");
});

afterAll(async () => {
  await redisClient?.quit();
  redisProcess?.kill("SIGTERM");
});

describe("jobs-bullmq integration", () => {
  it("enqueues and processes jobs through a live Redis-backed BullMQ worker", async () => {
    const seen: string[] = [];
    let resolveCompletion: (() => void) | undefined;
    const completed = new Promise<void>((resolve) => {
      resolveCompletion = resolve;
    });

    const registry = createJobRegistry([
      defineJob({
        id: "notifications.send",
        queue: "notifications",
        payload: z.object({
          notificationId: z.string()
        }),
        handler: ({ payload }) => {
          seen.push(payload.notificationId);
          resolveCompletion?.();
        }
      })
    ]);

    const adapter = createBullMqQueueAdapter({
      connection: {
        host: "127.0.0.1",
        port: redisPort,
        maxRetriesPerRequest: null
      }
    });
    const managedWorker = createBullMqWorker({
      config: {
        connection: {
          host: "127.0.0.1",
          port: redisPort,
          maxRetriesPerRequest: null
        }
      },
      queue: "notifications",
      registry
    });

    try {
      const result = await registry.dispatch(adapter, {
        jobDefinitionId: "notifications.send",
        payload: {
          notificationId: "notice-1"
        }
      });
      await completed;

      expect(result.status).toBe("queued");
      expect(seen).toEqual(["notice-1"]);
    } finally {
      await managedWorker.close();
      await adapter.close();
    }
  });
});

async function findFreePort(): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (address && typeof address === "object") {
        const { port } = address;
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve(port);
        });
        return;
      }

      reject(new Error("Failed to allocate a free port"));
    });
  });
}
