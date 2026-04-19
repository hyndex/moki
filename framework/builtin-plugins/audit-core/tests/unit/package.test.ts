import { describe, expect, it } from "bun:test";
import { executeAction } from "@platform/schema";
import manifest from "../../package";
import { recordAuditEventAction } from "../../src/actions/default.action";
import { emitAuditEvent, recordAuditEvent } from "../../src/services/main.service";

describe("plugin manifest", () => {
  it("keeps a stable package id and primary capability", () => {
    expect(manifest.id).toBe("audit-core");
    expect(manifest.providesCapabilities).toContain("audit.events");
  });

  it("summarizes audit events for downstream sinks", () => {
    const result = recordAuditEvent({
      eventId: "8d18b663-6663-43eb-92d2-afed9e4a7ab9",
      tenantId: "b232d7e5-6878-434c-ae08-c8574a7de0ae",
      actionId: "crm.contacts.archive",
      actorId: "8d18b663-6663-43eb-92d2-afed9e4a7ab9",
      severity: "critical",
      reason: "security review"
    });

    expect(result.ok).toBe(true);
    expect(result.nextStatus).toBe("recorded");
    expect(result.eventSummary).toBe("8d18b663-6663-43eb-92d2-afed9e4a7ab9:crm.contacts.archive:critical");
    expect(result.emittedEventType).toBe("audit.event.recorded");
    expect(result.emittedIdempotencyKey).toBe("audit.event.recorded:8d18b663-6663-43eb-92d2-afed9e4a7ab9");
    expect(typeof result.emittedOutboxId).toBe("string");
    expect(typeof result.occurredAt).toBe("string");
  });

  it("keeps the audit action contract stable", async () => {
    const result = await executeAction(recordAuditEventAction, {
      eventId: "8d18b663-6663-43eb-92d2-afed9e4a7ab9",
      tenantId: "b232d7e5-6878-434c-ae08-c8574a7de0ae",
      actionId: "crm.contacts.archive",
      actorId: "8d18b663-6663-43eb-92d2-afed9e4a7ab9",
      targetId: null,
      severity: "warning",
      reason: "redact target payload"
    });

    expect(result.ok).toBe(true);
    expect(result.nextStatus).toBe("redacted");
    expect(result.eventSummary).toBe("8d18b663-6663-43eb-92d2-afed9e4a7ab9:crm.contacts.archive:warning");
    expect(result.emittedEventType).toBe("audit.event.redacted");
    expect(result.emittedIdempotencyKey).toBe("audit.event.redacted:8d18b663-6663-43eb-92d2-afed9e4a7ab9");
    expect(typeof result.emittedOutboxId).toBe("string");
    expect(typeof result.occurredAt).toBe("string");
  });

  it("emits explicit outbox metadata for downstream audit sinks", () => {
    const emission = emitAuditEvent({
      eventId: "8d18b663-6663-43eb-92d2-afed9e4a7ab9",
      tenantId: "b232d7e5-6878-434c-ae08-c8574a7de0ae",
      actionId: "crm.contacts.archive",
      actorId: "8d18b663-6663-43eb-92d2-afed9e4a7ab9",
      severity: "warning",
      status: "redacted",
      summary: "8d18b663-6663-43eb-92d2-afed9e4a7ab9:crm.contacts.archive:warning"
    });

    expect(emission.eventType).toBe("audit.event.redacted");
    expect(emission.idempotencyKey).toBe("audit.event.redacted:8d18b663-6663-43eb-92d2-afed9e4a7ab9");
    expect(typeof emission.outboxId).toBe("string");
  });
});
