---
plugin: gutu-plugin-dashboard-core
design-system: 1.0
tier: flagship
last-updated: 2026-04-27
---

# Dashboard — Page Design Brief

The cross-plugin dashboard builder. Every other plugin ships its
own canonical Intelligent Dashboard; this plugin lets users
compose **bespoke** dashboards across data from many plugins.

## Positioning

Lightdash and Looker are great BI but live outside the app. Twenty
has no dashboard. ERPNext has report builder but no real dashboard
composition. We give a tile-grid composer that uses widgets from
the design system catalog (see `PAGE-DESIGN-SYSTEM.md` §3),
reads from any plugin's data via the standard query layer, and
respects ACL automatically.

## Page map

| # | Page path | Archetype | Purpose |
|---|---|---|---|
| 1 | `/dashboards` | Smart List | All dashboards |
| 2 | `/dashboards/:id` | Detail-Rich | Read a dashboard |
| 3 | `/dashboards/:id/edit` | Editor Canvas | Compose / edit |
| 4 | `/dashboards/library` | Smart List | Public / template gallery |
| 5 | `/dashboards/embeds` | Smart List | Embed tokens |
| 6 | `/dashboards/datasources` | Smart List | Registered data sources |

## 1 · `/dashboards` — Smart List

**Columns:** ☐ · Name · Owner · Visibility · Last viewed · Tiles · Updated · Refresh
**Saved views:** Mine · Shared with me · Pinned · Templates · Recently viewed
**Filters:** owner, tag, plugin used, audience, refresh-cadence
**Bulk:** duplicate, archive, change visibility.

## 2 · `/dashboards/:id` — Detail-Rich (read mode)

**S1:** Dashboard name · period selector · variant selector · audience badge · HeaderActions [Edit · Share · Export · ⋯]
**S2 (optional):** if creator marked tiles "hero", they render as KpiTile strip
**S5 main:** the tile grid, fully composed by the creator
**S6 rail (optional):** any creator-defined notes / glossary
**Filters bar (S3):** dashboard-level filters that cascade to all tiles (e.g., team, region, period)

**Read mode:**
- All tiles render concurrently with their own loading/error/empty states.
- Click a chart point → drill to source plugin's Smart List with corresponding filter applied.
- Click a KPI → drill to source plugin's filtered list.

## 3 · `/dashboards/:id/edit` — Editor Canvas

The composer. Full-bleed.

**Layout:**
- Top bar: name · save · undo/redo · period · variant · audience · share
- Left rail: widget catalog (search + drag) — every widget from the design system
- Centre: 12-column responsive grid; drag to add, resize, snap, duplicate, delete
- Right rail: selected-tile inspector (data source, filter, viz, formatting)

**Widget configuration (right rail):**
- Source: pick plugin → pick entity → pick query (or write SQL via `query` library if user has the role)
- Aggregation: sum/avg/count/min/max/p50/p90 etc.
- Group by / time bucket
- Compare: previous period / target / segment
- Format: currency, percent, number, locale
- Drill: pick destination plugin path

**Pre-built tiles:** every Tier-1 plugin ships 3–5 ready-to-add tiles (e.g., from accounting: "AR aging", "Cash 30d", "GL anomalies"). Drop on canvas → already wired.

**AI assist:** "/-build a dashboard for sales operations" → AI proposes a layout (8 tiles), user accepts/edits.

**Validation:**
- Tile errors highlight inline; saving with errors blocked
- Permissions: tile-level ACL — viewer's role determines which tiles render (others render as "Hidden by ACL" placeholder)

## 4 · `/dashboards/library`

Curated gallery — official templates per industry / role (e.g., "CFO weekly", "Sales VP daily", "Operations live"). Click → "Use template" copies into your space. Filter by industry, role, plugin set.

## 5 · `/dashboards/embeds`

Tokens to embed dashboards in external surfaces (intranet, customer portal). Columns: Name · Dashboard · Audience · Created · Last hit · Status. Bulk: revoke, rotate.
**Audience scoping:** every embed has an audience predicate (e.g., `tenant_id` and `role`) baked in; ACL still enforced server-side.

## 6 · `/dashboards/datasources`

Registered data sources beyond plugin-native data: external BI warehouses, GSheets, REST APIs. Each row: name · type · connection status · last sync · refresh cadence · linked tiles count.

## Cross-plugin integrations

- Every plugin — exposes its query schemas to the composer
- `analytics-bi-core` — provides extended analytics primitives
- `query` library — standard query DSL the composer uses
- `audit-core` — share/embed/edit events audited
- `notifications-core` — scheduled snapshot delivery (PDF/PNG/CSV)
- `automation-core` — refresh schedules
- `ai-assist-core` — "build a dashboard for X" co-author

## Performance budget

Read mode: each tile loads independently; first KPI <400ms cached. Editor: drag/resize <16ms; preview re-renders incrementally.

## Open questions

- SQL access: who can write raw SQL? (Default: only `analytics.editor` role.)
- Cross-tenant dashboard sharing — phase 2; phase 1 is per-tenant.
- Real-time mode: tiles can subscribe to record events for live updates — opt-in per tile to avoid load.
