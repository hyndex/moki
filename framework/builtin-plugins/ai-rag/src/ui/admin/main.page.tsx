import React from "react";

import { formatPlatformDateTime } from "@platform/ui";

import { documentFixtures, memoryCollectionsFixture } from "../../services/main.service";

export function AiRagAdminPage() {
  return (
    <section data-plugin-page="ai-rag-memory" className="awb-surface-stack">
      <div className="awb-inline-banner">
        <strong>Memory collections</strong>
        <span>Collections stay tenant-scoped, classified, and ready for deterministic reindexing.</span>
      </div>
      <div className="awb-inline-grid awb-inline-grid-2">
        {memoryCollectionsFixture.map((collection) => {
          const documentCount = typeof collection.metadata?.documentCount === "number"
            ? collection.metadata.documentCount
            : 0;

          return (
            <div key={collection.id} className="awb-form-card">
              <h3 className="awb-panel-title">{collection.label}</h3>
              <dl className="awb-detail-grid">
                <div>
                  <dt>Scope</dt>
                  <dd>{collection.policyScope}</dd>
                </div>
                <div>
                  <dt>Classification</dt>
                  <dd>{collection.classification}</dd>
                </div>
                <div>
                  <dt>Source</dt>
                  <dd>{collection.sourcePlugin}</dd>
                </div>
                <div>
                  <dt>Documents</dt>
                  <dd>{documentCount}</dd>
                </div>
              </dl>
            </div>
          );
        })}
      </div>
      <div className="awb-form-card">
        <h3 className="awb-panel-title">Latest corpus updates</h3>
        <div className="awb-table">
          {documentFixtures.map((document) => (
            <div key={document.id} className="awb-table-row">
              <strong>{document.title}</strong>
              <span>{document.sourceKind}</span>
              <span>{document.classification}</span>
              <span>{formatPlatformDateTime(document.updatedAt)}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
