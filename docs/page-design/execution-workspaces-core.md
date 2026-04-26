---
plugin: gutu-plugin-execution-workspaces-core
design-system: 1.0
tier: standard
last-updated: 2026-04-27
---

# Execution Workspaces — Page Design Brief

Per-team execution surface: scratchpads + queues + standups + OKRs in one place.

## Pages

| Path | Archetype | Purpose |
|---|---|---|
| `/workspaces` | Smart List | Team workspaces |
| `/workspaces/:id` | Workspace Hub | Team home |
| `/workspaces/:id/queue` | Kanban | Today's queue |
| `/workspaces/:id/standup` | Detail-Rich | Standup ritual |
| `/workspaces/:id/objectives` | Tree Explorer | OKRs / goals |

## Highlights

**Team home tabs:** Today · Queue · Standup · OKRs · Calendar · Files · Audit.

**Queue Kanban:** Today · This week · Backlog · Blocked · Done. Card pulls from issues, deals, tickets, mentions, AI suggestions.

**Standup:** yesterday/today/blockers per member; AI summary; integrates with `notifications-core` to push to Slack/etc.

**OKRs tree:** company → team → individual; check-in cadence; AI nudges.

## Cross-plugin

- `crm-core`, `support-service-core`, `issues-core`, `projects-core` — feed the queue
- `notifications-core` — standup digest delivery
- `audit-core` — check-ins audited
- `ai-assist-core` — summary, suggested next

## Open

- Cross-team queue federation — phase 2.
