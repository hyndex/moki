---
plugin: gutu-plugin-crm-core
design-system: 1.0
tier: flagship
last-updated: 2026-04-27
---

# CRM — Page Design Brief

The customer-relationship plugin. The most-visited surface in any
business OS — must feel inevitable.

## Positioning

CRM is the entity-of-entities. People, companies, deals, activities,
inboxes, pipelines, all join here. The flagship goal: _ten seconds
from "open the app" to "I know what to do today."_ That's the
litmus test. ERPNext gives you a list of leads; Twenty gives you a
grid of records. We give you a control tower.

## Page map

| # | Page path | Archetype | Purpose |
|---|---|---|---|
| 1 | `/crm` | Intelligent Dashboard | "What needs me today?" |
| 2 | `/crm/people` | Smart List | All people, filterable |
| 3 | `/crm/companies` | Smart List | All companies |
| 4 | `/crm/deals` | Kanban / Pipeline | Sales pipeline (stage-driven) |
| 5 | `/crm/deals/list` | Smart List | Tabular alt-view of deals |
| 6 | `/crm/people/:id` | Workspace Hub | Person 360 |
| 7 | `/crm/companies/:id` | Workspace Hub | Company 360 |
| 8 | `/crm/deals/:id` | Detail-Rich | Deal cockpit |
| 9 | `/crm/activities` | Split Inbox | Activity inbox (calls/meetings/emails) |
| 10 | `/crm/segments` | Smart List | Saved segments + cohort builder |
| 11 | `/crm/territories` | Map / Geo | Account map by territory |
| 12 | `/crm/relations` | Graph / Network | Account topology |

## 1 · `/crm` — Intelligent Dashboard

**S2 KPIs (6):**
- `New leads (period)` · KpiTile · drill → people filter `status:new&created:period`
- `Open pipeline value` · KpiTile · drill → deals kanban
- `Win rate (period)` · KpiRing · target=team monthly target
- `Avg sales cycle` · KpiTile · trend p50 cycle days
- `Stalled deals (>14d)` · AnomalyTile · drill → deals `stalled:true`
- `Forecast (next 30d)` · ForecastTile · `p10/p50/p90`

**S5 main:**
- `Attention Queue` (top): hot leads (no follow-up >5d) · stalled deals
  · meetings without notes · birthdays this week
- `LineSeries`: weekly new deals + weighted pipeline value
- `Funnel`: stage-by-stage conversion (last 90d)
- `Heatmap`: rep activity by day-of-week × hour

**S6 rail:**
- Anomalies (3): "outreach drop on Tuesday", "win rate dipped 8% w/w", "Acme has gone silent 11d"
- Next actions: rule + AI suggestions ("send Q3 review to top 5 customers")
- AI assistant chat scoped to the dashboard

**Filters:** period (7/30/90/QTD/YTD/custom), team, owner, segment.
**URL:** `?period=30d&team=west&segment=enterprise`
**Density:** comfortable.
**Empty:** "No leads yet — import a CSV or connect Mail." Sample-data button.

## 2 · `/crm/people` — Smart List

**Columns (default):** ☐ · Name · Company · Title · Status · Last touch · Owner · Tags
**Saved views (seeded):** All · My people · No-touch >30d · New (7d) · VIPs · Recently engaged
**Filter chips:** status, owner, tags, source, last-touch-days, has-deal, has-open-deal
**Group by:** company / status / owner / source / territory
**Bulk actions:** add to segment, change owner, send sequence, merge duplicates, export, delete (confirm)
**Inline AI:** "/ask describe a filter" → parses natural language → fills FilterBar

**Quick-create:** `N` opens a sheet with name+email; AI auto-suggests company from email domain.

**Cross-plugin:** searchable via `awesome-search-core`; activity timeline via `timeline-core`; record-links exposed.

## 3 · `/crm/companies` — Smart List

Same skeleton as `/crm/people` with these column changes:
**Columns:** ☐ · Name · Domain · Industry · Tier · ARR · Owner · Health · Last touch · Tags
**Bulk:** assign owner, add to portfolio, run enrichment job (AI), export.
**`Health` column:** RailRecordHealth-derived score 0–100 with semantic colour.

## 4 · `/crm/deals` — Kanban (primary)

**Columns:** New · Qualified · Proposal · Negotiation · Won · Lost (collapsed by default)

**Card content:** name · customer · amount · age-in-stage · owner avatar · primary tag.
**Card colour:** by `priority` (low/med/high) — toggleable to `value` (low/med/high quintile) or `risk` (AI score).

**Footer per column:** count · sum · avg-cycle-days.
**Aging:** card border amber at p75 stage time, red at p90.
**WIP limits:** off by default; admin can enable per stage.

