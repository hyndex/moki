import { defineResource } from "@platform/schema";
import { z } from "zod";
import { domainRecords } from "../../db/schema";

export const NotificationMessageResource = defineResource({
  id: "notifications.messages",
  table: domainRecords,
  contract: z.object({
    id: z.string().uuid(),
    tenantId: z.string().uuid(),
    channel: z.enum(["email", "chat", "in-app"]),
    templateKey: z.string().min(3),
    recipientRef: z.string().min(3),
    deliveryMode: z.enum(["immediate", "scheduled", "digest"]),
    priority: z.enum(["low", "normal", "high", "critical"]),
    providerRoute: z.string().min(3),
    status: z.enum(["queued", "scheduled", "blocked", "sent", "failed"]),
    sendAt: z.string().min(1).nullable(),
    createdAt: z.string()
  }),
  fields: {
    channel: { filter: "select", label: "Channel" },
    createdAt: { sortable: true, label: "Created" },
    deliveryMode: { filter: "select", label: "Delivery" },
    priority: { filter: "select", label: "Priority" },
    providerRoute: { searchable: true, sortable: true, label: "Provider" },
    status: { filter: "select", label: "Status" },
    templateKey: { searchable: true, sortable: true, label: "Template" }
  },
  admin: {
    autoCrud: true,
    defaultColumns: ["channel", "templateKey", "priority", "providerRoute", "status", "createdAt"]
  },
  portal: { enabled: false }
});
