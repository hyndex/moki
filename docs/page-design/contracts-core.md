---
plugin: gutu-plugin-contracts-core
design-system: 1.0
tier: standard
last-updated: 2026-04-27
---

# Contracts — Page Design Brief

Contract lifecycle management: drafting, review, signing, renewal.

## Pages

| Path | Archetype | Purpose |
|---|---|---|
| `/contracts` | Intelligent Dashboard | Contract pulse |
| `/contracts/list` | Smart List | All contracts |
| `/contracts/:id` | Detail-Rich | Contract cockpit |
| `/contracts/templates` | Smart List | Reusable templates |
| `/contracts/clauses` | Smart List | Approved clause library |
| `/contracts/renewals` | Kanban | Upcoming renewals |

## Highlights

**Dashboard KPIs:** Active · Expiring 30d · TCV · ARR · Avg cycle time · Stuck in review · Renewal pipeline.

**Cockpit tabs:** Document · Parties · Obligations · Milestones · Approvals · Signatures · Audit.

**Document tab:** redline editor with clause-aware AI suggestions; track changes; comments.

**Renewals Kanban:** New · Negotiating · Signed · Auto-renewing · At risk · Lost.

## Cross-plugin

- `crm-core` — link customer / vendor
- `accounting-core` — billing terms
- `audit-core` — every redline + signature audited
- `ai-assist-core` — clause comparison, risk extraction
- `notifications-core` — renewal reminders

## Open

- E-sign provider — phase 1 native (PDF + cryptographic signature) + integration with DocuSign via `connections-core`.
- AI clause-risk score — phase 1 (low/med/high with explanation).
