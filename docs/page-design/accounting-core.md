---
plugin: gutu-plugin-accounting-core
design-system: 1.0
tier: flagship
last-updated: 2026-04-27
---

# Accounting — Page Design Brief

The financial backbone. Must be precise, audit-defensible, and feel
faster than a spreadsheet for 90% of tasks.

## Positioning

Most accounting UIs are journal-shaped: type debits, balance them,
move on. That's necessary but insufficient. The flagship brief here
is **decision-grade visibility** — at a glance you know cash runway,
AR aging, GL anomalies, period-close health. ERPNext drowns the user
in forms; QuickBooks hides the chart of accounts behind plain rows.
We deliver a financial control room with one-click drill all the way
down to a posted entry — and the entry is hash-chain audited so a
regulator can reverify on the spot.

## Page map

| # | Page path | Archetype | Purpose |
|---|---|---|---|
| 1 | `/accounting` | Intelligent Dashboard | "Is the business healthy this period?" |
| 2 | `/accounting/coa` | Tree Explorer | Chart of Accounts |
| 3 | `/accounting/journals` | Smart List | Posted/draft journal entries |
| 4 | `/accounting/journals/:id` | Detail-Rich | Journal entry cockpit |
| 5 | `/accounting/ar` | Intelligent Dashboard | Accounts Receivable — aging, DSO, top debtors |
| 6 | `/accounting/ar/invoices` | Smart List | Invoices |
| 7 | `/accounting/ap` | Intelligent Dashboard | Accounts Payable — aging, DPO, top creditors |
| 8 | `/accounting/ap/bills` | Smart List | Bills |
| 9 | `/accounting/cash` | Intelligent Dashboard | Cashflow + bank reconciliation |
| 10 | `/accounting/reports/pl` | Detail-Rich | P&L (with waterfall) |
| 11 | `/accounting/reports/balance-sheet` | Detail-Rich | Balance sheet |
| 12 | `/accounting/reports/cashflow` | Detail-Rich | Cash flow statement |
| 13 | `/accounting/close` | Workspace Hub | Period close orchestration |
| 14 | `/accounting/tax` | Smart List | Tax filings |
| 15 | `/accounting/anomalies` | Split Inbox | GL anomaly review |

## 1 · `/accounting` — Intelligent Dashboard

**S2 KPIs (6):**
- `Cash on hand` · KpiTile · multi-currency
- `Net cash (period)` · KpiTile · trend
- `Burn / runway` · ForecastTile · `runway_days p10/p50/p90`
- `AR (open)` · KpiTile · drill → `/accounting/ar`
- `AP (due 7d)` · KpiTile · drill → `/accounting/ap?due:7d`
- `GL anomaly score` · AnomalyTile · drill → `/accounting/anomalies`

**S5 main:**
- `Attention Queue`: invoices overdue >30d · bills due in 3d > cash · journals stuck in draft >7d · period-close blockers
- `WaterfallSeries`: P&L bridge period-over-period (Revenue → COGS → Opex → Net)
- `LineSeries`: cash position daily (last 90d, with forecast band)
- `BarSeries` stacked: revenue by segment / cost by category

**S6 rail:**
- Anomalies (top 3): "GL 4100 spike +180% on 2026-04-22 vs trailing 30d", "Unusual vendor: NEW VENDOR, 3 bills/wk"
- Next actions: "Reconcile bank A/c ending 2026-04-30", "Approve 4 bills > $5k", "Run depreciation"
- AI ("explain the cash dip in week 16")

**Filters:** period · entity · currency · cost-center · department.
**Density:** comfortable.

## 2 · `/accounting/coa` — Tree Explorer

Tree of accounts: 1xxx Assets · 2xxx Liabilities · 3xxx Equity · 4xxx Revenue · 5xxx COGS · 6xxx Opex.
**Right pane:** account detail — type, currency, parent, balance (period & lifetime), reconciliation status, last journal touch, where-used.
**Bulk:** add child, archive, merge (with constraints), reorder.
**Inline:** rename, change parent (drag), edit code.
**Effective dates:** account changes get `effective_from` / `effective_to` so prior-period reports remain stable.

## 3 · `/accounting/journals` — Smart List

**Columns:** ☐ · # · Date · Memo · Lines · Total · Status · Created by · Hash ✓
**Saved views:** Posted · Draft · Reversed · My drafts · Last 30d · Anomaly-flagged
**Filters:** date range · status · account · created-by · amount op · has-anomaly · linked-to-entity
**Bulk:** post, reverse, void (with confirm + reason), export
**Inline:** quick-edit memo (compact mode supports inline), expand to view lines

## 4 · `/accounting/journals/:id` — Detail-Rich

**S1:** "JE-2026-0042 · Posted · Hash ✓"
**Tabs:** Lines · Source · Audit · Linked records · Reversals
**Lines tab:** debit/credit grid; running balance; AI flag if unbalanced (impossible after post; only relevant in draft)
**Audit tab:** chain hash + verify button; full event log
**Linked tab:** invoice / bill / payment / customer / vendor (via `record-links-core`)

## 5 · `/accounting/ar` — Intelligent Dashboard

