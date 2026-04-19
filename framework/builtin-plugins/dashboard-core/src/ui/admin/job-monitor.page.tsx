import React from "react";

export function JobMonitorPage() {
  return (
    <section data-plugin-page="dashboard-job-monitor" className="awb-surface-stack">
      <div className="awb-inline-banner">
        <strong>Background job monitor</strong>
        <span>Queue throughput, retry posture, and worker health for asynchronous platform work.</span>
      </div>
      <div className="awb-inline-grid awb-inline-grid-3">
        <div className="awb-mini-stat">
          <span className="awb-mini-stat-label">Running workers</span>
          <strong className="awb-mini-stat-value">6</strong>
        </div>
        <div className="awb-mini-stat">
          <span className="awb-mini-stat-label">Retry backlog</span>
          <strong className="awb-mini-stat-value">3</strong>
        </div>
        <div className="awb-mini-stat">
          <span className="awb-mini-stat-label">Dead-letter items</span>
          <strong className="awb-mini-stat-value">0</strong>
        </div>
      </div>
      <div className="awb-inline-table-wrap">
        <table className="awb-inline-table">
          <thead>
            <tr>
              <th>Queue</th>
              <th>Status</th>
              <th>Visible at</th>
              <th>Retries</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>notifications</td>
              <td>running</td>
              <td>now</td>
              <td>0</td>
            </tr>
            <tr>
              <td>crm-sync</td>
              <td>scheduled</td>
              <td>in 4m</td>
              <td>1</td>
            </tr>
            <tr>
              <td>files-security</td>
              <td>running</td>
              <td>now</td>
              <td>0</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
