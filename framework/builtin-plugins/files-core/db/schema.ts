import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const domainRecords = pgTable("files_records", {
  id: uuid("id").primaryKey(),
  tenantId: uuid("tenant_id").notNull(),
  fileName: text("file_name").notNull(),
  objectKey: text("object_key").notNull(),
  storageAdapter: text("storage_adapter").notNull(),
  contentType: text("content_type").notNull(),
  bytes: integer("bytes").notNull(),
  visibility: text("visibility").notNull(),
  checksum: text("checksum").notNull(),
  malwareStatus: text("malware_status").notNull(),
  status: text("status").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow()
});
