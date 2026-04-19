import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const domainRecords = pgTable("portal_records", {
  id: uuid("id").primaryKey(),
  tenantId: uuid("tenant_id").notNull(),
  accountType: text("account_type").notNull(),
  subjectId: text("subject_id").notNull(),
  primaryIdentityId: uuid("primary_identity_id").notNull(),
  membershipStatus: text("membership_status").notNull(),
  homeRoute: text("home_route").notNull(),
  selfServiceFeatures: text("self_service_features").notNull(),
  lastSeenAt: timestamp("last_seen_at"),
  createdAt: timestamp("created_at").notNull().defaultNow()
});
