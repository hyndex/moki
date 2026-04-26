---
plugin: gutu-plugin-treasury-core
design-system: 1.0
tier: standard
last-updated: 2026-04-27
---

# Treasury — Page Design Brief

Cash management across multiple banks and entities.

## Pages

| Path | Archetype | Purpose |
|---|---|---|
| `/treasury` | Intelligent Dashboard | Cash overview |
| `/treasury/banks` | Smart List | Bank accounts |
| `/treasury/banks/:id` | Workspace Hub | Bank account 360 |
| `/treasury/cashflow` | Detail-Rich | Cashflow forecast |
| `/treasury/transfers` | Smart List | Inter-account transfers |
| `/treasury/fx` | Smart List | FX positions |
| `/treasury/investments` | Smart List | Short-term investments |

## Highlights

**Dashboard KPIs:** Total cash · By currency · Forecast (7/30/90d p50) · FX exposure · Yield earned · Counterparty concentration.

**Bank account hub:** balance, recent activity, reconciliation lag, open transfers, holds, counterparty risk badge.

**Cashflow forecast:** detail tab with upper/lower bands, scenario toggles (base/best/worst), actions feeding (AR collections, AP schedule, payroll, taxes).

## Cross-plugin

- `accounting-core` — bank reconciliation
- `payments-core` — outflows
- `e-invoicing-core` — inflows
- `org-tenant-core` — multi-entity
- `audit-core` — every transfer

## Open

- Sweep / pooling — phase 2 (intercompany cash pooling).
