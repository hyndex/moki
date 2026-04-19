import { definePolicy } from "@platform/permissions";

export const notificationsPolicy = definePolicy({
  id: "notifications-core.default",
  rules: [
    {
      permission: "notifications.messages.read",
      allowIf: ["role:admin", "role:operator"]
    },
    {
      permission: "notifications.messages.queue",
      allowIf: ["role:admin"],
      requireReason: true,
      audit: true
    }
  ]
});