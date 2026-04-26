# Gutu Business Plugin Goal

This file is the umbrella architecture and delivery contract for the Gutu Business OS rollout.

## Target Architecture

Gutu Business OS stays aligned to the existing Gutu shape:

- extracted first-party repos
- modular monolith runtime
- explicit commands, events, jobs, and workflows
- admin-shell composition instead of a one-off ERP shell
- catalog and certification driven distribution

The target is not a giant ERP fork and not a premature microservice swarm. The target is a plugin-first business operating system with:

- platform core for identity, org, workflow, approvals, automation, audit, notifications, search, APIs, jobs, integrations, import or export, packs, and localization
- shared business foundations for party data, product data, pricing or tax policy, and document traceability
- first-party business plugins for accounting, CRM, sales, procurement, inventory, projects, support, POS, manufacturing, quality, assets, and HR or payroll
- JSON-pack driven overlays for starter packs, localization packs, sector packs, and company overrides

## Domain Ownership Rules

The non-negotiable rule is one plugin owns one write model and one business truth.

- Accounting owns ledger truth.
- Inventory owns stock truth.
- Manufacturing owns production truth.
- HR owns employee and payroll truth.
- Projects owns project execution truth.
- Support owns ticket and service truth.
- Sales owns commercial demand truth.
- Procurement owns source-to-procure commitment truth.
- CRM owns pre-sales relationship truth.

Cross-plugin work must happen through explicit commands, queries, events, projections, jobs, and linked downstream records. No plugin should perform hidden direct writes into another plugin's durable model.

Every business record must carry explicit multi-axis lifecycle state:

- `recordState`
- `approvalState`
- `postingState`
- `fulfillmentState`

Every amendable or reconcilable record must also carry:

- revision and supersession metadata
- correlation and process identifiers
- upstream and downstream references
- reason codes and effective dates

## Program Stages

### Stage 0

Create workspace-level truth docs, the master staged TODO, repo conventions, and check tooling for the business suite.

### Stage 1

Harden package and pack contracts, numbering and localization surfaces, reconciliation primitives, traceability, import quarantine, durable outbox or inbox or dead-letter or projection state, contract-registry checks, and JSON-pack execution schemas.

### Stage 2

Ship the shared business foundations:

- Party & Relationships Core
- Product & Catalog Core
- Pricing & Tax Core
- Traceability & Dimensions Core

### Stage 3

Ship the must-have business core:

- Accounting Core
- CRM Core
- Sales Core
- Procurement Core
- Inventory Core
- Projects Core
- Support & Service Core
- POS Core

### Stage 4

Ship the advanced operational domains:

- Manufacturing Core
- Quality Core
- Assets Core
- HR & Payroll Core

### Stage 5

Layer in addons, sector packs, enterprise controls, and stronger governance over config promotion, trust tiers, masking, and retention.

### Stage 6

Promote the suite through catalogs, signed artifacts, compatibility metadata, certification, and refreshed graph knowledge.

## First-Party Business Repo Map

The initial extracted business suite created under this program is:

- `plugins/gutu-plugin-party-relationships-core`
- `plugins/gutu-plugin-product-catalog-core`
- `plugins/gutu-plugin-pricing-tax-core`
- `plugins/gutu-plugin-traceability-core`
- `plugins/gutu-plugin-accounting-core`
- `plugins/gutu-plugin-crm-core`
- `plugins/gutu-plugin-sales-core`
- `plugins/gutu-plugin-procurement-core`
- `plugins/gutu-plugin-inventory-core`
- `plugins/gutu-plugin-projects-core`
- `plugins/gutu-plugin-support-service-core`
- `plugins/gutu-plugin-pos-core`
- `plugins/gutu-plugin-manufacturing-core`
- `plugins/gutu-plugin-quality-core`
- `plugins/gutu-plugin-assets-core`
- `plugins/gutu-plugin-hr-payroll-core`
- `plugins/gutu-plugin-contracts-core`
- `plugins/gutu-plugin-subscriptions-core`
- `plugins/gutu-plugin-business-portals-core`
- `plugins/gutu-plugin-field-service-core`
- `plugins/gutu-plugin-maintenance-cmms-core`
- `plugins/gutu-plugin-treasury-core`
- `plugins/gutu-plugin-e-invoicing-core`
- `plugins/gutu-plugin-analytics-bi-core`
- `plugins/gutu-plugin-ai-assist-core`
- `catalogs/gutu-business-packs`

Each extracted repo is expected to ship:

- a standalone root package
- repo-local `README.md`, `DEVELOPER.md`, `TODO.md`, `SECURITY.md`, and `CONTRIBUTING.md`
- a nested publishable plugin package
- actions, resources, jobs, workflows, UI surfaces, migrations, and tests
- a sample pack payload with `pack.json`, `dependencies.json`, `signatures.json`, objects, and validation fixtures

## Current Implementation Truth

This rollout does not claim full ERP-grade domain depth is complete today. The current implementation truth is:

