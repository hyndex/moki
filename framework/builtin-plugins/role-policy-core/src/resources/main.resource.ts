import { defineResource } from "@platform/schema";
import { z } from "zod";
import { domainRecords } from "../../db/schema";

export const GrantResource = defineResource({
  id: "roles.grants",
  table: domainRecords,
  contract: z.object({
    id: z.string().uuid(),
    tenantId: z.string().uuid(),
    subjectType: z.enum(["user", "service-account"]),
    subjectId: z.string().uuid(),
    permission: z.string().min(3),
    effect: z.enum(["allow", "deny"]),
    status: z.enum(["draft", "active", "revoked"]),
    createdAt: z.string()
  }),
  fields: {
    subjectType: { filter: "select", label: "Subject Type" },
    permission: { searchable: true, sortable: true, label: "Permission" },
    effect: { filter: "select", label: "Effect" },
    status: { filter: "select", label: "Status" },
    createdAt: { sortable: true, label: "Created" }
  },
  admin: {
    autoCrud: true,
    defaultColumns: ["subjectType", "permission", "effect", "status", "createdAt"]
  },
  portal: { enabled: false }
});
