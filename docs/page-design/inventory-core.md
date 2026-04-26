---
plugin: gutu-plugin-inventory-core
design-system: 1.0
tier: flagship
last-updated: 2026-04-27
---

# Inventory — Page Design Brief

Stock truth, demand-aware, multi-location, and audit-defensible.
Operators want to know — without scrolling — what's at risk, what's
moving, and what to reorder.

## Positioning

ERPNext gives you forms-per-action. Twenty doesn't have inventory.
We give a stock control room: real-time levels per location, demand
sensing, anomaly alerts, drill from "low-stock SKUs" to a transfer
order in two clicks, and full traceability via the
`traceability-core` plugin so a recall is one filter away.

## Page map

| # | Page path | Archetype | Purpose |
|---|---|---|---|
| 1 | `/inventory` | Intelligent Dashboard | Health + reorder pulse |
| 2 | `/inventory/items` | Smart List | All SKUs with KPIs |
| 3 | `/inventory/items/:id` | Workspace Hub | SKU 360 |
| 4 | `/inventory/stock` | Smart List | Stock by item × location |
| 5 | `/inventory/locations` | Tree Explorer | Warehouse → zone → bin tree |
| 6 | `/inventory/movements` | Timeline / Log | Stock ledger |
| 7 | `/inventory/transfers` | Kanban | Inter-location transfers |
| 8 | `/inventory/cycle-counts` | Smart List | Counts in progress |
| 9 | `/inventory/cycle-counts/:id` | Detail-Rich | Count session |
| 10 | `/inventory/lots` | Smart List | Lot/batch records |
| 11 | `/inventory/serials` | Smart List | Serialised units |
| 12 | `/inventory/reorder` | Intelligent Dashboard | Reorder suggestions |
| 13 | `/inventory/forecast` | Detail-Rich | Demand forecast |
| 14 | `/inventory/abc` | Detail-Rich | ABC/XYZ classification |
| 15 | `/inventory/discrepancies` | Split Inbox | Cycle-count variances |

## 1 · `/inventory` — Intelligent Dashboard

**S2 KPIs (6):**
- `On hand value` · KpiTile · multi-currency
- `Available (on hand − allocated)` · KpiTile
- `Stock-outs (24h)` · AnomalyTile · drill → reorder
- `Reorder due` · KpiTile · drill → reorder dashboard
- `Slow movers (90d)` · KpiTile · drill → ABC analysis
- `Inventory turns (annualised)` · KpiTile

**S5 main:**
- Attention Queue: SKUs at-or-below safety, expiring lots <30d, dead stock >180d, transfers stuck, cycle counts overdue
- `BarSeries` stacked: stock value by location
- `LineSeries`: 30-day movement (in/out/adjust)
- `Heatmap`: SKUs × locations density of stock-outs

**S6 rail:** anomalies (e.g., "SKU-481 movement -37% w/w"); next actions (run reorder, schedule cycle count); AI ("which 10 SKUs should I deprioritise?")

## 2 · `/inventory/items` — Smart List

**Columns:** ☐ · SKU · Name · Category · UoM · Qty on hand · Allocated · Available · Reorder pt · Reorder qty · Avg cost · Last movement · Status
**Saved views:** All · Below safety · No movement 30d · Hazmat · Lot-tracked · Serial-tracked
**Filter chips:** category, supplier, location, abc-class, lifecycle (intro/mature/EOL), serialised, lot-tracked
**Bulk:** update reorder, change category, deactivate, export, generate transfer
**Inline AI:** "/forecast SKU-X over Q3" → modal with forecast

## 3 · `/inventory/items/:id` — Workspace Hub

**S1:** EntityBadge "SKU-481 · Active" · HeaderActions [Adjust · Transfer · Reorder · ⋯]
**S2 KPIs:** On hand · Available · Avg cost · Days of cover · Demand variability (CV)
**Tabs:** Overview · Stock by location · Movements · Suppliers · Lots/serials · Forecast · Files · Audit
**Overview:** photo, descriptors, dimensions/weight, supplier list, BOM where-used (link to manufacturing), price tiers
**Rail:** locations summary (qty per warehouse), recent movements, AI ("when will I run out?")

## 4 · `/inventory/stock` — Smart List

Item × Location grid with stock cells. Filter by location to collapse.
Pivotable: rows=item, columns=location; cell=qty.
**Bulk:** transfer, count, reserve.

