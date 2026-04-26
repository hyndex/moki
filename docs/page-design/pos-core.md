---
plugin: gutu-plugin-pos-core
design-system: 1.0
tier: standard
last-updated: 2026-04-27
---

# Point of Sale — Page Design Brief

Retail point-of-sale (touch terminal + back-office).

## Pages

| Path | Archetype | Purpose |
|---|---|---|
| `/pos` | Editor Canvas (full-bleed, terminal) | Sale screen |
| `/pos/end-of-day` | Detail-Rich | Z-report / shift close |
| `/pos/sessions` | Smart List | Sessions |
| `/pos/registers` | Smart List | Registers |
| `/pos/discounts` | Smart List | Discount rules |
| `/pos/back-office` | Intelligent Dashboard | Daily revenue |

## Highlights

**Sale screen:** density `compact`; large product grid + scan input; cart at right; pay panel; offline-capable (queues sales while offline).

**End-of-day:** declared cash vs expected; variance; locked once submitted with audit.

**Back office KPIs:** Sales (today/MTD) · Avg basket · Top items · Refunds rate · Cash vs card mix.

## Cross-plugin

- `inventory-core` — stock decrement
- `accounting-core` — sales journal
- `payments-core` — card / digital
- `audit-core` — every line audited
- `notifications-core` — daily summary

## Open

- Offline mode merge conflict — last-writer-wins for inventory; AR conflict requires review.