**KPIs:** AR open · DSO (p50) · Avg invoice age · Top-5 debtors total · Bad-debt provisioned · Forecast collection (30d p50)
**Main:**
- `BarSeries` aging buckets (Current · 1–30 · 31–60 · 61–90 · 90+)
- `Heatmap` payment-day-of-week × invoice-age
- Top-10 debtors with mini health score
- Attention queue: overdue >30d, in dispute, bouncing payments
**Rail:** anomalies (sudden customer slowdown), next actions (send reminder batch, escalate), AI ("which 5 customers should I call today?")

## 6 · `/accounting/ar/invoices` — Smart List

**Columns:** ☐ · # · Customer · Issued · Due · Total · Paid · Balance · Status · Owner · Days overdue
**Saved views:** Open · Overdue · Disputed · This month · Top 50 unpaid · By customer
**Filters:** customer, status, due-window, currency, salesperson, age-bucket
**Bulk:** send reminder (compose mass email), apply payment, write-off, export
**Quick-create:** `N` opens a sheet — pick customer → AI prefills line items from last 3 invoices for that customer.

## 7 · `/accounting/ap` — Intelligent Dashboard

Mirror of AR for vendor side.
**KPIs:** AP open · DPO · Bills due 7d · Bills due 30d · Top-5 creditors · Forecast outflow 30d
**Attention queue:** approvals pending, invoices missing PO match, vendor anomalies (price up >15%, new vendor first invoice).

## 8 · `/accounting/ap/bills` — Smart List

**Columns:** ☐ · # · Vendor · Received · Due · Total · Status · Approval · PO match · Owner
**Bulk:** approve, schedule payment, dispute, export.
**Three-way match badge:** PO · receipt · invoice — green when all three match, amber on tolerance, red on mismatch (drill to PO).

## 9 · `/accounting/cash` — Intelligent Dashboard

**KPIs:** Cash by bank · Yesterday net · Forecast 7d / 30d / 90d (p50) · Reconciliation lag (days behind)
**Main:**
- `LineSeries` cash by account
- `BarSeries` weekly inflow/outflow
- Bank-reconciliation panel: imported vs matched vs un-matched count
- Pending matches list with one-click "match" / "create journal"

## 10 · `/accounting/reports/pl` — Detail-Rich

Header period-selector + comparison toggle. Body: sectioned table (Revenue / COGS / Gross / Opex / Operating / Other / Net) with columns per period.
**Top WaterfallSeries** showing the bridge from period A to period B.
**Drill:** click any leaf line → list of contributing journals.
**Export:** PDF, CSV, Excel.

## 11 · `/accounting/reports/balance-sheet`

Standard sections; multi-period side-by-side; ratio strip on top
(current ratio, quick ratio, debt/equity).

## 12 · `/accounting/reports/cashflow`

Operating / Investing / Financing breakdown; reconciliation to net income shown explicitly.

## 13 · `/accounting/close` — Workspace Hub for the period

Each period (e.g. 2026-04) is its own entity.
**S1:** "Close · 2026-04 · in progress · 7 of 12 steps complete"
**Tabs:** Checklist · Reconciliations · Journals · Reports · Sign-off · Audit
**Checklist tab:** ordered tasks (depreciation, accruals, FX revalue, intercompany, etc.) with owner, due, status. Each task linked to the action that completes it.
**Sign-off tab:** approvers, e-sign, frozen-flag (post-freeze, journals require reopen with audit).

## 14 · `/accounting/tax` — Smart List

Filings (VAT/GST/sales) by period. Columns: jurisdiction · period · status · due · amount · filed-on. Bulk: file, print, export. Drill → tax detail with line-by-line traceability.

## 15 · `/accounting/anomalies` — Split Inbox

Stream of GL anomalies (anomaly-detection job runs nightly + on-demand).
**List item:** account · score · period · "explain" snippet
**Preview:** time series of the account, highlighted anomaly windows, contributing journals, AI explanation
**Actions:** mark reviewed, snooze, escalate (creates a ticket via `support-service-core`), create adjusting journal.

## Cross-plugin integrations

- `audit-core` — every entry hash-chained automatically
- `e-invoicing-core` — wires e-invoice send/receive on AR/AP
- `payments-core` — payment receipts feed AR; outflow feeds cashflow
- `treasury-core` — multi-bank cash dashboard pulls from here
- `analytics-bi-core` — P&L, BS, CF feed analytics warehouse
- `automation-core` — recurring journals, depreciation runs, FX revalue
- `workflow-core` — period-close approval workflows
- `notifications-core` — overdue, threshold alerts
- `ai-assist-core` — natural-language queries on books

## Performance budget

Dashboard <1.0s cold; journal Smart List supports 100k entries virtualised; P&L report <1.5s for monthly; close-checklist instant.

## Open questions

- Multi-currency revalue UX: where does the auto-generated FX journal surface? (Proposal: pre-post in `/accounting/close` checklist, link to draft.)
- Journal lock-on-post — current default is "post freezes; reopen requires reason". Confirmed.
- Anomaly false-positive rate target: <8% reviewed-and-dismissed per week. Tune via `ai-evals`.
