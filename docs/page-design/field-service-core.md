---
plugin: gutu-plugin-field-service-core
design-system: 1.0
tier: standard
last-updated: 2026-04-27
---

# Field Service — Page Design Brief

Dispatching technicians to customer locations: jobs, schedules, routes, parts.

## Pages

| Path | Archetype | Purpose |
|---|---|---|
| `/field-service` | Intelligent Dashboard | Live ops |
| `/field-service/dispatch` | Map / Geo | Live dispatch map |
| `/field-service/schedule` | Calendar / Schedule | Tech schedule |
| `/field-service/jobs` | Smart List | All jobs |
| `/field-service/jobs/:id` | Detail-Rich | Job cockpit |
| `/field-service/technicians` | Smart List | Tech roster |
| `/field-service/parts` | Smart List | Truck-stock |

## Highlights

**Dashboard KPIs:** Jobs today · In-progress · Late · First-time-fix rate · SLA compliance · Avg drive time.

**Dispatch map:** live tech locations, jobs with status pins, routes drawn, ETA per leg, drag-drop reassign.

**Job cockpit tabs:** Overview · Customer · Site · Parts · Time · Photos · Signature · Audit.

**Mobile-optimised:** technicians get a phone-shaped page (compact density, big tap targets).

## Cross-plugin

- `crm-core` — customer + site
- `inventory-core` — truck stock + parts request
- `assets-core` — service history per asset
- `support-service-core` — ticket → job conversion
- `notifications-core` — appointment reminders, on-the-way SMS
- `audit-core` — every status change audited

## Open

- Route optimisation — basic phase 1; advanced (multi-stop, time windows) phase 2.
- Customer self-serve appointment booking — via `booking-core`.
