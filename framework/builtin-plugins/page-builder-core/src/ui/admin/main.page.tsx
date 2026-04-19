import React from "react";
import { SplitPanelLayout } from "@platform/layout";
import { ObjectHeader } from "@platform/ui";

export function PageBuilderCoreAdminPage() {
  return (
    <section data-plugin-page="page-builder-core" className="awb-surface-stack">
      <ObjectHeader title="Page Builder" subtitle="Canonical layout panels keep embedded builders and governed zones visually consistent." />
      <div className="awb-inline-banner">
        <strong>Builder workbench</strong>
        <span>Layout, block, preview, and publish controls for governed internal experiences.</span>
      </div>
      <SplitPanelLayout
        left={
          <div className="awb-form-card">
            <h3 className="awb-panel-title">Builder promises</h3>
            <ul className="awb-check-list">
              <li>Embedded builder host for quick changes.</li>
              <li>Governed zone launcher for dense studio workflows.</li>
              <li>Explicit save, compare, and publish transitions.</li>
              <li>Platform-authenticated preview and telemetry continuity.</li>
            </ul>
          </div>
        }
        center={
          <div className="awb-form-card">
            <h3 className="awb-panel-title">Current draft</h3>
            <dl className="awb-detail-grid">
              <div>
                <dt>Draft revision</dt>
                <dd>12</dd>
              </div>
              <div>
                <dt>Published revision</dt>
                <dd>11</dd>
              </div>
              <div>
                <dt>Inspector mode</dt>
                <dd>Layout tokens</dd>
              </div>
              <div>
                <dt>Preview target</dt>
                <dd>Admin surfaces</dd>
              </div>
            </dl>
          </div>
        }
        right={
          <div className="awb-form-card">
            <h3 className="awb-panel-title">Release checks</h3>
            <ul className="awb-check-list">
              <li>Preview uses platform auth.</li>
              <li>Compare/publish audit trail attached.</li>
              <li>Zone launch remains governed.</li>
            </ul>
          </div>
        }
      />
    </section>
  );
}
