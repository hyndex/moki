# ERPNext Reference vs Gutu Business OS End-to-End Gap Report

Date: 2026-04-26

Scope:
- Reference product: `ref/Business/ERPNext`
- Framework implementation reviewed:
  - `Business Plugin Goal.md`
  - `Plugin-Todo.md`
  - `admin-panel/src/app/App.tsx`
  - `admin-panel/src/contracts/*`
  - `admin-panel/src/examples/*`
  - `admin-panel/src/examples/_factory/buildDomainPlugin.tsx`
  - `admin-panel/src/admin-primitives/*`
  - `admin-panel/backend/src/routes/resources.ts`
  - `admin-panel/backend/src/lib/field-metadata.ts`
  - `plugins/gutu-plugin-*-core/framework/builtin-plugins/*`
  - `libraries/gutu-lib-admin-shell-workbench/framework/libraries/admin-shell-workbench/src/main.tsx`

Method:
- Read `graphify-out/GRAPH_REPORT.md` first, per repo instructions.
- Used Graphify queries for business plugin, admin shell, builder, report, customization, and routing relationships.
- Audited ERPNext module metadata, DocType JSON, workspaces, custom pages, hooks, scheduler jobs, controller code, client-side form code, print formats, dashboard charts, number cards, onboarding assets, reports, and portal routes.
- Audited Gutu Business OS docs, first-party plugin catalogs, generated resources, admin shell composition, generic CRUD, field customization, report builder, dashboard personalization, route generation, and representative accounting, inventory, manufacturing, and CRM plugin surfaces.
- This is a source-level product, architecture, and UX audit. I did not run ERPNext or Gutu in the browser during this pass, so screenshot-level visual polish is not claimed.

## Implementation Status Update

Status date: 2026-04-26

The first parity implementation pass landed the foundation needed to move from hand-audited gaps toward executable ERP parity work:

- `@platform/business-runtime` now exports ERP document graph and mapping primitives with line-level lineage, contextual actions, source-state guards, field maps, child-table maps, and upstream/downstream lineage traversal.
- `@platform/business-runtime` now exports an accounting runtime that validates balanced journals, posts immutable GL entries, reverses journals, calculates Trial Balance rows, Profit and Loss, Balance Sheet, and account balances.
- `@platform/business-runtime` now exports a stock runtime that posts receipts, issues, transfers, reconciliations, FIFO valuation layers, stock ledger entries, reservations, projected quantity, and valuation summaries.
- The admin contract surface now has `ErpResourceMetadata` plus field-level link, dynamic-link, table, dependency, filter, print, portal, and search metadata.
- `buildDomainPlugin` now preserves ERP metadata on generated resources and passes link/dependency metadata into generated form fields.
- Accounting, Inventory, and Manufacturing examples now carry representative ERP metadata for invoices, bills, accounts, journal entries, payment entries, items, warehouses, stock entries, work orders, and BOMs.
- `bun run business:erpnext-map` now generates `tooling/business-os/erpnext-reference-map.json` and `integrations/gutu-ecosystem-integration/reports/erpnext-reference-map.md` from the checked-out ERPNext source.

Current generated reference-map truth:

| Surface | Count |
| --- | ---: |
| ERPNext DocType JSON records | 627 |
| Fields | 10,248 |
| Child table fields | 314 |
| Link fields | 2,213 |
| Reports | 203 |
| Workspaces | 14 |
| Print formats | 41 |
| Web forms | 6 |
| Catalog-covered DocTypes | 97 |
| Admin-metadata DocTypes | 17 |
| Covered DocTypes total | 114 |
| Missing or shallow DocTypes | 513 |

The next implementation pass added the first live operator bridge:

- `admin-panel/backend/src/routes/erp-actions.ts` now exposes tenant-aware document mapping and posting endpoints.
- Mapping routes enforce source-record ACLs, tenant isolation, document-state eligibility, idempotency, safe JSON payloads, downstream ACL seeding, `record_links`, audit rows, realtime invalidation, and per-record timeline entries.
- Posting routes persist immutable accounting, stock, or custom posting batches and entries, with accounting balance validation and idempotent replay.
- The admin runtime now has an `ErpClient`, and generated ERP rich-detail rails call the live mapping endpoint instead of only showing static action chips.
- Representative Accounting, Inventory, Manufacturing, Sales, and Procurement actions now carry target document types, field maps, child-table maps, and safe default target states.
- Backend integration coverage now proves source-to-target mapping, replay idempotency, links, timelines, ineligible-state rejection, unbalanced-accounting rejection, balanced posting persistence, and posting replay.

The current pass added live print and portal behavior:

- `admin-panel/backend/src/routes/erp-actions.ts` now renders redacted printable ERP document HTML through `/api/erp/print/:resource/:id`, using normal tenant and document ACL checks.
- The backend now persists portal links in `erp_portal_links` with hashed tokens, expiry, revocation, access counters, format metadata, audit events, and timeline events.
- `/api/erp/portal/:token` serves the public portal document without auth while rejecting invalid, revoked, expired, or cross-tenant records.
- Generated rich-detail print and portal buttons now call the runtime-backed ERP client, open generated print documents, create expiring portal links, copy the URL when allowed, and open the public view.
- Backend integration coverage proves print redaction, child-table rendering, hashed token storage, public access, expiry, and revocation.

This still does not claim full ERPNext parity. It closes the first platform, live-mutation, print, and portal gaps: Gutu now has typed primitives, generated reference evidence, live ERP action routes, runtime-backed generated detail actions, printable documents, and secure portal links. The remaining work is to wire every hand-authored ERP page, every custom builder output, and every plugin-specific posting engine through the same production route family.

## Executive Verdict

ERPNext is far ahead in ERP domain depth, document flow maturity, accounting and stock semantics, operational link density, built-in reports, printable documents, portal routes, and metadata-driven form behavior. Its advantage is not just "more modules." It is the way every business document is connected to the next document, to ledger entries, stock entries, taxes, dimensions, print formats, dashboard cards, reports, portal pages, scheduled jobs, and validation hooks.

Gutu is ahead in modular product architecture. The plugin model, explicit contracts, command/event/job/workflow posture, capability-based shell composition, generated resources, advanced table primitives, saved views, dashboard personalization, report builder modes, and business pack direction are stronger foundations for a multi-product, installable, SaaS-oriented business platform than copying ERPNext into one giant app.

