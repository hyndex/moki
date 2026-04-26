---
plugin: gutu-plugin-integration-core
design-system: 1.0
tier: standard
last-updated: 2026-04-27
---

# Integration — Page Design Brief

Generic integration runtime (companion to `connections-core` and
`webhooks-core`): handles inbound/outbound queues, retries, dead-
letters, replay.

## Pages

| Path | Archetype | Purpose |
|---|---|---|
| `/integrations` | Intelligent Dashboard | Throughput + errors |
| `/integrations/queues` | Smart List | Live queues |
| `/integrations/dead-letter` | Split Inbox | Failed messages |
| `/integrations/replay` | Detail-Rich | Replay session |

## Highlights

**Dashboard KPIs:** Inbound (24h) · Outbound (24h) · Backlog · Avg latency · Errors · Dead letters · Retries.

**DLQ inbox:** filter by source/error/age; per-message inspect + replay.

## Cross-plugin

- `connections-core`, `webhooks-core` — feed this plugin
- `notifications-core` — DLQ alerts
- `audit-core` — replays audited

## Open

- Replay safety: dry-run preview by default; confirm to commit.
