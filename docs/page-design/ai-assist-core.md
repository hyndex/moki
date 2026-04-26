---
plugin: gutu-plugin-ai-assist-core
design-system: 1.0
tier: flagship
last-updated: 2026-04-27
---

# AI Assist — Page Design Brief

The cross-plugin assistant. Lives as a contextual rail on every
Workspace Hub, as a side panel on every Smart List, and as full
pages here. Not a chatbot — an action-taking copilot grounded in
plugin context.

## Positioning

Generic chatbots produce generic replies. We build a copilot that
knows what entity is in focus, what permissions the user has, what
plugin's data is involved, and what actions are reversible. It can
draft, summarise, query, and (with explicit consent per action) take
action. Every reply cites sources from the user's own data; every
action is auditable; every reasoning step is reviewable.

## Page map

| # | Page path | Archetype | Purpose |
|---|---|---|---|
| 1 | `/ai` | Intelligent Dashboard | AI usage health |
| 2 | `/ai/chat` | Editor Canvas | Full-page chat |
| 3 | `/ai/chat/:id` | Editor Canvas | Chat session |
| 4 | `/ai/skills` | Smart List | Skill catalog |
| 5 | `/ai/skills/:id` | Detail-Rich | Skill cockpit |
| 6 | `/ai/agents` | Smart List | Agent recipes |
| 7 | `/ai/agents/:id` | Detail-Rich | Agent cockpit |
| 8 | `/ai/runs` | Smart List | Recent agent runs |
| 9 | `/ai/runs/:id` | Detail-Rich | Run trace |
| 10 | `/ai/evals` | Intelligent Dashboard | Eval health |
| 11 | `/ai/evals/:id` | Detail-Rich | Eval suite cockpit |
| 12 | `/ai/datasets` | Smart List | Eval datasets |
| 13 | `/ai/memory` | Workspace Hub | Memory browser |
| 14 | `/ai/guardrails` | Workspace Hub | Guardrail config |
| 15 | `/ai/budgets` | Detail-Rich | Cost & quota |

## 1 · `/ai` — Intelligent Dashboard

**KPIs (6):** Tokens used (period) · Cost · Avg latency p50 · Eval pass rate · Failed runs · Action acceptance rate
**Main:**
- Attention queue: failing evals, cost overruns, drifting models, denied actions awaiting review
- `LineSeries` token spend daily
- `BarSeries` cost per skill (last 7d)
- `Heatmap` user adoption by department × week
**Rail:** anomalies (e.g., "model X p99 latency tripled"), next actions, AI itself ("explain my cost spike")

## 2 · `/ai/chat` — Editor Canvas (full-bleed)

The full-page chat, like a side panel but bigger. The same component
appears in plugin rails as `<RailAiAssistant>`, just smaller.

**Layout:**
- Left: thread list (recent chats)
- Centre: conversation
- Right rail: context (active entity, retrieved sources, suggested actions)

**Input area:**
- Text + voice + file upload (subject to file ACL)
- `/-commands` — `/summarise`, `/draft email to`, `/find similar`, `/query "<NL>"`, `/run skill <name>`
- Mention to scope: `@account:Acme`, `@plugin:accounting`, `@period:Q3`

**Reply rendering:**
- Citations inline with footnote markers
- Proposed actions appear as cards with "Approve" / "Decline" — never auto-execute without explicit consent for destructive or external-effect actions
- Errors degrade gracefully ("I tried but couldn't complete X — here's why")

**Trust signals:**
- Model badge (which model)
- Sensitivity badge if sensitive data was used (auto-detected via field metadata)
- "This used: 2 records, 1 chart, your timezone" expandable
- One-click "explain reasoning" reveals chain-of-thought summary

## 3 · `/ai/chat/:id` — Editor Canvas

Same as #2 with a specific session loaded.

## 4 · `/ai/skills` — Smart List

Skills are reusable AI capabilities (drafting, summarising, classification, etc.) — see `ai-skills-core`.
**Columns:** ☐ · Name · Type · Provider · Owner · Used (7d) · Avg latency · Pass rate · Status
**Saved views:** All · Mine · Failing · Hot · Drafts
**Bulk:** activate/deactivate, clone, export.

## 5 · `/ai/skills/:id` — Detail-Rich

Tabs: Overview · Prompt · Schema · Tests · Versions · Audit
**Prompt tab:** prompt template editor with variable binding; live preview against a fixture.
**Schema tab:** input/output JSON schemas (Zod-derived).
**Tests tab:** linked eval cases; one-click run-tests-now.
**Versions:** immutable history; promote a version to active; canary roll-out percentage.

## 6 · `/ai/agents` — Smart List

