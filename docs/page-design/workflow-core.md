---
plugin: gutu-plugin-workflow-core
design-system: 1.0
tier: standard
last-updated: 2026-04-27
---

# Workflow — Page Design Brief

Approval workflows, state machines, multi-step business processes.

## Pages

| Path | Archetype | Purpose |
|---|---|---|
| `/workflows` | Smart List | Workflow definitions |
| `/workflows/:id` | Editor Canvas | Designer |
| `/workflows/runs` | Smart List | Recent runs |
| `/workflows/runs/:id` | Detail-Rich | Run trace |
| `/workflows/inbox` | Split Inbox | My approvals |

## Highlights

**Designer:** state machine canvas — states (rounded boxes) and transitions (arrows with guards/actions). Side panel: edit state details (name, who-can-be-here, timeout, on-enter/on-exit hooks).

**My approvals inbox:** tasks awaiting current user; preview shows context; bulk approve/reject.

## Cross-plugin

- All plugins — register workflow definitions; can attach to any state transition
- `automation-core` — actions on transitions
- `audit-core` — every transition audited
- `notifications-core` — approval requests delivered

## Open

- Parallel branches with join — yes.
- Long-running with timeouts (escalation) — yes.
