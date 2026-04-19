import { defineResource } from "@platform/schema";
import { z } from "zod";
import { domainRecords } from "../../db/schema";
import { jobDefinitionKeys } from "../jobs/catalog";

export const JobExecutionResource = defineResource({
  id: "jobs.executions",
  table: domainRecords,
  contract: z.object({
    id: z.string().uuid(),
    tenantId: z.string().uuid(),
    jobKey: z.enum(jobDefinitionKeys),
    queue: z.string().min(2),
    schedule: z.string().min(1).nullable(),
    concurrency: z.number().int().positive(),
    retries: z.number().int().nonnegative(),
    timeoutMs: z.number().int().positive(),
    status: z.enum(["scheduled", "queued", "running", "failed", "completed"]),
    lastError: z.string().nullable(),
    visibleAt: z.string().min(1),
    createdAt: z.string()
  }),
  fields: {
    concurrency: { filter: "number", label: "Concurrency" },
    createdAt: { sortable: true, label: "Created" },
    jobKey: { searchable: true, sortable: true, label: "Job" },
    queue: { searchable: true, sortable: true, label: "Queue" },
    retries: { filter: "number", label: "Retries" },
    status: { filter: "select", label: "Status" },
    visibleAt: { filter: "date", sortable: true, label: "Visible At" }
  },
  admin: {
    autoCrud: true,
    defaultColumns: ["jobKey", "queue", "status", "visibleAt", "concurrency", "retries"]
  },
  portal: { enabled: false }
});
