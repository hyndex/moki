# Gutu Business Plugin TODO

This board is the workspace-level staged tracker for the Gutu Business OS program.

## Stage 0

- [x] Create `Business Plugin Goal.md` as the workspace-level architecture and delivery contract.
- [x] Create `Business Plugin TODO.md` as the master staged board.
- [x] Add `tooling/business-os/scaffold.mjs` to generate the extracted business plugin repos consistently.
- [x] Add `tooling/business-os/check.mjs` so the business suite has a dedicated verification lane.
- [x] Add dedicated local promotion entrypoints for business pack signing and stable-channel promotion.
- [x] Enforce split-repo hygiene in the umbrella workspace so extracted repos publish independently and do not stay double-tracked by the root coordination repo.
- [ ] Add a dedicated remote release flow for business-suite repo fan-out and publication.

## Stage 1

- [x] Expand the package contract work so business plugins can declare richer public commands, queries, events, ownership, and dependency metadata.
- [x] Add first-class install guidance metadata so business plugins and packs can distinguish required, recommended, capability-enhancing, and integration-only dependencies.
- [x] Add pack-manifest schema work so JSON packs can carry explicit trust, merge, dependency, and rollback metadata.
- [x] Add `@platform/business-runtime` with numbering, localization, exchange-rate, tax, import quarantine, traceability, reconciliation, pack preview or apply or rollback, and contract-registry primitives.
- [x] Add live importer and dry-run execution surfaces for pack payloads instead of schema-only and sample-artifact coverage.
- [x] Add shared Postgres and SQLite schema builders for persistent business-runtime state across numbering, imports, links, reconciliation, and pack rollback.
- [x] Add shared outbox, inbox, dead-letter, projection, replay, and downstream-resolution primitives to `@platform/business-runtime`.
- [x] Add shared ERP document graph, document mapping, line-level lineage, stored document records, accounting GL, fiscal-period locks, AR/AP aging, financial statements, stock ledger, FIFO valuation, FIFO queues, stock aging, serial or batch drilldown, reservation, transfer, and reconciliation primitives to `@platform/business-runtime`.
- [x] Add a repeatable ERPNext reference-map generator and durable report so parity coverage can be measured from the checked-out reference source.
- [x] Move the scaffolded business plugin local state helpers onto `@platform/business-runtime` so the suite uses one shared runtime surface.
- [x] Extend `business:check` into a contract-registry, pack-preview, and lifecycle-scenario verification lane.
- [x] Wire the shared SQL persistence surfaces into the generated business-plugin service flows so they no longer rely on JSON fixture files.
- [x] Surface ERP child tables, document metadata, print formats, portal routes, workspace drilldowns, mapping actions, and builder hooks in generated admin forms and rich detail pages.
- [x] Persist ERP document mapping and immutable posting batches through tenant-aware live DB operations with idempotency, ACL checks, audit, record links, realtime invalidation, and per-record timelines.
- [ ] Persist every remaining ERP primitive, including full GL report truth, stock valuation projections, print rendering, portal rendering, and builder-created metadata, through domain-specific tenant-aware operator flows.
- [ ] Deepen the default runtime path from local SQLite-backed operator fixtures into full multi-environment deployment wiring and tenant-aware live DB operations.

## Stage 2

- [x] Scaffold `gutu-plugin-party-relationships-core`.
- [x] Scaffold `gutu-plugin-product-catalog-core`.
- [x] Scaffold `gutu-plugin-pricing-tax-core`.
- [x] Scaffold `gutu-plugin-traceability-core`.
- [x] Ensure each foundation repo ships manifests, actions, resources, jobs, workflows, migrations, sample packs, and tests.
- [x] Export ERPNext-informed domain catalogs, reports, exception queues, operational scenarios, and governed settings surfaces from each foundation repo.
- [ ] Deepen each foundation repo from scaffolded lifecycle coverage into domain-complete party, catalog, pricing, and traceability logic.

## Stage 3

