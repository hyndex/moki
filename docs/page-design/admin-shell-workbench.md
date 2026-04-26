---
plugin: gutu-plugin-admin-shell-workbench
design-system: 1.0
tier: support
last-updated: 2026-04-27
---

# Admin Shell Workbench — Page Design Brief

The shell's own admin pages: tenant management, plugin enablement,
session management, system status. Lives in `/admin/*`.

## Pages

| Path | Archetype | Purpose |
|---|---|---|
| `/admin` | Intelligent Dashboard | Operator overview |
| `/admin/tenants` | Smart List | All tenants |
| `/admin/tenants/:id` | Workspace Hub | Tenant 360 |
| `/admin/plugins` | Smart List | Installed plugins per tenant |
| `/admin/plugins/:id` | Detail-Rich | Plugin status / health |
| `/admin/sessions` | Smart List | Live sessions |
| `/admin/feature-flags` | Smart List | Flag manager |
| `/admin/system` | Intelligent Dashboard | Health probes / metrics |

## Highlights

**`/admin` KPIs:** Active tenants · Daily active users · Plugin failures (24h) · Session count · Audit chain status · Worker leases active · Rate-limit hits (1h)

**`/admin/tenants/:id` tabs:** Overview · Plugins · Users · Quotas · Audit · Billing.

**`/admin/plugins`** — per-tenant enable/disable matrix; status pills (loaded / failed / quarantined); bulk enable.

**`/admin/system`** — pulls from `/api/_metrics` and `/api/_plugins`. Charts: requests/sec, p95 latency, plugin uptime by name, lease holder per worker.

## Cross-plugin

- `org-tenant-core` — tenant lifecycle
- `auth-core` — sessions
- `audit-core` — chain verify
- `observability-*` — feeds dashboards
- `notifications-core` — operator alerts

## Open

- Tenant impersonation — gated by SUPER admin role + always audited.
