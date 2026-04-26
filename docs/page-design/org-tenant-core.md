---
plugin: gutu-plugin-org-tenant-core
design-system: 1.0
tier: standard
last-updated: 2026-04-27
---

# Org & Tenant — Page Design Brief

Multi-entity org structure: tenants, business units, divisions, branches.

## Pages

| Path | Archetype | Purpose |
|---|---|---|
| `/admin/org` | Tree Explorer | Org tree |
| `/admin/org/:id` | Workspace Hub | Entity 360 |
| `/admin/org/intercompany` | Smart List | Intercompany rules |

## Highlights

**Tree:** parent → children with type chip (HQ, BU, branch, JV); right pane: entity detail (legal, address, currency, tax id, books).

**Hub tabs:** Overview · Settings · Books · Users · Plugins · Audit.

**Intercompany:** mapping rules (IC sales, transfers, eliminations); auto-journals on transactions.

## Cross-plugin

- `accounting-core` — multi-entity ledgers
- `auth-core` — per-entity user scope
- `audit-core` — entity changes audited
- `treasury-core` — multi-entity cash

## Open

- Cross-entity consolidation reports — phase 1 yes (analytics-bi-core).
