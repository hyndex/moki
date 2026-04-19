import type * as z from "zod";
import type { WorkflowUnderstanding } from "@platform/agent-understanding";

export const packageId = "jobs" as const;
export const packageDisplayName = "Jobs" as const;
export const packageDescription = "Queue-agnostic jobs and workflow execution contracts." as const;

export type RetryPolicy = {
  attempts: number;
  backoff: "fixed" | "exponential";
  delayMs: number;
  maxDelayMs?: number | undefined;
};

export type ScheduleDefinition = {
  kind: "once" | "cron" | "delay";
  cron?: string | undefined;
  delayMs?: number | undefined;
};

export type JobExecutionContext<TPayload> = {
  jobId: string;
  jobDefinitionId: string;
  queue: string;
  payload: TPayload;
  attempt: number;
  requestId?: string | undefined;
  tenantId?: string | undefined;
  actorId?: string | undefined;
  signal: AbortSignal;
};

export type JobDefinition<TPayload extends z.ZodTypeAny = z.ZodTypeAny> = {
  id: string;
  queue: string;
  payload: TPayload;
  concurrency?: number | undefined;
  retryPolicy?: RetryPolicy | undefined;
  timeoutMs?: number | undefined;
  dedupeKey?: ((payload: z.infer<TPayload>) => string | undefined) | undefined;
  schedule?: ScheduleDefinition | undefined;
  handler: (context: JobExecutionContext<z.infer<TPayload>>) => Promise<void> | void;
};

export type WorkflowDefinition = WorkflowUnderstanding & {
  id: string;
  initialState: string;
  states: Record<string, { on?: Record<string, string> }>;
};

export type JobEnvelope<TPayload = unknown> = {
  jobId: string;
  jobDefinitionId: string;
  queue: string;
  payload: TPayload;
  dedupeKey?: string | undefined;
  requestId?: string | undefined;
  tenantId?: string | undefined;
  actorId?: string | undefined;
};

export type JobDispatchRequest<TPayload = unknown> = {
  jobDefinitionId: string;
  payload: TPayload;
  requestId?: string | undefined;
  tenantId?: string | undefined;
  actorId?: string | undefined;
};

export type JobDispatchResult = {
  jobId: string;
  queue: string;
  dedupeKey?: string | undefined;
  status: "queued" | "deduplicated";
};

export type DeadLetterRecord = {
  jobId: string;
  jobDefinitionId: string;
  queue: string;
  attempt: number;
  error: string;
};

export type JobRunResult = {
  jobId: string;
  jobDefinitionId: string;
  status: "completed" | "retry" | "dead-letter";
  attempt: number;
  nextDelayMs?: number | undefined;
  deadLetter?: DeadLetterRecord | undefined;
};

export type JobQueueAdapter = {
  enqueue<TPayload>(
    envelope: JobEnvelope<TPayload>,
    options?: {
      schedule?: ScheduleDefinition | undefined;
      retryPolicy?: RetryPolicy | undefined;
    }
  ): Promise<JobDispatchResult>;
  close?(): Promise<void> | void;
};

export type JobRegistry = {
  definitions: ReadonlyMap<string, JobDefinition>;
  register<TPayload extends z.ZodTypeAny>(definition: JobDefinition<TPayload>): JobRegistry;
  dispatch<TPayload>(adapter: JobQueueAdapter, request: JobDispatchRequest<TPayload>): Promise<JobDispatchResult>;
  run<TPayload>(envelope: JobEnvelope<TPayload>, attempt?: number): Promise<JobRunResult>;
};

export function defineJob<TPayload extends z.ZodTypeAny>(definition: JobDefinition<TPayload>): JobDefinition<TPayload> {
  return Object.freeze(definition);
}

export function defineWorkflow(definition: WorkflowDefinition): WorkflowDefinition {
  return Object.freeze(definition);
}

export function getWorkflowTransition(workflow: WorkflowDefinition, currentState: string, action: string): string | null {
  return workflow.states[currentState]?.on?.[action] ?? null;
}

export function createRetryPolicy(input?: Partial<RetryPolicy>): RetryPolicy {
  return Object.freeze({
    attempts: input?.attempts ?? 3,
    backoff: input?.backoff ?? "exponential",
    delayMs: input?.delayMs ?? 1_000,
    maxDelayMs: input?.maxDelayMs
  });
}

