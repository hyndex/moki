import React from "react";

import { regressionGateResultFixture } from "../../services/main.service";

export function EvalRegressionWidget() {
  return (
    <section data-plugin-widget="ai-eval-regressions" className="awb-form-card">
      <div className="awb-inline-banner">
        <strong>{regressionGateResultFixture.passed ? "Regression gate passing" : "Regression gate blocked"}</strong>
        <span>
          {regressionGateResultFixture.reasons.length > 0
            ? regressionGateResultFixture.reasons.join("; ")
            : "Latest candidate run stays within baseline thresholds."}
        </span>
      </div>
    </section>
  );
}
