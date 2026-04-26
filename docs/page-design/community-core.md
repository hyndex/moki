---
plugin: gutu-plugin-community-core
design-system: 1.0
tier: standard
last-updated: 2026-04-27
---

# Community — Page Design Brief

Internal or customer-facing community spaces (forums, Q&A, ideas).

## Pages

| Path | Archetype | Purpose |
|---|---|---|
| `/community` | Intelligent Dashboard | Activity overview |
| `/community/feed` | Split Inbox | Latest posts |
| `/community/topics` | Smart List | Topic taxonomy |
| `/community/posts/:id` | Detail-Rich | Post + replies |
| `/community/users` | Smart List | Members + reputation |
| `/community/moderation` | Split Inbox | Flagged content |

## Highlights

**Dashboard KPIs:** Active members (7d) · New posts · Resolved Qs · Avg response time · Sentiment trend.

**Post detail:** original post · threaded replies · best-answer pin · related (AI) · author rep card.

**Moderation queue:** AI pre-classifies; reviewer accepts/escalates/dismisses; bulk actions.

## Cross-plugin

- `auth-core` — member identity
- `notifications-core` — replies / mentions
- `audit-core` — moderation actions audited
- `ai-assist-core` — post classification, summary, search

## Open

- Reputation algorithm — initial: SO-style (votes + accepted answers + tenure).
- Anonymous posts — opt-in per tenant; default off.
