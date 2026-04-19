import { defineResource } from "@platform/schema";
import { z } from "zod";
import { domainRecords } from "../../db/schema";

export const PortalAccountResource = defineResource({
  id: "portal.accounts",
  table: domainRecords,
  contract: z.object({
    id: z.string().uuid(),
    tenantId: z.string().uuid(),
    accountType: z.enum(["customer", "member", "vendor", "patient", "student"]),
    subjectId: z.string().min(3),
    primaryIdentityId: z.string().uuid(),
    membershipStatus: z.enum(["invited", "active", "suspended"]),
    homeRoute: z.string().min(3),
    selfServiceFeatures: z.array(z.enum(["cases", "documents", "billing", "bookings", "learning"])),
    lastSeenAt: z.string().min(1).nullable(),
    createdAt: z.string()
  }),
  fields: {
    accountType: { filter: "select", label: "Account Type" },
    createdAt: { sortable: true, label: "Created" },
    homeRoute: { searchable: true, sortable: true, label: "Home" },
    membershipStatus: { filter: "select", label: "Membership" },
    subjectId: { searchable: true, sortable: true, label: "Subject" }
  },
  admin: {
    autoCrud: true,
    defaultColumns: ["accountType", "subjectId", "membershipStatus", "homeRoute", "createdAt"]
  },
  portal: { enabled: true }
});
