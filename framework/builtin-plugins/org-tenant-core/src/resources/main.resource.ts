import { defineResource } from "@platform/schema";
import { z } from "zod";
import { domainRecords } from "../../db/schema";

export const TenantResource = defineResource({
  id: "org.tenants",
  table: domainRecords,
  contract: z.object({
    id: z.string().uuid(),
    tenantId: z.string().uuid(),
    slug: z.string().min(2),
    displayName: z.string().min(2),
    billingPlan: z.enum(["trial", "standard", "enterprise"]),
    status: z.enum(["provisioning", "active", "suspended"]),
    createdAt: z.string()
  }),
  fields: {
    slug: { searchable: true, sortable: true, label: "Slug" },
    displayName: { searchable: true, sortable: true, label: "Display Name" },
    billingPlan: { filter: "select", label: "Billing Plan" },
    status: { filter: "select", label: "Status" },
    createdAt: { sortable: true, label: "Created" }
  },
  admin: {
    autoCrud: true,
    defaultColumns: ["displayName", "slug", "billingPlan", "status", "createdAt"]
  },
  portal: { enabled: false }
});
