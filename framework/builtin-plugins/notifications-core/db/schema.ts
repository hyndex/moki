import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const domainRecords = pgTable("notifications_records", {
  id: uuid("id").primaryKey(),
  tenantId: uuid("tenant_id").notNull(),
  channel: text("channel").notNull(),
  templateKey: text("template_key").notNull(),
  recipientRef: text("recipient_ref").notNull(),
  deliveryMode: text("delivery_mode").notNull(),
  priority: text("priority").notNull(),
  providerRoute: text("provider_route").notNull(),
  status: text("status").notNull(),
  sendAt: timestamp("send_at"),
  createdAt: timestamp("created_at").notNull().defaultNow()
});
