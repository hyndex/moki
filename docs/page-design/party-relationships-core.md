---
plugin: gutu-plugin-party-relationships-core
design-system: 1.0
tier: standard
last-updated: 2026-04-27
---

# Party Relationships — Page Design Brief

Generic "party" base type (person, org, role) and relationships (employee-of, owns, manages).

## Pages

| Path | Archetype | Purpose |
|---|---|---|
| `/parties` | Smart List | All parties |
| `/parties/:id` | Workspace Hub | Party 360 |
| `/parties/relationships` | Graph / Network | Relations explorer |

## Highlights

Parties power CRM, HR, Vendors, Suppliers — all consume this.

**Hub tabs:** Overview · Roles · Relationships · Documents · Audit.

**Relations graph:** nodes = parties, edges = typed relations (employs, owns, supplies).

## Cross-plugin

- `crm-core`, `hr-payroll-core`, `procurement-core` — extend party types
- `audit-core` — relation changes audited

## Open

- Merge of duplicate parties — confidence-based; review queue.