The current gap is that Gutu has a powerful platform skeleton and broad ERP-shaped coverage, while ERPNext has mature ERP organs. Gutu covers many business nouns, pages, and reports, but many are still shallow resource surfaces. ERPNext has deeply implemented transaction semantics, child tables, linked documents, lifecycle transitions, reversals, ledger effects, stock effects, tax/regional rules, and contextual UI actions.

The recommended direction is not to abandon Gutu's plugin-first architecture. The path is to keep that architecture and import ERPNext-level ERP semantics into it: richer resource metadata, child-table support, first-class Link/Dynamic Link relationships, document mapping chains, ledger engines, stock valuation engines, workspace link graphs, print/web form builders, onboarding/setup flows, and domain-crafted detail pages.

## Reference State

ERPNext checkout:
- Path: `ref/Business/ERPNext`
- Branch: `develop`
- Reference commit observed: `f5357c233d`, `fix: py error on stock ageing report (#54467)`

ERPNext measured source inventory:

| Surface | Count |
| --- | ---: |
| Modules | 21 |
| DocTypes | 536 |
| Reports | 183 |
| Workspaces | 14 |
| Pages | 6 |
| Print formats | 36 |
| Web forms | 3 |
| Dashboard charts | 43 |
| Number cards | 41 |
| Onboarding steps | 56 |
| Module onboarding records | 10 |
| Form tours | 2 |
| Dashboards | 9 |
| Total DocType fields | 10,248 |
| Child table fields | 314 |

Largest ERPNext modules by DocType and report count:

| Module | DocTypes | Reports | Field count | Child table fields |
| --- | ---: | ---: | ---: | ---: |
| Accounts | 189 | 52 | 3,315 | 115 |
| Stock | 79 | 49 | 1,999 | 61 |
| Manufacturing | 48 | 21 | 958 | 33 |
| Setup | 43 | 0 | 564 | 4 |
| CRM | 27 | 9 | 476 | 8 |
| Assets | 26 | 3 | 402 | 11 |
| Buying | 21 | 10 | 645 | 29 |
| Selling | 20 | 23 | 658 | 23 |
| Quality | 16 | 1 | 200 | 3 |
| Projects | 15 | 7 | 261 | 3 |
| Support | 11 | 4 | 138 | 1 |

Gutu Business OS measured source inventory:

| Surface | Count |
| --- | ---: |
| First-party business plugin catalogs | 25 |
| ERPNext module references in catalogs | 62 |
| ERPNext DocType references in catalogs | 157 |
| Owned entities in catalogs | 150 |
| Report catalog entries | 98 |
| Edge case catalog entries | 90 |
| Settings surface entries | 73 |
| Operational scenario entries | 89 |
| Exception queue entries | 84 |
| Workflow entries | 25 |
| Job entries | 50 |
| Admin example files | 138 |
| Approximate admin route mentions | 413 |

Top Gutu catalogs by ERPNext DocType references:

| Plugin catalog | ERPNext DocType refs | Reports |
| --- | ---: | ---: |
| Accounting Core | 13 | 8 |
| Inventory Core | 12 | 6 |
| Manufacturing Core | 9 | 4 |
| Assets Core | 8 | 3 |
| HR Payroll Core | 8 | 4 |
| Party Relationships Core | 7 | 4 |
| Pricing Tax Core | 7 | 4 |
| Procurement Core | 7 | 4 |
| Product Catalog Core | 7 | 4 |

## Product Positioning Difference

ERPNext is a mature integrated ERP suite. It assumes one Frappe application, many DocTypes, many DocType controllers, metadata-generated Desk UI, deep framework conventions, and a large set of hooks that connect business documents into a single operational fabric.

Gutu Business OS is a plugin-first business operating system. It intentionally avoids becoming one giant ERP fork. Its docs define a modular monolith runtime with first-party extracted repos, explicit commands, events, jobs, workflows, business packs, catalog distribution, admin-shell composition, shared runtime primitives, and a rule that one plugin owns one write model.

This distinction is important. ERPNext is ahead as an ERP product. Gutu can still become the better platform architecture if it fills the semantic depth gap without losing plugin isolation.

## Where ERPNext Is Advanced

### 1. ERPNext has deeply modeled business documents

ERPNext DocTypes are not simple tables with a few fields. A single Sales Invoice has:
- 232 fields.
- 11 child tables.
- Linked items, taxes, payments, advances, timesheets, packed items, sales team, payment schedules, and pricing rules.
- Naming series, print behavior, import support, search fields, permissions, autoname behavior, required fields, conditional fields, link filters, read-only rules, tab breaks, section breaks, and column breaks.

Representative high-density DocTypes:

| ERPNext DocType | Field count | Child tables | Link-like fields |
| --- | ---: | ---: | ---: |
| Sales Invoice | 232 | 11 | 62 |
| Purchase Invoice | 201 | 8 | 47 |
| POS Invoice | 186 | 10 | 52 |
| Sales Order | 171 | 7 | 42 |
| Delivery Note | 166 | 6 | 43 |
| Purchase Order | 158 | 6 | 40 |
| Item | 123 | 8 | 24 |
| BOM | 94 | 4 | 24 |

Gutu's resources today are much thinner. For example, the admin accounting invoice resource carries fields like number, customer, status, issued date, due date, amount, currency, and notes. The plugin catalog knows about ERPNext parity targets, but the active admin resource does not yet model invoice items, taxes, advances, payment schedules, accounting dimensions, packed items, withholding, write-offs, POS payments, returns, or GL posting outcomes at ERPNext depth.

### 2. ERPNext embeds business behavior in controllers

ERPNext Sales Invoice is not just metadata. Its Python controller validates and posts real business effects:
- customer and project validation
- return and credit note checks
- UOM validation
- debit account validation
- advance payment validation
- fixed asset handling
- cost center validation
- conversion rate validation
- coupon code validation
- POS profile and POS payment checks
- warehouse and current stock validation
- deferred revenue validation
- timesheet validation
- multiple billing validation
- packing list updates
- loyalty point handling
- write-off handling
- stock ledger updates
- GL entry creation
- credit limit checks
- stock reservation updates
- future stock ledger and GL reposting
- cancellation reversals

