---
plugin: gutu-plugin-ai-evals
design-system: 1.0
tier: standard
last-updated: 2026-04-27
---

# AI Evals — Page Design Brief

Eval orchestration. Most surfaces composed under `/ai/evals` in the
`ai-assist-core` brief. This plugin contributes the dataset and
runner pages.

## Pages

| Path | Archetype | Purpose |
|---|---|---|
| `/ai/evals/runners` | Smart List | Runner configs |
| `/ai/evals/runners/:id` | Detail-Rich | Runner cockpit |
| `/ai/evals/scorecards` | Smart List | Reusable scorecards |
| `/ai/evals/scorecards/:id` | Editor Canvas | Edit scorecard |
| `/ai/evals/regressions` | Split Inbox | Regression triage |

## Highlights

**Runner detail tabs:** Config · Dataset · Schedule · Runs · Audit.
**Regression triage:** each item shows expected vs actual, AI explanation, accept/reject as new baseline.

## Cross-plugin

- `ai-assist-core` — surfaces eval results on `/ai/evals` dashboard
- `ai-core` — providers
- `audit-core` — runs audited
- `notifications-core` — regression alerts

## Open

- Human-in-the-loop scoring UI — phase 2 (start with reviewer queue + reviewer agreement metrics).
