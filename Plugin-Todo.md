# Plugin Parity & Production-Readiness Tracker

Working through every plugin in the Gutu admin-panel ecosystem, bringing each to **feature parity with (or beyond) ERPNext and other industry leaders**. One plugin at a time, end-to-end, no gimmicks.

**Scope per plugin (target state):**
- All resources a real business needs (derived from ERPNext + common market expectations)
- Full list / form / rich-detail pages (auto-factory already covers detail)
- Custom pages for workflows that need them (graph, canvas, stepper, analytics)
- 5–25 standard reports built on the ReportBuilder
- Dashboard widget descriptors surfaced on `/home` and `/`
- Approval/workflow state machines where relevant
- Automation hooks (what events fire, what actions are possible)
- Realtime-aware (WebSocket invalidation already free via hooks)
- Audit/activity coverage on every mutation
- Connections panel entries so related records show on every record's rail
- Permission descriptors per role

Reference: audit of `ref/Business/ERPNext/erpnext/` summarised in this tracker. No code or text copied; only feature names used for parity planning.

---

## Legend

- `☐` pending
- `🔄` in progress
- `✅` shipped
- `P0/P1/P2/P3` priority

---

## P0 — Foundation (must ship first)

### ✅ P0 — ERP document actions and posting bridge — shipped (this pass)
**Delivered**: tenant-aware `/api/erp` backend routes for ERP document mapping, related-document lookup, and immutable posting batches. The mapping path enforces source ACL, tenant isolation, idempotency, document-state eligibility, safe JSON defaults, downstream ACL seeding, record links, audit rows, realtime invalidation, and per-record timeline entries. The generated ERP rich-detail rail now executes live mapping actions and navigates to downstream records where a target route exists. Accounting, Inventory, Manufacturing, Sales, and Procurement mapping metadata now includes field maps, child-table maps, target document types, and safe draft defaults. Integration tests cover mapping, replay, related links, timelines, state rejection, unbalanced accounting rejection, balanced posting persistence, and posting replay.

**Print and portal added**: `/api/erp/print/:resource/:id` now renders redacted printable ERP documents with child tables and format metadata under normal document ACL. `/api/erp/portal-links` now creates hashed-token portal links with expiry, revocation, access counters, audit rows, and timeline events, while `/api/erp/portal/:token` serves the public document view without exposing stored tokens. Generated rich-detail print and portal buttons now call these runtime-backed routes instead of using browser-only print or static hash navigation. Integration tests cover redaction, child-table rendering, hashed token storage, public access, expiry, and revocation.

**Workflow/report bridge added**: `buildDomainPlugin` now accepts declarative `reports[]`, `workflows[]`, and `connections`; contributes generated ReportBuilder routes, Reports nav, command-palette report/workflow entries, and live connection descriptors; and the generated ERP rich-detail rail now exposes metadata-backed workflow transitions. `/api/erp` now includes posting preview, workflow transition, cancel, reverse, reconcile, related ledger, related stock, and ledger/stock report endpoints. Integration coverage includes workflow transition, cancellation idempotency, reconciliation, accounting preview, ledger report, stock posting lookup, and reversal replay.

**Still not complete**: hand-authored ERP pages that bypass the generated rich-detail factory should be migrated where they do not add domain-specific UX; plugin-specific auto-posting engines still need to deepen beyond generic immutable posting rows for every document type.

### ✅ P0 — CRM (`crm`) — shipped (commit pending)
**Delivered**: 8 new resources (Lead, Opportunity, Campaign, Appointment, Contract, Competitor, Market Segment, Sales Stage) with Zod schemas + list views + idempotent backend seed (123 new records). CRM Control Room dashboard (4 KPIs + 4 charts + 4 shortcuts + 3 quick lists). 8 reports via ReportBuilder (Lead Details, Lead Conversion Time, Lead Owner Efficiency, Opportunity Summary by Stage, Sales Pipeline Analytics, Campaign Efficiency, Lost Opportunity, First Response Time). Connections panel descriptors for Contact/Opportunity/Campaign routing to Deals, Invoices, Payments, Tickets, Notes, Appointments, Contracts. Nav extended (+ 11 entries) and commands (+ 5). Typecheck clean. Backend boots healthy; all endpoints return live data. Frontend renders Control Room with live aggregations.

**Deferred to next CRM pass**: custom rich detail pages for Opportunity (line items + stage history), Lead (scoring explainer + email log), Campaign (attribution graph). The auto-rich-detail factory covers these today; dedicated pages are an upgrade.

### ☐ P0 — CRM (`crm`) — [ORIGINAL PLAN FOR REFERENCE]
**ERPNext ref**: `crm/`, 15 DocTypes, 9 reports, 8 dashboard charts
**Resources to add**: `crm.lead`, `crm.opportunity`, `crm.campaign`, `crm.appointment`, `crm.contract`, `crm.contract-template`, `crm.competitor`, `crm.market-segment`, `crm.sales-stage`, `crm.email-campaign`, `crm.note` (already exists via extended seed), `crm.task`, `crm.segment` (already exists)
**Reports to ship**: Lead Details · Lead Conversion Time · Lead Owner Efficiency · Campaign Efficiency · Opportunity Summary by Stage · Sales Pipeline Analytics · First Response Time · Lost Opportunity · Prospects Engaged But Not Converted
**Custom pages**: Control Room dashboard · Campaign builder · Appointment scheduler with availability slots · Contract fulfilment checklist · Competitor intel board
**Workflows**: Lead lifecycle (new → qualified → converted → lost) · Opportunity stages (discovery → qualification → proposal → negotiation → won/lost) · Campaign (draft → active → completed) · Contract (draft → signed → active → completed/terminated) · Appointment (proposed → confirmed → completed/cancelled)
**Connections panel**: Contact → Deals, Invoices, Quotes, Tickets, Emails, Calls, Notes, Tasks
**Automations**: Lead-to-opportunity conversion trigger · Campaign email scheduler · Appointment reminders · Contract expiry reminders · Lost-reason classification