## 5 · `/inventory/locations` — Tree Explorer

Warehouse → Zone → Aisle → Rack → Bin.
**Right pane:** location detail — capacity used, items stored, last activity, picker assigned.
**Bulk:** add child, archive (with stock-zero check), reassign items.

## 6 · `/inventory/movements` — Timeline / Log

Append-only stock ledger. Filterable by item, location, type (receipt/ship/transfer/adjust/manufacture-in/manufacture-out), user, date.
Each row: timestamp · type · qty · cost · ref (PO/SO/MO/transfer) · running balance.
**Bulk export** for audit; integration with `audit-core` hash chain.

## 7 · `/inventory/transfers` — Kanban

Columns: Draft · Approved · Picked · In transit · Received · Closed (collapsed).
Card: transfer# · from→to · items count · value · age · ETA.
**Drag rules:** must follow workflow; in-transit→received requires user with receiving permission at destination.
**Aging:** in-transit >X days flags as risk.

## 8 · `/inventory/cycle-counts` — Smart List

**Columns:** ☐ · # · Location · Scope · Created · Due · Status · Counter · Variance qty · Variance value
**Filter:** open, due-window, location, counter.
**Bulk:** assign counter, postpone, close.

## 9 · `/inventory/cycle-counts/:id` — Detail-Rich

**Tabs:** Items · Variances · Notes · Audit
**Items tab:** scan-driven count; large input field; barcode + qty; running progress.
**Mobile-first:** density compact; large tap targets.
**Variance tab:** lists items where counted ≠ system; require reason + approval to commit; on commit creates an adjustment movement.

## 10 · `/inventory/lots` — Smart List

Lot tracking. Columns: lot · item · qty · received · expires · status · supplier.
**Saved views:** Expiring 30d · Quarantined · Recalled · Active.
**Quarantine** action: blocks allocation downstream; wires to `quality-core`.

## 11 · `/inventory/serials` — Smart List

Per-unit tracking. Columns: serial · item · current location · status (in stock / allocated / shipped / returned) · linked sales order · warranty expires.
**Filter:** customer, status, warranty window.

## 12 · `/inventory/reorder` — Intelligent Dashboard

**KPIs:** SKUs needing reorder · Total reorder value · Avg lead time · Reorder coverage (post-order days of supply)
**Main:**
- Reorder suggestions table — sortable by urgency (days until stock-out p50)
- Bulk-create POs from selected suggestions (forwards to `procurement-core`)
- `Funnel`: suggested → approved → ordered → received

## 13 · `/inventory/forecast` — Detail-Rich

Item picker; view forecast curve with p10/p50/p90 bands; historical actual overlay; events (promotions, holidays) annotated. Editable: human override per period (with reason).

## 14 · `/inventory/abc` — Detail-Rich

ABC × XYZ classification grid with item counts per cell. Click cell → SKU list. Refresh schedule visible (default monthly, configurable). Used to prioritise cycle counts and forecasting effort.

## 15 · `/inventory/discrepancies` — Split Inbox

Stream of variance findings from cycle counts.
List item: count# · item · variance · ageing.
Preview: full variance with cost impact + AI-suggested cause (shrink/transfer-not-recorded/data-entry).
Actions: approve adjustment, escalate, dispute (sends back to counter with note).

## Cross-plugin integrations

- `manufacturing-core` — BOM consumption / production receipt
- `procurement-core` — POs from reorder
- `sales-core` — allocations, ATP queries
- `traceability-core` — lot/serial fan-out for recalls
- `quality-core` — quarantines + holds
- `accounting-core` — cost layers, COGS posting on shipment
- `analytics-bi-core` — feed inventory warehouse
- `notifications-core` — stock-out, expiry, variance alerts
- `automation-core` — scheduled cycle counts
- `audit-core` — every adjustment auto-audited

## Performance budget

100k SKUs in Smart List virtualised; tree to 6 levels deep responsive; reorder dashboard refresh <2s.

## Open questions

- Forecast model: ensemble (Holt-Winters + Croston + ML) — owner of model lives in `ai-core`.
- Negative stock policy per tenant: default "warn"; tenants can switch to "block" or "allow" (e.g., service warehouses).
- Cycle-count fairness: counter assignment — balanced or random? (Proposal: balanced load + occasional random injection.)
