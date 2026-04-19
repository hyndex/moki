import { normalizeActionInput } from "@platform/schema";
import type { JobDefinitionKey } from "../jobs/catalog";
import { jobDefinitions } from "../jobs/catalog";

export type DomainActionInput = {
  executionId: string;
  tenantId: string;
  jobKey: JobDefinitionKey;
  runAt?: string | undefined;
  concurrency: number;
  retries: number;
  timeoutMs: number;
  reason?: string | undefined;
};

export function scheduleJobExecution(input: DomainActionInput): {
  ok: true;
  nextStatus: "queued" | "scheduled";
  queue: string;
  observabilityKey: string;
  concurrency: number;
  retries: number;
} {
  normalizeActionInput(input);
  const definition = jobDefinitions[input.jobKey];
  const maxConcurrency = definition.concurrency ?? input.concurrency;
  const maxRetries = definition.retryPolicy?.attempts ?? input.retries;
  const maxTimeout = definition.timeoutMs ?? input.timeoutMs;

  if (input.concurrency > maxConcurrency) {
    throw new Error(`requested concurrency ${input.concurrency} exceeds ${input.jobKey} limit ${maxConcurrency}`);
  }
  if (input.retries > maxRetries) {
    throw new Error(`requested retries ${input.retries} exceeds ${input.jobKey} limit ${maxRetries}`);
  }
  if (input.timeoutMs > maxTimeout) {
    throw new Error(`requested timeout ${input.timeoutMs} exceeds ${input.jobKey} limit ${maxTimeout}`);
  }

  const parsedRunAt = input.runAt ? new Date(input.runAt).getTime() : Number.NaN;
  const nextStatus = Number.isFinite(parsedRunAt) && parsedRunAt > Date.now() ? "scheduled" : "queued";

  return {
    ok: true,
    nextStatus,
    queue: definition.queue,
    observabilityKey: `${input.tenantId}:${input.jobKey}:${input.executionId}`,
    concurrency: input.concurrency,
    retries: input.retries
  };
}
