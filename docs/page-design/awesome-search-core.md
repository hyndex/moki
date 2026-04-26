---
plugin: gutu-plugin-awesome-search-core
design-system: 1.0
tier: standard
last-updated: 2026-04-27
---

# Awesome Search — Page Design Brief

Global search across every plugin's data. Powered by registered schemas.

## Pages

| Path | Archetype | Purpose |
|---|---|---|
| `/search` | Smart List | Full search results |
| Cmd-K palette | overlay | Quick search (no page) |

## Highlights

**`/search` layout:** S1 query input (sticky), S3 filter chips (entity type, plugin, owner, date), S5 grouped results (one section per entity type), facets panel in S6 rail.

**Result row:** title · snippet (highlighted) · entity-type chip · last-touched · owner · 3 inline quick-actions (open / copy link / star).

**Cmd-K palette (overlay, owned by shell):** instant fuzzy + semantic results across types; arrows + Enter; keyboard-only.

**Saved searches** + **share link**.

## Cross-plugin

- Every plugin registers a search schema with this plugin
- `ai-assist-core` — semantic ranking
- `audit-core` — query log

## Open

- Index refresh: near-real-time via record-events; full reindex nightly.
- Per-tenant index isolation — strict.
