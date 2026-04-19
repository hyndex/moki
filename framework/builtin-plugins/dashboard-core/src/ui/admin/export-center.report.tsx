import React from "react";

export function ExportCenterReportPage() {
  return (
    <section data-plugin-page="dashboard-export-center" className="awb-surface-stack">
      <div className="awb-inline-banner">
        <strong>Export center</strong>
        <span>Audit-backed delivery, retention, retries, and ownership for governed exports.</span>
      </div>
      <div className="awb-inline-grid awb-inline-grid-3">
        <div className="awb-mini-stat">
          <span className="awb-mini-stat-label">Queued</span>
          <strong className="awb-mini-stat-value">2</strong>
        </div>
        <div className="awb-mini-stat">
          <span className="awb-mini-stat-label">Delivered today</span>
          <strong className="awb-mini-stat-value">18</strong>
        </div>
        <div className="awb-mini-stat">
          <span className="awb-mini-stat-label">Retention</span>
          <strong className="awb-mini-stat-value">14 days</strong>
        </div>
      </div>
      <div className="awb-inline-table-wrap">
        <table className="awb-inline-table">
          <thead>
            <tr>
              <th>Export</th>
              <th>Owner</th>
              <th>Status</th>
              <th>Format</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>CRM pipeline weekly</td>
              <td>Revenue Ops</td>
              <td>Processing</td>
              <td>XLSX</td>
            </tr>
            <tr>
              <td>Usage audit extract</td>
              <td>Compliance</td>
              <td>Ready</td>
              <td>CSV</td>
            </tr>
            <tr>
              <td>Executive scorecard snapshot</td>
              <td>Leadership</td>
              <td>Delivered</td>
              <td>PDF</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
