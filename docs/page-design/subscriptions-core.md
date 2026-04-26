---
plugin: gutu-plugin-subscriptions-core
design-system: 1.0
tier: standard
last-updated: 2026-04-27
---

# Subscriptions — Page Design Brief

Recurring billing and lifecycle management.

## Pages

| Path | Archetype | Purpose |
|---|---|---|
| `/subscriptions` | Intelligent Dashboard | MRR / churn |
| `/subscriptions/list` | Smart List | All subs |
| `/subscriptions/:id` | Detail-Rich | Subscription cockpit |
| `/subscriptions/plans` | Smart List | Plans |
| `/subscriptions/coupons` | Smart List | Coupons |
| `/subscriptions/dunning` | Split Inbox | Failed payments |

## Highlights

**Dashboard KPIs:** MRR · Net new MRR · Gross churn · Net churn · LTV · ARPU · Active subs · Failed payments (24h).

**Cockpit tabs:** Overview · Customer · Lines · Invoices · Payments · Audit.

**Dunning:** failed payment with attempt history; AI ("draft customer email"); retry / cancel / pause / convert to PAYG.

## Cross-plugin

- `payments-core` — collection
- `accounting-core` — revenue recognition (deferred / earned)
- `crm-core` — link customer
- `audit-core` — changes audited
- `notifications-core` — renewal / dunning notices

## Open

- Mid-cycle changes proration — yes; configurable per plan.
