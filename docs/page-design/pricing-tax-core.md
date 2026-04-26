---
plugin: gutu-plugin-pricing-tax-core
design-system: 1.0
tier: standard
last-updated: 2026-04-27
---

# Pricing & Tax — Page Design Brief

Pricing engine + tax calculation across geographies.

## Pages

| Path | Archetype | Purpose |
|---|---|---|
| `/pricing` | Smart List | Price books |
| `/pricing/:id` | Detail-Rich | Price book editor |
| `/pricing/promotions` | Smart List | Active promotions |
| `/pricing/tax/jurisdictions` | Smart List | Tax jurisdictions |
| `/pricing/tax/rules` | Smart List | Tax rules |
| `/pricing/test` | Detail-Rich | Pricing playground |

## Highlights

**Playground:** input customer/item/qty/date → engine returns price + breakdown (list, discount, tax) with rule trace.

**Tax rules:** by jurisdiction × product class × customer class; effective dates; reversible audit history.

## Cross-plugin

- `sales-core`, `pos-core`, `e-invoicing-core`, `subscriptions-core` — consumers
- `audit-core` — rule changes audited
- `connections-core` — third-party tax providers (Avalara, etc.)

## Open

- Marketplace tax (e.g., MOSS) — phase 2.
