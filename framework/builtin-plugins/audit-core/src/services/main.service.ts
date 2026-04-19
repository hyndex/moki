import { createEventEnvelope, createEventIdempotencyKey, createOutboxRecord } from "@platform/events";
import { normalizeActionInput } from "@platform/schema";

export type DomainActionInput = {
  eventId: string;
  tenantId: string;
  actionId: string;
  actorId: string;
  targetId?: string | null | undefined;
  severity: "info" | "warning" | "critical";
  reason?: string | undefined;
};

export type AuditLifecycleStatus = "recorded" | "redacted";

export type AuditDomainEvent = {
  type: "audit.event.recorded" | "audit.event.redacted";
  eventId: string;
  tenantId: string;
  actionId: string;
  actorId: string;
  targetId?: string | null | undefined;
  severity: "info" | "warning" | "critical";
  status: AuditLifecycleStatus;
  summary: string;
  occurredAt: string;
};

export function emitAuditEvent(input: {
  eventId: string;
  tenantId: string;
  actionId: string;
  actorId: string;
  targetId?: string | null | undefined;
  severity: "info" | "warning" | "critical";
  status: AuditLifecycleStatus;
  summary: string;
}): {
  eventType: AuditDomainEvent["type"];
  occurredAt: string;
  outboxId: string;
  idempotencyKey: string;
} {
  const occurredAt = new Date().toISOString();
  const eventType = input.status === "redacted" ? "audit.event.redacted" : "audit.event.recorded";
  const idempotencyKey = createEventIdempotencyKey(eventType, input.eventId);
  const domainEvent = createEventEnvelope({
    type: eventType,
    source: "framework/builtin-plugins/audit-core",
    occurredAt,
    payload: {
      eventId: input.eventId,
      tenantId: input.tenantId,
      actionId: input.actionId,
      actorId: input.actorId,
      ...(input.targetId == null ? {} : { targetId: input.targetId }),
      severity: input.severity,
      status: input.status,
      summary: input.summary,
      occurredAt
    },
    correlation: {
      tenantId: input.tenantId,
      actorId: input.actorId,
      idempotencyKey
    }
  });
  const outbox = createOutboxRecord(domainEvent, input.tenantId);

  return {
    eventType,
    occurredAt: outbox.occurredAt,
    outboxId: outbox.id,
    idempotencyKey
  };
}

export function recordAuditEvent(input: DomainActionInput): {
  ok: true;
  nextStatus: AuditLifecycleStatus;
  eventSummary: string;
  emittedEventType: AuditDomainEvent["type"];
  emittedOutboxId: string;
  emittedIdempotencyKey: string;
  occurredAt: string;
} {
  const { targetId, ...rest } = input;
  normalizeActionInput(targetId == null ? rest : { ...rest, targetId });
  const nextStatus = input.reason?.toLowerCase().includes("redact") ? "redacted" : "recorded";
  const eventSummary = `${input.actorId}:${input.actionId}:${input.severity}`;
  const emission = emitAuditEvent({
    eventId: input.eventId,
    tenantId: input.tenantId,
    actionId: input.actionId,
    actorId: input.actorId,
    targetId: input.targetId,
    severity: input.severity,
    status: nextStatus,
    summary: eventSummary
  });

  return {
    ok: true,
    nextStatus,
    eventSummary,
    emittedEventType: emission.eventType,
    emittedOutboxId: emission.outboxId,
    emittedIdempotencyKey: emission.idempotencyKey,
    occurredAt: emission.occurredAt
  };
}
