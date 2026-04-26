---
plugin: gutu-plugin-procurement-core
design-system: 1.0
tier: standard
last-updated: 2026-04-27
---

# Procurement — Page Design Brief

Purchase requests → POs → receipts → vendor invoicing.

## Pages

| Path | Archetype | Purpose |
|---|---|---|
| `/procurement` | Intelligent Dashboard | Spend health |
| `/procurement/requests` | Smart List | Purchase requests |
| `/procurement/requests/:id` | Detail-Rich | PR cockpit |
| `/procurement/orders` | Kanban | POs by stage |
| `/procurement/orders/:id` | Detail-Rich | PO cockpit |
| `/procurement/receipts` | Smart List | GR/SR |
| `/procurement/vendors` | Smart List | Vendors |
| `/procurement/vendors/:id` | Workspace Hub | Vendor 360 |
| `/procurement/rfq` | Workspace Hub | RFQ workspace |

## Highlights

**Dashboard KPIs:** Spend (period) · Open POs · On-time delivery % · Three-way-match rate · Top vendors · Price variance %.

**Kanban:** Draft · Approved · Sent · Acknowledged · Partial · Received · Closed.

**RFQ workspace:** invite vendors, evaluation matrix (price/lead/quality), decision audit.

## Cross-plugin

- `inventory-core`, `accounting-core` (3-way match) — primary integrations
- `payments-core` — vendor payouts
- `quality-core` — inspection at GR
- `audit-core` — every change

## Open

- Punchout catalogs from vendors — phase 2.
