---
plugin: gutu-plugin-record-links-core
design-system: 1.0
tier: standard
last-updated: 2026-04-27
---

# Record Links — Page Design Brief

Cross-entity linking ("this invoice is linked to deal Q3 and customer Acme").

## Pages

This plugin contributes:

- `<RailRelatedEntities>` widget (used on every Workspace Hub / Detail-Rich)
- `/admin/record-links` — Smart List of link types (admin)

## Highlights

**RailRelatedEntities:** lists related items grouped by type with counts; click → navigate; quick "+ link" action.

**Link types** are typed (e.g., `invoice → customer`, `deal → contract`). Plugins register types.

## Cross-plugin

- All plugins — register link types
- `audit-core` — link create/delete audited
- `awesome-search-core` — links surface in search context

## Open

- Bidirectional links auto-mirrored — yes.