Gutu has lifecycle primitives and generated command schemas such as hold, release, amend, reverse, reconcile, advance, and downstream pending-work state. That is a strong platform foundation, but many domain-specific effects are still not implemented at ERPNext depth. The accounting model exposes lifecycle axes and references, but the actual double-entry posting engine, GL report stack, bank reconciliation UI, tax dimension propagation, and financial statements remain pending in the tracker.

### 3. ERPNext has document-to-document flow as a native user habit

ERPNext form JavaScript adds contextual actions directly on documents. A Sales Invoice can expose actions for:
- Payment
- Return or Credit Note
- Delivery Note
- Payment Request
- Invoice Discounting
- Dunning
- Maintenance Schedule
- Intercompany Purchase Invoice
- Unreconcile Payment
- Get Items From Sales Order
- Get Items From Quotation
- Get Items From Delivery Note
- Get Timesheets

This creates a business flow where the user does not think in separate app pages. They start at one document and naturally move to the next downstream document, with mapping logic carrying data forward.

Gutu currently has many routes and commands, but fewer rich document-mapping flows. Navigation is more page/module oriented than document-chain oriented. Connections panels exist as a target pattern, but many records do not yet have a dense, bidirectional operational graph equivalent to ERPNext's "make from" and "get items from" flows.

### 4. ERPNext workspaces are dense operational link maps

ERPNext workspaces such as Invoicing, Stock, and Manufacturing combine:
- charts
- number cards
- shortcuts
- grouped cards
- report links
- document links
- setup links
- custom page links
- onboarding context

The Stock workspace links to Item, Product Bundle, Price List, Item Price, Shipping Rule, Pricing Rule, Item Alternative, Item Manufacturer, Material Request, Stock Entry, Delivery Note, Purchase Receipt, Pick List, Delivery Trip, Stock Settings, Warehouse, UOM, Item Variant Settings, reports, and custom pages.

Gutu has a modern workspace renderer with a 12-column grid, draggable widgets, hide/reset/done/cancel customization, filters, saved views, and admin shell metrics. That interaction model is better and more modern. The gap is content density and ERP linkage. Many Gutu workspaces are not yet curated as complete operational maps for each domain.

### 5. ERPNext has mature reports everywhere

ERPNext has 183 report definitions in the reference checkout, with Accounts and Stock alone contributing 101 reports. These are not only dashboard charts. Many are business-critical operating reports:
- General Ledger
- Trial Balance
- Balance Sheet
- Profit and Loss
- Accounts Receivable
- Accounts Payable
- Bank Reconciliation
- Stock Ledger
- Stock Balance
- Stock Ageing
- Stock Projected Qty
- FIFO Queue
- Production Planning
- Material Requirements Planning
- Work Order Summary
- Purchase Analytics
- Sales Analytics

Gutu has a strong ReportBuilder primitive with table, chart, pivot, export CSV, export JSON, export XLSX, refresh, print, filters, and display modes. The primitive is solid. The gap is the domain report corpus and the data engines behind it. A pivot renderer cannot produce a real Trial Balance until the GL engine, postings, account dimensions, fiscal periods, currency revaluation, opening balances, and closing entries are implemented.

### 6. ERPNext has portal and print surfaces built into the product

ERPNext hooks define website route rules and portal menu items for orders, invoices, supplier quotations, purchase orders, purchase invoices, quotations, shipments, RFQs, addresses, BOMs, timesheets, material requests, projects, and tasks. The reference also includes print formats and web forms.

Gutu has business portal plugin direction, page builder, and admin routes, but ERPNext-style standard document portals and print formats are not yet a broad ERP guarantee. That is a major UX and adoption gap because real ERP users need customer-facing invoices, supplier-facing RFQs, printable documents, and shareable document pages.

### 7. ERPNext has scheduler jobs wired to real business operations

ERPNext hooks include hourly, daily, weekly, monthly, and cron jobs for operational maintenance:
- BOM cost updates
- stock valuation reposts
- project reminder emails
- ticket auto-close
- opportunity auto-close
- invoice status updates
- fiscal year auto-create
- reorder item checks
- subscription processing
- exchange rate revaluation
- recurring invoice and contract actions

Gutu catalogs include jobs and workflows, and the business runtime has outbox, inbox, dead-letter, replay, projection, and state store primitives. The platform story is strong. The missing work is domain-complete job behavior across the ERP suite, not only job descriptors.

## Where Gutu Is Ahead

### 1. Plugin isolation and product architecture

Gutu's Plugin V2 contract is intentionally designed for zero shell edits, independent plugins, open registries, capability-based permissions, isolation, disposable contributions, dependency ordering, and lazy activation. Plugins contribute nav, views, resources, widgets, actions, commands, connections, view extensions, route guards, shortcuts, jobs, and seeds.

ERPNext is powerful but coupled to Frappe app conventions and a large integrated codebase. Gutu's architecture is better suited for:
- installable first-party and third-party modules
- signed catalogs
- business packs
- standalone plugin repos
- staged certification
- modular enterprise distribution
- tenant-specific feature composition
- product-family evolution outside one ERP monolith

### 2. Explicit business runtime posture

Gutu's business goal doc defines ownership rules that ERPNext often handles through convention:
- one plugin owns one write model
- cross-plugin work happens through commands, queries, events, projections, jobs, and linked downstream records
- business records carry `recordState`, `approvalState`, `postingState`, and `fulfillmentState`
- amendable records carry revision, supersession, correlation, references, reason codes, and effective dates

This is a cleaner architecture for long-term platform governance. The gap is not philosophy. The gap is implementation depth.

### 3. Modern admin UX primitives

Gutu's admin primitives are stronger than a basic CRUD shell:
- advanced data table with pinning, reorder, multi-sort, visibility, virtualization, selection, resize, sticky headers, keyboard support, and ARIA posture
- saved view manager with pinned/default/personal views
- report builder with table, chart, pivot, refresh, print, and exports
- workspace renderer with personalization and 12-column widget layout
- command palette and shell-level plugin composition
- generated rich-detail pages
- generic CRUD with ACL, tenant isolation, audit, custom fields, WebSocket invalidation, and event publishing

ERPNext's Desk is mature and familiar, but Gutu's primitives are already aligned with a modern enterprise admin surface. The issue is that many domain pages still use generic output instead of domain-crafted workflows.

