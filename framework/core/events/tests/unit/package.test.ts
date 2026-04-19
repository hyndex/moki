import { describe, expect, it } from "bun:test";

import {
  createEventEnvelope,
  createEventIdempotencyKey,
  createInMemoryOutboxPublisher,
  defineEventHandler,
  deliverEvent,
  jsonEventSerializer,
  markOutboxRecordPublished,
  packageId
} from "../../src";

describe("events", () => {
  it("exposes a stable package id", () => {
    expect(packageId).toBe("events");
  });

  it("creates correlated envelopes and idempotency keys", () => {
    const event = createEventEnvelope({
      type: "crm.contact.created",
      source: "crm-core",
      payload: {
        contactId: "contact-1"
      },
      correlation: {
        requestId: "req-1",
        tenantId: "tenant-a"
      }
    });

    expect(event.correlation.requestId).toBe("req-1");
    expect(createEventIdempotencyKey(event.type, "contact-1")).toBe("crm.contact.created:contact-1");
  });

  it("serializes outbox records and tracks publication state", async () => {
    const publisher = createInMemoryOutboxPublisher();
    const event = createEventEnvelope({
      type: "crm.contact.created",
      source: "crm-core",
      payload: {
        contactId: "contact-1"
      }
    });

    const record = await publisher.publish(event, "contact-1");
    const restored = jsonEventSerializer.deserialize(record.payload);

    expect(restored.type).toBe("crm.contact.created");
    expect(markOutboxRecordPublished(record, "2026-04-18T00:00:00.000Z").publishedAt).toBe("2026-04-18T00:00:00.000Z");
  });

  it("delivers matching events and ignores mismatched handlers", async () => {
    const event = createEventEnvelope({
      type: "crm.contact.created",
      source: "crm-core",
      payload: {
        contactId: "contact-1"
      }
    });
    const handler = defineEventHandler({
      id: "crm.sync",
      eventType: "crm.contact.created",
      handle: (currentEvent) => ({
        eventId: currentEvent.id,
        handlerId: "crm.sync",
        status: "delivered"
      })
    });
    const ignored = defineEventHandler({
      id: "crm.ignore",
      eventType: "crm.contact.deleted",
      handle: (currentEvent) => ({
        eventId: currentEvent.id,
        handlerId: "crm.ignore",
        status: "delivered"
      })
    });

    expect((await deliverEvent(handler, event)).status).toBe("delivered");
    expect((await deliverEvent(ignored, event)).status).toBe("ignored");
  });
});
