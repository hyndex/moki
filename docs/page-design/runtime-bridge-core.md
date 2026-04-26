---
plugin: gutu-plugin-runtime-bridge-core
design-system: 1.0
tier: support
last-updated: 2026-04-27
---

# Runtime Bridge — Page Design Brief

Bridges in-process plugin calls to runtime tools (commands, events, jobs, workflows). No user-facing pages.

## Pages

| Path | Archetype | Purpose |
|---|---|---|
| `/admin/runtime` | Intelligent Dashboard | Runtime health |
| `/admin/runtime/commands` | Smart List | Registered commands |
| `/admin/runtime/events` | Smart List | Registered event topics |

## Highlights

**Dashboard KPIs:** Commands invoked · Events emitted · Subscribers · Avg latency.

## Cross-plugin

- All plugins — emit/subscribe via this plugin's runtime
- `audit-core` — runtime calls audited
- `jobs-core` — long-running offload

## Open

- Per-tenant rate limiting on emits — yes.