### 4. Custom fields without schema drift

Gutu's backend field metadata model intentionally keeps custom field values inside record JSON while storing field definitions separately. This means an operator can add metadata-driven fields without database schema changes.

That is flexible for a SaaS platform. The tradeoff is visible in the implementation notes: indexed filtering uses `json_extract`, old records have undefined values, and custom relations do not become true cross-object joins automatically.

ERPNext's Frappe model has more mature metadata-driven customization behavior, but Gutu's approach can become stronger if it adds indexes, field-level permissions, relationship definitions, property setters, custom DocTypes, and admin-safe migration/promotion.

### 5. Business pack and certification direction

Gutu is thinking beyond a single installed ERP instance. The business packs direction includes starter settings, workflows, report objects, automation objects, localization packs, sector packs, channel metadata, validation fixtures, and signing/promotion scripts.

ERPNext has a mature product ecosystem, but Gutu's catalog and pack path is a credible differentiator if completed honestly.

## Domain-by-Domain Gap

### Accounting

ERPNext is far ahead.

ERPNext Accounts includes 189 DocTypes, 52 reports, 3,315 fields, and 115 child table fields. Sales Invoice, Purchase Invoice, POS Invoice, Payment Entry, Journal Entry, GL Entry, Accounts Receivable, Accounts Payable, Trial Balance, Balance Sheet, Profit and Loss, tax, budget, cost center, period closing, dunning, exchange revaluation, subscriptions, and bank reconciliation are deeply connected.

Gutu Accounting has:
- a catalog that references core ERPNext accounting objects
- 8 report catalog entries
- an admin example with invoice, bill, account, journal entry, payment entry, bank account, bank transaction, budget, cost center, accounting period, tax rule, dunning, fiscal year, and currency rate resources
- lifecycle schemas for create, advance, hold, release, amend, reverse, and reconcile
- a tracker that honestly marks GL, Trial Balance, Balance Sheet, P&L, double-entry posting engine, bank reconciliation UI, and subscription invoicing automation as deferred

Missing accounting depth:
- true chart of accounts tree semantics
- double-entry posting engine
- immutable GL Entry model
- posting date and fiscal period locks
- Trial Balance
- General Ledger
- Balance Sheet
- Profit and Loss
- Cash Flow
- accounts receivable/payable ledgers
- payment allocation and unreconciliation
- advance payments
- taxes and withholding
- dimensions across all accounting documents
- currency revaluation
- period closing voucher
- stock-to-GL integration
- payroll-to-GL integration
- asset depreciation journal automation
- POS invoice accounting
- regional tax compliance

Recommended first accounting target:
- Implement GL Entry, Payment Ledger Entry, Account tree, Fiscal Year, Accounting Period, Cost Center, Dimension, and Posting Engine as the real core.
- Make Sales Invoice and Purchase Invoice post through that engine.
- Ship General Ledger, Trial Balance, Balance Sheet, P&L, AR, AP, and Cash Flow before claiming accounting parity.

### Stock and Inventory

ERPNext is far ahead.

ERPNext Stock includes 79 DocTypes, 49 reports, 1,999 fields, and 61 child table fields. Item alone has 123 fields and 8 child tables covering stock settings, serial/batch behavior, variants, accounting defaults, purchasing, sales, quality, manufacturing, customer-specific details, and manufacturer data.

Gutu Inventory has:
- Item and Warehouse resources
- 15 additional resources in the tracker, including variant, item price, bin, stock entry, material request, delivery note, purchase receipt, landed cost, batch, serial number, reconciliation, pick list, packing slip, delivery trip, and item supplier
- 9 reports in the tracker
- a control room
- stock-like quantities and movement resources

Missing stock depth:
- stock ledger entry as immutable valuation truth
- valuation rate layers
- FIFO and moving average auditability
- serial and batch ledger
- projected quantity engine
- stock reservations
- reorder automation
- stock reconciliation posting semantics
- transfer wizard
- landed cost allocation engine
- warehouse capacity and putaway rules
- item variant attribute matrix
- item alternate and substitute flows
- delayed order and shortage reports
- future stock ledger reposting
- tight stock-to-GL integration

Recommended first inventory target:
- Implement Stock Ledger Entry, Bin projection, Valuation Layer, Serial/Batch Ledger, and Reservation models.
- Make Stock Entry, Delivery Note, Purchase Receipt, and Stock Reconciliation post through the stock engine.
- Ship Stock Ledger, Stock Balance, Stock Ageing, Stock Valuation, Projected Qty, Reserved Stock, and FIFO Queue reports.

### Manufacturing

ERPNext is ahead in production depth.

ERPNext Manufacturing includes 48 DocTypes, 21 reports, workspaces, BOM tools, production planning, MRP, work orders, job cards, routing, operations, workstations, subcontracting, material requests, and stock integration.

Gutu Manufacturing has:
- production order
- BOM summary
- routing
- work center
- operation
- material consumption
- job card-like resources
- catalog references and report targets

Missing manufacturing depth:
- BOM tree and explosion
- BOM costing with nested operations and scrap
- production plan and MRP engine
- work order material reservation and issue
- job card clock-in/clock-out
- workstation capacity calendar
- routing operation sequencing
- subcontracting order/receipt flow
- WIP accounting and stock integration
- downtime capture
- production variance reports

Recommended first manufacturing target:
- Build BOM, BOM Item, Operation, Routing, Workstation, Work Order, Job Card, Production Plan, and Material Requirement as a connected flow.
- Add BOM explosion, MRP calculation, shop-floor job card UI, and stock issue/receipt integration.

### Buying, Procurement, and Supplier Flow

ERPNext is ahead in document chain completeness.

ERPNext Buying includes supplier, RFQ, supplier quotation, purchase order, purchase receipt, purchase invoice, material request, subcontracting, supplier scorecards, lead times, purchase analytics, and supplier portal routes.

Gutu Procurement has catalog coverage and planned resources, but the operational source-to-pay flow is not yet ERPNext-complete.

Missing procurement depth:
- material request to RFQ
- RFQ to multi-supplier supplier quotation comparison
- supplier quotation to purchase order
- purchase order to purchase receipt
- purchase receipt to purchase invoice
- supplier scorecards
- subcontracting flows
- lead time driven reorder
- supplier portal document access