### ✅ P0 — Sales (`sales`) — shipped (commit f68c8b6)
**Delivered**: 9 new resources (ProductBundle, InstallationNote, SalesPartner, SalesTeam, CustomerCreditLimit, Territory, CommissionRule, PricingRule, DeliverySchedule) with Zod schemas + list views + idempotent backend seed (104 new records). Sales Control Room dashboard + 6 reports (Sales Analytics, Territory Target Variance, Partner Commission, Customer Credit Balance, Quotation Trends, Pricing Rule Usage). Nav +11 entries, commands +2. Typecheck clean.

### ✅ P0 — Accounting (`accounting`) — shipped (this pass)
**Delivered**: 11 new resources extending the factory plugin (JournalEntry, PaymentEntry, BankAccount, BankTransaction, Budget, CostCenter, AccountingPeriod, TaxRule, Dunning, FiscalYear, CurrencyRate) with auto-generated list/form/detail/rich-detail views via `buildDomainPlugin` + idempotent backend seed (238 records across 11 resources; total 300 records across 14 accounting resources including the original invoice/bill/account). Accounting Control Room dashboard (4 KPIs, 4 charts, 4 shortcuts, 2 quick lists). 6 reports via `buildReportLibrary` (AR Aging, AP Aging, Invoice Trends, Budget Variance, Cash Flow, Tax Summary). Nav +3 entries (Control Room + Reports + Month-end close), commands +8. Buildable: `bunx tsc --noEmit` clean for admin-panel; backend seed confirmed via SQLite count. Frontend Control Room reads live aggregations; reports library lands under /accounting/reports.

**Deferred to next Accounting pass**: Trial Balance / General Ledger / Balance Sheet / P&L (need accounting.gl-entry resource + double-entry posting engine); Bank Reconciliation tool UI (data model exists via bank-transaction + reconciled flag); Subscription invoicing automation (separate subscriptions plugin already covers this).

### ☐ P0 — Accounting (`accounting`) — [ORIGINAL PLAN FOR REFERENCE]
**ERPNext ref**: `accounts/`, 80+ DocTypes, 45+ reports — the single biggest module
**Resources to add**: `accounting.account`, `accounting.cost-center`, `accounting.accounting-period`, `accounting.journal-entry`, `accounting.payment-entry`, `accounting.sales-invoice`, `accounting.purchase-invoice`, `accounting.bank-account`, `accounting.bank-transaction`, `accounting.bank-reconciliation`, `accounting.budget`, `accounting.tax-rule`, `accounting.advance-payment`, `accounting.dunning`, `accounting.subscription`, `accounting.accounting-dimension`
**Reports to ship (22 priority)**: Trial Balance · General Ledger · Balance Sheet · Profit & Loss · Cash Flow · Accounts Receivable · Accounts Payable · Bank Reconciliation · Invoice Aging · Sales Register · Purchase Register · Gross Profit · Consolidated Financial Statement · Tax Withholding Details · Financial Ratios · Payment Ledger · Budget Variance · Deferred Revenue & Expense · Customer Ledger Summary · Supplier Ledger Summary · Dimension-Wise Balance · Period Closing Voucher
**Custom pages**: Ledger drill-down · Payment Entry with allocations · Bank Reconciliation tool · Journal Entry with dimensions · Month-end close (exists) · Budget dashboard · Subscription manager · Dunning workflow
**Workflows**: Invoice (draft → submitted → paid/void) · Journal (draft → submitted → cancelled) · Payment (draft → reconciled → posted) · Close period (lock with audit trail)
**Connections**: Invoice → Payments, Customer, Order, Dunning; Customer → All Invoices
**Automations**: Auto-generate journal on stock/payroll transactions · Bank import + matching · Subscription invoice generation · Dunning escalation · Currency revaluation · Period lock enforcement

### ✅ P0 — Inventory (`inventory`) — shipped (this pass)
**Delivered**: 15 new resources (ItemVariant, ItemPrice, Bin, StockEntry, MaterialRequest, DeliveryNote, PurchaseReceipt, LandedCost, Batch, SerialNumber, StockReconciliation, PickList, PackingSlip, DeliveryTrip, ItemSupplier) extending the existing Item + Warehouse with auto-generated list/form/rich-detail views via `buildDomainPlugin`. Idempotent backend seed (452 records across 15 resources; 486 total inventory records with factory base). Inventory Control Room dashboard (4 KPIs: Active SKUs / Inventory value / Below reorder / Stock moves MTD; 4 charts; 4 shortcuts; 2 quick lists). 9 reports via `buildReportLibrary` (Stock Balance, Stock Ledger, Stock Ageing, Stock Projected Qty, Warehouse-Wise Balance, Reorder Level, Batch Expiry, Item Shortage, Stock Valuation). Nav +3 entries (Control Room, Reports, Low-stock alerts), commands +8. Typecheck clean.

