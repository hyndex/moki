---
plugin: gutu-plugin-ai-skills-core
design-system: 1.0
tier: standard
last-updated: 2026-04-27
---

# AI Skills — Page Design Brief

Skill registry + lifecycle. Surfaced in `/ai/skills/*` (see ai-assist-core brief).

## Pages

| Path | Archetype | Purpose |
|---|---|---|
| `/ai/skills` | Smart List | All skills (covered in ai-assist-core) |
| `/ai/skills/:id` | Detail-Rich | Skill cockpit (covered) |
| `/ai/skills/marketplace` | Smart List | Public/template skills |
| `/ai/skills/canary` | Smart List | Active canary rollouts |

## Highlights

**Marketplace:** browse + clone reusable skills (drafts, summarisers, classifiers). Each card: install count, avg pass rate, owner.

**Canary:** rollout % · failure threshold · auto-rollback toggle · current cohort size. Each row: skill · version A vs B · KPIs side-by-side.

## Cross-plugin

- `ai-core`, `ai-assist-core`, `ai-evals` — primary consumers
- `audit-core` — skill version promotions audited

## Open

- Skill marketplace governance — initial: tenant-private + first-party templates only; v2: cross-tenant gallery.
