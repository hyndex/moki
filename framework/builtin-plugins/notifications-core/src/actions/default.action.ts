import { defineAction } from "@platform/schema";
import { z } from "zod";
import { queueNotificationMessage } from "../services/main.service";

export const queueNotificationMessageAction = defineAction({
  id: "notifications.messages.queue",
  input: z.object({
    messageId: z.string().uuid(),
    tenantId: z.string().uuid(),
    channel: z.enum(["email", "chat", "in-app"]),
    recipientRef: z.string().min(3),
    templateKey: z.string().min(3),
    deliveryMode: z.enum(["immediate", "scheduled", "digest"]).default("immediate"),
    priority: z.enum(["low", "normal", "high", "critical"]).default("normal"),
    sendAt: z.string().min(1).optional(),
    reason: z.string().min(3).optional()
  }),
  output: z.object({
    ok: z.literal(true),
    nextStatus: z.enum(["queued", "scheduled", "blocked"]),
    providerRoute: z.enum(["sendgrid-adapter", "slack-adapter", "in-app"]),
    eventType: z.string(),
    requiredSecrets: z.array(z.string())
  }),
  permission: "notifications.messages.queue",
  idempotent: true,
  audit: true,
  handler: ({ input }) => queueNotificationMessage(input)
});