**Deferred to next Inventory pass**: BOM tree + explosion (lives in Manufacturing plugin); Transfer wizard UI (data model exists via stock-entry kind=transfer); Batch/Serial traceability graph (needs RelationshipGraph primitive applied); FIFO queue audit report (needs valuation lot tracking); Landed-cost auto-allocation engine.

### ☐ P0 — Inventory (`inventory`) — [ORIGINAL PLAN FOR REFERENCE]
**ERPNext ref**: `stock/`, 50+ DocTypes, 50+ reports
**Resources to add**: `inventory.item-variant`, `inventory.item-price`, `inventory.item-alternative`, `inventory.item-barcode`, `inventory.item-supplier`, `inventory.bin`, `inventory.batch`, `inventory.serial-no`, `inventory.stock-entry`, `inventory.stock-reconciliation`, `inventory.delivery-note`, `inventory.purchase-receipt`, `inventory.landed-cost`, `inventory.material-request`, `inventory.pick-list`, `inventory.packing-slip`, `inventory.delivery-trip`
**Reports to ship**: Stock Balance · Stock Ledger · Stock Ageing · Stock Analytics · Stock Projected Qty · Reserved Stock · Warehouse-Wise Balance · Batch Expiry · Serial No Ledger · Landed Cost · Item Shortage · Delayed Order · BOM Search · FIFO Queue Check · Stock Variance · Requested Items · Reorder Level
**Custom pages**: Stock Reconciliation (physical count) · Pick List optimizer · Delivery Trip planner with map · Landed Cost allocator · Material Request workflow · Batch/Serial traceability graph (uses RelationshipGraph) · Low-stock alerts (exists) · Transfer wizard
**Workflows**: Material Request (draft → approved → ordered → received → closed) · Stock Entry (draft → submitted → cancelled with reversal)
**Connections**: Item → Stock per Warehouse, Movements, Purchase Orders, Sales Orders, Quality Inspections
**Automations**: Auto-reserve stock from SO · Auto-receive on PO · Expiry alerts · Reorder-point triggers · Valuation on each transaction (FIFO/Average/Moving) · Multi-warehouse transfer · Landed-cost auto-allocation

### ✅ P0 — HR & Payroll (`hr-payroll`) — shipped (this pass)
**Delivered**: 18 new resources (Department, Designation, LeaveType, LeaveApplication, LeaveBalance, Attendance, Shift, HolidayList, SalaryStructure, SalaryComponent, SalarySlip, ExpenseClaim, Advance, Appraisal, TrainingEvent, JobRequisition, Onboarding, Offboarding) extending Employee + Payroll with auto-generated list/form/rich-detail views via `buildDomainPlugin`. Employee resource enriched from 5 → 22 fields (empCode, phone, designation, grade, manager, employmentType, location, anniversary, birthday, status, currency, baseSalary, bio). Payroll resource enriched with deductions/taxes/net/currency/processedBy + explicit status lifecycle. Idempotent backend seed (317 backfilled records, 343 total HR records across 20 resources). HR & Payroll Control Room dashboard (4 KPIs: Headcount / Open requisitions / Leave pending / Expenses pending; 4 charts: Headcount by dept / New hires 12mo / Gross payroll trend / Attendance today; 4 shortcuts; 2 quick lists). 9 reports via `buildReportLibrary` (Headcount, Attendance Summary, Leave Balance, Payroll Summary, Expense Claims, Employee Tenure, Anniversaries, Salary Slip, New Hires). Nav +3 entries (Control Room, Reports, Headcount), commands +8. Typecheck clean.

**Deferred to next HR pass**: Organization-chart visualization (needs RelationshipGraph primitive wired to employee.manager); Payroll run wizard (multi-step form primitive); Appraisal form with goals/competencies (nested child-table primitive); Tax-deduction summary report (needs salary-slip line items).

### ☐ P0 — HR & Payroll (`hr-payroll`) — [ORIGINAL PLAN FOR REFERENCE]
**ERPNext ref**: HR+Payroll module (via Frappe HRMS in newer releases)
**Resources to add**: `hr.employee-profile`, `hr.department`, `hr.designation`, `hr.employment-type`, `hr.grade`, `hr.leave-type`, `hr.leave-application`, `hr.leave-balance`, `hr.attendance`, `hr.shift`, `hr.holiday-list`, `hr.payroll-entry`, `hr.salary-slip`, `hr.salary-structure`, `hr.salary-component`, `hr.expense-claim`, `hr.advance`, `hr.appraisal`, `hr.appraisal-goal`, `hr.training-event`, `hr.training-feedback`, `hr.employee-separation`
**Reports to ship**: Headcount (exists) · Attendance Summary · Leave Balance · Leave Ledger · Monthly Attendance · Payroll Summary · Salary Slip · Tax Deduction Summary · Expense Claim Summary · Employee Tenure · Anniversaries (birthdays/hire dates) · Training Records · Appraisal Summary
**Custom pages**: Payroll run wizard · Attendance tool with shift-based calculation · Leave approval board · Expense claim approval · Appraisal form · Onboarding checklist · Offboarding checklist · Organization chart (uses RelationshipGraph)
**Workflows**: Leave (apply → approved/rejected) · Expense (draft → submitted → approved → reimbursed) · Payroll (draft → approved → paid) · Appraisal · Onboarding · Offboarding
**Connections**: Employee → Attendance, Leaves, Expenses, Payrolls, Assets assigned, Training
**Automations**: Auto-calc attendance from shifts · Auto-accrual of leave · Payroll journal · Expense reimbursement · Probation end alerts · Anniversary notifications

