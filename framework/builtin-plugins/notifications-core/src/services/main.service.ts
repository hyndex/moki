import { normalizeActionInput } from "@platform/schema";

export type DomainActionInput = {
  messageId: string;
  tenantId: string;
  channel: "email" | "chat" | "in-app";
  recipientRef: string;
  templateKey: string;
  deliveryMode: "immediate" | "scheduled" | "digest";
  priority: "low" | "normal" | "high" | "critical";
  sendAt?: string | undefined;
  reason?: string | undefined;
};

const providerRoutes = {
  email: "sendgrid-adapter",
  chat: "slack-adapter",
  "in-app": "in-app"
} as const;

const requiredSecretsByChannel = {
  email: ["SENDGRID_API_KEY"],
  chat: ["SLACK_BOT_TOKEN"],
  "in-app": []
} as const;

export function queueNotificationMessage(input: DomainActionInput): {
  ok: true;
  nextStatus: "queued" | "scheduled" | "blocked";
  providerRoute: "sendgrid-adapter" | "slack-adapter" | "in-app";
  eventType: string;
  requiredSecrets: string[];
} {
  normalizeActionInput(input);
  if (input.deliveryMode !== "immediate" && !input.sendAt) {
    throw new Error(`delivery mode ${input.deliveryMode} requires sendAt`);
  }

  const providerRoute = providerRoutes[input.channel];
  const nextStatus =
    input.recipientRef.startsWith("suppressed:") ? "blocked" : input.deliveryMode === "immediate" ? "queued" : "scheduled";

  return {
    ok: true,
    nextStatus,
    providerRoute,
    eventType: `notifications.message.${nextStatus}`,
    requiredSecrets: [...requiredSecretsByChannel[input.channel]]
  };
}
