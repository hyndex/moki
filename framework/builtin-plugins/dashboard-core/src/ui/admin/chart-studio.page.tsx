import React from "react";

export function ChartStudioPage() {
  return (
    <section data-plugin-page="dashboard-chart-studio" className="awb-surface-stack">
      <div className="awb-inline-banner">
        <strong>Chart studio</strong>
        <span>Define card layouts, drill paths, and dashboard bindings for governed analytics widgets.</span>
      </div>
      <div className="awb-inline-grid awb-inline-grid-2">
        <div className="awb-form-card">
          <h3 className="awb-panel-title">Card configuration</h3>
          <ul className="awb-check-list">
            <li>Linked filters and date ranges</li>
            <li>Drill-through route binding</li>
            <li>Role-aware dashboard placement</li>
          </ul>
        </div>
        <div className="awb-form-card">
          <h3 className="awb-panel-title">Preview settings</h3>
          <dl className="awb-detail-grid">
            <div>
              <dt>Chart family</dt>
              <dd>Line + KPI</dd>
            </div>
            <div>
              <dt>Theme</dt>
              <dd>Workbench tokens</dd>
            </div>
            <div>
              <dt>Drill target</dt>
              <dd>CRM pipeline report</dd>
            </div>
            <div>
              <dt>Refresh</dt>
              <dd>5 minutes</dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  );
}