---

## P1 — Core operations

### ☐ P1 — Support Service (`support-service`)
**ERPNext ref**: `support/`, 11 DocTypes, 4 reports
**Add**: `support.issue-type`, `support.priority`, `support.sla-policy`, `support.service-day`, `support.warranty-claim`, `support.service-contract`
**Reports**: Issue Analytics · Issue Summary · First Response · SLA Compliance · Support Hour Distribution · CSAT Survey · Resolution Time · Agent Leaderboard
**Custom pages**: Ticket Board (exists) · SLA dashboard · Warranty claim workflow · Agent console with queue · AI-suggested articles on each ticket
**Workflows**: Ticket (open → in-progress → resolved → closed with auto-SLA pause on "waiting-on-customer")
**Automations**: Auto-assign round-robin · Email-to-ticket · SLA escalation · CSAT survey on close · Article suggestion via AI (uses AIInsightPanel)

### ☐ P1 — Booking (`booking`)
**Add**: `booking.service`, `booking.availability`, `booking.resource`, `booking.client`, `booking.payment`, `booking.feedback`, `booking.recurring-booking`, `booking.waitlist`
**Reports**: Utilization · Booking Trends · No-show rate · Revenue per service · Resource availability · Client LTV
**Custom pages**: Calendar (exists) · Availability grid · Waitlist manager · Recurring-booking builder
**Workflows**: Booking (proposed → confirmed → completed/cancelled/no-show)
**Automations**: Reminders (email/SMS) · Waitlist promotion · No-show charge · Feedback request on completion

### ☐ P1 — Field Service (`field-service`)
**Add**: `fs.technician`, `fs.skill`, `fs.service-area`, `fs.part-used`, `fs.time-log`, `fs.photo`, `fs.signature`, `fs.invoice`, `fs.customer-equipment`
**Reports**: On-time % · Mean time to resolution · Technician utilization · Parts used · Customer satisfaction · Jobs by area
**Custom pages**: Calendar + map (exists needs map) · Dispatch board · Technician workload planner · Checklist form · Signature capture
**Workflows**: Job (open → dispatched → in-progress → completed → invoiced)
**Automations**: Route optimization · Auto-dispatch by skill+area · Parts replenishment from job · Travel-time calc

### ☐ P1 — Projects (`projects`)
**ERPNext ref**: 15 DocTypes, 5 reports
**Add**: `projects.project-template`, `projects.task-template`, `projects.activity-type`, `projects.activity-cost`, `projects.timesheet`, `projects.timesheet-entry`, `projects.project-update`, `projects.milestone`
**Reports**: Project Summary · Delayed Tasks · Daily Timesheet · Billing Summary · Project Wise Stock · Budget vs Actual · Resource Allocation
**Custom pages**: Board (exists) · Gantt chart · Resource planner · Timesheet tool · Burndown · Status update feed
**Workflows**: Project (draft → active → completed/cancelled) · Task (backlog → active → in-review → done)
**Automations**: Template instantiation · Dependency scheduling · Timesheet-to-invoice · Milestone notifications

### ☐ P1 — Issues (`issues`) — engineering
**Add**: `issues.label`, `issues.component`, `issues.milestone`, `issues.commit-link`, `issues.pull-request-link`, `issues.comment`
**Reports**: Open Issues by Severity · Time to Resolve · Stale Issues · Engineering Velocity · Bug vs Feature trend
**Custom pages**: Board (exists) · Roadmap · Component heatmap · PR linkage graph
**Workflows**: Issue (open → triaged → in-progress → review → closed) + severity gates
**Automations**: Auto-label · Stale issue nudges · PR auto-close on merge · Slack/Discord integration

### ☐ P1 — Quality (`quality`)
**ERPNext ref**: `quality_management/`, 16 DocTypes, 1 report
**Add**: `quality.inspection-template`, `quality.parameter`, `quality.feedback`, `quality.goal`, `quality.review`, `quality.meeting`, `quality.non-conformance`, `quality.action`, `quality.procedure`
**Reports**: Quality Review · Inspection Pass Rate · Non-Conformance Trend · Corrective Action Aging · Supplier Quality · Cost of Poor Quality
**Custom pages**: Inspection form with parameter templates · Non-conformance workflow · Goal tracker · Meeting minutes · Procedure library
**Workflows**: Inspection (draft → passed/failed → actions) · Non-conformance (raised → investigated → resolved/verified)
**Automations**: Inspection trigger from receipts/manufacturing · NCR notifications · Action follow-up reminders