Recommended first procurement target:
- Implement the full source-to-pay document mapping chain and expose it as contextual actions on each document.

### Selling, CRM, and Customer Flow

Gutu is more competitive here, but ERPNext still has stronger ERP document linkage.

Gutu CRM and Sales already have meaningful resources, reports, control rooms, commands, and connections. The admin shell can provide a better modern user experience than ERPNext for CRM-style work if dedicated details are added.

ERPNext remains ahead in the quote-to-cash chain:
- lead and opportunity
- quotation
- sales order
- delivery note
- sales invoice
- payment
- dunning
- returns
- credit notes
- maintenance schedules
- commission and sales team behavior
- price rules and taxes

Missing Gutu depth:
- mapped document creation between quote, order, delivery, invoice, payment, return, and dunning
- item-level commercial documents
- pricing rule application
- credit limit checks
- sales team commission behavior
- customer portal flows
- document-specific detail pages with contextual next actions

Recommended first selling target:
- Build quote-to-cash as a first-class graph, not as separate resources.

### Assets

ERPNext is ahead in fixed asset accounting.

Gutu Assets has catalog targets and resources, but ERPNext has deeper depreciation schedules, asset movement, repair, capitalization, finance books, value adjustment, and accounting integration.

Missing depth:
- depreciation schedule generation
- depreciation journal posting
- asset movement approval
- asset repair and maintenance costing
- capitalization flows
- value adjustments
- finance book behavior
- asset register and depreciation reports

### HR and Payroll

Gutu has broad HR admin coverage, but ERPNext/Frappe HR-style payroll depth is not complete.

Gutu HR has a strong resource breadth in the tracker: employee, payroll, department, designation, leave, attendance, shift, holiday, salary structure, salary component, salary slip, expense, appraisal, training, onboarding, and offboarding.

Missing depth:
- payroll run wizard
- salary slip line-item and deduction detail
- tax deduction report
- leave ledger
- attendance calculation from shifts
- organization chart
- appraisal goals and competencies as child tables
- payroll journal integration
- statutory/regional payroll rules

### Quality

ERPNext is ahead in quality process structure.

Missing Gutu depth:
- quality inspection template
- parameterized inspection forms
- supplier/customer feedback loops
- non-conformance workflow
- corrective action tracking
- quality gates from purchase receipt, manufacturing, and delivery

### Projects and Timesheets

ERPNext has project, task, timesheet, project update, billing, reminders, portals, and report coverage.

Gutu needs:
- project template and task template
- dependency and Gantt support
- resource planner
- timesheet entry line items
- timesheet-to-invoice flow
- project-wise stock and billing reports
- customer portal project visibility

### Support and Service

ERPNext has issue, warranty, maintenance, SLA-adjacent flows, reports, auto-close jobs, and portal exposure.

Gutu Support can become stronger through modern queue UX and AI-assisted article suggestions, but needs:
- SLA policy engine
- service day/calendar
- warranty claim flow
- support hour distribution
- first response and resolution metrics
- auto-assignment and escalation jobs

## Customizability and Flexibility

### ERPNext flexibility

ERPNext is flexible because Frappe treats metadata as product structure. In the ERPNext checkout, this is visible through:
- DocType JSON files with field order, required fields, sections, tabs, columns, child tables, links, dynamic conditions, and permissions.
- Client scripts that add contextual buttons, custom queries, filters, and route behavior.
- Python controllers that enforce domain-specific validation and posting behavior.
- Workspaces that define charts, number cards, cards, and direct links.
- Hooks that define portal routes, menu items, tree views, calendars, scheduled jobs, document events, and regional behavior.
- Reports, print formats, web forms, onboarding steps, module onboarding, and form tours.

ERPNext's flexibility is strongest for ERP admins and implementers who live inside the Frappe model. They can extend forms, fields, scripts, reports, print formats, workflows, and workspaces while keeping a common Desk experience.

ERPNext's tradeoff:
- Custom behavior can become implicit and distributed across metadata, hooks, Python controllers, JavaScript form files, reports, patches, and framework conventions.
- The platform is harder to split into independently versioned product modules.
- Deep customization often assumes Frappe expertise.

### Gutu flexibility

Gutu is flexible for platform composition:
- plugins contribute resources, views, routes, widgets, commands, jobs, and connections
- the shell composes plugins without one-off edits
- generic CRUD applies tenant isolation, ACL, audit, custom field merge, WebSocket invalidation, and event publishing
- field contracts include dynamic visible/required/read-only predicates and permission hooks
- saved views, tables, reports, and dashboards are already modern and user-personalizable
- business packs can eventually deliver localizations, sector overlays, workflows, reports, automation, and settings

Gutu's rigidity today:
- Most ERP resources are still code-defined by developers.
- Custom fields are useful but not equivalent to custom DocTypes.
- The custom fields page currently targets a limited hardcoded resource list, not every business object.
- There is no full property setter equivalent for changing labels, sections, required behavior, print behavior, list behavior, or link filters across all resources.
- There is no child-table builder equivalent to ERPNext's item/tax/payment line tables.
- Link fields do not yet create a full ERP relationship graph with automatic drillthrough and document mapping.
- Report definitions exist, but many are not tied to deep accounting/stock engines.
- Workflows and reports are not yet fully declarative through `buildDomainPlugin` despite being identified as pending in the tracker.
- Portal pages, print formats, web forms, onboarding steps, and form tours are not first-class across the ERP suite.

Best direction:
- Keep Gutu's code-first plugin contracts for versioned product development.
- Add admin-safe metadata overlays for fields, property setters, sections, child tables, links, workflows, reports, workspaces, print formats, web forms, and portal visibility.
- Make every overlay exportable as a business pack so admin customization can be promoted between environments.

## UI and UX Comparison

### ERPNext Desk flow

ERPNext favors dense business navigation:
- module workspace
- grouped links
- charts and number cards
- direct report links
- direct setup links
- list view
- form view
- contextual buttons
- linked documents
- child table editing
- print
- portal route
- report drilldown

ERPNext pages are often compact and information-dense. The UI is not as modern as Gutu's newer primitives, but it is practical for ERP operators because the next useful action is usually nearby.

The core ERPNext UX strength is continuity. A user can start with a lead, move to quotation, sales order, delivery, invoice, payment, return, dunning, ledger, and customer statement without feeling like they are switching product areas.

