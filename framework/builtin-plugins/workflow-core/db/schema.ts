import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const domainRecords = pgTable("workflow_records", {
  id: uuid("id").primaryKey(),
  tenantId: uuid("tenant_id").notNull(),
  definitionKey: text("definition_key").notNull(),
  subjectType: text("subject_type").notNull(),
  subjectId: text("subject_id").notNull(),
  currentState: text("current_state").notNull(),
  approvalStatus: text("approval_status").notNull(),
  assignedRole: text("assigned_role"),
  dueAt: timestamp("due_at"),
  lastTransitionAt: timestamp("last_transition_at"),
  createdAt: timestamp("created_at").notNull().defaultNow()
});