### ☐ P1 — Assets (`assets`)
**ERPNext ref**: 25 DocTypes, 3 reports
**Add**: `assets.category`, `assets.location`, `assets.finance-book`, `assets.depreciation-schedule`, `assets.maintenance`, `assets.maintenance-task`, `assets.movement`, `assets.repair`, `assets.capitalization`, `assets.value-adjustment`
**Reports**: Fixed Asset Register · Depreciation Schedule · Maintenance Due · Repair Cost · Asset Location History · Asset Utilization
**Custom pages**: Asset register · Depreciation calculator · Maintenance calendar · Movement tracker · Capitalization form
**Workflows**: Asset (draft → active → in-maintenance → retired/disposed) · Maintenance (scheduled → performed → verified)
**Automations**: Depreciation journal auto-entry · Maintenance reminders · Warranty expiry · Insurance renewal

### ☐ P1 — CMMS Work Orders (`maintenance-cmms`)
**Add**: `cmms.preventive-schedule`, `cmms.work-order`, `cmms.part-request`, `cmms.labor-log`, `cmms.downtime`, `cmms.root-cause`
**Reports**: MTTR · MTBF · Preventive Compliance · Downtime Cost · Labor Hours · Parts Consumption · Failure Mode Analysis
**Custom pages**: Work order board (exists) · Preventive schedule calendar · Downtime log · Root-cause tree
**Workflows**: WO (created → assigned → in-progress → completed → verified)
**Automations**: Preventive auto-generation · Overdue escalation · Failure mode pattern detection

### ☐ P1 — Procurement (`procurement`)
**ERPNext ref**: `buying/`, 19 DocTypes, 10 reports
**Add**: `procurement.supplier`, `procurement.rfq`, `procurement.supplier-quotation`, `procurement.scorecard`, `procurement.subcontract`, `procurement.blanket-order`, `procurement.contract`
**Reports**: Purchase Analytics · Purchase Order Analysis · Purchase Trends · Item-Wise Purchase · Supplier Quotation Comparison · Procurement Tracker · Subcontract Summary · Supplier Scorecard · Lead Time Analysis
**Custom pages**: RFQ multi-supplier comparison · Supplier scorecard dashboard · PO approval chain · Subcontract tracker
**Workflows**: RFQ (draft → sent → responses → awarded) · PO (draft → approved → sent → received → billed)
**Automations**: Auto-RFQ from material request · Quote comparison scoring · Lead-time-based reorder

### ☐ P1 — Manufacturing (`manufacturing`)
**ERPNext ref**: 40+ DocTypes, 22 reports
**Add**: `mfg.bom`, `mfg.bom-operation`, `mfg.production-plan`, `mfg.work-order`, `mfg.job-card`, `mfg.workstation`, `mfg.operation`, `mfg.routing`, `mfg.downtime`, `mfg.sales-forecast`
**Reports**: Production Analytics · BOM Explorer · BOM Variance · Work Order Summary · Material Requirements · Job Card Summary · Quality Inspection Summary · Cost of Poor Quality · Process Loss · Downtime Analysis · Exponential Smoothing Forecast · MPS
**Custom pages**: BOM tree viewer · MRP wizard · Work Order shop floor view · Job Card with operator clock · MPS scheduler · Downtime logger
**Workflows**: Work Order (planned → in-progress → completed/closed) · Job Card (open → clocked-in → clocked-out → finished)
**Automations**: BOM explosion · MRP calculation · Auto-issue of materials · Workstation time capture · Downtime-on-event

### ☐ P1 — Audit (`audit`)
**Already has**: Live audit, seeded demo, event detail
**Add**: `audit.policy` (retention, redaction), `audit.alert-rule` (threshold-based)
**Reports**: Actor Activity (exists) · Failed Action Trend · Permission Denials · Cross-Tenant Attempts · SIEM Export
**Custom pages**: Alert rule builder · Retention config · Forensic timeline · Anomaly detection panel

### ☐ P1 — Auth & Sessions (`auth`)
**Add**: `auth.api-key`, `auth.login-attempt`, `auth.security-event`, `auth.social-login-provider`, `auth.sso-config`
**Reports**: Active Sessions · Failed Login Trend · MFA Adoption · Suspicious Login (new country/device) · API Key Usage
**Custom pages**: Session map · Impersonation audit · API key manager · SSO config · MFA enforcement dashboard
**Workflows**: Impersonation (requested → approved → active → ended/audited)
**Automations**: Brute-force lockout · Unusual-login email · API key rotation reminders

---

## P2 — Growth / adjacent

### ☐ P2 — Community (`community`)
**Add**: `community.topic`, `community.post` (exists), `community.comment`, `community.reaction`, `community.badge`, `community.reputation-event`, `community.membership-tier`
**Reports**: Engagement by space · Top contributors · Moderation queue age · Violations trend · Active member %
**Custom pages**: Feed (exists) · Moderation queue (exists) · Reputation leaderboard · Badge editor · Content scheduling

### ☐ P2 — Party Relationships (`party-relationships`)
**Add**: `party.role`, `party.relation-type`, `party.agreement`
**Custom pages**: Graph (exists, migrate to xyflow) · Relationship timeline · Stakeholder map

### ☐ P2 — Product Catalog (`product-catalog`)
**Add**: `catalog.category`, `catalog.variant-matrix`, `catalog.bundle`, `catalog.image-gallery`, `catalog.attribute`, `catalog.collection`, `catalog.review`, `catalog.seo-metadata`
**Reports**: Catalog health · Missing SEO · Conversion by variant · Slow-moving SKUs
**Custom pages**: Variant matrix editor · Collection manager · Media library · SEO bulk editor

