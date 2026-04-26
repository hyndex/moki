---
plugin: gutu-plugin-notifications-core
design-system: 1.0
tier: flagship
last-updated: 2026-04-27
---

# Notifications & Mail — Page Design Brief

The communication hub. Every other plugin emits notifications; this
is where they collect, get triaged, and where users can respond
without context-switching.

## Positioning

Most apps surface notifications via a small bell icon. We treat
notifications as a first-class workspace: a triage inbox, a
preferences cockpit, and a delivery audit. Mail (SMTP/IMAP-bound or
internal) lives alongside as part of the same archetype family —
both are streams of communications scoped to the user.

## Page map

| # | Page path | Archetype | Purpose |
|---|---|---|---|
| 1 | `/inbox` | Split Inbox | Unified user inbox |
| 2 | `/inbox/notifications` | Split Inbox | App notifications stream |
| 3 | `/inbox/mail` | Split Inbox | Email |
| 4 | `/inbox/mail/compose` | Editor Canvas | Compose / reply |
| 5 | `/inbox/threads/:id` | Detail-Rich | Mail thread cockpit |
| 6 | `/inbox/preferences` | Workspace Hub | Per-channel preferences |
| 7 | `/inbox/digest` | Detail-Rich | Daily / weekly digest |
| 8 | `/admin/notifications` | Intelligent Dashboard | Operator: delivery health |
| 9 | `/admin/notifications/templates` | Smart List | Templates |
| 10 | `/admin/notifications/templates/:id` | Editor Canvas | Template editor |
| 11 | `/admin/notifications/rules` | Smart List | Routing rules |
| 12 | `/admin/notifications/audit` | Timeline / Log | Delivery audit |

## 1 · `/inbox` — Split Inbox (unified)

Shows everything: app notifications, emails, system alerts, mentions, approvals, scheduled digests.

**S1:** "Inbox" · HeaderActions [Compose · Mark all read · Filter ▾]
**S3 toolbar tabs:** All · Mentions · Approvals · Mail · System · Snoozed · Done
**S5a list:** sorted by unread→date; bold for unread; chip for source plugin (CRM, Accounting, etc.); urgency dot (high=red).
**S5b preview:** richer than list — full body, embedded actions ("Approve PR-204"), linked record, AI summary toggle.
**S6 rail:** active filters, smart segments ("Today only", "From customers"), AI ("triage my unread")

**Bulk:** mark read, snooze, archive, mark important, route to ticket.
**Keyboard (gmail-style):** `J/K` next/prev, `Enter` open, `R` reply, `A` reply all, `F` forward, `E` archive, `S` snooze, `M` mark, `#` delete confirm, `/` search, `T` toggle done, `*` star.

## 2 · `/inbox/notifications` — Split Inbox

Subset filtered to non-mail. Same layout. List items show plugin icon, action ("invoice approved"), context ("INV-0042 · $4.8k").

**Right pane:** the notification body + linked actions:
- "View record" (opens detail in source plugin)
- "Take action" (executes the suggested action — e.g., "approve" — with confirm)
- "Dismiss" / "Snooze for 1h / today / next week / custom"

## 3 · `/inbox/mail` — Split Inbox

Mail-specific.
**Threading:** by subject + Reference / In-Reply-To headers.
**List item:** sender · subject snippet · date · attach indicator · star · label chips.
**Preview:** thread; collapse/expand replies; reply box at bottom; "Convert to" → deal/ticket/task via `erp-actions-core`.

**Filters:** unread, has attachment, from customers, from teammates, in label, has flag, date range.
**Saved searches.** Smart folder support.

## 4 · `/inbox/mail/compose` — Editor Canvas

Full-bleed (or modal sheet) composer.
**Top bar:** to · cc · bcc (collapsed) · subject · scheduling.
**Main:** rich-text editor with /-commands ("/insert customer", "/template Q3-Renewal").
**Right rail:** template picker · linked record · AI assistant ("draft a follow-up", "shorten", "translate").
**Send:** primary action; "Send + create task" secondary; "Save draft" tertiary.

