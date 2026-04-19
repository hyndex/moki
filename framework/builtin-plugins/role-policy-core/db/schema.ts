import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const domainRecords = pgTable("role_policy_records", {
  id: uuid("id").primaryKey(),
  tenantId: uuid("tenant_id").notNull(),
  label: text("label").notNull(),
  status: text("status").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow()
});