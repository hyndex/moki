---
plugin: gutu-plugin-projects-core
design-system: 1.0
tier: standard
last-updated: 2026-04-27
---

# Projects — Page Design Brief

Project + task + milestone tracking with budget and time.

## Pages

| Path | Archetype | Purpose |
|---|---|---|
| `/projects` | Intelligent Dashboard | Portfolio health |
| `/projects/list` | Smart List | All projects |
| `/projects/:id` | Workspace Hub | Project 360 |
| `/projects/:id/tasks` | Kanban | Task board |
| `/projects/:id/gantt` | Calendar / Schedule (timeline) | Gantt |
| `/projects/:id/budget` | Detail-Rich | Budget cockpit |
| `/projects/timesheets` | Smart List | Time entries |

## Highlights

**Dashboard KPIs:** Projects active · % on-time · Budget burn · Capacity util · Late tasks · Open risks.

**Hub tabs:** Overview · Tasks · Gantt · Budget · Time · Files · Audit.

**Gantt:** dependencies, critical path highlight, drag-resize, baselines.

## Cross-plugin

- `hr-payroll-core` — labour cost
- `accounting-core` — billable + WIP
- `crm-core` — client linkage
- `notifications-core` — milestone alerts
- `audit-core`

## Open

- Resource leveling — phase 2.
- Earned-value reporting — phase 2.