### Gutu admin flow

Gutu favors a modern admin application shape:
- plugin-composed sidebar and workspace shell
- advanced tables
- saved views
- command palette
- generated forms
- generated detail pages
- report builder
- dashboard widgets
- control rooms
- custom fields
- settings pages

The UX foundation is good. The largest issue is genericness. Many pages look and behave like generated resource CRUD even when the business job requires a workflow-specific page.

Examples:
- Accounting needs journal entry with balanced debit/credit lines, allocation panels, reconciliation matching, ledger drilldown, and financial statement drillthrough.
- Inventory needs stock ledger, serial/batch traceability, warehouse movement graph, transfer wizard, reconciliation count screen, and landed-cost allocation.
- Manufacturing needs BOM tree, MRP wizard, production plan board, job card operator view, and work center capacity planning.
- Sales needs quote-to-cash document mapping, line-item pricing, credit warnings, fulfillment status, and payment status.

### Page layouts

ERPNext page layout strengths:
- DocType forms have tab and section structure.
- Child tables appear in the document where they are used.
- Buttons are contextual to document state.
- Link fields drive navigation and query filters.
- Workspaces are link-dense and task-oriented.
- Reports and pages are first-class targets in workspace navigation.

Gutu page layout strengths:
- Tables are more powerful.
- Saved views are more modern.
- Dashboards are more personalizable.
- Shell composition is cleaner.
- The ReportBuilder is a good shared primitive.
- Generated detail pages reduce boilerplate.

Gutu page layout gaps:
- Generated detail pages need domain-specific rail cards, timelines, related records, next actions, and previews.
- Forms need child table sections and document line editors.
- Workspaces need curated operational link maps, not only widget grids.
- List pages need direct links into reports, related documents, and bulk workflows.
- Settings pages need every ERP customization surface, not only narrow admin tools.

### Hyperlinks and direct navigation

ERPNext has an extremely dense direct-link model:
- Workspace links point to DocTypes, reports, pages, and setup records.
- Link fields point to other DocTypes.
- Client scripts add filtered queries and mapped-document buttons.
- Portal routes expose document pages to customers and suppliers.
- Tree views exist for account, cost center, warehouse, item group, territory, department, and similar hierarchies.

Gutu has route generation and shell navigation, but direct links are less semantic. The next step is to make `connections` and document relationships first-class:
- record-to-record links
- routeable relationship graph
- upstream/downstream references
- "make from" actions
- "get items from" actions
- link-filtered pickers
- related reports
- related portal pages
- related print documents

## Builders and Admin Customization

ERPNext/Frappe-style builder surfaces visible or implied by the checkout:
- DocType metadata
- workspaces
- reports
- print formats
- web forms
- dashboard charts
- number cards
- onboarding steps
- module onboarding
- form tours
- portal menu items
- tree views
- custom pages
- client-side form behavior
- scheduled jobs and document hooks

Gutu builder surfaces today:
- generic `buildDomainPlugin`
- generated list/form/detail/rich-detail views
- admin shell composition
- custom fields page
- workflow/settings pages
- API tokens/webhooks settings
- report builder primitive
- workspace renderer with personalization
- page builder and company builder plugin direction
- business packs direction

Builder gaps to close:
- Custom DocType Builder
- Child Table Builder
- Workspace Builder
- Print Format Builder
- Web Form Builder
- Portal Page Builder tied to business documents
- Report Builder persistence and role visibility
- Workflow Builder with state transitions and approvals
- Property Setter equivalent
- Link/Dynamic Link Relationship Builder
- Tree View Builder for accounts, cost centers, warehouses, item groups, departments, territories, and sales teams
- Form Tour and Onboarding Builder
- Naming Series Builder
- Number Card and Dashboard Chart Builder
- Pack Export/Import/Promote flow for all builder output

## Most Important Missing Pieces

Priority 0:
- ERP-grade accounting engine: Account tree, GL Entry, payment allocations, fiscal locks, dimensions, financial statements, currency revaluation, period closing, and cancellation/reversal semantics.
- ERP-grade stock engine: Stock Ledger Entry, valuation layers, serial/batch ledger, stock reservations, projected quantity, FIFO/moving average, stock reconciliation, and future ledger reposting.
- Child table primitive: line items, taxes, payments, advances, operations, BOM items, salary components, inspection parameters, and timesheet entries.
- Link and Dynamic Link primitive: typed relationships, link filters, reverse references, drillthrough, and routeable related-record rails.
- Document mapping engine: quotation to order, order to delivery, delivery to invoice, invoice to payment, material request to RFQ, RFQ to supplier quotation, supplier quotation to PO, PO to receipt, receipt to invoice, BOM to work order, work order to job card, job card to stock entry.
- Domain-crafted detail pages: not only auto-rich details, but real pages with contextual actions, timelines, status bars, related ledgers, related stock movements, print/portal/share actions, and next-step buttons.
- Workspace link maps: ERPNext-level workspaces for Accounts, Stock, Manufacturing, Buying, Selling, CRM, Projects, Support, Assets, HR, Quality, and Setup.
- Customization parity: custom DocTypes, child tables, property setters, workflow builder, print format builder, web form builder, workspace builder, and report persistence.
- Print and portal parity: invoices, orders, RFQs, quotations, shipments, projects, tasks, material requests, supplier documents, and customer documents.
- Setup/onboarding flows: setup wizard, onboarding steps, module onboarding, form tours, and progressive configuration.

Priority 1:
- Tree views for account, cost center, warehouse, item group, customer group, supplier group, territory, sales person, and department.
- Naming series and numbering configuration per company, fiscal year, and document type.
- Regional tax and localization packs with real behavior, not only metadata.
- Scheduled jobs for reorder, subscription, fiscal year, revaluation, auto-close, reminders, and reposting.
- Role and permission matrix per DocType/resource, state, field, and action.
- Business import tools with quarantine, validation, preview, and rollback.
- Data migration and patch tooling for long-lived business records.
- Deep reports with drilldown and row-level related actions.

Priority 2:
- Mobile/responsive ERP operator flows.
- Offline POS and field-service surfaces.
- Embedded BI over business records.
- AI assistance that understands document context and permitted next actions.
- Cross-company consolidation and multi-currency reporting.

