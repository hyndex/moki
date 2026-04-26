---
plugin: gutu-plugin-search-core
design-system: 1.0
tier: standard
last-updated: 2026-04-27
---

# Search — Page Design Brief

Indexing + retrieval primitives under `awesome-search-core`. Mostly admin-facing.

## Pages

| Path | Archetype | Purpose |
|---|---|---|
| `/admin/search` | Intelligent Dashboard | Index health |
| `/admin/search/indexes` | Smart List | Indexes |
| `/admin/search/queries` | Timeline / Log | Query log |
| `/admin/search/synonyms` | Smart List | Synonyms |

## Highlights

**Dashboard KPIs:** Index size · Doc count · Indexer lag · Query rate · p95 latency · Hit rate.

## Cross-plugin

- `awesome-search-core` — primary consumer
- `audit-core` — synonym / config changes audited

## Open

- Lucene vs vector default — phase 1 hybrid.
