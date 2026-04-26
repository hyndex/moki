---
plugin: gutu-plugin-files-core
design-system: 1.0
tier: standard
last-updated: 2026-04-27
---

# Files — Page Design Brief

User-facing file/folder UI on top of `storage-*` adapters.

## Pages

| Path | Archetype | Purpose |
|---|---|---|
| `/files` | Tree Explorer (with grid main) | Folder browser |
| `/files/:path` | Smart List | Folder contents |
| `/files/recent` | Smart List | Recent files |
| `/files/shared` | Smart List | Shared with me |
| `/files/trash` | Smart List | Trash |

## Highlights

- Drag-drop upload (multi-file, folder)
- Inline preview (image, PDF, video, code, csv)
- Versioning with rollback
- AI search across content
- Share with link (TTL + access scope) — link generation requires explicit user consent
- Tag + colour-code
- Mobile: grid view default

## Cross-plugin

- `storage-*` adapters
- `audit-core` — access + share audited
- `ai-rag` — RAG-able file content (with sensitivity respected)
- `notifications-core` — share notifications

## Open

- E2E encryption for sensitive folders — phase 2.
- Locking on edit (for binary files like Word) — phase 1.
