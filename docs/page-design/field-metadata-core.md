---
plugin: gutu-plugin-field-metadata-core
design-system: 1.0
tier: standard
last-updated: 2026-04-27
---

# Field Metadata — Page Design Brief

Per-tenant custom fields, validation, sensitivity labels.

## Pages

| Path | Archetype | Purpose |
|---|---|---|
| `/admin/fields` | Smart List | Custom field definitions |
| `/admin/fields/:id` | Detail-Rich | Field cockpit |
| `/admin/fields/sensitivity` | Workspace Hub | Sensitivity labels + ACL rules |

## Highlights

**Field cockpit tabs:** Definition · Validation · UI · Sensitivity · Audit.

**Sensitivity labels:** none · low · medium · high · critical. Each maps to a default ACL + masking policy.

**Validation:** required, regex, min/max, enum, foreign-key, AI ("validate matches business rule X").

## Cross-plugin

- All plugins — extensible via field-metadata
- `audit-core` — high-sensitivity reads audited
- `ai-assist-core` — AI respects sensitivity labels

## Open

- Schema migration when retiring a custom field — soft-delete + 30-day grace.
