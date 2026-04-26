---
plugin: gutu-plugin-knowledge-core
design-system: 1.0
tier: standard
last-updated: 2026-04-27
---

# Knowledge — Page Design Brief

Internal / customer-facing help center: articles, categories, search.

## Pages

| Path | Archetype | Purpose |
|---|---|---|
| `/knowledge` | Smart List | Articles |
| `/knowledge/:id` | Detail-Rich | Article reader |
| `/knowledge/edit/:id` | Editor Canvas | Article editor |
| `/knowledge/categories` | Tree Explorer | Category tree |
| `/knowledge/feedback` | Split Inbox | Article feedback |

## Highlights

**Reader page:** TOC sidebar, "was this helpful?" footer, related articles, last-updated badge, AI ("ask a question about this article").

**Feedback inbox:** flagged outdated, "this didn't help" with reason; auto-creates issues for owners.

**Internal vs public flag** per article, with audit when toggled.

## Cross-plugin

- `support-service-core` — articles surface in agent reply
- `community-core` — Q&A complement
- `ai-rag` — articles indexed for retrieval
- `audit-core` — publishes audited

## Open

- Versioning per article: yes; restore-to-version.
