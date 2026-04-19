import { describe, expect, it } from "bun:test";
import { executeAction } from "@platform/schema";
import manifest from "../../package";
import { queueNotificationMessageAction } from "../../src/actions/default.action";
import { queueNotificationMessage } from "../../src/services/main.service";

describe("plugin manifest", () => {
  it("keeps a stable package id and primary capability", () => {
    expect(manifest.id).toBe("notifications-core");
    expect(manifest.providesCapabilities).toContain("notifications.messages");
  });

  it("routes outbound email through the declared provider adapter", () => {
    expect(
      queueNotificationMessage({
        messageId: "de57a01b-f693-47db-a4c3-a457ef1537b2",
        tenantId: "9344677c-f605-4374-9306-f2e8668f1ccd",
        channel: "email",
        recipientRef: "user:contact-42",
        templateKey: "billing.invoice-ready",
        deliveryMode: "immediate",
        priority: "high",
        reason: "invoice notification"
      })
    ).toEqual({
      ok: true,
      nextStatus: "queued",
      providerRoute: "sendgrid-adapter",
      eventType: "notifications.message.queued",
      requiredSecrets: ["SENDGRID_API_KEY"]
    });
  });

  it("preserves contract behavior for scheduled chat digests", async () => {
    const result = await executeAction(queueNotificationMessageAction, {
      messageId: "de57a01b-f693-47db-a4c3-a457ef1537b2",
      tenantId: "9344677c-f605-4374-9306-f2e8668f1ccd",
      channel: "chat",
      recipientRef: "team:ops-alerts",
      templateKey: "ops.daily-digest",
      deliveryMode: "scheduled",
      priority: "normal",
      sendAt: new Date(Date.now() + 600_000).toISOString(),
      reason: "daily digest"
    });

    expect(result).toEqual({
      ok: true,
      nextStatus: "scheduled",
      providerRoute: "slack-adapter",
      eventType: "notifications.message.scheduled",
      requiredSecrets: ["SLACK_BOT_TOKEN"]
    });
  });
});
