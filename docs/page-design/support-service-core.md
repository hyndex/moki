---
plugin: gutu-plugin-support-service-core
design-system: 1.0
tier: standard
last-updated: 2026-04-27
---

# Support & Service — Page Design Brief

Customer-facing helpdesk: tickets, SLAs, agents.

## Pages

| Path | Archetype | Purpose |
|---|---|---|
| `/support` | Intelligent Dashboard | Service health |
| `/support/queue` | Split Inbox | Agent queue |
| `/support/tickets` | Smart List | All tickets |
| `/support/tickets/:id` | Detail-Rich | Ticket cockpit |
| `/support/sla` | Smart List | SLA policies |
| `/support/macros` | Smart List | Reply templates |
| `/support/agents` | Smart List | Agent roster |

## Highlights

**Dashboard KPIs:** Open · First-response p50 · Resolution p50 · CSAT · SLA compliance · Backlog age · Top reasons.

**Agent queue:** assigned to me / team / unassigned tabs; filters; SLA timer chip per item; preview pane with reply box; macro picker; AI ("draft a reply", "summarise thread").

**Cockpit tabs:** Overview · Customer · History · SLA · Linked records · Audit.

## Cross-plugin

- `crm-core` — customer linkage
- `knowledge-core` — articles in agent reply
- `automation-core` — auto-assign rules
- `notifications-core` — SLA alerts
- `audit-core` — every change

## Open

- Multi-channel ingest (email, chat, in-app, phone) — phase 1 email + chat; phase 2 voice.
