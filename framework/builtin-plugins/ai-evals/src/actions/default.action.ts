import { defineAction } from "@platform/schema";
import { z } from "zod";

import { compareEvalRunScenario, runEvalDatasetScenario } from "../services/main.service";

export const runEvalDatasetAction = defineAction({
  id: "ai.evals.run",
  input: z.object({
    tenantId: z.string().min(2),
    datasetId: z.string().min(2),
    candidateLabel: z.string().min(2)
  }),
  output: z.object({
    ok: z.literal(true),
    runId: z.string(),
    passRate: z.number(),
    averageScore: z.number(),
    citationRate: z.number()
  }),
  permission: "ai.evals.run",
  idempotent: false,
  audit: true,
  ai: {
    purpose: "Execute an offline AI eval dataset against the current prompt, tool, and routing configuration.",
    riskLevel: "moderate",
    approvalMode: "required",
    toolPolicies: ["tool.require_approval"],
    resultSummaryHint: "Return the run id and the top-level pass, score, and citation metrics.",
    replay: {
      deterministic: true,
      includeInputHash: true,
      includeOutputHash: true,
      note: "Eval runs are replayed against the same dataset and judge configuration."
    }
  },
  handler: ({ input }) => runEvalDatasetScenario(input)
});

export const compareEvalRunsAction = defineAction({
  id: "ai.evals.compare",
  input: z.object({
    tenantId: z.string().min(2),
    baselineId: z.string().min(2),
    candidateRunId: z.string().min(2)
  }),
  output: z.object({
    ok: z.literal(true),
    passed: z.boolean(),
    reasons: z.array(z.string())
  }),
  permission: "ai.evals.read",
  idempotent: true,
  audit: false,
  ai: {
    purpose: "Compare a candidate eval run against a stored baseline and regression gate.",
    riskLevel: "low",
    approvalMode: "none",
    toolPolicies: ["tool.allow"],
    resultSummaryHint: "Return whether the regression gate passed and why.",
    replay: {
      deterministic: true,
      includeInputHash: true,
      includeOutputHash: true,
      note: "Comparisons are deterministic for the same baseline and candidate ids."
    }
  },
  handler: ({ input }) => compareEvalRunScenario(input)
});

export const aiEvalActions = [runEvalDatasetAction, compareEvalRunsAction] as const;
