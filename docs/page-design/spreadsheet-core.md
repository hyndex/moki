---
plugin: gutu-plugin-spreadsheet-core
design-system: 1.0
tier: standard
last-updated: 2026-04-27
---

# Spreadsheet — Page Design Brief

Collaborative spreadsheet (Yjs-backed). Cells, formulas, named ranges, pivot.

## Pages

| Path | Archetype | Purpose |
|---|---|---|
| `/sheets` | Smart List | Sheets |
| `/sheets/:id` | Editor Canvas (full-bleed) | Sheet editor |
| `/sheets/:id/history` | Detail-Rich | Versions |

## Highlights

- Multi-sheet tabs
- Formula bar with autocomplete
- Conditional formatting
- Pivot tables
- Linked-cell from records (live, ACL-aware)
- AI ("convert this column to YYYY-MM-DD")

## Cross-plugin

- `editor-core` — runtime
- `query` library — record-bound cells
- `audit-core` — version history
- `ai-assist-core` — formulas, tidy, summarise

## Open

- Excel parity bar — phase 1 mid-tier (top 50 functions).