export function calculateRetryDelay(policy: RetryPolicy, attempt: number): number {
  const baseDelay = policy.backoff === "fixed" ? policy.delayMs : policy.delayMs * 2 ** Math.max(0, attempt - 1);
  return policy.maxDelayMs ? Math.min(baseDelay, policy.maxDelayMs) : baseDelay;
}

export function createJobRegistry(definitions: JobDefinition[] = []): JobRegistry {
  const registry = new Map<string, JobDefinition>();
  const dedupe = new Set<string>();

  for (const definition of definitions) {
    registry.set(definition.id, definition);
  }

  return {
    get definitions() {
      return registry;
    },
    register(definition) {
      if (registry.has(definition.id)) {
        throw new Error(`Job '${definition.id}' is already registered`);
      }
      registry.set(definition.id, definition);
      return this;
    },
    async dispatch(adapter, request) {
      const definition = registry.get(request.jobDefinitionId);
      if (!definition) {
        throw new Error(`Job '${request.jobDefinitionId}' is not registered`);
      }

      const parsedPayload = definition.payload.parse(request.payload);
      const dedupeKey = definition.dedupeKey?.(parsedPayload);
      if (dedupeKey && dedupe.has(dedupeKey)) {
        return {
          jobId: `dedupe:${dedupeKey}`,
          queue: definition.queue,
          dedupeKey,
          status: "deduplicated"
        };
      }

      if (dedupeKey) {
        dedupe.add(dedupeKey);
      }

      const envelope: JobEnvelope = {
        jobId: crypto.randomUUID(),
        jobDefinitionId: definition.id,
        queue: definition.queue,
        payload: parsedPayload,
        dedupeKey,
        requestId: request.requestId,
        tenantId: request.tenantId,
        actorId: request.actorId
      };

      return adapter.enqueue(envelope, {
        schedule: definition.schedule,
        retryPolicy: definition.retryPolicy
      });
    },
    async run(envelope, attempt = 1) {
      const definition = registry.get(envelope.jobDefinitionId);
      if (!definition) {
        throw new Error(`Job '${envelope.jobDefinitionId}' is not registered`);
      }

      const parsedPayload = definition.payload.parse(envelope.payload);
      const timeoutMs = definition.timeoutMs ?? 30_000;
      const signal = AbortSignal.timeout(timeoutMs);

      try {
        await Promise.race([
          definition.handler({
            jobId: envelope.jobId,
            jobDefinitionId: definition.id,
            queue: definition.queue,
            payload: parsedPayload,
            attempt,
            requestId: envelope.requestId,
            tenantId: envelope.tenantId,
            actorId: envelope.actorId,
            signal
          }),
          new Promise<never>((_, reject) => {
            signal.addEventListener(
              "abort",
              () => {
                reject(new Error(`Job '${definition.id}' exceeded ${timeoutMs}ms`));
              },
              { once: true }
            );
          })
        ]);

        return {
          jobId: envelope.jobId,
          jobDefinitionId: definition.id,
          status: "completed",
          attempt
        };
      } catch (error) {
        const policy = createRetryPolicy(definition.retryPolicy);
        if (attempt < policy.attempts) {
          return {
            jobId: envelope.jobId,
            jobDefinitionId: definition.id,
            status: "retry",
            attempt,
            nextDelayMs: calculateRetryDelay(policy, attempt)
          };
        }

        return {
          jobId: envelope.jobId,
          jobDefinitionId: definition.id,
          status: "dead-letter",
          attempt,
          deadLetter: createDeadLetterRecord(envelope, attempt, error)
        };
      }
    }
  };
}

export function createDeadLetterRecord(envelope: JobEnvelope, attempt: number, error: unknown): DeadLetterRecord {
  return {
    jobId: envelope.jobId,
    jobDefinitionId: envelope.jobDefinitionId,
    queue: envelope.queue,
    attempt,
    error: error instanceof Error ? error.message : String(error)
  };
}

export function createInMemoryJobQueueAdapter(): JobQueueAdapter & { enqueued: JobEnvelope[] } {
  const enqueued: JobEnvelope[] = [];
  return {
    enqueued,
    enqueue(envelope) {
      enqueued.push(envelope);
      return Promise.resolve({
        jobId: envelope.jobId,
        queue: envelope.queue,
        dedupeKey: envelope.dedupeKey,
        status: "queued"
      });
    }
  };
}