## Recommended Delivery Plan

### Stage A: Turn ERPNext into a machine-readable gap ledger

Create a generated `tooling/business-os/erpnext-reference-map.json` from the reference checkout:
- modules
- DocTypes
- fields
- child tables
- link fields
- reports
- workspaces
- pages
- print formats
- web forms
- dashboard charts
- number cards
- hooks
- scheduled jobs
- portal routes

Then map each ERPNext object to:
- Gutu plugin owner
- current Gutu resource, report, page, job, or workflow
- status: missing, scaffolded, shallow, implemented, verified
- priority
- required engine
- required UI primitive

### Stage B: Upgrade the resource metadata model

Add first-class metadata for:
- tabs
- sections
- columns
- child tables
- Link fields
- Dynamic Link fields
- naming series
- docstatus
- print behavior
- portal visibility
- field dependencies
- link filters
- permissions
- list behavior
- search fields
- tree behavior

This is the bridge between ERPNext-level flexibility and Gutu plugin contracts.

### Stage C: Build the relationship and document mapping engine

Add a shared engine for:
- upstream references
- downstream references
- related record rails
- mapped document creation
- "get items from" flows
- reverse links
- graph traversal
- contextual action eligibility
- audit trail of transformations

This engine should be generic, but the actual mappings should be owned by domain plugins.

### Stage D: Implement the first two deep verticals

Do Accounting and Stock first because every other ERP domain depends on them.

Accounting first milestone:
- Account
- GL Entry
- Journal Entry
- Payment Entry
- Sales Invoice
- Purchase Invoice
- Fiscal Year
- Accounting Period
- Cost Center
- Accounting Dimension
- Posting engine
- Trial Balance
- General Ledger
- Balance Sheet
- Profit and Loss

Stock first milestone:
- Item
- Warehouse
- Bin
- Stock Ledger Entry
- Valuation Layer
- Stock Entry
- Delivery Note
- Purchase Receipt
- Batch
- Serial Number
- Reservation
- Reconciliation
- Stock Balance
- Stock Ledger
- Stock Valuation
- Stock Ageing

### Stage E: Make workspaces ERP-grade

For each business domain, create an ERPNext-level workspace:
- KPI cards
- trend charts
- action shortcuts
- grouped document links
- grouped report links
- grouped setup links
- custom page links
- saved views
- onboarding steps
- "recent/favorites" behavior

The existing Gutu workspace renderer can support this. The missing work is curation and standard content.

### Stage F: Build admin customization parity

Add:
- Custom DocType Builder
- Child Table Builder
- Property Setter
- Workspace Builder
- Print Format Builder
- Web Form Builder
- Workflow Builder
- Report Builder persistence
- Tree View Builder
- Naming Series Builder
- Number Card Builder
- Dashboard Chart Builder
- Form Tour Builder
- Onboarding Builder

All output should be exportable into a business pack.

### Stage G: Replace generic details with domain-crafted flows

Use auto-rich details as fallback only. Build dedicated pages for:
- Sales Invoice
- Purchase Invoice
- Payment Entry
- Journal Entry
- Stock Entry
- Item
- Warehouse
- BOM
- Work Order
- Job Card
- RFQ
- Purchase Order
- Sales Order
- Delivery Note
- Project
- Issue
- Employee
- Asset

Each detail page should include:
- status bar
- primary contextual next actions
- child tables
- related documents
- ledger or stock previews
- activity timeline
- comments and attachments
- print/share/portal actions
- approvals
- audit events

### Stage H: Verify with end-to-end business scenarios

Required E2E scenarios:
- lead to quotation to sales order to delivery note to invoice to payment to ledger
- material request to RFQ to supplier quotation to purchase order to receipt to purchase invoice to payment
- item purchase to stock ledger to valuation to accounting entry
- BOM to work order to job cards to stock issue to finished goods receipt
- employee to salary slip to payroll journal
- asset purchase to depreciation to disposal
- support issue to SLA escalation to resolution
- project timesheet to customer invoice
- stock reconciliation with valuation adjustment
- period close and locked-period rejection

Each scenario should assert:
- records created
- linked documents correct
- ledger or stock entries correct
- reports updated
- permissions enforced
- audit/events emitted
- reverse/cancel behavior correct
- UI route exists
- detail page shows next actions

## Implementation Progress After This Pass

The current branch now closes part of the foundation gap without claiming complete ERPNext parity:

- The generated ERPNext ledger now separates `admin-metadata`, `catalog-only`, and `missing` DocTypes. The latest generated map reports 17 DocTypes with admin metadata, 97 catalog-only DocTypes, 114 covered DocTypes total, and 513 missing DocTypes. It also assigns every ERPNext DocType to a Gutu owner plugin with a target resource, required child-table targets, report/workspace links, print/web-form signals, portal requirement, workflow requirement, supporting plugins, and verification scenario.
- `@platform/business-runtime` now stores ERP document records, runs mapping chains, preserves line-level lineage, lists related upstream/downstream documents, and verifies a quote-to-cash chain from quotation to sales order, delivery note, sales invoice, and payment entry.
- The accounting runtime now supports duplicate-post protection, fiscal-period locks, General Ledger filtering, balanced posting, reversals, Trial Balance, Balance Sheet, P&L, and AR/AP aging rows.
- The stock runtime now supports FIFO valuation, reservations, transfers, reconciliations, FIFO queue reporting, stock aging, projected quantity, and serial/batch ledger drilldown.
- The admin metadata contract now includes workflow, property setter, tree, dashboard chart, number card, builder surface, print, portal, workspace, child-table, and mapping-action metadata.
- Generated factory forms now render ERP child-table sections, and generated rich detail pages expose a Document tab plus ERP rail actions for print formats, portal routes, mapping actions, workflow transitions, workspace links, and builder surfaces.
- `buildDomainPlugin` now accepts declarative `reports[]`, `workflows[]`, and `connections`, auto-registering ReportBuilder routes, Reports nav, command-palette report/workflow shortcuts, and registry-backed connection rails.
- `/api/erp` now exposes tenant-scoped posting preview, workflow transition, cancellation, reversal, reconciliation, related ledger, related stock, and General Ledger, Trial Balance, and Stock Ledger report-data endpoints in addition to mapping, posting, print, and portal links.
- Accounting, Inventory, Manufacturing, Sales, and Procurement now carry representative ERP metadata on high-leverage resources, including quotations, sales orders, purchase orders, material requests, RFQs, delivery notes, purchase receipts, invoices, payment entries, stock entries, work orders, and BOMs.

