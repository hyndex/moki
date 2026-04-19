import { Queue, Worker, type ConnectionOptions, type JobsOptions, type Processor, type QueueOptions, type WorkerOptions } from "bullmq";
import Redis, { type RedisOptions } from "ioredis";

import type { JobEnvelope, JobQueueAdapter, JobRegistry, RetryPolicy, ScheduleDefinition } from "@platform/jobs";

export const packageId = "jobs-bullmq" as const;
export const packageDisplayName = "Jobs BullMQ" as const;
export const packageDescription = "BullMQ adapter for platform jobs." as const;

export type BullMqTelemetryHooks = {
  onEnqueue?: ((event: { queue: string; jobId: string }) => void) | undefined;
  onCompleted?: ((event: { queue: string; jobId: string }) => void) | undefined;
  onFailed?: ((event: { queue: string; jobId: string; error: string }) => void) | undefined;
};

export type BullMqAdapterConfig = {
  connection: ConnectionOptions;
  defaultJobOptions?: QueueOptions["defaultJobOptions"];
  workerDefaults?: Pick<WorkerOptions, "concurrency" | "autorun" | "removeOnComplete">;
  telemetry?: BullMqTelemetryHooks | undefined;
};

export type BullMqManagedWorker = {
  worker: Worker;
  close(): Promise<void>;
};

export function createBullMqAdapterConfig(config: BullMqAdapterConfig): BullMqAdapterConfig {
  return {
    ...config,
    defaultJobOptions: config.defaultJobOptions ?? {
      removeOnComplete: 100,
      removeOnFail: 100
    },
    workerDefaults: config.workerDefaults ?? {
      concurrency: 5,
      autorun: true,
      removeOnComplete: { count: 100 }
    }
  };
}

export function createRedisConnection(connection: ConnectionOptions): Redis {
  return new Redis(connection as RedisOptions);
}

export function createBullMqQueueAdapter(config: BullMqAdapterConfig): JobQueueAdapter & { close(): Promise<void> } {
  const normalizedConfig = createBullMqAdapterConfig(config);
  const queues = new Map<string, Queue>();

  function getQueue(queueName: string): Queue {
    const existing = queues.get(queueName);
    if (existing) {
      return existing;
    }

    const queueOptions: QueueOptions = {
      connection: normalizedConfig.connection,
      ...(normalizedConfig.defaultJobOptions ? { defaultJobOptions: normalizedConfig.defaultJobOptions } : {})
    };
    const queue = new Queue(queueName, queueOptions);
    queues.set(queueName, queue);
    return queue;
  }

  return {
    async enqueue(envelope, options) {
      const queue = getQueue(envelope.queue);
      await queue.add(envelope.jobDefinitionId, envelope, buildJobOptions(envelope, options?.schedule, options?.retryPolicy));
      normalizedConfig.telemetry?.onEnqueue?.({
        queue: envelope.queue,
        jobId: envelope.jobId
      });
      return {
        jobId: envelope.jobId,
        queue: envelope.queue,
        dedupeKey: envelope.dedupeKey,
        status: "queued"
      };
    },
    async close() {
      await Promise.all([...queues.values()].map((queue) => queue.close()));
      queues.clear();
    }
  };
}

export function createBullMqWorker(input: {
  config: BullMqAdapterConfig;
  queue: string;
  registry: JobRegistry;
}): BullMqManagedWorker {
  const normalizedConfig = createBullMqAdapterConfig(input.config);
  const processor: Processor = async (job) => {
    const envelope = job.data as JobEnvelope;
    const result = await input.registry.run(envelope, job.attemptsMade + 1);

    if (result.status === "retry") {
      throw new Error(`retry:${result.nextDelayMs ?? 0}`);
    }

    if (result.status === "dead-letter") {
      const error = new Error(result.deadLetter?.error ?? "job dead-lettered");
      normalizedConfig.telemetry?.onFailed?.({
        queue: input.queue,
        jobId: envelope.jobId,
        error: error.message
      });
      throw error;
    }

    normalizedConfig.telemetry?.onCompleted?.({
      queue: input.queue,
      jobId: envelope.jobId
    });
    return result;
  };

  const worker = new Worker(input.queue, processor, {
    connection: normalizedConfig.connection,
    ...normalizedConfig.workerDefaults
  });

  worker.on("failed", (job, error) => {
    normalizedConfig.telemetry?.onFailed?.({
      queue: input.queue,
      jobId: String(job?.id ?? "unknown"),
      error: error.message
    });
  });

  return {
    worker,
    async close() {
      await worker.close();
    }
  };
}

export function createBullMqTestAdapter(): JobQueueAdapter & { enqueued: JobEnvelope[] } {
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

function buildJobOptions(
  envelope: JobEnvelope,
  schedule?: ScheduleDefinition,
  retryPolicy?: RetryPolicy
): JobsOptions {
  const delay = schedule?.kind === "delay" ? schedule.delayMs : undefined;

  const backoff =
    retryPolicy?.attempts && retryPolicy.attempts > 1
      ? {
          type: retryPolicy.backoff,
          delay: retryPolicy.delayMs
        }
      : undefined;

  return {
    jobId: envelope.jobId,
    ...(delay !== undefined ? { delay } : {}),
    ...(retryPolicy?.attempts ? { attempts: retryPolicy.attempts } : {}),
    ...(backoff ? { backoff } : {})
  };
}
