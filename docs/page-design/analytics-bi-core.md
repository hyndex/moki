---
plugin: gutu-plugin-analytics-bi-core
design-system: 1.0
tier: standard
last-updated: 2026-04-27
---

# Analytics & BI — Page Design Brief

Cross-plugin analytics warehouse and SQL workbench. Heavier than
`dashboard-core` — for analysts, not end users.

## Pages

| Path | Archetype | Purpose |
|---|---|---|
| `/analytics` | Intelligent Dashboard | Org-wide analytics overview |
| `/analytics/explore` | Editor Canvas | SQL workbench |
| `/analytics/models` | Smart List | dbt-style models |
| `/analytics/models/:id` | Detail-Rich | Model cockpit |
| `/analytics/cohorts` | Smart List | Saved cohorts |
| `/analytics/jobs` | Smart List | Scheduled queries |
| `/analytics/lineage` | Graph / Network | Data lineage |

## Highlights

**`/analytics/explore`** — SQL editor with autocomplete from registered tables; result grid with one-click chart-it; save as model or as tile.

**Lineage graph:** sources → models → tiles. Click a node to see consumers / inputs.

**Models cockpit:** SQL · schema · tests (column-level) · runs · subscribers (tiles, alerts, exports).

## Cross-plugin

- All plugins — analytics consumes their data via the `query` library
- `dashboard-core` — produces tiles
- `notifications-core` — subscription delivery
- `audit-core` — query log
- `field-metadata-core` — column-level access policy

## Open

- Federated query across multiple tenants (for super-admin) — disabled by default; enable via SUPER role.
- Materialised refresh schedule — configurable per model.
