import React from "react";

export function InboxSummaryWidget() {
  return (
    <section data-plugin-widget="dashboard-inbox-summary" className="awb-widget-spotlight">
      <h3 className="awb-panel-title">Operations inbox</h3>
      <p className="awb-muted-copy">Three approvals and one workflow follow-up are waiting for operator attention.</p>
      <ul className="awb-check-list">
        <li>2 export approvals</li>
        <li>1 restricted preview review</li>
        <li>1 workflow retry follow-up</li>
      </ul>
    </section>
  );
}
