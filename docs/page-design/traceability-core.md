---
plugin: gutu-plugin-traceability-core
design-system: 1.0
tier: standard
last-updated: 2026-04-27
---

# Traceability — Page Design Brief

Lot/serial fan-out: backward (where did this come from?) and forward (where did this go?).

## Pages

| Path | Archetype | Purpose |
|---|---|---|
| `/traceability` | Graph / Network | Lot/serial graph |
| `/traceability/lots/:id` | Detail-Rich | Lot trace |
| `/traceability/serials/:id` | Detail-Rich | Serial trace |
| `/traceability/recall` | Detail-Rich | Recall workspace |

## Highlights

**Graph:** click any lot/serial → see backward (suppliers, components) and forward (POs, customers); colour-code health flags.

**Recall workspace:** define impact set → list affected customers + units → notify (via notifications-core) → track responses + returns.

## Cross-plugin

- `inventory-core`, `manufacturing-core`, `sales-core` — primary consumers
- `quality-core` — quarantines
- `audit-core` — recall actions audited
- `notifications-core` — recall notices

## Open

- Regulatory export (FDA / FSMA) — phase 1 yes (formatted CSV).
