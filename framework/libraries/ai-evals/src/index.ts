import type { Citation } from "@platform/ai-memory";

export const packageId = "ai-evals" as const;
export const packageDisplayName = "AI Evals" as const;
export const packageDescription = "Eval datasets, judges, regression comparison, and release gates for AI runs." as const;

export type EvalMetric = {
  id: string;
  label: string;
  score: number;
  passed: boolean;
  detail?: string | undefined;
};

export type EvalCase = {
  id: string;
  label: string;
  input: string;
  expectedTools?: string[] | undefined;
  expectedRefusal?: boolean | undefined;
  requiredCitationSources?: string[] | undefined;
  rubric?: string[] | undefined;
  tags?: string[] | undefined;
};

export type EvalDataset = {
  id: string;
  label: string;
  cases: EvalCase[];
  thresholds?: {
    minPassRate?: number | undefined;
    minAverageScore?: number | undefined;
    minCitationRate?: number | undefined;
  } | undefined;
};

export type EvalCaseExecutionResult = {
  outputText: string;
  toolCalls?: string[] | undefined;
  citations?: Citation[] | undefined;
  refused?: boolean | undefined;
};

export type EvalCaseResult = EvalCaseExecutionResult & {
  caseId: string;
  metrics: EvalMetric[];
  passed: boolean;
};

export type EvalJudge = {
  id: string;
  evaluate(input: {
    evalCase: EvalCase;
    result: EvalCaseExecutionResult;
  }): Promise<EvalMetric[]> | EvalMetric[];
};

export type EvalRun = {
  id: string;
  datasetId: string;
  startedAt: string;
  completedAt?: string | undefined;
  caseResults: EvalCaseResult[];
  passRate: number;
  averageScore: number;
  citationRate: number;
};

export type EvalBaseline = {
  id: string;
  datasetId: string;
  runId: string;
  capturedAt: string;
  passRate: number;
  averageScore: number;
  citationRate: number;
};

export type RegressionGate = {
  datasetId: string;
  minPassRate?: number | undefined;
  minAverageScore?: number | undefined;
  minCitationRate?: number | undefined;
  maxPassRateDrop?: number | undefined;
  maxAverageScoreDrop?: number | undefined;
  maxCitationRateDrop?: number | undefined;
};

export function defineEvalDataset(dataset: EvalDataset): EvalDataset {
  return Object.freeze({
    ...dataset,
    cases: [...dataset.cases]
  });
}

export async function runEvalDataset(
  dataset: EvalDataset,
  input: {
    judges: EvalJudge[];
    executeCase(evalCase: EvalCase): Promise<EvalCaseExecutionResult> | EvalCaseExecutionResult;
    runId?: string | undefined;
    startedAt?: string | Date | undefined;
  }
): Promise<EvalRun> {
  const startedAt = normalizeTimestamp(input.startedAt ?? new Date());
  const caseResults: EvalCaseResult[] = [];

  for (const evalCase of dataset.cases) {
    const result = await input.executeCase(evalCase);
    const judgedMetrics = (
      await Promise.all(
        input.judges.map((judge) =>
          Promise.resolve(
            judge.evaluate({
              evalCase,
              result
            })
          )
        )
      )
    ).flat();

    const metrics = [...judgedMetrics];
    const passed = metrics.every((metric) => metric.passed);
    caseResults.push({
      caseId: evalCase.id,
      ...result,
      metrics,
      passed
    });
  }

  const passRate = caseResults.length === 0 ? 1 : caseResults.filter((caseResult) => caseResult.passed).length / caseResults.length;
  const averageScore =
    caseResults.length === 0
      ? 1
      : caseResults.reduce((total, caseResult) => total + averageMetricScore(caseResult.metrics), 0) / caseResults.length;
  const citationRate =
    caseResults.length === 0
      ? 1
      : caseResults.filter((caseResult) => (caseResult.citations?.length ?? 0) > 0).length / caseResults.length;

  return Object.freeze({
    id: input.runId ?? `${dataset.id}:run:${startedAt}`,
    datasetId: dataset.id,
    startedAt,
    completedAt: normalizeTimestamp(new Date()),
    caseResults,
    passRate: roundMetric(passRate),
    averageScore: roundMetric(averageScore),
    citationRate: roundMetric(citationRate)
  });
}

export function createEvalBaseline(run: EvalRun, baselineId = `${run.datasetId}:baseline:${run.id}`): EvalBaseline {
  return Object.freeze({
    id: baselineId,
    datasetId: run.datasetId,
    runId: run.id,
    capturedAt: normalizeTimestamp(run.completedAt ?? run.startedAt),
    passRate: run.passRate,
    averageScore: run.averageScore,
    citationRate: run.citationRate
  });
}

export function compareEvalRuns(
  baseline: Pick<EvalBaseline, "datasetId" | "passRate" | "averageScore" | "citationRate">,
  candidate: Pick<EvalRun, "datasetId" | "passRate" | "averageScore" | "citationRate">
): {
  passRateDelta: number;
  averageScoreDelta: number;
  citationRateDelta: number;
} {
  if (baseline.datasetId !== candidate.datasetId) {
    throw new Error("cannot compare eval runs from different datasets");
  }

  return {
    passRateDelta: roundMetric(candidate.passRate - baseline.passRate),
    averageScoreDelta: roundMetric(candidate.averageScore - baseline.averageScore),
    citationRateDelta: roundMetric(candidate.citationRate - baseline.citationRate)
  };
}

export function checkRegressionGate(
  gate: RegressionGate,
  baseline: EvalBaseline,
  candidate: EvalRun
): {
  passed: boolean;
  reasons: string[];
} {
  const deltas = compareEvalRuns(baseline, candidate);
  const reasons: string[] = [];

  if (gate.minPassRate !== undefined && candidate.passRate < gate.minPassRate) {
    reasons.push(`pass rate ${candidate.passRate} is below minimum ${gate.minPassRate}`);
  }
  if (gate.minAverageScore !== undefined && candidate.averageScore < gate.minAverageScore) {
    reasons.push(`average score ${candidate.averageScore} is below minimum ${gate.minAverageScore}`);
  }
  if (gate.minCitationRate !== undefined && candidate.citationRate < gate.minCitationRate) {
    reasons.push(`citation rate ${candidate.citationRate} is below minimum ${gate.minCitationRate}`);
  }
  if (gate.maxPassRateDrop !== undefined && deltas.passRateDelta < -gate.maxPassRateDrop) {
    reasons.push(`pass rate regressed by ${Math.abs(deltas.passRateDelta)}`);
  }
  if (gate.maxAverageScoreDrop !== undefined && deltas.averageScoreDelta < -gate.maxAverageScoreDrop) {
    reasons.push(`average score regressed by ${Math.abs(deltas.averageScoreDelta)}`);
  }
  if (gate.maxCitationRateDrop !== undefined && deltas.citationRateDelta < -gate.maxCitationRateDrop) {
    reasons.push(`citation rate regressed by ${Math.abs(deltas.citationRateDelta)}`);
  }

  return {
    passed: reasons.length === 0,
    reasons
  };
}

function averageMetricScore(metrics: EvalMetric[]): number {
  if (metrics.length === 0) {
    return 1;
  }
  return metrics.reduce((total, metric) => total + metric.score, 0) / metrics.length;
}

function roundMetric(value: number): number {
  return Number(value.toFixed(4));
}

function normalizeTimestamp(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
