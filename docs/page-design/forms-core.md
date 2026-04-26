---
plugin: gutu-plugin-forms-core
design-system: 1.0
tier: standard
last-updated: 2026-04-27
---

# Forms — Page Design Brief

Public forms (lead capture, customer feedback, support intake).

## Pages

| Path | Archetype | Purpose |
|---|---|---|
| `/forms` | Smart List | All forms |
| `/forms/:id` | Editor Canvas | Form builder |
| `/forms/:id/responses` | Smart List | Submissions |
| `/forms/:id/analytics` | Intelligent Dashboard | Drop-off, conversion |
| `/f/:slug` | (External) | The public form |

## Highlights

**Builder:** drag fields; conditional logic; multi-page; payment integration; AI ("build a form for X").

**Analytics:** funnel — view → start → submit; drop-off per step; mobile vs desktop split.

**Anti-spam:** invisible captcha, honeypot, rate limit per IP.

## Cross-plugin

- `crm-core`, `support-service-core` — submissions create records
- `payments-core` — paid forms
- `notifications-core` — confirmations
- `automation-core` — submission triggers
- `audit-core` — submission audited

## Open

- File upload with size cap and content scanning — phase 1.
