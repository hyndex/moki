---
plugin: gutu-plugin-company-builder-core
design-system: 1.0
tier: standard
last-updated: 2026-04-27
---

# Company Builder — Page Design Brief

Onboarding wizard that sets up a new tenant: industry preset, plugin
selection, brand, sample data, first users.

## Pages

| Path | Archetype | Purpose |
|---|---|---|
| `/onboard` | Editor Canvas (configurator) | Multi-step wizard |
| `/onboard/templates` | Smart List | Industry templates |
| `/onboard/import` | Detail-Rich | Bulk-import wizard |

## Highlights

**Wizard steps:** Industry → Plugins → Brand → Users → Sample data → Done.

**Each step** has its own progress chip, can be skipped (with later prompt), and persists state so resume mid-flow works.

**Industry templates:** SaaS · Manufacturing · Retail · Services · Non-profit · Custom. Each enables a curated plugin set + saved views + sample data.

**Import wizard:** CSV / Sheets / from another platform (CRM/ERP); column mapping; AI auto-suggests mappings; dry-run with diff preview before commit.

## Cross-plugin

- `org-tenant-core` — tenant creation
- `auth-core` — first-admin user
- All plugins — install + seed via lifecycle hooks
- `audit-core` — onboarding audit trail
- `ai-assist-core` — column mapping, smart defaults

## Open

- Resumable across devices — yes; state stored in tenant scratch space.
- Rollback on abandoned onboarding (>30d) — soft delete; recoverable.
