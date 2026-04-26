---
plugin: gutu-plugin-quality-core
design-system: 1.0
tier: standard
last-updated: 2026-04-27
---

# Quality — Page Design Brief

Inspection plans, NCRs, CAPA, supplier quality.

## Pages

| Path | Archetype | Purpose |
|---|---|---|
| `/quality` | Intelligent Dashboard | Quality KPIs |
| `/quality/inspections` | Smart List | Inspections |
| `/quality/inspections/:id` | Detail-Rich | Inspection cockpit |
| `/quality/ncrs` | Kanban | Non-conformances |
| `/quality/capa` | Kanban | Corrective/Preventive actions |
| `/quality/plans` | Smart List | Inspection plans |

## Highlights

**Dashboard KPIs:** First-pass yield · Defect rate (PPM) · Open NCRs · CAPA cycle time · Top defect modes · Supplier scorecard.

**NCR Kanban:** New · Investigating · Containment · Disposition · Closed.

**CAPA:** Plan → Do → Check → Act with owners and due dates.

## Cross-plugin

- `manufacturing-core`, `inventory-core`, `procurement-core` — feed inspections + quarantines
- `audit-core` — every event
- `notifications-core` — escalations

## Open

- Statistical process control charts — phase 1 (X-bar, R, p-chart).
