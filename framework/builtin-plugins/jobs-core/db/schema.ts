import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const domainRecords = pgTable("jobs_records", {
  id: uuid("id").primaryKey(),
  tenantId: uuid("tenant_id").notNull(),
  jobKey: text("job_key").notNull(),
  queue: text("queue").notNull(),
  schedule: text("schedule"),
  concurrency: integer("concurrency").notNull(),
  retries: integer("retries").notNull(),
  timeoutMs: integer("timeout_ms").notNull(),
  status: text("status").notNull(),
  lastError: text("last_error"),
  visibleAt: timestamp("visible_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow()
});
