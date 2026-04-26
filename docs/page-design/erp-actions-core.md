---
plugin: gutu-plugin-erp-actions-core
design-system: 1.0
tier: standard
last-updated: 2026-04-27
---

# ERP Actions — Page Design Brief

The cross-plugin actions registry. Plugins register quick-actions
(e.g., "Convert email → deal", "Create invoice from order"); this
plugin surfaces them in the Cmd-K palette and contextual menus.

## Pages

| Path | Archetype | Purpose |
|---|---|---|
| `/admin/actions` | Smart List | Registered actions |
| `/admin/actions/:id` | Detail-Rich | Action cockpit |
| `/admin/actions/usage` | Intelligent Dashboard | Usage metrics |

## Highlights

**Action descriptor:** id · label · scope (entity types it applies to) · permissions · handler · icon.

**Cockpit tabs:** Definition · Permissions · Tests · Usage · Audit.

**Usage dashboard:** Top actions, success rate, avg latency, who uses what.

## Cross-plugin

- All plugins register actions
- `awesome-search-core` — exposes actions in Cmd-K palette
- `automation-core` — actions can be triggered programmatically
- `audit-core` — every execution audited
- `ai-assist-core` — proposes action invocations

## Open

- Approval gating for sensitive actions — yes; per-action policy.
