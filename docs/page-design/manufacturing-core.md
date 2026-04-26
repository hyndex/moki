---
plugin: gutu-plugin-manufacturing-core
design-system: 1.0
tier: standard
last-updated: 2026-04-27
---

# Manufacturing — Page Design Brief

BOM + work orders + routings + production tracking.

## Pages

| Path | Archetype | Purpose |
|---|---|---|
| `/manufacturing` | Intelligent Dashboard | Production health |
| `/manufacturing/orders` | Kanban | Work orders |
| `/manufacturing/orders/:id` | Detail-Rich | Work order cockpit |
| `/manufacturing/bom` | Smart List | BOM list |
| `/manufacturing/bom/:id` | Tree Explorer | BOM structure |
| `/manufacturing/routings` | Smart List | Routings |
| `/manufacturing/work-centers` | Calendar / Schedule | Capacity |
| `/manufacturing/quality` | Split Inbox | QC events |
| `/manufacturing/mrp` | Detail-Rich | MRP run |

## Highlights

**Dashboard KPIs:** Open WOs · Throughput (units/day) · OEE · Scrap rate · On-time completion · Capacity util.

**Kanban:** Released · In progress · QC · Done · Held.

**Cockpit tabs:** Overview · Components · Operations · Time / Labor · QC · Scrap · Audit.

**MRP run:** input demand → suggested production + procurement; preview; commit creates WOs and POs.

## Cross-plugin

- `inventory-core` — components / FG
- `quality-core` — inspections, NCRs
- `procurement-core` — purchase suggestions
- `accounting-core` — WIP / cost variance
- `traceability-core` — lot/serial through BOM
- `audit-core` — every WO event

## Open

- Shop floor terminal UI — phase 1 (compact density, large tap targets).
