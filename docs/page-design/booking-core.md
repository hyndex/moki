---
plugin: gutu-plugin-booking-core
design-system: 1.0
tier: standard
last-updated: 2026-04-27
---

# Booking — Page Design Brief

Appointments, resources, calendars, availability.

## Pages

| Path | Archetype | Purpose |
|---|---|---|
| `/booking` | Intelligent Dashboard | Booking pulse |
| `/booking/calendar` | Calendar / Schedule | Resource calendar |
| `/booking/list` | Smart List | All bookings |
| `/booking/:id` | Detail-Rich | Booking cockpit |
| `/booking/resources` | Smart List | Resources / staff / rooms |
| `/booking/services` | Smart List | Bookable services |
| `/booking/availability` | Workspace Hub | Per-resource availability |
| `/booking/public/:slug` | Editor Canvas | Public booking page |

## Highlights

**Dashboard KPIs:** Upcoming (24h) · Cancelled (7d) · No-show rate · Utilisation % · Lead time (p50) · Revenue from bookings.

**Resource calendar:** lanes per resource, drag to reschedule, drag-create, conflict highlighting, capacity heatmap.

**Booking detail tabs:** Overview · Customer · Payments · Reschedule history · Audit.

**Public booking page:** brand-customisable; available-slot grid; capture form; payment optional.

## Cross-plugin

- `crm-core` — link booking to person/company
- `payments-core` — deposits / full prepay
- `notifications-core` — confirmations, reminders
- `automation-core` — follow-up sequences
- `audit-core` — every reschedule logged

## Open

- Multi-resource bookings (e.g., room + equipment + staff) — phase 1 yes.
- Recurring bookings with exceptions — phase 1.