### ☐ P2 — Pricing & Tax (`pricing-tax`)
**Add**: `pricing.tier`, `pricing.rule`, `pricing.promotion`, `tax.rule` (exists), `tax.jurisdiction`, `tax.exemption-certificate`
**Reports**: Discount utilization · Tax liability by jurisdiction · Price rule effectiveness
**Custom pages**: Rule editor (boolean tree) · Tax tester · Promotion calendar · Jurisdiction map

### ☐ P2 — POS (`pos`)
**Add**: `pos.shift` (exists), `pos.tender`, `pos.refund`, `pos.cash-count`, `pos.loyalty`, `pos.gift-card`, `pos.receipt-printer`
**Reports**: Shift summary (exists) · X/Z-reports · Cash variance · Discount abuse
**Custom pages**: Cashier UI · Offline-capable terminal · Cash count form · Gift card issuance

### ☐ P2 — Subscriptions (`subscriptions`)
**Add**: `subscription.plan`, `subscription.addon`, `subscription.invoice-template`, `subscription.proration-rule`, `subscription.dunning-step`
**Reports**: MRR/ARR · Churn · Revenue retention · Dunning success · Trial conversion
**Custom pages**: Plan editor · Dunning flow · Cohort retention heatmap

### ☐ P2 — E-Invoicing (`e-invoicing`)
**Add**: `einv.jurisdiction`, `einv.format-schema`, `einv.submission`, `einv.acknowledgement`, `einv.correction`
**Reports**: Submission success · Rejection reasons · Per-jurisdiction compliance

### ☐ P2 — Treasury (`treasury`)
**Add**: `treasury.account` (exists) · `treasury.forecast`, `treasury.fx-exposure`, `treasury.hedging-contract`
**Reports**: Cash position (exists) · FX exposure · Liquidity runway · Interest reconciliation

### ☐ P2 — Payments (`payments`)
**Add**: `payment.method`, `payment.gateway`, `payment.settlement`, `payment.dispute`, `payment.refund`, `payment.webhook-log`
**Reports**: Success rate by method · Dispute trend · Fee analysis · Chargeback ratio

### ☐ P2 — Traceability (`traceability`)
**Add**: `trace.lot` (exists) · `trace.movement`, `trace.recall`, `trace.certificate-of-analysis`
**Custom pages**: Lineage graph (uses xyflow) · Recall workflow · COA viewer

### ☐ P2 — Role/Policy (`role-policy`)
**Extend the already-good role/policy with**: Simulator ("what can user X do on resource Y?"), Role bundle marketplace, Audit-on-policy-change alerts

### ☐ P2 — User Directory (`user-directory`)
**Add**: `directory.org-unit`, `directory.team`, `directory.manager-relationship`, `directory.public-profile`
**Custom pages**: Org chart · Team pages · People search

### ☐ P2 — Analytics-BI (`analytics-bi`)
**Already strong** (reports library + executive dashboard); add:
- Ad-hoc query builder (SQL-free)
- Scheduled delivery to email/Slack
- Anomaly detection via z-score/seasonal adjustment
- Drill-through from any chart to the underlying records

---

## P3 — AI, automation, platform

### ☐ P3 — AI plugins bundle
**Core**: Prompt library with versioning + A/B testing · Model benchmarking · Usage + cost dashboards · Safety/guardrail rules
**Evals**: Test case editor · Regression dashboard · Model comparison matrix
**RAG**: Collection QA · Chunk-level inspection · Hybrid search (dense + BM25) · Reindex scheduler
**Skills**: Marketplace · Version rollback · Usage analytics
**Assist**: Thread branching · Memory governance · Export conversation

### ☐ P3 — Automation stack
**Triggers**: Event catalog · Condition builder · Schedule cron UI · Manual-run override
**Workflows**: Canvas (new `WorkflowCanvas` xyflow primitive ready) · Version diff viewer · Staging/production promote · Replay from any step
**Runs**: Log viewer (exists) · Retry controls · Error class aggregation
**Jobs**: Cron UI · Dead-letter queue · Resource quotas

### ☐ P3 — Notifications (`notifications`)
**Add**: Channel routing (user prefs) · Quiet hours · Digest scheduler · Template A/B testing
**Reports**: Deliverability · Engagement (open/click) · Unsubscribe trend

### ☐ P3 — Integrations (`integration`)
**Add**: OAuth connection broker · Webhook log viewer · Retry queue · Provider scorecard
**Reports**: Sync lag · Failure rate by provider · Data drift
**Custom pages**: Connector marketplace · Field mapping editor · Rate-limit dashboard

### ☐ P3 — Content / Documents / Files / Contracts / Forms / Knowledge / Templates
**Shared improvements**: Versioning · Review workflow · Access logs · Full-text search · AI summarization
**Contracts-specific**: Clause library · Redline tracking · Signature workflow (DocuSign-style)
**Forms-specific**: Conditional logic · Payment collection · File uploads · Webhook on submit
**Knowledge-specific**: Related articles · Feedback widget · Analytics per article

### ☐ P3 — Portals & Pages (`portals`, `pages`, `company-builder`)
**Portal improvements**: Multi-portal theming · Per-audience SSO · Access-log analytics · Custom domain mapping
**Pages/page-builder**: Block library · Variants · SEO editor · Scheduled publish · A/B test
**Company-builder**: Provisioning wizard · Region routing · Branding inheritance

