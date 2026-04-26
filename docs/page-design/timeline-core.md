---
plugin: gutu-plugin-timeline-core
design-system: 1.0
tier: standard
last-updated: 2026-04-27
---

# Timeline — Page Design Brief

Per-entity activity timeline. Surfaces in `RailActivityTimeline` on every Workspace Hub.

## Pages

This plugin contributes:

- `<RailActivityTimeline>` widget (rail S6)
- `/admin/timeline` — Smart List of registered event types

## Highlights

**Filter** by type (system / user / AI / integration), source plugin, date.

**Live tail** when `record-events` push is active.

## Cross-plugin

- All plugins emit timeline events
- `audit-core` — timeline events linked to audit rows
- `awesome-search-core` — searchable

## Open

- Retention per-tenant — yes; default 1 year, configurable.