Agents are skill compositions (chains/graphs).
**Columns:** ☐ · Name · Skills used · Trigger · Owner · Last run · Pass rate · Cost (7d) · Status
**Saved views:** All · Scheduled · Triggered · Mine · Failing.

## 7 · `/ai/agents/:id` — Detail-Rich

Tabs: Definition · Triggers · Tests · Runs · Versions · Audit
**Definition tab:** visual graph of skills (nodes) and decision branches (edges).
**Triggers:** schedule, event, manual.
**Runs:** last N runs as a list — quick to spot pattern of failures.

## 8 · `/ai/runs` — Smart List

All recent runs across agents.
Columns: # · Agent · Trigger · Started · Duration · Status · Cost · User
Saved views: Failed · Canceled · Slow (>p95) · Mine.
Bulk: re-run, cancel, export.

## 9 · `/ai/runs/:id` — Detail-Rich

**Tabs:** Trace · Inputs · Outputs · Logs · Audit
**Trace tab:** waterfall of skills called; spans annotated with cost, latency, model, tokens; click any span to inspect prompt + response + retrieved chunks.
**Inputs tab:** raw inputs, parsed inputs, redactions.
**Outputs tab:** structured output + raw model output.
**Logs:** structured + tracebacks if any.

## 10 · `/ai/evals` — Intelligent Dashboard

**KPIs:** Latest run pass rate · Coverage % · Last regression · Eval cost · Time-to-results
**Main:**
- Attention queue: regressions, low-coverage skills, datasets without eval, flaky cases
- `BarSeries` pass rate per suite
- `LineSeries` regression count over time
**Rail:** anomalies, next actions ("add 12 missing cases for skill X").

## 11 · `/ai/evals/:id` — Detail-Rich

Tabs: Cases · Runs · Metrics · Audit
**Cases tab:** grid of fixtures; pass/fail/uncertain badges; filter by tag.
**Runs:** historical runs; diff between two runs.
**Metrics:** custom — accuracy, BLEU, semantic similarity, factuality, latency, cost.

## 12 · `/ai/datasets` — Smart List

Eval/training datasets.
Columns: name · size · created · last used · owner · sensitivity · status

## 13 · `/ai/memory` — Workspace Hub

Per-user / per-tenant memory browser.
**Tabs:** Facts · Preferences · Episodes · Sources
**Facts:** key-value memory inferred or explicit; edit/delete (with audit).
**Episodes:** session memories used to personalise.
**Sources:** registered RAG sources (paths, indexes, refresh status).

## 14 · `/ai/guardrails` — Workspace Hub

Tabs: Allowed actions · Forbidden topics · PII rules · Rate limits · Approvers
Each tab is an editable policy.
**Allowed actions:** which side-effecting tools the assistant can call without explicit user consent (reads always allowed; writes are off by default).
**PII rules:** what fields the assistant can see / can not include in replies.
**Approvers:** for high-risk actions, who must sign off.

## 15 · `/ai/budgets` — Detail-Rich

Per-tenant or per-team cost dashboard.
**KPIs:** Spend (period) · Budget · Forecast end-of-period · Top users · Top skills.
**Charts:** spend by skill, by user, by department.
**Alerts:** budget threshold notifications via `notifications-core`.
**Caps:** hard cap per user / per agent.

## Cross-plugin integrations

- Every plugin — embeds `<RailAiAssistant>` on Workspace Hubs
- `ai-core` — runtime / model providers
- `ai-skills-core` — skill registry
- `ai-evals` — eval system
- `ai-rag` — retrieval; this plugin orchestrates retrieval queries
- `ai-memory` — facts / preferences
- `ai-guardrails` — policy enforcement
- `ai-mcp` — MCP servers as tool providers
- `audit-core` — every action proposal + execution audited
- `notifications-core` — budget alerts, eval regressions
- `field-metadata-core` — sensitivity tags drive what AI may use

## Trust & safety

- All AI actions that mutate state require explicit user consent (no
  silent action). Hard rule.
- Sensitive fields (per `field-metadata-core` `sensitivity:high`) are
  redacted from prompts unless user has explicit grant.
- Every action AI executes auto-audits with full prompt + response +
  retrieved sources stored.
- Reasoning summaries are always optional — never require reading
  chain-of-thought to use a result.
- Rate limits per user / per tenant prevent abuse.

## Performance budget

First token <600ms p50 across configured providers; full reply <8s p95
for typical queries; trace render <500ms regardless of run size.

## Open questions

- Default model per tenant — admin choice (cost vs quality slider).
- Reasoning visibility — opt-in by default for org admins.
- Fine-tuning per tenant — phase 2; phase 1 ships RAG + tools only.
