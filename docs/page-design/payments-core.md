---
plugin: gutu-plugin-payments-core
design-system: 1.0
tier: standard
last-updated: 2026-04-27
---

# Payments — Page Design Brief

Inbound and outbound payments, gateways, reconciliation.

## Pages

| Path | Archetype | Purpose |
|---|---|---|
| `/payments` | Intelligent Dashboard | Payment health |
| `/payments/transactions` | Smart List | All transactions |
| `/payments/:id` | Detail-Rich | Transaction cockpit |
| `/payments/gateways` | Smart List | Gateway configs |
| `/payments/refunds` | Smart List | Refunds |
| `/payments/disputes` | Split Inbox | Chargebacks |
| `/payments/payouts` | Smart List | Payouts to vendors |
| `/payments/reconciliation` | Detail-Rich | Bank reconciliation |

## Highlights

**Dashboard KPIs:** Inbound (24h) · Outbound (24h) · Avg ticket · Decline rate · Chargeback rate · Pending settlement · Failed (1h).

**Cockpit tabs:** Overview · Customer · Gateway · Webhook events · Refunds · Audit.

**Disputes inbox:** evidence upload, reply submission, AI ("draft response with order context").

## Cross-plugin

- `accounting-core` — receipts + payouts post journals
- `subscriptions-core` — recurring billing
- `audit-core` — every event audited
- `notifications-core` — failure / refund alerts

## Privacy / safety

- Card data tokenised; PAN never stored
- Gateway secrets in vault
- 3DS / SCA flows respected
- Idempotency keys on all writes

## Open

- Multi-gateway routing by cost/region — phase 1 yes.
