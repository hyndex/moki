---
plugin: gutu-plugin-ai-rag
design-system: 1.0
tier: standard
last-updated: 2026-04-27
---

# AI RAG — Page Design Brief

Retrieval-augmented generation. Owns sources, indexes, retrieval policy.

## Pages

| Path | Archetype | Purpose |
|---|---|---|
| `/ai/rag` | Intelligent Dashboard | Index health |
| `/ai/rag/sources` | Smart List | Connected sources |
| `/ai/rag/sources/:id` | Detail-Rich | Source cockpit |
| `/ai/rag/indexes` | Smart List | Vector indexes |
| `/ai/rag/queries` | Timeline / Log | Recent retrieval traces |

## Highlights

**Dashboard KPIs:** Indexed docs · Index size · Index lag · Retrieval p50 · Cache hit · Query volume.

**Source detail:** connector config, schedule, last sync stats, redaction rules, sensitivity tags.

**Index page:** chunking strategy, embedding model, dimensions, stale ratio.

**Queries log:** per query — top-k chunks retrieved with score, latency, used-by-skill, accept/reject relevance feedback.

## Cross-plugin

- `ai-core` — embedding model providers
- `ai-assist-core` — primary consumer (rail + chat)
- `field-metadata-core` — sensitivity-aware redaction
- `storage-core` — file source content
- `audit-core` — retrieval audited (who retrieved what)

## Open

- Hybrid search (BM25 + vector) — phase 1 enabled by default.
- Per-tenant index isolation — required (already designed).
