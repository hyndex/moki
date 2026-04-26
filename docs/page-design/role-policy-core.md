---
plugin: gutu-plugin-role-policy-core
design-system: 1.0
tier: standard
last-updated: 2026-04-27
---

# Role & Policy — Page Design Brief

RBAC, per-record ACL, attribute policies.

## Pages

| Path | Archetype | Purpose |
|---|---|---|
| `/admin/roles` | Smart List | Roles |
| `/admin/roles/:id` | Detail-Rich | Role cockpit |
| `/admin/policies` | Smart List | Attribute policies |
| `/admin/policies/test` | Detail-Rich | Policy playground |
| `/admin/permissions` | Smart List | Permission catalog |

## Highlights

**Role cockpit tabs:** Permissions · Members · Inheritance · Audit.

**Playground:** input subject + action + resource → engine returns allow/deny + matched rule. Trace.

**Permission catalog:** all permissions registered by plugins + built-in.

## Cross-plugin

- `auth-core` — pairing
- All plugins — declare permissions via manifest
- `audit-core` — role/policy changes audited

## Open

- ABAC vs RBAC: hybrid; ABAC layered on top of RBAC.
- Tenant-level role overrides — yes.
