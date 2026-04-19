import React from "react";

import { ChartSurface, createBarChartOption } from "@platform/chart";

import {
  baselineFixture,
  candidateEvalRunFixture,
  comparisonFixture,
  datasetFixture,
  regressionGateResultFixture
} from "../../services/main.service";

export function AiEvalsAdminPage() {
  return (
    <section data-plugin-page="ai-evals" className="awb-surface-stack">
      <div className="awb-inline-banner">
        <strong>Eval runs and regression gates</strong>
        <span>Golden tasks, judges, citations, and release thresholds stay visible before rollout.</span>
      </div>
      <div className="awb-inline-grid awb-inline-grid-3">
        <div className="awb-mini-stat">
          <span className="awb-mini-stat-label">Dataset cases</span>
          <strong className="awb-mini-stat-value">{datasetFixture.cases.length}</strong>
        </div>
        <div className="awb-mini-stat">
          <span className="awb-mini-stat-label">Candidate pass rate</span>
          <strong className="awb-mini-stat-value">{candidateEvalRunFixture.passRate}</strong>
        </div>
        <div className="awb-mini-stat">
          <span className="awb-mini-stat-label">Gate</span>
          <strong className="awb-mini-stat-value">{regressionGateResultFixture.passed ? "Pass" : "Blocked"}</strong>
        </div>
      </div>
      <ChartSurface
        title="Baseline vs candidate"
        option={createBarChartOption({
          title: "Eval summary",
          labels: ["Pass rate", "Avg score", "Citation rate"],
          series: [
            {
              name: "Baseline",
              data: [baselineFixture.passRate, baselineFixture.averageScore, baselineFixture.citationRate]
            },
            {
              name: "Candidate",
              data: [
                candidateEvalRunFixture.passRate,
                candidateEvalRunFixture.averageScore,
                candidateEvalRunFixture.citationRate
              ]
            }
          ]
        })}
      />
      <div className="awb-form-card">
        <h3 className="awb-panel-title">Regression deltas</h3>
        <dl className="awb-detail-grid">
          <div>
            <dt>Pass rate delta</dt>
            <dd>{comparisonFixture.passRateDelta}</dd>
          </div>
          <div>
            <dt>Average score delta</dt>
            <dd>{comparisonFixture.averageScoreDelta}</dd>
          </div>
          <div>
            <dt>Citation rate delta</dt>
            <dd>{comparisonFixture.citationRateDelta}</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
