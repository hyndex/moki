---
plugin: gutu-plugin-page-builder-core
design-system: 1.0
tier: standard
last-updated: 2026-04-27
---

# Page Builder — Page Design Brief

Composable page builder for portals, internal landing pages, custom dashboards beyond `dashboard-core`.

## Pages

| Path | Archetype | Purpose |
|---|---|---|
| `/pages-builder` | Smart List | Built pages |
| `/pages-builder/:id` | Editor Canvas | Page editor |

## Highlights

**Editor:** block-based (hero, columns, gallery, form, embed, dashboard tile, record list); responsive preview (desktop / tablet / mobile); brand tokens auto-applied; AI ("write a hero for X").

**Publishing:** draft → review → published (versioned).

## Cross-plugin

- `business-portals-core` — primary consumer
- `content-core` — asset reuse
- `dashboard-core` — embed tiles
- `audit-core` — publishes audited

## Open

- Per-section ACL — yes (audience predicate per block).