**Drag rules:** must satisfy `workflow-core` transitions. Disallowed
drops show a red dot + tooltip with the failing rule.

**Quick actions on hover:** snooze, log activity, reassign owner, +note.

**Empty stage:** dashed ghost ("no deals here — drag a card or +new").

## 5 · `/crm/deals/list` — Smart List

For users who prefer rows. Same data, columns: ☐ · Name · Customer · Stage · Amount · Probability · Expected close · Age · Owner · Last activity.

## 6 · `/crm/people/:id` — Workspace Hub

**S1:** EntityBadge (avatar + name + title) · status pill · HeaderActions [Email · Call · Schedule · ⋯ Convert / Merge / Delete]
**S2 KPIs (4):** ARR contribution · Deals (open/won) · Tickets · Days since last touch
**Tabs:** Overview · Deals · Activities · Tickets · Notes · Files · Audit
**Overview tab:** sentiment chip · last interaction · suggested next action · "key facts" extracted by AI · contact preferences
**S4 rail card:** photo · title · company · social handles · `Edit` pill
**S6:**
- Related: company · deals (count + sum) · tickets · contracts · contacts at same company
- Activity timeline (filterable)
- Documents
- AI assistant ("draft a follow-up email")
- Risk flags (no-touch, dropped engagement)

**Keyboard:** `Cmd-1..7` tabs · `E` edit · `M` email · `C` call · `S` schedule · `Cmd-Enter` send AI

## 7 · `/crm/companies/:id` — Workspace Hub

Same skeleton; tabs: Overview · People · Deals · Tickets · Contracts · Files · Audit.
Overview adds: tier · industry · health score · renewal date · org chart (mini-graph).

## 8 · `/crm/deals/:id` — Detail-Rich

**S1:** "Deal — Q3 Renewal" · stage pill · amount · expected close · HeaderActions [Move stage ▾ · Win · Lose · ⋯]
**S2 KPIs:** Amount · Probability · Days in stage · Days to close
**Tabs:** Overview · Quote · Tasks · Activity · Files · Audit
**Overview:** decision-makers list · competitor flag · key risks · next steps (AI-suggested) · linked records (PO, contract, support tickets)
**Rail:** customer card · linked products · win/loss similar deals · AI ("what would push this to close?")

## 9 · `/crm/activities` — Split Inbox

List (left) of activities (calls/meetings/emails/notes/tasks) + preview (right).
**Filter chips:** type · owner · with-customer · sentiment · open/closed
**Bulk:** mark done, reassign, add to follow-up sequence
**Convert-to:** call → task · email → deal · note → knowledge article (via `erp-actions-core`).

## 10 · `/crm/segments` — Smart List

Cohort definitions. Columns: name · description · size · created · last refreshed · owner · auto-refresh.
Click → opens segment in person/company list with the saved-view applied.
**Cohort builder:** rule chips with AND/OR/NOT; preview count live.

## 11 · `/crm/territories` — Map / Geo

World/region map of accounts. Cluster bubbles by territory; colour by ARR.
Filter: territory · tier · owner · stage.
Selecting a cluster → side-pane lists accounts.
Useful for travel planning + territory rebalancing.

## 12 · `/crm/relations` — Graph / Network

Force-directed graph of accounts ↔ contacts ↔ deals ↔ contracts.
Nodes coloured by entity type; edges weighted by recency-of-interaction.
Cluster collapse on >5000 nodes.

## Cross-plugin integrations

- `awesome-search-core` — registers People, Companies, Deals as searchable
- `saved-views-core` — registers schemas for #2, #3, #5, #10
- `timeline-core` — emits events on every CRM action
- `record-links-core` — surfaces linked tickets, invoices, contracts
- `erp-actions-core` — exposes "Convert to deal", "Merge people", "Send sequence"
- `ai-assist-core` — embeds inline assistant on hub pages
- `notifications-core` — long actions toast on completion
- `automation-core` — cadences, drip sequences, follow-up reminders
- `analytics-bi-core` — feeds the dashboard charts
- `audit-core` — records every mutation
- `field-metadata-core` — custom fields per tenant on people/companies/deals

## Performance budget (per archetype contract)

Dashboard hero <800ms cold; Smart Lists virtualise past 100 rows; Kanban
60fps drag; Hub renders header+rail from cache instantly.

## Open questions

- Auto-merge of duplicate people: confidence threshold? (proposal: ≥0.92 auto, 0.7–0.92 review queue, <0.7 ignore)
- AI "next action" attribution: who owns when AI suggestion is accepted?
  → emit a `recommendation.accepted` event + audit row.
- Mobile: which archetypes degrade to a single column? (Kanban: yes →
  swipeable columns; Graph: simplified to top-N).