- [x] Scaffold `gutu-plugin-accounting-core`.
- [x] Scaffold `gutu-plugin-crm-core`.
- [x] Scaffold `gutu-plugin-sales-core`.
- [x] Scaffold `gutu-plugin-procurement-core`.
- [x] Scaffold `gutu-plugin-inventory-core`.
- [x] Scaffold `gutu-plugin-projects-core`.
- [x] Scaffold `gutu-plugin-support-service-core`.
- [x] Scaffold `gutu-plugin-pos-core`.
- [x] Add repo-root `ci` entrypoints so each extracted business repo can build, lint, test, and docs-check itself directly.
- [x] Add named cross-plugin end-to-end business flow coverage plus durable report artifacts under `integrations/gutu-ecosystem-integration/reports/`.
- [x] Add resilience coverage for duplicate create protection, revision mismatch protection, dead-letter replay, and downstream recovery across all 25 business plugins.
- [x] Deepen the shared generated lifecycle so every business plugin now carries hold or release, amend, reverse, and richer downstream secondary-record tracking instead of only create or advance or reconcile scaffolds.
- [ ] Deepen quote-to-cash, procure-to-pay, project-to-bill, and service-to-cash flows from scaffold coverage into domain-complete operational logic.
- [x] Add direct contract scenarios across the core business plugins for billing intents, reservation intents, and reconciliation handoff.
- [x] Add representative ERP metadata to Accounting, Inventory, Manufacturing, Sales, and Procurement admin resources for child tables, links, mapping actions, print formats, portal surfaces, builder hooks, and workspace links.
- [x] Add runtime-level quote-to-cash document-chain coverage with stored records, upstream/downstream lineage, and related-document lookup.
- [x] Wire generated ERP rich-detail actions and backend mutation routes into representative quote-to-cash, procure-to-pay, stock-to-GL, BOM-to-work-order, and invoice-to-payment document actions.
- [ ] Migrate remaining hand-authored ERP pages, especially the legacy Sales quote/order screens, onto the same mutation-backed rich-detail action surface.

## Stage 4

- [x] Scaffold `gutu-plugin-manufacturing-core`.
- [x] Scaffold `gutu-plugin-quality-core`.
- [x] Scaffold `gutu-plugin-assets-core`.
- [x] Scaffold `gutu-plugin-hr-payroll-core`.
- [ ] Deepen WIP, CAPA, asset-depreciation, payroll, and offline conflict handling from scaffold coverage into domain-complete logic.
- [ ] Add intercompany, landed-cost, consolidation, and offline POS recovery scenarios.

## Stage 5

- [x] Add addon coverage for contracts, subscriptions, portals, field service, maintenance, treasury, e-invoicing, analytics, and bounded AI assists.
- [x] Add sector and localization packs through the extracted `catalogs/gutu-business-packs` catalog repo.
- [x] Add local signing metadata, stable-promotion scripts, and validation rules for business pack artifacts.
- [ ] Add governance-grade controls for draft or publish config, approval gates, masking, retention, and trust restrictions.

## Stage 6

- [x] Create a preview-first business pack catalog with `catalog/index.json` plus `next` and `stable` channels.
- [x] Promote the business suite into local catalogs, channels, and certification evidence as first-class ecosystem artifacts.
- [x] Add signed pack enforcement and compatibility-driven promotion checks for local validation and stable-channel promotion.
- [x] Restore the local signed stable channel after business-pack regeneration so the pack catalog stays furnished instead of resetting to an empty promotion target.
- [x] Add a repo-level CI fan-out verifier so the 25 business plugin repos plus the pack catalog can be certified as one local suite.
- [ ] Run remote-first publication and certification once the new repos have their standalone remotes.
- [x] Refresh `graphify-out/` after the business-suite repo and contract changes settle.

## Active Risks

- The new business repos are scaffolded before full domain depth exists, so the workspace must not overstate maturity.
- The addon plugin repos and pack catalog now exist, but they are still scaffold-depth and not yet domain-complete.
- Catalog, certification, and publication will stay partial until the new repos are pushed and added to the remote ecosystem.
- Pack files now have preview or apply or rollback runtime support plus local signing and stable-promotion flows, but remote publication and environment rollout pipelines still need deeper implementation.
- The business suite now has shared SQL schema builders plus shared orchestration state and recovery flows, but the generated domains are still scaffold-depth and default to local SQLite-backed runtime wiring until deeper operator deployment work lands.
- The ERPNext parity foundation now includes repeatable reference mapping, richer admin metadata, generated ERP form/detail visibility, document mapping, stored lineage, tenant-aware ERP action routes, immutable posting batches, GL, fiscal locks, AR/AP aging, financial statements, stock valuation, FIFO queues, stock aging, and serial/batch drilldowns. The generated reference map still shows hundreds of ERPNext DocTypes missing from catalog/admin metadata, so parity claims must remain scoped until those ledgers are closed plugin by plugin.

## Notes

- The current milestone is to establish truthful structure, contracts, verification lanes, SQL-backed local persistence, downstream recovery semantics, exported ERP parity catalogs, repo-local CI, 11 named cross-plugin flow scenarios, full-suite resilience coverage across 25 plugins, addon scaffolding, and pack-catalog promotion scaffolding for the business suite, with shared business runtime and orchestration primitives now in place.
- The shared generated lifecycle now goes beyond create or advance or reconcile scaffolds by covering hold or release, amendment, reversal, richer downstream follow-up records, and lifecycle-aware repo-root CI or docs-summary surfaces across the extracted business repos.
- Generated business plugin and pack manifests now carry explicit install guidance for mandatory, recommended, capability-enhancing, and integration-only dependencies plus suggested packs and standalone-support posture.
- Domain-complete behavior remains a tracked follow-up across the staged items above and must be implemented repo by repo without violating ownership boundaries.
