---
plugin: gutu-plugin-document-core
design-system: 1.0
tier: standard
last-updated: 2026-04-27
---

# Document — Page Design Brief

Generic document records: any business doc with parties, lines, totals,
status. The contract isn't sale, isn't purchase — it's a base.

## Pages

| Path | Archetype | Purpose |
|---|---|---|
| `/documents` | Smart List | All documents |
| `/documents/:id` | Detail-Rich | Document cockpit |
| `/documents/templates` | Smart List | Reusable templates |
| `/documents/numbering` | Smart List | Naming series |

## Highlights

**Document cockpit tabs:** Header · Lines · Totals · Audit · Linked.

**Naming series:** prefix + counter + reset rules; per-tenant; with conflict detection.

**Bulk:** print, export, status change.

## Cross-plugin

- `accounting-core`, `sales-core`, `procurement-core`, `inventory-core` — base for typed docs (invoice, PO, etc.)
- `audit-core` — full lifecycle
- `field-metadata-core` — custom fields

## Open

- Type-safe specialisation: typed plugins extend documents via prototype.
- Document templates with variables — phase 1.
