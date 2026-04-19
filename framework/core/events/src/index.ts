export const packageId = "events" as const;
export const packageDisplayName = "Events" as const;
export const packageDescription = "Typed domain events and outbox contracts." as const;

export type EventCorrelation = {
  requestId?: string | undefined;
  tenantId?: string | undefined;
  actorId?: string | undefined;
  pluginId?: string | undefined;
  causationId?: string | undefined;
  idempotencyKey?: string | undefined;
};

export type EventEnvelope<TPayload extends Record<string, unknown> = Record<string, unknown>> = {
  id: string;
  type: string;
  version: string;
  source: string;
  occurredAt: string;
  payload: Readonly<TPayload>;
  correlation: Readonly<EventCorrelation>;
};

export type EventDeliveryResult = {
  eventId: string;
  handlerId: string;
  status: "delivered" | "ignored" | "retry" | "dead-letter";
  message?: string | undefined;
};

export type EventHandler<TPayload extends Record<string, unknown> = Record<string, unknown>> = {
  id: string;
  eventType: string;
  handle(event: EventEnvelope<TPayload>): Promise<EventDeliveryResult> | EventDeliveryResult;
};

export type OutboxRecord = {
  id: string;
  partitionKey: string;
  eventType: string;
  eventId: string;
  payload: string;
  occurredAt: string;
  publishedAt?: string | undefined;
  idempotencyKey: string;
};

export type EventSerializer = {
  serialize<TPayload extends Record<string, unknown>>(event: EventEnvelope<TPayload>): string;
  deserialize(value: string): EventEnvelope<Record<string, unknown>>;
};

export type OutboxPublisher = {
  publish<TPayload extends Record<string, unknown>>(event: EventEnvelope<TPayload>, partitionKey: string): Promise<OutboxRecord>;
};

export function defineEvent<TPayload extends Record<string, unknown>>() {
  return <TEvent extends EventEnvelope<TPayload>>(event: TEvent) => event;
}

export function defineEventHandler<TPayload extends Record<string, unknown>>(
  handler: EventHandler<TPayload>
): EventHandler<TPayload> {
  return Object.freeze(handler);
}

export function createEventEnvelope<TPayload extends Record<string, unknown>>(input: {
  type: string;
  source: string;
  payload: TPayload;
  version?: string | undefined;
  occurredAt?: string | undefined;
  correlation?: EventCorrelation | undefined;
}): EventEnvelope<TPayload> {
  return Object.freeze({
    id: crypto.randomUUID(),
    type: input.type,
    source: input.source,
    version: input.version ?? "1",
    occurredAt: input.occurredAt ?? new Date().toISOString(),
    payload: deepFreeze({ ...input.payload }),
    correlation: Object.freeze({
      ...(input.correlation ?? {})
    })
  });
}

export function createOutboxRecord<TPayload extends Record<string, unknown>>(
  event: EventEnvelope<TPayload>,
  partitionKey: string,
  serializer: EventSerializer = jsonEventSerializer
): OutboxRecord {
  return Object.freeze({
    id: crypto.randomUUID(),
    partitionKey,
    eventType: event.type,
    eventId: event.id,
    payload: serializer.serialize(event),
    occurredAt: event.occurredAt,
    idempotencyKey: event.correlation.idempotencyKey ?? createEventIdempotencyKey(event.type, partitionKey)
  });
}

export function createEventIdempotencyKey(eventType: string, resourceId: string): string {
  return `${eventType}:${resourceId}`.toLowerCase();
}

export function markOutboxRecordPublished(record: OutboxRecord, publishedAt = new Date().toISOString()): OutboxRecord {
  return Object.freeze({
    ...record,
    publishedAt
  });
}

export const jsonEventSerializer: EventSerializer = Object.freeze({
  serialize(event) {
    return JSON.stringify(event);
  },
  deserialize(value) {
    return JSON.parse(value) as EventEnvelope<Record<string, unknown>>;
  }
});

export function createInMemoryOutboxPublisher(
  serializer: EventSerializer = jsonEventSerializer
): OutboxPublisher & { records: OutboxRecord[] } {
  const records: OutboxRecord[] = [];
  return {
    records,
    publish(event, partitionKey) {
      const record = createOutboxRecord(event, partitionKey, serializer);
      records.push(record);
      return Promise.resolve(record);
    }
  };
}

export async function deliverEvent<TPayload extends Record<string, unknown>>(
  handler: EventHandler<TPayload>,
  event: EventEnvelope<TPayload>
): Promise<EventDeliveryResult> {
  if (handler.eventType !== event.type) {
    return {
      eventId: event.id,
      handlerId: handler.id,
      status: "ignored",
      message: `handler '${handler.id}' does not accept '${event.type}'`
    };
  }

  return handler.handle(event);
}

function deepFreeze<TValue>(value: TValue): TValue {
  if (Array.isArray(value)) {
    for (const entry of value) {
      deepFreeze(entry);
    }
    return Object.freeze(value);
  }

  if (typeof value === "object" && value !== null) {
    for (const entry of Object.values(value as Record<string, unknown>)) {
      deepFreeze(entry);
    }
    return Object.freeze(value);
  }

  return value;
}
