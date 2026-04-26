---
plugin: gutu-plugin-jobs-core
design-system: 1.0
tier: standard
last-updated: 2026-04-27
---

# Jobs — Page Design Brief

Background job runner: long-running async tasks, scheduled work,
retries.

## Pages

| Path | Archetype | Purpose |
|---|---|---|
| `/admin/jobs` | Intelligent Dashboard | Job runner health |
| `/admin/jobs/queues` | Smart List | Queues |
| `/admin/jobs/runs` | Smart List | Recent runs |
| `/admin/jobs/runs/:id` | Detail-Rich | Run trace |
| `/admin/jobs/scheduled` | Smart List | Schedules |

## Highlights

**Dashboard KPIs:** Queue depth · Throughput (jobs/min) · Failures (24h) · Retries · Avg duration · Workers active.

**Run trace:** logs, attempts, duration per attempt, output, errors.

## Cross-plugin

- All plugins — enqueue jobs
- `audit-core` — runs audited
- `notifications-core` — failure alerts

## Open

- Per-tenant rate limits — yes; enforced.
- Replay specific job from any past attempt — yes.
