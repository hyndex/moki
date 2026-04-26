---
plugin: gutu-plugin-webhooks-core
design-system: 1.0
tier: standard
last-updated: 2026-04-27
---

# Webhooks — Page Design Brief

Outbound webhook delivery: subscription, retries, signing, audit.

## Pages

| Path | Archetype | Purpose |
|---|---|---|
| `/admin/webhooks` | Intelligent Dashboard | Delivery health |
| `/admin/webhooks/subscriptions` | Smart List | Subscriptions |
| `/admin/webhooks/subscriptions/:id` | Detail-Rich | Subscription cockpit |
| `/admin/webhooks/deliveries` | Smart List | Recent deliveries |
| `/admin/webhooks/deliveries/:id` | Detail-Rich | Delivery trace |
| `/admin/webhooks/replay` | Detail-Rich | Replay session |

## Highlights

**Dashboard KPIs:** Subscriptions · Delivery success % · Avg latency · Retries · Dead letters.

**Cockpit tabs:** Endpoint · Events · Headers · Signing · Recent · Audit.

**Replay:** select past delivery → re-send (idempotent semantic flagged in payload).

## Cross-plugin

- `connections-core` — sister plugin
- `audit-core` — every delivery audited
- `notifications-core` — failures alert subscribers

## Open

- HMAC + per-subscription signing keys — yes; rotated on demand with grace.
