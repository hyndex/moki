---
plugin: gutu-plugin-content-core
design-system: 1.0
tier: standard
last-updated: 2026-04-27
---

# Content — Page Design Brief

Marketing content / CMS-light: pages, posts, snippets, taxonomies.

## Pages

| Path | Archetype | Purpose |
|---|---|---|
| `/content` | Smart List | Posts/articles |
| `/content/:id` | Editor Canvas | Article editor |
| `/content/taxonomies` | Tree Explorer | Categories + tags |
| `/content/media` | Smart List | Asset library |
| `/content/sites` | Smart List | Sites (multi-site) |
| `/content/calendar` | Calendar | Editorial calendar |

## Highlights

**Editor:** rich text + blocks (image / quote / embed / table); AI co-writer; SEO checklist sidebar (title, meta, slug, schema.org); preview pane.

**Editorial calendar:** lanes per author; status (draft/review/scheduled/published); drag to reschedule.

**Media library:** grid + filters (type, tags, source); inline crop/resize; drag-drop upload.

## Cross-plugin

- `storage-core` — media storage
- `audit-core` — version + publish audited
- `automation-core` — scheduled publish
- `ai-assist-core` — SEO suggestions, draft, summarise
- `business-portals-core` — surface published content

## Open

- Multi-language: phase 1 yes — language picker per article + locale fallback.
- Live preview via short-lived token — yes.
