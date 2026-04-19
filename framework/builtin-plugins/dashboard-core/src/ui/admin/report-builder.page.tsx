import React from "react";

export function ReportBuilderPage() {
  return (
    <section data-plugin-page="dashboard-report-builder" className="awb-surface-stack">
      <div className="awb-inline-banner">
        <strong>Report builder</strong>
        <span>Compose approved semantic measures, filters, and export policies without exposing raw data queries.</span>
      </div>
      <div className="awb-inline-grid awb-inline-grid-2">
        <div className="awb-form-card">
          <h3 className="awb-panel-title">Builder lanes</h3>
          <ul className="awb-check-list">
            <li>Semantic source selection</li>
            <li>Filter and grouping design</li>
            <li>Export format and retention policy</li>
          </ul>
        </div>
        <div className="awb-form-card">
          <h3 className="awb-panel-title">Current draft</h3>
          <dl className="awb-detail-grid">
            <div>
              <dt>Source</dt>
              <dd>Revenue activity</dd>
            </div>
            <div>
              <dt>Measures</dt>
              <dd>3</dd>
            </div>
            <div>
              <dt>Dimensions</dt>
              <dd>2</dd>
            </div>
            <div>
              <dt>Publish state</dt>
              <dd>Draft</dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  );
}
