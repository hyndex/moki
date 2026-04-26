---
plugin: gutu-plugin-issues-core
design-system: 1.0
tier: standard
last-updated: 2026-04-27
---

# Issues — Page Design Brief

Internal issue tracker (Linear/Jira-style) for engineering / ops
teams.

## Pages

| Path | Archetype | Purpose |
|---|---|---|
| `/issues` | Kanban | Active board |
| `/issues/list` | Smart List | All issues |
| `/issues/:id` | Detail-Rich | Issue cockpit |
| `/issues/cycles` | Workspace Hub | Sprint / cycle |
| `/issues/triage` | Split Inbox | Needs triage |
| `/issues/projects` | Smart List | Issue projects |

## Highlights

**Kanban:** Triage · Backlog · In progress · In review · Done; per-cycle scope.

**Cockpit tabs:** Overview · Sub-issues · Linked PRs · Comments · Activity · Audit.

**Cycles:** burndown chart, scope changes, completed vs target.

## Cross-plugin

- `automation-core` — auto-assign rules
- `notifications-core` — assignment / status changes
- `audit-core` — every change audited
- `ai-assist-core` — auto-summarise, similar-issue detection

## Open

- GitHub/GitLab integration via `connections-core` for PR linking — phase 1.
