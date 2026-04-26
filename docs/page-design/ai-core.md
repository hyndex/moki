---
plugin: gutu-plugin-ai-core
design-system: 1.0
tier: standard
last-updated: 2026-04-27
---

# AI Core — Page Design Brief

The runtime + provider plumbing under all AI plugins. Mostly admin-
facing.

## Pages

| Path | Archetype | Purpose |
|---|---|---|
| `/admin/ai/providers` | Smart List | Provider configs (OpenAI, Anthropic, Bedrock, local) |
| `/admin/ai/providers/:id` | Detail-Rich | Provider config + health |
| `/admin/ai/models` | Smart List | Catalog of available models |
| `/admin/ai/usage` | Intelligent Dashboard | Tokens, cost, latency |
| `/admin/ai/health` | Intelligent Dashboard | Provider availability |

## Highlights

**`/admin/ai/usage` KPIs:** Tokens (24h) · Cost · p50 latency · p95 latency · Failed requests · Cache hit rate · Throttled count

**Provider config:** API key (write-only, never echoed), endpoint, region, rate limit, fallback chain.

**Health page:** real-time provider status with synthetic probe results, model-by-model availability, cached failover order.

## Cross-plugin

- `ai-assist-core`, `ai-skills-core`, `ai-evals`, `ai-rag`, `ai-memory`, `ai-mcp` — all consume providers from here
- `audit-core` — config changes audited
- `notifications-core` — provider outage alerts

## Open

- Local model support (vLLM, llama.cpp) — phase 2.
- Cost attribution: per-tenant, per-user, per-skill — already implemented; surface in this UI.