- the business suite contract and repo topology are now being established directly in the workspace
- the package contract is upgraded so business plugins and pack artifacts can declare richer ownership and contract metadata
- `@platform/business-runtime` now provides shared numbering, localization, tax, import quarantine, traceability, reconciliation, ERP document graph or mapping, accounting GL, fiscal-period locks, party aging ledgers, financial statements, stock ledger or valuation, FIFO queues, stock aging, serial or batch drilldowns, contract-registry, pack preview or apply or rollback primitives, SQL-backed business state stores, durable outbox or inbox or dead-letter or projection orchestration helpers, and shared Postgres or SQLite schema builders for the business suite
- 25 first-party business plugin repos are scaffolded with consistent actions, resources, jobs, workflows, migrations, sample packs, and test lanes
- the generated business plugin packages now also export ERPNext-informed domain catalogs, report catalogs, exception queue catalogs, operational scenario catalogs, and governed settings-surface catalogs
- the workspace now carries a generated ERPNext reference map at `tooling/business-os/erpnext-reference-map.json` plus the durable summary report `integrations/gutu-ecosystem-integration/reports/erpnext-reference-map.md`; the map now distinguishes admin-metadata coverage, catalog-only coverage, and missing DocTypes, assigns every ERPNext DocType to a Gutu owner plugin with a target resource, and tracks required child tables, report links, workspace links, print or web-form signals, portal requirements, workflow requirements, supporting plugins, and verification scenarios mechanically instead of by hand
- the admin resource contract now accepts ERP-grade metadata for child tables, document links, mapping actions, workflows, property setters, workspaces, dashboard charts, number cards, print formats, portal surfaces, builder surfaces, onboarding, naming series, and submitted statuses; the Accounting, Inventory, Manufacturing, Sales, and Procurement examples now expose representative metadata for invoices, bills, journal entries, payment entries, items, warehouses, stock entries, material requests, delivery notes, purchase receipts, work orders, BOMs, quotations, sales orders, requisitions, RFQs, and purchase orders
- generated factory forms now include ERP child-table sections, and generated rich detail pages now surface an ERP document tab plus print, portal, mapping-action, workflow-transition, workspace, link, and builder metadata rails for resources that declare ERP metadata
- `buildDomainPlugin` now accepts declarative `reports[]`, `workflows[]`, and `connections`; generated plugins can contribute ReportBuilder index/detail routes, Reports nav entries, command-palette report/workflow shortcuts, and registry-backed connection rails without custom boilerplate
- the admin backend now exposes tenant-aware ERP action routes for document mapping, immutable posting batches, posting previews, workflow transitions, cancellation, reversal, reconciliation, related ledger reads, related stock reads, and ledger or stock report data; these routes enforce source-record ACLs, tenant isolation, document-state eligibility, idempotency or replay behavior, safe JSON payloads, downstream ACL seeding where records are created, record links, audit events, realtime invalidation, and per-record timelines
- the same ERP backend now renders tenant-aware printable document HTML for declared print formats and issues secure portal links backed by hashed tokens, expiry, revocation, access counters, redacted fields, child-table rendering, audit, and timeline events
- generated rich detail ERP action buttons now execute the backend mapping route and navigate to the created downstream document when a target list path exists; Accounting, Inventory, Manufacturing, Sales, and Procurement metadata now includes field maps, child-table maps, target document types, and safe default states for the main quote-to-cash, procure-to-pay, stock-to-GL, BOM-to-work-order, and invoice-to-payment actions
- generated rich detail print and portal buttons now call the runtime-backed `/api/erp` routes, open generated print documents, create expiring portal links, copy the secure URL when browser permissions allow it, and open the public portal document view
- each extracted business repo now carries a repo-local `ci` script that builds, typechecks, lints, tests, and validates its docs truth from the repo root
- the workspace now carries 11 named cross-plugin end-to-end business flow scenarios plus durable evidence artifacts in `integrations/gutu-ecosystem-integration/reports/business-os-flows.{json,md}`
- the workspace now also carries a resilience verification lane across all 25 business plugins with durable evidence artifacts in `integrations/gutu-ecosystem-integration/reports/business-os-resilience.{json,md}`
- a first-party `catalogs/gutu-business-packs` repo now carries 13 localization or sector pack artifacts with package manifests, channel metadata, deployable pack payloads, validation fixtures, and local signing or promotion scripts
- the pack artifacts now include starter settings, workflow, report, and automation objects instead of only minimal settings or workflow placeholders
- the regenerated business plugin scaffolds now persist explicit downstream pending work, dead-letter or replay recovery state, projection summaries, and record revisions through the shared business runtime
- the shared lifecycle surface is now deeper than the original create or advance or reconcile scaffold: every generated business plugin now also carries hold or release, amend, and reverse flows plus richer downstream secondary-record tracking for requested, failed, completed, and closed follow-up work
- every generated business plugin and business pack now carries first-class install guidance that separates hard dependencies from recommended plugins, capability-enhancing plugins, integration-only plugins, suggested packs, standalone support posture, and install notes for operators
- the shared plugin solver and generated plugin docs now expose install recommendation surfaces so future install UX can warn or suggest dependencies instead of flattening every relationship into a single mandatory list
- the master business TODO and business check tooling now perform contract-registry, sample-pack dry-run, lifecycle or recovery scenario verification, stable-channel signature enforcement, 19 direct cross-plugin handoff scenarios, full-suite dead-letter or replay resilience verification, and repo-wide CI fan-out reporting so the workspace can track staged delivery honestly
- the umbrella workspace now treats extracted apps, libraries, plugins, catalogs, `gutu-core`, and integration harnesses as standalone repos instead of tracking them twice through the root coordination repo

What is still intentionally pending after this scaffold phase:

- full domain-complete business rules for every sector and edge case
- deep downstream automation into every existing non-business plugin
- production signing, live catalog promotion, and full certification across every new repo and pack artifact
- full tenant-aware live persistence and mutation wiring for every ERP primitive across every business plugin; the generic ERP action, print, portal, and posting backend is now present, but many hand-authored pages, custom builders, and domain-specific posting engines still need plugin-by-plugin hardening beyond the generic route
- richer operator UX, live deployment wiring, and domain-complete behaviors on top of the shared runtime primitives now added in core
