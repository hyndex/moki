import { defineResource } from "@platform/schema";
import { z } from "zod";
import { domainRecords } from "../../db/schema";

export const AuditEventResource = defineResource({
  id: "audit.events",
  table: domainRecords,
  contract: z.object({
    id: z.string().uuid(),
    tenantId: z.string().uuid(),
    actionId: z.string().min(3),
    actorId: z.string().uuid(),
    targetId: z.string().uuid().nullable(),
    severity: z.enum(["info", "warning", "critical"]),
    status: z.enum(["recorded", "redacted"]),
    createdAt: z.string()
  }),
  fields: {
    actionId: { searchable: true, sortable: true, label: "Action" },
    actorId: { searchable: true, sortable: true, label: "Actor" },
    severity: { filter: "select", label: "Severity" },
    status: { filter: "select", label: "Status" },
    createdAt: { sortable: true, label: "Created" }
  },
  admin: {
    autoCrud: true,
    defaultColumns: ["actionId", "actorId", "severity", "status", "createdAt"]
  },
  portal: { enabled: false }
});
