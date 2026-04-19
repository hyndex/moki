import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const evalDatasets = pgTable("ai_eval_datasets", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  label: text("label").notNull(),
  caseCount: integer("case_count").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});

export const evalRuns = pgTable("ai_eval_runs", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  datasetId: text("dataset_id").notNull(),
  status: text("status").notNull(),
  passRate: integer("pass_rate").notNull(),
  averageScore: integer("average_score").notNull(),
  completedAt: timestamp("completed_at").notNull().defaultNow()
});
