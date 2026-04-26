---
plugin: gutu-plugin-business-portals-core
design-system: 1.0
tier: standard
last-updated: 2026-04-27
---

# Business Portals — Page Design Brief

White-label portals for partners, vendors, customers (read-only or
limited-write windows into your data).

## Pages

| Path | Archetype | Purpose |
|---|---|---|
| `/portals` | Smart List | All portals |
| `/portals/:id` | Workspace Hub | Portal cockpit |
| `/portals/:id/branding` | Editor Canvas | Brand settings |
| `/portals/:id/audience` | Smart List | Allowed users / partners |
| `/portals/:id/pages` | Smart List | Composed pages |
| `/p/:slug` | (External) | The portal itself |

## Highlights

**Cockpit tabs:** Overview · Pages · Audience · Branding · Domains · Audit · Analytics.

**Pages:** composed via `dashboard-core` and `page-builder-core`; ACL strict — only registered audience sees data scoped to them.

**Branding:** logo, colours, custom domain, email template.

**Analytics:** views, unique users, conversion (if forms or payments embedded).

## Cross-plugin

- `dashboard-core` — embed dashboards
- `page-builder-core` — page composition
- `auth-core` — portal login (per-portal SSO)
- `audit-core` — every access audited
- `notifications-core` — portal email branding

## Open

- Per-portal data isolation — enforced via tenant + audience ACL combination.
- Custom domain SSL — automated via integration with provider plugin.
