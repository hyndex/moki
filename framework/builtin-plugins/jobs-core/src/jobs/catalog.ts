import { defineJob } from "@platform/jobs";
import { z } from "zod";

export const jobDefinitionKeys = ["crm.sync-segments", "files.scan-uploads", "notifications.dispatch"] as const;

export const jobDefinitions = {
  "crm.sync-segments": defineJob({
    id: "crm.sync-segments",
    queue: "crm-sync",
    payload: z.object({
      tenantId: z.string().uuid(),
      segmentId: z.string().uuid().optional()
    }),
    concurrency: 2,
    retryPolicy: {
      attempts: 3,
      backoff: "exponential",
      delayMs: 1_000
    },
    timeoutMs: 60_000,
    handler: () => undefined
  }),
  "files.scan-uploads": defineJob({
    id: "files.scan-uploads",
    queue: "files-security",
    payload: z.object({
      tenantId: z.string().uuid(),
      assetId: z.string().uuid()
    }),
    concurrency: 4,
    retryPolicy: {
      attempts: 5,
      backoff: "exponential",
      delayMs: 1_000
    },
    timeoutMs: 120_000,
    handler: () => undefined
  }),
  "notifications.dispatch": defineJob({
    id: "notifications.dispatch",
    queue: "notifications",
    payload: z.object({
      tenantId: z.string().uuid(),
      messageId: z.string().uuid()
    }),
    concurrency: 10,
    retryPolicy: {
      attempts: 8,
      backoff: "exponential",
      delayMs: 1_000
    },
    timeoutMs: 30_000,
    handler: () => undefined
  })
} as const;

export type JobDefinitionKey = (typeof jobDefinitionKeys)[number];
