import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const memoryCollections = pgTable("ai_memory_collections", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id"),
  label: text("label").notNull(),
  classification: text("classification").notNull(),
  sourcePlugin: text("source_plugin").notNull(),
  documentCount: integer("document_count").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});

export const memoryDocuments = pgTable("ai_memory_documents", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id"),
  collectionId: text("collection_id").notNull(),
  title: text("title").notNull(),
  sourceKind: text("source_kind").notNull(),
  classification: text("classification").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});
