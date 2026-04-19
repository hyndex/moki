import { defineAction } from "@platform/schema";
import { z } from "zod";
import { scheduleJobExecution } from "../services/main.service";
import { jobDefinitionKeys } from "../jobs/catalog";

export const scheduleJobExecutionAction = defineAction({
  id: "jobs.executions.schedule",
  input: z.object({
    executionId: z.string().uuid(),
    tenantId: z.string().uuid(),
    jobKey: z.enum(jobDefinitionKeys),
    runAt: z.string().min(1).optional(),
    concurrency: z.number().int().min(1).max(25).default(1),
    retries: z.number().int().min(0).max(10).default(3),
    timeoutMs: z.number().int().min(1_000).max(300_000).default(60_000),
    reason: z.string().min(3).optional()
  }),
  output: z.object({
    ok: z.literal(true),
    nextStatus: z.enum(["queued", "scheduled"]),
    queue: z.string(),
    observabilityKey: z.string(),
    concurrency: z.number().int().positive(),
    retries: z.number().int().nonnegative()
  }),
  permission: "jobs.executions.schedule",
  idempotent: true,
  audit: true,
  handler: ({ input }) => scheduleJobExecution(input)
});
