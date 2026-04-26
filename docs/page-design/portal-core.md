---
plugin: gutu-plugin-portal-core
design-system: 1.0
tier: standard
last-updated: 2026-04-27
---

# Portal — Page Design Brief

Customer / partner portal runtime (companion to `business-portals-core`).

## Pages

| Path | Archetype | Purpose |
|---|---|---|
| `/admin/portal` | Workspace Hub | Portal config |
| `/admin/portal/messages` | Smart List | Customer messages |
| `/admin/portal/embedded` | Smart List | Embedded widgets |

## Highlights

**Config tabs:** Branding · Domain · Login · Pages · Widgets · Audit.

**Embedded widgets:** generated for embed in customer's own site (chat, status, balance, etc.).

## Cross-plugin

- `business-portals-core` — orchestration
- `auth-core` — portal login
- `audit-core` — access audited

## Open

- Embed iframe vs JS SDK — both supported.
