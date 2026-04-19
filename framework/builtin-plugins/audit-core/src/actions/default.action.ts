import { defineAction } from "@platform/schema";
import { z } from "zod";
import { recordAuditEvent } from "../services/main.service";

export const recordAuditEventAction = defineAction({
  id: "audit.events.record",
  input: z.object({
    eventId: z.string().uuid(),
    tenantId: z.string().uuid(),
    actionId: z.string().min(3),
    actorId: z.string().uuid(),
    targetId: z.string().uuid().nullable().optional(),
    severity: z.enum(["info", "warning", "critical"]).default("info"),
    reason: z.string().min(3).optional()
  }),
  output: z.object({
    ok: z.literal(true),
    nextStatus: z.enum(["recorded", "redacted"]),
    eventSummary: z.string(),
    emittedEventType: z.enum(["audit.event.recorded", "audit.event.redacted"]),
    emittedOutboxId: z.string().uuid(),
    emittedIdempotencyKey: z.string(),
    occurredAt: z.string()
  }),
  permission: "audit.events.record",
  idempotent: true,
  audit: true,
  handler: ({ input }) => recordAuditEvent(input)
});
