import React from "react";

import { retrievalFixture } from "../../services/main.service";

export function RetrievalHealthWidget() {
  return (
    <section data-plugin-widget="ai-retrieval-health" className="awb-form-card">
      <div className="awb-inline-banner">
        <strong>{retrievalFixture.citations.length} citations returned</strong>
        <span>{retrievalFixture.plan.collectionIds.length} approved collections participated in the latest diagnostic query.</span>
      </div>
    </section>
  );
}
