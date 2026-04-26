---
plugin: gutu-plugin-whiteboard-core
design-system: 1.0
tier: standard
last-updated: 2026-04-27
---

# Whiteboard — Page Design Brief

Infinite-canvas collaborative whiteboard (Yjs-backed).

## Pages

| Path | Archetype | Purpose |
|---|---|---|
| `/boards` | Smart List | Boards |
| `/boards/:id` | Editor Canvas (full-bleed) | Board canvas |
| `/boards/:id/history` | Detail-Rule | Versions |

## Highlights

- Sticky notes, shapes, connectors, freehand, text, embeds (records, charts, mini dashboards)
- Shape libraries (frameworks, BPMN, flowcharts)
- Cursor presence, comments, voting
- Frames + sections for structured agendas
- Zoom + minimap + jump-to
- AI ("organise these stickies", "summarise themes")

## Cross-plugin

- `editor-core` — Yjs + presence
- `dashboard-core` — embed tile
- `record-links-core` — link to records
- `audit-core` — versions

## Open

- Pen/touch input — phase 1 yes.
- Voice-to-stickies — phase 2.