## 5 · `/inbox/threads/:id` — Detail-Rich

Tabs: Conversation · Linked records · Audit
**Conversation tab:** the thread, message-by-message, with reply/forward inline.
**Linked records tab:** what this thread references — deal, ticket, customer, invoice. AI auto-detects.
**Audit tab:** delivery events (sent, delivered, opened, bounced, replied) with timestamps.

## 6 · `/inbox/preferences` — Workspace Hub

Tabs: Channels · Categories · Schedules · Devices · Privacy
**Channels tab:** for each channel (in-app, email, push, SMS, slack), enable/disable + per-category override matrix.
**Schedules tab:** quiet hours, weekend mode, timezone, custom schedules per category.
**Devices tab:** registered devices for push, with last-active.
**Privacy:** "what data shows in previews" toggle (sensitive → require unlock).

## 7 · `/inbox/digest` — Detail-Rich

Curated daily/weekly digest.
**Sections:** "What's new" · "What needs you" · "What you missed" · "Trends".
**Each section** is a list of cards with one-click actions; no bell-triage required.
**Subscribe** button to email this digest at preferred cadence.

## 8 · `/admin/notifications` — Intelligent Dashboard

For operators.
**KPIs:** Sent (24h) · Delivered % · Bounced % · Open rate · Avg latency · Failures (24h)
**Main:**
- Attention queue: provider rate-limit warnings, bounce rate spike, template failures, queue backlog
- `LineSeries` send volume per channel
- `BarSeries` delivery success per template (last 24h)
- `Funnel` send → deliver → open → click
**Rail:** anomalies ("template X bounce 12% (3× baseline)"), provider status, AI

## 9 · `/admin/notifications/templates` — Smart List

Columns: ☐ · Name · Channel · Category · Last edited · Used (30d) · Open rate · A/B
Bulk: activate, archive, clone.

## 10 · `/admin/notifications/templates/:id` — Editor Canvas

Template editor (HTML / MJML / plain) with live preview.
Variables panel; AI ("rewrite for friendlier tone", "shorten 30%").
A/B variant editor.
Save creates a new version (immutable history).

## 11 · `/admin/notifications/rules` — Smart List

Rule definitions: when X happens, route to channel Y for audience Z.
Columns: Name · Trigger · Channels · Audience · Active · Last fired · Volume (24h)
Bulk: enable/disable, archive, clone, export.

## 12 · `/admin/notifications/audit` — Timeline / Log

Append-only delivery audit.
Filterable: by template, channel, recipient, status. Live tail toggle.
Each row expandable to show payload, headers, provider response, traceId.
Hash-chain verify badge.

## Cross-plugin integrations

- All plugins — emit notifications via this plugin's API; this plugin owns delivery + preferences
- `webhooks-core` — outbound integration to Slack, Teams, etc.
- `automation-core` — schedules, throttles, cadences
- `audit-core` — every send + every preference change audited
- `auth-core` — device registration, MFA prompts piggyback this channel
- `ai-assist-core` — drafting, triage, smart digest

## Privacy / consent

- Per-category opt-in (transactional vs marketing)
- Unsubscribe links honoured + auto-suppress
- Provider rate-limit budgets enforced per tenant
- Sensitive content masked in previews when device locked

## Performance budget

Inbox first paint <500ms cold (cached unread count instant); thread render <300ms; compose autosave debounced 800ms; admin dashboard <1.0s cold.

## Open questions

- IMAP/SMTP vs first-party mail server — phase 1: SMTP send + IMAP receive via per-tenant config; phase 2: native receive via inbound webhook + DKIM/SPF.
- Slack/Teams as channels — provider plugins; this plugin remains channel-agnostic.
- AI triage default vs opt-in — opt-in initially with one-tap "enable" prompt.
