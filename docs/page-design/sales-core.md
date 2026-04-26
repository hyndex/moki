---
plugin: gutu-plugin-sales-core
design-system: 1.0
tier: flagship
last-updated: 2026-04-27
---

# Sales — Page Design Brief

The order-to-cash spine. CRM closes deals; sales-core fulfils them.
This is where quotes turn into orders, orders into shipments, shipments
into invoices.

## Positioning

Salesforce CPQ is heavy. ERPNext sales-cycle is form-soup. Twenty
doesn't go this far. We give a flow-shaped surface: every order has
a visible state machine (quoted → confirmed → allocated → picked → shipped
→ invoiced → paid → closed) and the page composition reflects that.

## Page map

| # | Page path | Archetype | Purpose |
|---|---|---|---|
| 1 | `/sales` | Intelligent Dashboard | Order pulse |
| 2 | `/sales/quotes` | Smart List | All quotes |
| 3 | `/sales/quotes/:id` | Detail-Rich | Quote builder |
| 4 | `/sales/orders` | Kanban | Orders by state |
| 5 | `/sales/orders/list` | Smart List | Tabular orders |
| 6 | `/sales/orders/:id` | Detail-Rich | Order cockpit |
| 7 | `/sales/shipments` | Kanban | Picks/packs/ships |
| 8 | `/sales/returns` | Smart List | RMA |
| 9 | `/sales/customers` | Smart List | Customer accounts (sales lens) |
| 10 | `/sales/products` | Smart List | Sellable items |
| 11 | `/sales/price-books` | Smart List | Price book versions |
| 12 | `/sales/promotions` | Smart List | Promotions/coupons |
| 13 | `/sales/forecast` | Detail-Rich | Sales forecast |
| 14 | `/sales/territories` | Map / Geo | Territory map |

## 1 · `/sales` — Intelligent Dashboard

**KPIs (6):** Bookings (period) · Backlog · Avg deal size · Win rate · Time-to-fulfill (p50) · Returns rate
**Main:**
- Attention queue: orders past promised-ship-date, allocations failing, quotes expiring 7d, holds awaiting credit, bookings without owner
- `Funnel`: quote → confirmed → shipped → invoiced (last 90d)
- `LineSeries`: bookings vs target weekly
- `BarSeries`: revenue by product line
- `Heatmap`: bookings by day-of-week × hour
**Rail:** anomalies (e.g., "returns up 18%"), next actions, AI ("which 5 quotes are most likely to close this week?")

## 2 · `/sales/quotes` — Smart List

**Columns:** ☐ · # · Customer · Issued · Valid until · Total · Status · Owner · Probability · Next step
**Saved views:** All open · Expiring 7d · By customer · By owner · High-value (>$10k) · Stalled (no edit 14d)
**Filters:** customer, status, valid window, value range, salesperson, source
**Bulk:** send (compose), revise, expire, convert to order, export
**Quick-create:** `N` opens sheet — pick customer → AI prefills lines from last orders.

## 3 · `/sales/quotes/:id` — Detail-Rich

**S1:** "Q-2026-0042 · Sent · Valid until 2026-05-15"
**Tabs:** Lines · Pricing · Terms · Approvals · Activity · Audit
**Lines tab:** items grid with margin chip; bundle/group support; configurable products with feature options; live re-price on changes; ATP indicator per line; substitutes button when out of stock.
**Pricing tab:** discount levels (percentage/amount) with approval thresholds; bundle pricing; AI ("is this competitive vs last 10 similar quotes?")
**Terms tab:** payment terms, delivery, validity
**Approvals tab:** auto-routed by margin/value rules

## 4 · `/sales/orders` — Kanban

Columns: Confirmed · Allocated · Picked · Packed · Shipped · Invoiced · Closed (collapsed)
Card: # · customer · value · ETA · ageing chip · ATP risk indicator
**Drag rules:** must satisfy workflow + allocation. Move from Confirmed→Allocated triggers allocation job.
**Aging:** card amber when stage age >p75 of historical for that stage.

## 5 · `/sales/orders/list`

Tabular alternative. Columns add: items count · backorder count · paid balance · margin.

## 6 · `/sales/orders/:id` — Detail-Rich

**S1:** "SO-2026-0042 · Allocated · Acme Corp · $12,840 · Promised 2026-05-04"
**S2 KPIs:** Total · Margin · Days-to-ship · Paid balance
**Tabs:** Lines · Allocation · Shipments · Returns · Invoicing · Activity · Audit
**Allocation tab:** per-line ATP, lot/serial picks, alternate suggestion if shortfall.
**Shipments tab:** packed boxes, tracking #s, carrier rates, label printing.
**Invoicing tab:** invoiced lines vs unbilled; one-click create invoice.
**Rail:** customer card, hold flags (credit, compliance), linked records, AI ("explain the margin drop on line 3")

## 7 · `/sales/shipments` — Kanban

Columns: Picking · Packed · Ready to ship · In transit · Delivered · Exception
Card: shipment# · order# · items count · weight · carrier · tracking
**Exception column:** any shipment with carrier exception (delay/damage)
**Carrier rate compare:** on creation, side panel shows live rate quotes from configured carriers.

## 8 · `/sales/returns` — Smart List

Columns: ☐ · RMA# · Customer · Order# · Reason · Items · Refund · Status · Created
Saved views: Open · Awaiting receipt · Inspected · Refunded · Disputed
Bulk: approve, refund, restock, scrap (with `quality-core` if defective)

## 9 · `/sales/customers` — Smart List

Sales-lens view of customer accounts. Columns: name · tier · ARR · open orders · backlog · last order · payment terms · credit limit · credit used.

## 10 · `/sales/products` — Smart List

Sellable items only. Columns add: list price · margin · last sold · top buyers.

## 11 · `/sales/price-books` — Smart List

Versions of price books. Columns: name · effective from/to · currency · # items · status. Click → editor (Detail-Rich) with bulk update + import.

## 12 · `/sales/promotions` — Smart List

Active/expired promotions. Columns: code · type · discount · usage · cap · valid window · status. Bulk: activate, deactivate, clone, export.

## 13 · `/sales/forecast` — Detail-Rich

Per-team/per-product forecast with manager rollup.
**S1:** period selector + variant (commit / best-case / pipe).
**Main:** sortable table — territory · target · committed · best · pipe · gap; with `BarSeries` of attainment by team. Editable: rep enters commit; manager calls.

## 14 · `/sales/territories` — Map / Geo

Choropleth by region with revenue colour. Markers per top-N customer. Layer: rep coverage (geofence). Click cluster → drill list.

## Cross-plugin integrations

- `crm-core` — deal → quote conversion handoff
- `accounting-core` — invoice creation + revenue posting
- `inventory-core` — ATP, allocation, shipment
- `pricing-tax-core` — price calc + tax engine
- `payments-core` — collection
- `procurement-core` — drop-ship to vendor
- `manufacturing-core` — make-to-order routing
- `automation-core` — quote follow-ups, abandoned-cart-style nudges
- `workflow-core` — approval rules
- `ai-assist-core` — close-likelihood scoring, draft reply
- `audit-core` — every state change audited

## Performance budget

Order kanban supports 5k cards/column with virtual scroll; quote builder responsive even at 200 lines.

## Open questions

- Approval routing engine: rule-based vs ML — start rule-based (margin and value thresholds); add ML lift in v2.
- Multi-currency at quote vs order — quote in customer currency, order locks rate at confirmation.
- Returns triggering inventory action: configurable per item — refurbish, resell, scrap, recycle.
