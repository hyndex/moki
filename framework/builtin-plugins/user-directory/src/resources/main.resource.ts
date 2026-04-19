import { defineResource } from "@platform/schema";
import { z } from "zod";
import { domainRecords } from "../../db/schema";

export const PersonResource = defineResource({
  id: "directory.people",
  table: domainRecords,
  contract: z.object({
    id: z.string().uuid(),
    tenantId: z.string().uuid(),
    fullName: z.string().min(2),
    email: z.string().email(),
    employmentType: z.enum(["employee", "contractor", "member"]),
    status: z.enum(["invited", "active", "inactive"]),
    createdAt: z.string()
  }),
  fields: {
    fullName: { searchable: true, sortable: true, label: "Full Name" },
    email: { searchable: true, sortable: true, label: "Email" },
    employmentType: { filter: "select", label: "Employment Type" },
    status: { filter: "select", label: "Status" },
    createdAt: { sortable: true, label: "Created" }
  },
  admin: {
    autoCrud: true,
    defaultColumns: ["fullName", "email", "employmentType", "status", "createdAt"]
  },
  portal: { enabled: false }
});
