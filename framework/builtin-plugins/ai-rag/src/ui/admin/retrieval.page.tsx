import React from "react";

import { ChartSurface, createBarChartOption } from "@platform/chart";
import { formatPlatformDateTime } from "@platform/ui";

import { retrievalFixture } from "../../services/main.service";

export function RetrievalDiagnosticsPage() {
  return (
    <section data-plugin-page="ai-rag-retrieval" className="awb-surface-stack">
      <div className="awb-inline-banner">
        <strong>Retrieval diagnostics</strong>
        <span>Citations, freshness windows, and approved source kinds remain visible for every grounded response.</span>
      </div>
      <ChartSurface
        title="Citation confidence"
        option={createBarChartOption({
          title: "Citation confidence",
          labels: retrievalFixture.citations.map((citation) => citation.sourceObjectId),
          series: [
            {
              name: "Confidence",
              data: retrievalFixture.citations.map((citation) => Number((citation.confidence * 100).toFixed(2)))
            }
          ]
        })}
      />
      <div className="awb-inline-grid awb-inline-grid-2">
        {retrievalFixture.citations.map((citation) => (
          <div key={citation.chunkId} className="awb-form-card">
            <h3 className="awb-panel-title">{citation.sourceObjectId}</h3>
            <p className="awb-muted-copy">{citation.excerpt}</p>
            <dl className="awb-detail-grid">
              <div>
                <dt>Score</dt>
                <dd>{citation.score}</dd>
              </div>
              <div>
                <dt>Confidence</dt>
                <dd>{citation.confidence}</dd>
              </div>
              <div>
                <dt>Freshness cutoff</dt>
                <dd>{formatPlatformDateTime(retrievalFixture.plan.freshnessCutoff ?? "2026-04-18T12:00:00.000Z")}</dd>
              </div>
            </dl>
          </div>
        ))}
      </div>
    </section>
  );
}
