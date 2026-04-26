---
plugin: gutu-plugin-connections-core
design-system: 1.0
tier: standard
last-updated: 2026-04-27
---

# Connections — Page Design Brief

External integrations (Slack, GSuite, MS365, Stripe, Shopify, GitHub, Salesforce…).

## Pages

| Path | Archetype | Purpose |
|---|---|---|
| `/connections` | Intelligent Dashboard | Health + auth status |
| `/connections/library` | Smart List | Available connectors |
| `/connections/:id` | Detail-Rich | Connector cockpit |
| `/connections/oauth/callback/:id` | (transient) | OAuth landing |

## Highlights

**Dashboard KPIs:** Connected providers · Failed auth · Sync lag · API quota used (per provider) · Webhook errors (24h).

**Connector cockpit tabs:** Overview · Auth · Sync schedule · Field mapping · Logs · Audit.

**Library:** searchable; provider cards; "Install" → OAuth flow.

## Cross-plugin

- `webhooks-core` — outbound deliveries via this plugin's providers
- `audit-core` — auth + config changes audited
- `notifications-core` — sync failures
- `ai-assist-core` — auto-suggest field mapping

## Privacy

- OAuth tokens stored in encrypted vault, never echoed
- Per-tenant token isolation
- Disconnect always revokes upstream

## Open

- MCP servers as connectors — handled via `ai-mcp` plugin; this plugin is for non-AI integrations.
- Rate-limit-aware sync — built-in: backoff with jitter on 429.
