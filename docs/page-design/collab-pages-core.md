---
plugin: gutu-plugin-collab-pages-core
design-system: 1.0
tier: standard
last-updated: 2026-04-27
---

# Collab Pages — Page Design Brief

Live, collaborative documents (Notion-style) backed by Yjs.

## Pages

| Path | Archetype | Purpose |
|---|---|---|
| `/pages` | Smart List | All pages |
| `/pages/:id` | Editor Canvas (full-bleed) | The page |
| `/pages/:id/history` | Detail-Rich | Version history |

## Highlights

**Editor:** rich-text + tables + embeds (records, charts, dashboards, files); slash commands; cursor presence; comments; mentions; AI co-writer.

**History:** version slider; per-author colour-coded diff; restore-to-version (creates a new version, no data lost).

**Permissions:** view / comment / edit / admin.

## Cross-plugin

- `document-editor-core` — shared editor primitives
- `record-links-core` — embed records
- `dashboard-core` — embed tiles
- `audit-core` — page open/edit audited
- `ai-assist-core` — co-writer

## Open

- Offline mode — Yjs supports it; queue locally, replay on reconnect.
- E2E encryption per page — phase 2.
