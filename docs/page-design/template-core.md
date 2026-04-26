---
plugin: gutu-plugin-template-core
design-system: 1.0
tier: support
last-updated: 2026-04-27
---

# Template — Page Design Brief

Reusable templates across plugins (emails, docs, dashboards, workflows).

## Pages

| Path | Archetype | Purpose |
|---|---|---|
| `/admin/templates` | Smart List | All templates |
| `/admin/templates/:id` | Editor Canvas | Template editor |
| `/admin/templates/marketplace` | Smart List | Public templates |

## Highlights

**Variable system** with strong typing; preview against fixture; AI ("rewrite", "shorten").

**Versioning** — immutable; promote a version to active.

## Cross-plugin

- All plugins consume templates (notifications, contracts, content, etc.)
- `audit-core` — version promotions audited

## Open

- Cross-tenant marketplace — phase 2.
