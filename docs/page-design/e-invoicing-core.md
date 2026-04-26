---
plugin: gutu-plugin-e-invoicing-core
design-system: 1.0
tier: standard
last-updated: 2026-04-27
---

# E-Invoicing — Page Design Brief

Statutory e-invoice generation, transmission, and reconciliation
(Peppol, GST, etc.).

## Pages

| Path | Archetype | Purpose |
|---|---|---|
| `/e-invoicing` | Intelligent Dashboard | Submission health |
| `/e-invoicing/outgoing` | Smart List | Sent e-invoices |
| `/e-invoicing/incoming` | Smart List | Received |
| `/e-invoicing/:id` | Detail-Rich | E-invoice cockpit |
| `/e-invoicing/registers` | Smart List | Statutory registers |
| `/e-invoicing/credentials` | Workspace Hub | Provider credentials |

## Highlights

**Dashboard KPIs:** Submitted (period) · Acknowledged % · Rejected · Pending · Avg ack latency · Errors (24h).

**Cockpit tabs:** Document · IRN/QR · Acknowledgement · Audit.

**Registers:** GSTR-style outputs auto-built; export/file via `tax` workflow.

## Cross-plugin

- `accounting-core` — invoice source
- `connections-core` — provider auth (where used)
- `audit-core` — submission audit
- `notifications-core` — rejection alerts

## Open

- Multi-jurisdiction routing — pick provider per (country, document type, customer tax id).
- IRN cache to avoid resubmits.
