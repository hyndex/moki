import React from "react";

export function OperationsInboxPage() {
  return (
    <section data-plugin-page="dashboard-operations-inbox" className="awb-surface-stack">
      <div className="awb-inline-banner">
        <strong>Operations inbox</strong>
        <span>Approvals, escalations, and follow-ups grouped into one governed task queue.</span>
      </div>
      <div className="awb-inline-grid awb-inline-grid-2">
        <div className="awb-form-card">
          <h3 className="awb-panel-title">Needs action</h3>
          <ul className="awb-check-list">
            <li>Export approval for sensitive customer data</li>
            <li>Restricted preview acknowledgement for one marketplace package</li>
            <li>Workflow follow-up after failed notification delivery</li>
          </ul>
        </div>
        <div className="awb-form-card">
          <h3 className="awb-panel-title">Queue policy</h3>
          <dl className="awb-detail-grid">
            <div>
              <dt>SLA</dt>
              <dd>30 minutes</dd>
            </div>
            <div>
              <dt>Escalation</dt>
              <dd>Audit-backed</dd>
            </div>
            <div>
              <dt>Routing</dt>
              <dd>Role aware</dd>
            </div>
            <div>
              <dt>Retention</dt>
              <dd>180 days</dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  );
}
