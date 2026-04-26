---
plugin: gutu-plugin-saved-views-core
design-system: 1.0
tier: standard
last-updated: 2026-04-27
---

# Saved Views — Page Design Brief

Per-user / per-team saved filters + view configs across every Smart List.

## Pages

This plugin contributes:

- `<SavedViewSwitcher>` (S3 toolbar widget)
- `/admin/saved-views` — Smart List of all saved views (admin)

## Highlights

**Per-page saved views:** users save current filter+sort+columns+group as a named view; default view per user; share view with team or org (with audit).

**Public/team views:** managed by team admins.

## Cross-plugin

- All plugins with Smart Lists register their schemas
- `audit-core` — view share / unshare audited

## Open

- Versioning of shared views — yes; restore previous.