Remaining truth:

- The ledger still shows 513 missing ERPNext DocTypes, so the product is not ERPNext-complete yet.
- The new runtimes and `/api/erp` routes are verified in integration tests for tenant-persistent mutations, but not every business document type auto-posts through a domain-specific accounting or stock engine yet.
- UI surfaces expose ERP metadata and detail/document context, and generated mapping/workflow/print/portal actions now have mutation-backed execution paths. Hand-authored ERP pages still need migration where they bypass these generated live surfaces without adding domain-specific UX.
- Full print-format, portal-page, custom-DocType, workflow, workspace, report, number-card, and dashboard-chart builders are now typed as first-class metadata surfaces, but the live builder editors are not complete across every object type.

## Bottom Line

ERPNext is advanced because it is end-to-end in the literal ERP sense: metadata, UI, business rules, ledgers, stock, reports, portals, print, workspaces, hooks, and scheduler jobs all point at the same business documents.

Gutu is advanced in a different way: it has a cleaner modular platform shell, better long-term plugin boundaries, a stronger admin primitive stack, and a more explicit business runtime direction.

The missing work is not a small UI polish pass. It is the middle layer between "resource CRUD" and "real ERP": child tables, linked documents, posting engines, stock valuation, document mapping, report truth, workspaces, builders, portals, print formats, and domain-specific detail pages.

The winning path is to keep Gutu's architecture, but raise every critical business plugin from "ERP-shaped scaffold" to "ERP-operational system." Accounting and Stock should be the first deep verticals because they are the truth engines behind the rest of the suite.

## Evidence Appendix

ERPNext evidence:
- `ref/Business/ERPNext/erpnext/hooks.py`: app metadata, Desk entry, DocType JS, treeviews, portal routes, portal menu items, document events, scheduler jobs, and accounting dimensions.
- `ref/Business/ERPNext/erpnext/accounts/doctype/sales_invoice/sales_invoice.json`: Sales Invoice form metadata, sections, tabs, child tables, and linked fields.
- `ref/Business/ERPNext/erpnext/accounts/doctype/sales_invoice/sales_invoice.py`: Sales Invoice validation, submit, cancel, GL, stock, payment, tax, loyalty, credit, and reversal behavior.
- `ref/Business/ERPNext/erpnext/accounts/doctype/sales_invoice/sales_invoice.js`: contextual form actions, mapped document buttons, ledger previews, stock ledger previews, and filtered dialogs.
- `ref/Business/ERPNext/erpnext/stock/doctype/item/item.json`: Item metadata, stock settings, serial/batch, variants, defaults, purchasing, sales, quality, manufacturing, and linked fields.
- `ref/Business/ERPNext/erpnext/accounts/workspace/invoicing/invoicing.json`: Invoicing workspace charts, cards, number cards, grouped links, reports, and setup entries.
- `ref/Business/ERPNext/erpnext/stock/workspace/stock/stock.json`: Stock workspace document links, report links, setup links, and custom pages.
- `ref/Business/ERPNext/erpnext/manufacturing/workspace/manufacturing/manufacturing.json`: Manufacturing workspace, BOM tools, reports, settings, and custom page links.
- `ref/Business/ERPNext/erpnext/stock/page/stock_balance/stock_balance.js`: custom page with filters, backend method, dashboard refresh, and route behavior.

Gutu evidence:
- `Business Plugin Goal.md`: plugin-first business OS goal, domain ownership rules, lifecycle state requirements, current implementation truth, and intentionally pending domain depth.
- `Plugin-Todo.md`: ERPNext parity tracker, shipped resources/reports/control rooms, and deferred domain-complete gaps.
- `admin-panel/src/app/App.tsx`: plugin activation and shell composition across business, platform, builder, automation, analytics, and admin domains.
- `admin-panel/src/contracts/plugin-v2.ts`: Plugin V2 goals and contribution APIs.
- `admin-panel/src/contracts/fields.ts`: field kinds, dynamic predicates, defaults, and permissions.
- `admin-panel/src/contracts/resources.ts`: current lightweight resource definition surface.
- `admin-panel/src/examples/_factory/buildDomainPlugin.tsx`: generated resource, list, form, detail, rich-detail, nav, widget, action, and command pattern.
- `admin-panel/src/admin-primitives/AdvancedDataTable.tsx`: table UX primitives.
- `admin-panel/src/admin-primitives/SavedViewManager.tsx`: saved view and pin/default behavior.
- `admin-panel/src/admin-primitives/ReportBuilder.tsx`: report builder modes, exports, pivot, chart, and print.
- `admin-panel/src/admin-primitives/widgets/WorkspaceRenderer.tsx`: dashboard personalization and widget grid behavior.
- `admin-panel/backend/src/routes/resources.ts`: generic CRUD with ACL, tenant isolation, audit, custom field merge, WebSocket invalidation, and events.
- `admin-panel/backend/src/lib/field-metadata.ts`: custom field metadata model and validation.
- `admin-panel/src/examples/admin-tools/custom-fields-page.tsx`: custom fields UI and current hardcoded resource scope.
- `admin-panel/src/examples/accounting.ts`: current admin accounting resources and simplified invoice/bill/accounting surfaces.
- `admin-panel/src/examples/inventory.ts`: current inventory resources and stock-like fields.
- `admin-panel/src/examples/manufacturing.ts`: current manufacturing resources and simplified production/BOM/routing surfaces.
- `plugins/gutu-plugin-accounting-core/framework/builtin-plugins/accounting-core/src/domain/catalog.ts`: ERPNext-informed accounting catalog.
- `plugins/gutu-plugin-accounting-core/framework/builtin-plugins/accounting-core/src/model.ts`: lifecycle and business record schemas.
- `plugins/gutu-plugin-accounting-core/framework/builtin-plugins/accounting-core/src/reports/catalog.ts`: ERPNext-parity report catalog.
- `libraries/gutu-lib-admin-shell-workbench/framework/libraries/admin-shell-workbench/src/main.tsx`: admin route composition, workspace body, builder routing, registry composition, and Desk href behavior.
