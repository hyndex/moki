import { defineResource } from "@platform/schema";
import { z } from "zod";

import { evalDatasets, evalRuns } from "../../db/schema";

export const EvalDatasetResource = defineResource({
  id: "ai.eval-datasets",
  table: evalDatasets,
  contract: z.object({
    id: z.string().min(2),
    tenantId: z.string().min(2),
    label: z.string().min(2),
    caseCount: z.number().nonnegative(),
    updatedAt: z.string()
  }),
  fields: {
    label: { searchable: true, sortable: true, label: "Dataset" },
    caseCount: { sortable: true, filter: "number", label: "Cases" },
    updatedAt: { sortable: true, label: "Updated" }
  },
  admin: {
    autoCrud: true,
    defaultColumns: ["label", "caseCount", "updatedAt"]
  },
  portal: { enabled: false },
  ai: {
    curatedReadModel: true,
    purpose: "Eval datasets used to gate prompt, tool, and model changes.",
    citationLabelField: "label",
    allowedFields: ["label", "caseCount", "updatedAt"]
  }
});

export const EvalRunResource = defineResource({
  id: "ai.eval-runs",
  table: evalRuns,
  contract: z.object({
    id: z.string().min(2),
    tenantId: z.string().min(2),
    datasetId: z.string().min(2),
    status: z.enum(["completed", "failed"]),
    passRate: z.number(),
    averageScore: z.number(),
    completedAt: z.string()
  }),
  fields: {
    datasetId: { searchable: true, sortable: true, label: "Dataset" },
    status: { filter: "select", label: "Status" },
    passRate: { sortable: true, filter: "number", label: "Pass rate" },
    averageScore: { sortable: true, filter: "number", label: "Average score" },
    completedAt: { sortable: true, label: "Completed" }
  },
  admin: {
    autoCrud: true,
    defaultColumns: ["datasetId", "status", "passRate", "averageScore", "completedAt"]
  },
  portal: { enabled: false },
  ai: {
    curatedReadModel: true,
    purpose: "Completed eval runs with regression-ready top-level metrics.",
    citationLabelField: "datasetId",
    allowedFields: ["datasetId", "status", "passRate", "averageScore", "completedAt"]
  }
});

export const aiEvalResources = [EvalDatasetResource, EvalRunResource] as const;
