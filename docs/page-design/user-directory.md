---
plugin: gutu-plugin-user-directory
design-system: 1.0
tier: standard
last-updated: 2026-04-27
---

# User Directory — Page Design Brief

Internal directory of users (employees, agents, partners) with profiles + search.

## Pages

| Path | Archetype | Purpose |
|---|---|---|
| `/directory` | Smart List | All users |
| `/directory/:id` | Workspace Hub | User profile |
| `/directory/teams` | Tree Explorer | Teams |
| `/directory/groups` | Smart List | Groups |

## Highlights

**Profile tabs:** About · Contact · Skills · Reports to · Direct reports · Calendar · Documents.

**Privacy:** sensitive fields gated by ACL; per-org policies on what's exposed.

## Cross-plugin

- `auth-core` — identity source
- `hr-payroll-core` — extends with employment data
- `audit-core` — profile changes audited
- `awesome-search-core` — searchable

## Open

- Skills-based search ("who knows X") — phase 1 yes; AI-augmented.
