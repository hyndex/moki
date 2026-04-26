---
plugin: gutu-plugin-assets-core
design-system: 1.0
tier: standard
last-updated: 2026-04-27
---

# Assets — Page Design Brief

Fixed-asset and equipment register. The "things you own" plugin.

## Pages

| Path | Archetype | Purpose |
|---|---|---|
| `/assets` | Intelligent Dashboard | Asset health |
| `/assets/list` | Smart List | All assets |
| `/assets/:id` | Workspace Hub | Asset 360 |
| `/assets/categories` | Tree Explorer | Asset hierarchy |
| `/assets/depreciation` | Smart List | Depreciation runs |
| `/assets/locations` | Map / Geo | Where assets are |
| `/assets/movements` | Timeline / Log | Movement / custody changes |

## Highlights

**Dashboard KPIs:** Assets count · Total NBV · Depreciation YTD · Custody changes (30d) · Out-of-service count · Maintenance overdue (handover to cmms).

**Asset hub tabs:** Overview · Specs · Depreciation · Maintenance · Custody · Audit.

**Asset card:** photo, current custodian, location, NBV, expected disposal.

## Cross-plugin

- `accounting-core` — depreciation journals
- `maintenance-cmms-core` — maintenance schedule + tickets
- `traceability-core` — asset history
- `inventory-core` — when an asset is also stocked
- `audit-core` — every move audited

## Open

- Disposal workflow integration with accounting (gain/loss) — phase 1 yes.
- IoT integration for live custody/location — via `connections-core` + provider plugins.
