---
plugin: gutu-plugin-automation-core
design-system: 1.0
tier: standard
last-updated: 2026-04-27
---

# Automation — Page Design Brief

If-this-then-that for the whole platform. Triggers, conditions, actions, schedules.

## Pages

| Path | Archetype | Purpose |
|---|---|---|
| `/automations` | Smart List | All flows |
| `/automations/:id` | Editor Canvas | Flow builder (visual) |
| `/automations/runs` | Smart List | Recent runs |
| `/automations/runs/:id` | Detail-Rich | Run trace |
| `/automations/templates` | Smart List | Template library |
| `/automations/queues` | Smart List | Pending / scheduled |

## Highlights

**Flow builder:** visual node-edge — Triggers → Conditions → Actions; supports branches, loops (capped), delays, retries, error handlers; live test panel with sample payloads.

**Run trace:** waterfall of nodes; per-node duration, status, output; replay with edits.

**Templates:** pre-built (e.g., "lead created → enrich → assign → email"). Cloneable.

## Cross-plugin

- All plugins — emit triggers via `record-events`
- `workflow-core` — handoff complex approvals
- `audit-core` — every run audited
- `notifications-core` — failure alerts
- `ai-assist-core` — AI nodes for classify / draft

## Open

- Loop bound default 100 iterations (configurable per flow with audit trail).
- Cross-tenant flows — disabled by default.
