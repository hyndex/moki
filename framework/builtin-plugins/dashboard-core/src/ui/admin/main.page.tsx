import React from "react";

export function DashboardCoreAdminPage() {
  return (
    <section data-plugin-page="dashboard-core" className="awb-surface-stack">
      <div className="awb-inline-banner">
        <strong>Operations Overview</strong>
        <span>Cross-domain KPI, report, workflow, and launch surface for administrators and operators.</span>
      </div>
      <div className="awb-inline-grid awb-inline-grid-3">
        <div className="awb-mini-stat">
          <span className="awb-mini-stat-label">Saved dashboards</span>
          <strong className="awb-mini-stat-value">12</strong>
        </div>
        <div className="awb-mini-stat">
          <span className="awb-mini-stat-label">Open escalations</span>
          <strong className="awb-mini-stat-value">4</strong>
        </div>
        <div className="awb-mini-stat">
          <span className="awb-mini-stat-label">Background jobs</span>
          <strong className="awb-mini-stat-value">18</strong>
        </div>
      </div>
      <div className="awb-inline-grid awb-inline-grid-2">
        <div className="awb-form-card">
          <h3 className="awb-panel-title">Desk highlights</h3>
          <ul className="awb-check-list">
            <li>Saved dashboards and role-aware workspaces.</li>
            <li>Governed drill-through into reports and builders.</li>
            <li>Shell-owned favorites, recents, and saved views.</li>
            <li>Notifications, tenant context, and activity stay visible.</li>
            <li>Queue, export, and plugin-health tooling stay inside the same desk.</li>
          </ul>
        </div>
        <div className="awb-form-card">
          <h3 className="awb-panel-title">Shift priorities</h3>
          <dl className="awb-detail-grid">
            <div>
              <dt>Exports waiting</dt>
              <dd>2</dd>
            </div>
            <div>
              <dt>Reports pinned</dt>
              <dd>5</dd>
            </div>
            <div>
              <dt>Workspace focus</dt>
              <dd>Revenue ops</dd>
            </div>
            <div>
              <dt>Incident level</dt>
              <dd>Nominal</dd>
            </div>
          </dl>
        </div>
      </div>
      <div className="awb-inline-grid awb-inline-grid-2">
        <div className="awb-form-card">
          <h3 className="awb-panel-title">Operator loops</h3>
          <ul className="awb-check-list">
            <li>Open the inbox to clear approvals and follow-ups.</li>
            <li>Use export center for governed data delivery.</li>
            <li>Inspect worker backlogs in the job monitor.</li>
          </ul>
        </div>
        <div className="awb-form-card">
          <h3 className="awb-panel-title">Builder handoff</h3>
          <ul className="awb-check-list">
            <li>Semantic report builder for safe analytics authoring.</li>
            <li>Chart studio for card layouts and drill bindings.</li>
            <li>Page builder zone for denser editing flows.</li>
          </ul>
        </div>
      </div>
    </section>
  );
}
