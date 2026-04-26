---
plugin: gutu-plugin-slides-core
design-system: 1.0
tier: standard
last-updated: 2026-04-27
---

# Slides — Page Design Brief

Collaborative presentation editor (Yjs-backed).

## Pages

| Path | Archetype | Purpose |
|---|---|---|
| `/slides` | Smart List | Decks |
| `/slides/:id` | Editor Canvas (full-bleed) | Deck editor |
| `/slides/:id/present` | Editor Canvas (full-bleed) | Presenter mode |
| `/slides/:id/history` | Detail-Rich | Versions |

## Highlights

**Editor:** thumbnail strip left, slide canvas center, properties right; AI ("draft 5 slides on X", "rewrite this slide").

**Presenter mode:** notes, timer, next-slide preview, audience interaction (poll/Q&A).

## Cross-plugin

- `editor-core` — Yjs runtime
- `dashboard-core` — embed live tile
- `record-links-core` — link slide to entity (e.g., Acme QBR)
- `audit-core` — version history
- `ai-assist-core` — co-author

## Open

- Real-time co-presenting (multi-host) — phase 2.
