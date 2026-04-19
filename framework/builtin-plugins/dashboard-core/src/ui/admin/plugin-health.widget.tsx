import React from "react";

export function PluginHealthWidget() {
  return (
    <section data-plugin-widget="dashboard-plugin-health" className="awb-widget-spotlight">
      <h3 className="awb-panel-title">Plugin health</h3>
      <p className="awb-muted-copy">The active graph is stable with one restricted preview package awaiting review.</p>
      <div className="awb-inline-grid awb-inline-grid-2">
        <div className="awb-mini-stat">
          <span className="awb-mini-stat-label">Conflicts</span>
          <strong className="awb-mini-stat-value">0</strong>
        </div>
        <div className="awb-mini-stat">
          <span className="awb-mini-stat-label">Restricted</span>
          <strong className="awb-mini-stat-value">1</strong>
        </div>
      </div>
    </section>
  );
}