### ☐ P3 — Platform (`platform-core`, `org-tenant`, `runtime-bridge`, `execution-workspaces`, `search`)
**Tenants**: Domain marketplace · Plan comparison · Usage meters
**Runtime bridges**: Real-time throughput dashboard · Message replay · Subscriber debugger
**Execution workspaces**: Live logs streaming · Resource usage charts · Artifact browser
**Search**: Index health · Query analytics · Slow-query log

---

## Progress log

_Each entry: date · plugin · delivered scope · commit_

| Date | Plugin | Scope | Commit |
|---|---|---|---|
| 2026-04-24 | CRM | 8 resources + 8 reports + Control Room + connections + seed (+123 live records) | 8cdd501 |
| 2026-04-24 | Sales | 9 resources + 6 reports + Control Room + seed (+104 live records) | f68c8b6 |
| 2026-04-24 | Accounting | 11 resources + 6 reports + Control Room + seed (+238 live records) | 25b46c8 |
| 2026-04-24 | Inventory | 15 resources + 9 reports + Control Room + seed (+452 live records) | 91f194f |
| 2026-04-24 | HR & Payroll | 18 resources + 9 reports + Control Room + seed (+317 live records) | b264d11 |
| 2026-04-24 | Support | 7 resources + 8 reports + Control Room + seed (+124 live records) | f298905 |
| 2026-04-24 | Booking | 6 resources + 5 reports + Control Room + seed (+79 live records) | 41f6ae2 |
| 2026-04-24 | Field Service | 8 resources + 6 reports + Control Room + seed (+106 live records) | c19bc76 |
| 2026-04-24 | Projects | 7 resources + 6 reports + Control Room + seed (+198 live records) | 0fad6c1 |
| 2026-04-24 | Issues | 4 resources + 6 reports + Control Room + seed (+110 live records) | efe96ed |
| 2026-04-24 | Quality | 6 resources + 6 reports + Control Room + seed (+88 live records) | de09c3a |
| 2026-04-24 | Assets | 6 resources + 5 reports + Control Room + seed (+106 live records) | c7830ea |
| 2026-04-24 | CMMS | 7 resources + 5 reports + Control Room + seed (+86 live records) | 7b21966 |
| 2026-04-24 | Procurement | 7 resources + 6 reports + Control Room + seed (+88 live records) | 9e7d87c |
| 2026-04-24 | Manufacturing | 7 resources + 5 reports + Control Room + seed (+98 live records) | 46afde7 |
| 2026-04-24 | Audit | Control Room + 4 reports (single-resource immutable log) | e79af42 |
| 2026-04-24 | Auth | 8 resources + 5 reports + Control Room + seed (+118 live records) | f5c6ede |
| 2026-04-24 | Community | Control Room + 3 reports (shared sales-crm bundle) | b7e068b |
| 2026-04-24 | Party Relationships | Control Room + 2 reports (graph connectivity) | 1eb7a15 |
| 2026-04-24 | Product Catalog | 4 resources + 3 reports + Control Room | 043eb3d |
| 2026-04-24 | Pricing & Tax | 4 resources + 3 reports + Control Room | f772d5a |
| 2026-04-24 | POS + Subscriptions | 8 resources + 6 reports + Control Rooms | 236b1f2 |
| 2026-04-24 | E-Invoicing + Treasury + Payments | 9 resources + 7 reports + Control Rooms | f22c9ab |
| 2026-04-24 | Traceability + Role-Policy + User Directory + Analytics BI | 15 resources + 5 reports + Control Rooms | e0b2803 |
| 2026-04-24 | AI Core/Evals/RAG/Skills/Assist | 17 resources + 5 reports + Control Rooms | 10a18f2 |
| 2026-04-24 | Automation/Workflow/Jobs/Notifications/Integration | 17 resources + 5 reports + Control Rooms | bf1219b |
| 2026-04-24 | Content/Contracts/Document/Files/Forms/Knowledge/Template | 15+ resources + reports + Control Rooms (7 plugins) | 226ad46 |
| 2026-04-24 | Business Portals/Company Builder/Page Builder/Portal | 10 resources + Control Rooms (4 plugins) | c6a8a63 |
| 2026-04-24 | Execution Workspaces/Runtime Bridge/Search/Org-Tenant | 11 resources + Control Rooms (4 plugins) | 98fcf81 |
| 2026-04-26 | ERP parity foundation | Declarative factory reports/workflows/connections + ERP transition/cancel/reverse/reconcile/preview/ledger/stock/report endpoints + expanded ERPNext machine ledger | local |

## Summary

**All 55+ plugins shipped end-to-end** with the following baseline per plugin:
- Control Room dashboard (KPI cards + charts + shortcuts + quick lists)
- Reports library where domain-relevant (3-9 reports per P0/P1)
- Enriched resource fields (factory-plugin DSL)
- Nav entries for dashboard + reports + sub-resources
- Command palette entries for all key actions
- Idempotent backend seed data (P0/P1 tier; P2/P3 use factory seeds)
- Typecheck clean throughout

Total: ~2,500+ seed records across ~200 resources spanning 55+ plugins.

## Architectural helpers produced

- `_factory/controlRoomHelper.tsx` — `buildControlRoom(workspace, metadata)`
- `_factory/reportLibraryHelper.tsx` — `buildReportLibrary({ reports, basePath })`
- `_factory/compactDashboard.ts` — `buildCompactControlRoom({ kpis, charts, shortcuts })` (for P2/P3 speed)
- `_factory/buildDomainPlugin.tsx` — factory for declarative list/form/rich-detail resources

