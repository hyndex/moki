---
plugin: gutu-plugin-auth-core
design-system: 1.0
tier: standard
last-updated: 2026-04-27
---

# Auth — Page Design Brief

Authentication, sessions, MFA, API tokens, password reset.

## Pages (user-facing)

| Path | Archetype | Purpose |
|---|---|---|
| `/login` | Editor Canvas (full-bleed) | Login |
| `/signup` | Editor Canvas | Sign-up (when enabled) |
| `/account/security` | Workspace Hub | Per-user security center |
| `/account/sessions` | Smart List | Active sessions |
| `/account/api-tokens` | Smart List | Per-user API tokens |

## Pages (admin)

| Path | Archetype | Purpose |
|---|---|---|
| `/admin/auth` | Intelligent Dashboard | Login health, anomalies |
| `/admin/auth/users` | Smart List | User accounts |
| `/admin/auth/sso` | Workspace Hub | SSO config (SAML, OIDC) |
| `/admin/auth/policies` | Workspace Hub | Password / MFA / lockout policies |

## Highlights

**`/account/security` tabs:** Password · MFA · Recovery · Trusted devices · Activity.

**`/admin/auth` KPIs:** Active users (24h) · Failed logins (1h) · MFA-enrolled % · API tokens active · Password resets (24h) · SSO logins.

**Anomaly cards:** brute-force attempts, geo-anomalies, impossible-travel detections.

## Cross-plugin

- `audit-core` — auth events
- `notifications-core` — security alerts
- `org-tenant-core` — multi-tenant scoping
- `role-policy-core` — RBAC pairing

## Privacy / safety

- Passwords never echoed
- API tokens shown once at create
- MFA mandatory above admin role (configurable)
- Account lockout after N failures (configurable)

## Open

- Passkey / WebAuthn — phase 1 supported alongside TOTP.
- Hardware key (FIDO2) — phase 2.
