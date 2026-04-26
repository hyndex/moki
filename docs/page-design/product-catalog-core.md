---
plugin: gutu-plugin-product-catalog-core
design-system: 1.0
tier: standard
last-updated: 2026-04-27
---

# Product Catalog — Page Design Brief

Master catalog of items: SKUs, variants, attributes, taxonomy.

## Pages

| Path | Archetype | Purpose |
|---|---|---|
| `/catalog` | Smart List | Items |
| `/catalog/:id` | Workspace Hub | Item 360 |
| `/catalog/categories` | Tree Explorer | Category tree |
| `/catalog/attributes` | Smart List | Attributes (size, color) |
| `/catalog/variants/:id` | Detail-Rich | Variants matrix |
| `/catalog/import` | Detail-Rich | Bulk import |

## Highlights

**Hub tabs:** Overview · Variants · Pricing · Inventory · Suppliers · Marketing · Files · Audit.

**Variants matrix:** size × color grid, inline-editable; bulk activate.

**Bulk import:** CSV / GSheets; AI auto-maps columns; dry-run.

## Cross-plugin

- `inventory-core`, `sales-core`, `pos-core`, `manufacturing-core` — consumers
- `pricing-tax-core` — price assignment
- `content-core` — marketing copy/photos
- `audit-core`

## Open

- Product Information Management (PIM) features beyond catalog — phase 2 (channels, syndication).