## Deferred to follow-up passes

These are intentionally deferred — the breadth is in place, but depth remains for future passes:
- Accounting: the shared runtime and `/api/erp` bridge now have tenant-scoped posting preview, balanced GL posting, reversals, related ledger reads, General Ledger and Trial Balance report data, cancellation, reconciliation, audit, timeline, and replay primitives; remaining work is document-specific auto-posting from every accounting document plus full financial-statement UI drilldown.
- Inventory: the shared runtime and `/api/erp` bridge now have tenant-scoped stock posting, related stock reads, stock-ledger report data, reconciliation, cancellation, reversal, audit, timeline, and replay primitives; remaining work is document-specific auto-posting from every stock document plus BOM explosion visualization and route-level traceability graph UI.
- HR: Org-chart via RelationshipGraph, payroll wizard, appraisal with nested goals
- Support: CSAT analysis with NPS breakdown, macro-library integration
- Several plugins still use auto-generated rich-detail pages instead of hand-crafted layouts — the factory covers these today but custom pages would unlock per-plugin UX polish.

---

## Global deliverables tied to plugin work

These are shared infrastructure needs that come up repeatedly; knocking them out once accelerates multiple plugins:

- [x] Add repeatable ERPNext reference-map generation (`business:erpnext-map`) with durable JSON and Markdown reports for DocTypes, reports, workspaces, pages, print formats, web forms, child tables, and link fields.
- [x] Add ERP-grade admin metadata contracts for child tables, document links, mapping actions, workflows, property setters, workspace links, dashboard charts, number cards, print formats, portal surfaces, builder surfaces, naming series, and submitted statuses.
- [x] Add shared `@platform/business-runtime` primitives for document mapping with stored records and line-level lineage, GL posting/reversal/statements, fiscal locks, AR/AP aging, and FIFO stock ledger/reservation/reconciliation/aging/serial-batch drilldown.
- [x] Render ERP child tables in generated factory forms and surface ERP document model, line tables, mapping actions, print/portal actions, workspace drilldowns, and builder links in generated rich detail pages.
- [x] Extend `buildDomainPlugin` to accept `reports[]` declaratively (generated ReportBuilder index/detail routes, Reports nav, and command entries)
- [x] Extend `buildDomainPlugin` to accept `connections` descriptor so detail rails auto-populate through the plugin registry
- [x] Extend `buildDomainPlugin` to accept `workflows[]` declaratively and surface resource-level ERP workflow transitions in generated rich details
- [x] Migrate all 8 standard reports to the new `ReportBuilder` API
- [x] Migrate existing Kanban pages to the new `DnDKanban` ✅ (LiveDnDKanban + all 5 plugin boards: 5849d11)
- [ ] Migrate hand-rolled SVG charts to `EChartsCard` where they gain value (drilldowns, zoom)
- [ ] Migrate party-relationships graph + automation workflows to `@xyflow/react`
- [x] Auto-generated rich detail for every factory plugin ✅ (shipped in commit 15bc988)

---

## Interactivity / customization parity with ERPNext (and beyond)

Shipped in this pass (commits 5849d11 · b26d7f7 · 49164e3 · db798aa):

- [x] **List view** — tanstack-react-table (column pin/reorder/show-hide/multi-sort/virtualized), saved views (personal/team/tenant presets with pin + default), density toggle, SmartColumnConfigurator popover, CSV/JSON/XLSX export, pagination with page-size selector.
- [x] **Kanban** — `LiveDnDKanban` primitive wrapping dnd-kit with pointer/touch/keyboard sensors, drag-to-mutate backend via `runtime.resources.update(statusField)`, WIP-limit amber headers, per-column localStorage order, new `KanbanView` declarative type + `defineKanbanView()` builder.
- [x] **Dashboard / Control Room** — edit mode on both `WorkspaceRenderer` (used by all Control Rooms) and `DashboardView`: drag to reorder widgets, eye-toggle to hide/show, Reset/Cancel/Done buttons, localStorage persistence keyed per workspace.
- [x] **Forms** — `visibleWhen(ctx)`, `requiredWhen(ctx)`, `readonlyWhen(ctx)`, `canView(ctx)`, `canEdit(ctx)`, `defaultValue`, `description`, `unit`, `colSpan` on `FieldDescriptor`; `collapsible`, `visibleWhen`, `icon` on `FormSection`. Renderer applies all of them.
- [x] **Reports / BI** — `ReportBuilder` now has Table/Chart/Pivot view-mode switcher, chart-type selector (Bar/Line/Area/Donut), Print action, sortable table columns. New `PivotTable` primitive with row/column/value/aggregation (sum/avg/count/min/max), row+column+grand totals, auto-detecting dimension vs. value fields from `ReportColumn.fieldtype`.
- [x] **ERP metadata foundation** — `ResourceDefinition.erp` now carries ERPNext-parity metadata for document type, naming series, submitted statuses, child tables, links, mapping actions, workflows, property setters, workspace links, dashboard charts, number cards, builder surfaces, print formats, portal surfaces, and onboarding. Accounting, Inventory, Manufacturing, Sales, and Procurement examples now furnish representative metadata for their highest-leverage documents.
