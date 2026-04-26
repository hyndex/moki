---
plugin: gutu-plugin-maintenance-cmms-core
design-system: 1.0
tier: standard
last-updated: 2026-04-27
---

# Maintenance (CMMS) — Page Design Brief

Computerized maintenance management: assets + work orders + preventive
schedules + spare parts.

## Pages

| Path | Archetype | Purpose |
|---|---|---|
| `/maintenance` | Intelligent Dashboard | Maintenance health |
| `/maintenance/work-orders` | Kanban | WO board |
| `/maintenance/work-orders/:id` | Detail-Rich | Work order cockpit |
| `/maintenance/schedules` | Calendar | Preventive maintenance |
| `/maintenance/assets` | Smart List | Maintained assets |
| `/maintenance/parts` | Smart List | Spares inventory |
| `/maintenance/meters` | Smart List | Meter readings |

## Highlights

**Dashboard KPIs:** Open WOs · Overdue · MTTR · MTBF · PM compliance % · Backlog hours · Cost (period).

**Kanban:** Requested · Scheduled · In progress · On hold · Completed.

**WO cockpit tabs:** Overview · Tasks · Parts · Time · Photos · Audit.

**Schedules:** asset-driven (every X hours / cycles / days); meter-driven (every Y units).

## Cross-plugin

- `assets-core` — asset linkage
- `inventory-core` — parts consumption
- `accounting-core` — maintenance cost
- `field-service-core` — when external techs dispatched
- `notifications-core` — overdue alerts
- `audit-core` — every WO audited

## Open

- Predictive maintenance from sensor data — phase 2 with AI.
