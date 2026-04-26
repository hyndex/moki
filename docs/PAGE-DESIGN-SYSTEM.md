# Page Design System

The shared language every Gutu plugin page is composed from.

This is the foundation document. Read it before designing any new page.
Per-plugin design briefs in `docs/page-design/<plugin>.md` reference
the archetypes, slots, widgets, and tokens defined here. The goal is a
system where every plugin can build domain-specific pages that feel
cohesive, are keyboard-driven, recover gracefully from every failure
mode, and out-think a fixed CRUD framework like ERPNext or a flat
CRM-style grid like Twenty.

---

## 0. Why this exists

Most admin frameworks pick one layout and reuse it everywhere. ERPNext
gives you a list view and a form view. Twenty gives you a grid. Both
are honest about what they are; both stop helping the moment you need
something domain-shaped: a Kanban for a sales pipeline, a calendar for
field service, a tree for a Bill of Materials, a graph for entity
relations, a split-inbox for mail, a full-bleed canvas for slides.

Gutu's shell already gives plugins the entire middle canvas (see
[ARCHITECTURE.md](./ARCHITECTURE.md) §"Frontend"). The plugin owns the
page. The shell only contributes the sidebar and topbar. So the
question is not "can we build domain-shaped pages" — we can — but
"how do we keep 75 plugins building 400+ pages from drifting into
inconsistent slop?"

Answer: by composing every page from a small fixed set of
**archetypes**, every archetype from a fixed set of **slots**, every
slot from a fixed set of **widgets**, every widget bound to fixed
**tokens** (color/spacing/motion/typography). Plugins specialise the
content; the structure stays predictable; the user learns it once and
applies it everywhere.

This document is the contract. Per-plugin briefs only fill in domain.

---

## 1. The 12 page archetypes

Every Gutu page MUST be one of these archetypes (or — rarely — a
documented variant). If your page does not fit, push back to design
review before inventing a new one.

| # | Archetype | Use when | Anchor metaphor |
|---|---|---|---|
| 1 | **Intelligent Dashboard** | The page answers "how is this domain doing right now and what needs my attention?" | The control tower |
| 2 | **Workspace Hub** | The page is the home of a single primary entity (a customer, a project, a vehicle) and surfaces everything related | The cockpit |
| 3 | **Smart List** | The page is "browse all X, filter, group, save views, bulk-act" | The catalog with tools |
| 4 | **Kanban / Pipeline** | The data has stages with transitions and you optimise for flow, WIP, aging | The flow board |
| 5 | **Calendar / Schedule** | The data is time-bound, has resources, has conflicts, has capacity | The dispatcher |
| 6 | **Tree Explorer** | The data is hierarchical and you act on subtrees (BOM, COA, org chart, folder tree) | The drilldown |
| 7 | **Graph / Network** | The data is a node-edge graph and the topology IS the value | The map of relations |
| 8 | **Split Inbox** | A queue + a preview + actions on the focused item (mail, notifications, approvals, audit log) | The triage desk |
| 9 | **Timeline / Log** | A time-ordered stream of immutable events you scrub, filter, replay | The flight recorder |
| 10 | **Map / Geo** | The data is geographic, you cluster, route, and cross-reference live signal | The dispatch map |
| 11 | **Editor Canvas** | The page IS a creation surface — slides, doc, whiteboard, spreadsheet | The workshop |
| 12 | **Detail-Rich Page** | The page is "open one record, do everything possible to it" — the existing `RichDetailPage` pattern | The dossier |

Two more half-archetypes that ride on top of any base:

- **Configurator** — wizard / multi-step form (riding on Detail-Rich or Workspace Hub).
- **Comparator** — side-by-side of N entities (rides on Smart List).

---

## 2. The slot grid

Every archetype lays its content into the same 7 slots (most pages
fill 4–5 of them). The shell already gives you the outer chrome
(sidebar, topbar, breadcrumb, max-width container, scroll). Slots
below are *inside* the plugin's owned canvas.

```
┌─────────────────────────────────────────────────────────────────┐
│ S1  PAGE HEADER                                                 │  ← sticky on scroll
│     title · subtitle · entity badge · global page actions        │
├─────────────────────────────────────────────────────────────────┤
│ S2  HERO STRIP / KPI BAR                                        │  ← optional, dashboard archetype only
│     4–6 KPIs · trends · sparklines · period selector             │
├──────────────────────────────────────┬──────────────────────────┤
│ S3  FILTER / TOOLBAR / TAB STRIP     │ S4  RAIL TOP             │
│     filters · views · search · group │     focus card · alerts  │
├──────────────────────────────────────┤                          │
│ S5  MAIN CANVAS                      │ S6  RAIL BODY            │
│     list · board · calendar · graph  │     related · activity   │
│                                      │     metadata · ai panel  │
│                                      │                          │
├──────────────────────────────────────┴──────────────────────────┤
│ S7  FOOTER / ACTION BAR                                          │  ← appears on selection or unsaved changes
│     bulk-action chips · save / cancel · keyboard hints           │
└─────────────────────────────────────────────────────────────────┘
```

| Slot | Required for | Behaviour |
|---|---|---|
| **S1 Header** | All archetypes except #11 (Editor Canvas can opt-out for full-bleed) | Sticky; collapses height by 30% on scroll; always shows current entity context |
| **S2 Hero Strip** | #1 Dashboard, #2 Workspace Hub | KPI cards; trend indicator; period selector; click any KPI → drills to filtered Smart List |
| **S3 Toolbar** | #3, #4, #5, #6, #7, #9, #10 | Filters · saved views · group-by · sort · search · density toggle |
| **S4 Rail Top** | #2, #12, when context >120px wide | Hero card for currently-focused entity (when applicable) |
| **S5 Main** | All | The archetype-specific surface |
| **S6 Rail Body** | #2, #12 | Related entities · activity timeline · metadata · contextual AI · documents |
| **S7 Footer / Action Bar** | Any when bulk selection is active or form has unsaved changes | Slides up from bottom; never overlaps main; explicit Save / Discard with keyboard |

**Rail width:** 360px desktop, 320px laptop, hidden under 1100px (collapses to "Details" tab inline).

**Header height:** 56px expanded, 40px collapsed. Never taller — the dashboard hero strip is its own slot.

**Hero strip height:** 96px single row, 168px when KPIs include sparklines.

---

## 3. The widget catalog

Every widget lives in S2, S4, S5, or S6. Plugins assemble pages by
picking widgets from this list, not by inventing one-off chrome.

### 3.1 KPI widgets (S2)

| Widget | Visual | Required props | Use when |
|---|---|---|---|
| `KpiTile` | Number + delta + tiny sparkline + period chip | `label, value, deltaPct, trend[], period, drillTo` | Single number, trended |
| `KpiRing` | Donut showing portion-of-target | `label, current, target, period` | Goal attainment |
| `KpiStack` | Three rows of label+value, no chart | `rows[]` | When you need 3 numbers in the space of one tile |
| `AnomalyTile` | KPI tile with red/amber outline + "what changed" | `label, value, anomaly: { score, reason, since }` | When a value crossed a threshold; explains itself |
| `ForecastTile` | KPI tile + 7/30/90 day projection band | `label, current, projection: { p10, p50, p90 }` | When the future matters more than the present |

### 3.2 Chart widgets (S2 hero, S5 main, S6 rail)

| Widget | Visual | Use |
|---|---|---|
| `Sparkline` | 1-row inline trend, no axes | Inside KpiTile or rails |
| `LineSeries` | Time series with multi-line, brush, hover | Trends over time |
| `BarSeries` | Vertical / horizontal / stacked / grouped | Comparisons |
| `AreaSeries` | Filled time series, optional stack | Cumulative or share-of |
| `DonutSeries` | With center number + legend on right | Share / mix |
| `Heatmap` | Day-x-hour or NxM cell grid | Density / activity / capacity |
| `Funnel` | Staged drop-off bars + conversion ratios | Pipeline / signup / checkout |
| `Sankey` | Flow between buckets | Routing / categorization |
| `BoxPlot` | Distribution per group | Compare distributions |
| `Histogram` | Single distribution | Latency, value, age distributions |
| `GaugeArc` | Speedometer | Real-time bounded value |
| `CalendarHeatmap` | GitHub-contribution style | Activity-over-days |
| `WorldMap` / `RegionMap` | Choropleth + markers | Geo-distributed metrics |
| `WaterfallSeries` | Bridge chart | Period-over-period decomposition (P&L, cash flow) |

All charts MUST: (a) render an inline empty state, (b) animate in <300ms,
(c) keyboard-navigable points, (d) tap-target ≥24px, (e) respect
`prefers-reduced-motion`.

### 3.3 Data-surface widgets (S5 main)

| Widget | Use |
|---|---|
| `DataGrid` | The Smart List backbone — virtualised rows, column resizing, freeze, group headers, inline cell-edit (opt-in), bulk select |
| `KanbanBoard` | Columns are stages; cards are records; drag = transition; column footer shows count + sum/avg of WIP |
| `CalendarMonth` / `CalendarWeek` / `CalendarDay` | Resource lanes optional; event collision avoidance; capacity overlay |
| `TimelineSwimlane` | Gantt-like; lane per resource/project; dependencies; critical path highlight |
| `TreeView` | Hierarchical with chevron expand, drag-reparent, inline rename |
| `GraphCanvas` | Node-edge with zoom/pan/lasso; live layout; cluster collapse |
| `MapCanvas` | Tile + cluster + polygon + live cursor + route lines |
| `EditorCanvas` | Full-bleed creation surface (Yjs-backed when collaborative) |
| `SpreadsheetGrid` | Cells, formulas, named ranges, paste-from-Excel |
| `RecordPreview` | Right-pane preview of focused row in Split Inbox |

### 3.4 Rail widgets (S4 / S6)

| Widget | Use |
|---|---|
| `RailEntityCard` | The hero card for the currently-focused entity |
| `RailKpiStack` | Compact 4–6 KPI list with values + tiny trend |
| `RailRelatedEntities` | "Linked" — counts + last-touched + click-through |
| `RailActivityTimeline` | Reverse-chronological events, filterable by type |
| `RailDocuments` | Files attached to entity; drag-drop add; preview hover |
| `RailNextActions` | Suggested next actions (rules + AI); each is a one-click |
| `RailRiskFlags` | Compliance / SLA / anomaly flags with severity |
| `RailAiAssistant` | Inline chat scoped to current entity (uses ai-assist plugin) |
| `RailMetadata` | Created/updated/owner/tenant — readonly footer of the rail |
| `RailRecordHealth` | Composite "score" — completeness + freshness + risk |

### 3.5 Header widgets (S1)

| Widget | Use |
|---|---|
| `EntityBadge` | Entity-type chip (e.g. "Invoice INV-2026-0042") with status pill |
| `BreadcrumbTrail` | Comes from shell; plugin only contributes the leaf |
| `HeaderActions` | 1–3 primary actions; overflow menu for secondary |
| `HeaderTabs` | Optional second row when archetype = Workspace Hub or Detail-Rich |
| `PeriodSelector` | "Today / 7d / 30d / Quarter / Year / Custom" — bound to URL state |

### 3.6 Action / control widgets (S3 toolbar, S7 footer)

| Widget | Use |
|---|---|
| `FilterBar` | Chip-style filters; field-aware operators; AI "filter from natural language" entry |
| `SavedViewSwitcher` | Pill bar of saved views (uses saved-views-core plugin) + "+" to save current |
| `GroupBySelect` / `SortSelect` | Compact dropdowns |
| `DensityToggle` | Comfortable / Compact (per-user pref) |
| `BulkActionBar` | Appears on multi-select; primary destructive action requires explicit confirm |
| `CommandHints` | Bottom-right keyboard hint chip strip |

---

## 4. Density, color, motion, typography tokens

Pulled directly from [`UI-UX-GUIDELINES.md`](./UI-UX-GUIDELINES.md). Every
page MUST use these and only these.

### 4.1 Density

| Mode | Row height | Padding | Use |
|---|---|---|---|
| `comfortable` | 44px | 12px | Default; office / desktop |
| `compact` | 32px | 8px | Power users; data-heavy lists |
| `cozy` | 36px | 10px | Used on mobile + tablet only |

Density is per-user; persists in `users.preferences.density`. Pages MAY set
a default (e.g. POS forces `compact`) but must allow override.

### 4.2 Color tokens (semantic only — never raw hex)

```
text-text          // primary
text-text-muted    // secondary
text-text-subtle   // tertiary
bg-surface         // page background
bg-surface-raised  // cards, dialogs
bg-surface-sunken  // input fields, code blocks
border-border      // hairlines
border-border-strong // dividers between sections
text-accent / bg-accent / border-accent  // brand
text-success / bg-success-soft
text-warning / bg-warning-soft
text-danger / bg-danger-soft
text-info / bg-info-soft
```

Semantic mapping for status pills:
- **Open / Active / Healthy** → success
- **Pending / Reviewing** → info
- **At-risk / Aging / Warning** → warning
- **Failed / Overdue / Blocked** → danger
- **Archived / Closed / Inactive** → muted

### 4.3 Motion

- Page transitions: 220ms cubic-bezier(0.16, 1, 0.3, 1)
- Card hover lift: 120ms ease-out
- Drag pickup: 80ms scale to 1.02 + shadow
- Modal in: 180ms · out: 120ms
- Skeleton shimmer: 1500ms linear loop
- All motion respects `prefers-reduced-motion: reduce` — fall back to opacity-only crossfade

### 4.4 Typography scale

| Token | Size / weight | Use |
|---|---|---|
| `text-display` | 28/700 | Hero KPI numbers, page title in dashboards |
| `text-h1` | 22/700 | Page title (S1 header) |
| `text-h2` | 18/600 | Section heading inside main |
| `text-h3` | 15/600 | Card title, rail card title |
| `text-body` | 14/400 | Default |
| `text-small` | 12/400 | Metadata, captions, hints |
| `text-mono-sm` | 13/400 (mono) | IDs, codes, log lines |

Line height 1.45 default; KPI numbers are 1.0 with `font-feature-settings: "tnum"` for tabular alignment.

---

## 5. Archetype specs

Each archetype below is a contract: required slots, required widgets,
empty/loading/error states, keyboard map, URL state, and a wireframe.

### 5.1 Intelligent Dashboard

**When to use:** the page answers "how is this domain doing and what
needs my attention?" Used as the landing page of every major plugin.

**Wireframe:**

```
┌───────────────────────────────────────────────────────────────────────┐
│ S1  Sales Overview                          [Period: 30d ▾] [Refresh] │
├───────────────────────────────────────────────────────────────────────┤
│ S2  ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐                          │
│     │MRR │ │ARPU│ │CAC │ │NRR │ │PIPE│ │FCST│   ← KpiTile · KpiTile   │
│     │$48k│ │ $84│ │$210│ │112%│ │$320│ │$520│      KpiRing · Forecast │
│     │+8% │ │−2% │ │+11%│ │+4% │ │+18%│ │P50 │                          │
│     └────┘ └────┘ └────┘ └────┘ └────┘ └────┘                          │
├──────────────────────────────────────────┬────────────────────────────┤
│ S5  ATTENTION QUEUE                      │ S6  ANOMALIES (3)          │
│  ┌──────────────────────────────────────┐│ ┌────────────────────────┐ │
│  │ ⚠  3 stalled deals over 14d         ││ │ Spike in failed login  │ │
│  │ ⏱  8 invoices overdue 7+d           ││ │ Inventory: SKU-481 −37%│ │
│  │ 🔥 Hot lead: Acme Corp (no follow)  ││ │ AR aging: 30+ up 22%   │ │
│  └──────────────────────────────────────┘│ └────────────────────────┘ │
│                                          │                            │
│  TREND CHARTS (LineSeries · BarSeries)   │ NEXT ACTIONS               │
│  Revenue · New deals · Cash · Tickets    │ • Approve PR-204           │
│                                          │ • Renew SOC2 evidence      │
│                                          │ • Onboard 2 new clients    │
└──────────────────────────────────────────┴────────────────────────────┘
```

**Required widgets:** S2 must have ≥4 KPI tiles. S5 main must have:
(a) Attention Queue (intelligent stack of "things rotting"), (b) at
least 2 trend charts. S6 rail must have: Anomalies (top 3 with
`AnomalyTile`) + Next Actions (rule-based + AI suggestions).

**Empty state:** "Not enough data yet — connect a data source or start
creating records." Show a `<DataConnectorWizard>` if the plugin
supports import.

**Loading state:** Skeleton for each widget; KPI tiles show shimmer
rectangles for value + trend; charts show flat shimmer bar. All
appear simultaneously, not staggered.

**Error state:** Per-widget — one widget failing must NEVER blank the
whole dashboard. Each widget's `<ErrorBoundary>` catches its own
failure and offers "Retry" with the widget's own scope. Show a small
toast for transient errors.

**Keyboard map:**
- `R` → refresh all widgets
- `1..9` → focus the Nth KPI tile (drills to filtered Smart List on Enter)
- `?` → show keyboard help
- `Cmd-K` → command palette
- `Cmd-/` → AI assistant

**URL state:** `?period=30d&compare=prev&segment=tier:enterprise`. Period and segment are deep-linkable.

**Density:** Comfortable only — KPI tiles do not compact below 96px.

**Performance budget:** First KPI visible in <400ms; full hero in <800ms; each chart streams independently with progressive load.

### 5.2 Workspace Hub

**When to use:** the home page of a single primary entity — a
customer in CRM, a project in Projects, a vehicle in Field Service.
Surfaces "everything about this entity."

**Wireframe:**

```
┌───────────────────────────────────────────────────────────────────────┐
│ S1  Acme Corp                       [Edit] [Add Note] [⋯ More]        │
│     Enterprise · Customer since 2024-03-12 · Owned by Maya R.         │
├──────────────────────────────────────────┬────────────────────────────┤
│ S2  ┌────┐ ┌────┐ ┌────┐ ┌────┐         │ S4  RAIL ENTITY CARD        │
│     │ARR │ │OPEN│ │CSAT│ │NRR │         │     [Acme logo]             │
│     │$84k│ │ 12 │ │4.6 │ │128%│         │     Health: 84/100          │
│     └────┘ └────┘ └────┘ └────┘         │     Owner: Maya R.          │
├──────────────────────────────────────────┤     Renewal: 2026-09-30     │
│ S5  TABS:                                │     Plan: Enterprise        │
│  [Overview · Deals · Tickets · Files ·   ├────────────────────────────┤
│   Activity · Contracts]                  │ S6  RELATED                 │
│                                          │  • 8 contacts               │
│  Overview tab:                           │  • 3 open deals ($120k)     │
│   ┌──────────────────────────────────┐   │  • 12 tickets · 2 open      │
│   │ Last interaction: 3d ago         │   │  • 6 contracts              │
│   │ Sentiment: positive              │   │                             │
│   │ Next action: send Q3 review      │   │ ACTIVITY                    │
│   └──────────────────────────────────┘   │  · email · meeting · note   │
│                                          │                             │
│   Recent timeline (10 events) ───────    │ AI ASSISTANT                │
│                                          │  "Why is Acme's health 84?" │
└──────────────────────────────────────────┴────────────────────────────┘
```

**Required widgets:** S1 EntityBadge + HeaderActions. S2 4 KPIs scoped
to this entity. S5 tabbed area — first tab is always "Overview" with
last-interaction + sentiment + suggested next action. S4 RailEntityCard.
S6 RailRelatedEntities + RailActivityTimeline + RailAiAssistant.

**Empty state for tabs:** "No deals yet" / "No tickets yet" with a
single primary CTA to create one in-context.

**Keyboard map:**
- `Cmd-1..6` → switch tabs
- `E` → edit entity
- `N` → new note
- `Cmd-Enter` (in chat) → send to AI
- `Cmd-K` → command palette scoped to this entity

**URL state:** `/<plugin>/<entity-id>?tab=deals&filter=open`

**Performance:** Header + rail render from cache instantly; tabs lazy-load.

### 5.3 Smart List

**When to use:** browse and act on N records of one type.

**Wireframe:**

```
┌───────────────────────────────────────────────────────────────────────┐
│ S1  Invoices                                  [+ New Invoice] [Export]│
├───────────────────────────────────────────────────────────────────────┤
│ S3  [All Open · Overdue · Draft · Paid · Saved+]  [Group: status ▾]   │
│     [Filter: customer=Acme · amount>$1k]         [Density: ▢ Compact] │
│     [🔍 Search]                                  [⋮ Columns]          │
├───────────────────────────────────────────────────────────────────────┤
│ S5  DataGrid                                                          │
│  ┌─────┬───────────┬─────────┬──────────┬──────┬───────┬──────────┐  │
│  │ #   │ Customer  │ Issued  │ Due      │ Total│ Status│ Owner    │  │
│  ├─────┼───────────┼─────────┼──────────┼──────┼───────┼──────────┤  │
│  │ ☐   │ Acme      │ 04-12   │ 04-26 ⚠ │  $4.8k│ Open  │ Maya R.  │  │
│  │ ☐   │ Globex    │ 04-10   │ 04-24    │  $9.2k│ Paid  │ Devon    │  │
│  │ ☐   │ Initech   │ 04-09   │ 04-23 🔴│  $1.5k│ Overd │ Devon    │  │
│  └─────┴───────────┴─────────┴──────────┴──────┴───────┴──────────┘  │
│                                                                       │
│ S7  [3 selected]  [Mark Paid] [Send Reminder] [Export] [Cancel]       │
└───────────────────────────────────────────────────────────────────────┘
```

**Required:** SavedViewSwitcher, FilterBar, GroupBy, Sort, search, columns
manager, virtualised DataGrid, BulkActionBar appearing on selection.

**Empty state:** "No invoices yet — create one or import from CSV." With
sample-data button if env=dev.

**Loading:** Skeleton rows (15 rows × column count); preserve previous
data while next page loads.

**Error:** Inline banner above grid; keep current rows visible if any.

**Keyboard map:**
- `↑↓` row navigation
- `Space` toggle select
- `Shift-↓` extend selection
- `Cmd-A` select all (page) / `Shift-Cmd-A` select all (matching filter)
- `Enter` open detail
- `/` focus search
- `F` open filter
- `G` open group-by
- `Cmd-K` palette
- `D` delete (with confirm)

**URL state:** `?view=overdue&filter=customer:acme&group=status&sort=-due&page=2`

**Density:** All three modes supported. Compact = 32px row.

**Performance budget:** First 50 rows in <200ms from cache, <500ms cold.
Virtualised: 100k rows must stay 60fps.

### 5.4 Kanban / Pipeline

**Wireframe:**

```
┌───────────────────────────────────────────────────────────────────────┐
│ S1  Sales Pipeline                            [+ New Deal]  [Board ▾] │
├───────────────────────────────────────────────────────────────────────┤
│ S3  [Filter: owner=me]  [Group by: stage ▾] [Color: priority ▾]       │
├───────────────────────────────────────────────────────────────────────┤
│ S5  KANBAN                                                            │
│  ┌──────────┬──────────┬──────────┬──────────┬──────────┐             │
│  │ NEW      │ QUALIFY  │ PROPOSAL │ NEGOTIATE│ WON      │             │
│  │ 12 · $120│ 8 · $310 │ 5 · $480 │ 3 · $200 │ 7 · $510 │             │
│  ├──────────┼──────────┼──────────┼──────────┼──────────┤             │
│  │ ┌──────┐ │ ┌──────┐ │ ┌──────┐ │ ┌──────┐ │ ┌──────┐ │             │
│  │ │Deal A│ │ │Deal D│ │ │Deal H│ │ │Deal K│ │ │Deal N│ │             │
│  │ │$12k  │ │ │$80k  │ │ │$110k │ │ │$60k  │ │ │$70k  │ │             │
│  │ │Acme  │ │ │Globex│ │ │Initch│ │ │Soylnt│ │ │Hooli │ │             │
│  │ │  3d ⚠│ │ │  1w  │ │ │ 18d 🔴│ │ │  2d  │ │ │ 12d  │ │             │
│  │ └──────┘ │ └──────┘ │ └──────┘ │ └──────┘ │ └──────┘ │             │
│  │ ┌──────┐ │ ┌──────┐ │ ...      │ ...      │ ...      │             │
│  └──────────┴──────────┴──────────┴──────────┴──────────┘             │
└───────────────────────────────────────────────────────────────────────┘
```

**Required:** Column footer shows `count · sum/avg`. Card shows
domain-relevant icon + age (days in this stage with warn/danger
thresholds). Drag must show drop preview (border highlight) and
disallow drops that violate workflow rules.

**Aging thresholds:** Warn at p75 of historical stage time; danger at
p90. Computed once per day and cached on the board.

**WIP limits:** Optional per-column. Exceeding turns column header amber + a
"WIP exceeded" tooltip explaining the impact.

**Empty column:** Subtle dashed border with "No deals in NEGOTIATE — move one here or" + ghost CTA.

**Keyboard:** `Tab/Shift-Tab` between columns; `↑↓` between cards;
`←→` move card to adjacent stage with workflow check; `Enter` open
detail; `N` new card in focused column.

**URL state:** `?board=sales&filter=owner:me&color=priority`

### 5.5 Calendar / Schedule

**Wireframe:**

```
┌───────────────────────────────────────────────────────────────────────┐
│ S1  Service Schedule                  [+ New Job] [Week ▾] [Today]    │
├───────────────────────────────────────────────────────────────────────┤
│ S3  [Resources: All ▾] [Status: All ▾] [Conflicts: 3 ⚠]               │
├──────────┬────────┬────────┬────────┬────────┬────────┬───────────┐  │
│ TECH     │ MON 22 │ TUE 23 │ WED 24 │ THU 25 │ FRI 26 │ CAPACITY  │  │
│──────────┼────────┼────────┼────────┼────────┼────────┼───────────┤  │
│ Anika    │ ▓▓▓░░  │ ▓░░░░  │ ▓▓▓▓░  │ ▓▓░░░  │ ▓▓▓▓▓  │ 84% ⚠     │  │
│          │ Job 12 │ Job 17 │ J19 J22│ Job 24 │ Job 28 │           │  │
│ Bjorn    │ ▓▓░░░  │ ░░░░░  │ ▓░░░░  │ ▓▓▓░░  │ ▓▓░░░  │ 42%       │  │
│          │ Job 13 │   --   │ Job 20 │ J25 J27│ Job 29 │           │  │
│ Cara     │ ▓▓▓▓░  │ ▓▓▓▓▓ ⚠│ ▓▓▓▓░  │ ░░░░░  │ ▓▓▓░░  │ 71%       │  │
│ ...                                                                   │
└──────────────────────────────────────────────────────────────────────┘  │
```

**Required:** Resource lanes; capacity heatmap row; conflict detection
on overlap; drag to reschedule with snap; right-pane preview on click.

**Conflict highlight:** Red outline + tooltip "X is double-booked
14:00–15:30." Cannot save until resolved.

**Capacity overlay:** Per-resource per-day percentage with green/amber/red.

**Empty state:** "No jobs scheduled this week — drag in a job from the
backlog rail."

**Keyboard:** `T` today; `← →` prev/next period; `D/W/M` change zoom;
`N` new event at cursor; drag with arrow keys when focused.

**URL:** `?period=week&start=2026-04-22&resources=anika,bjorn`

### 5.6 Tree Explorer

**Wireframe:**

```
┌───────────────────────────────────────────────────────────────────────┐
│ S1  Bill of Materials — WIDGET-1000                  [Expand All] [⋯] │
├──────────────────────────┬────────────────────────────────────────────┤
│ S5  TREE                 │ S6  PANEL: Selected Node                   │
│  ▾ WIDGET-1000  qty 1    │  ┌────────────────────────────────────┐   │
│    ▾ ASM-200    qty 2    │  │ Part: ASM-200                       │   │
│      ▸ PART-12  qty 4    │  │ Description: Hinge assembly         │   │
│      ▸ PART-13  qty 2    │  │ UoM: each                           │   │
│      ▾ SUBASM-A qty 1    │  │ Cost: $4.20    Lead time: 3d        │   │
│        ▸ ...             │  │ Effective: 2026-01-01 →             │   │
│    ▸ ASM-300    qty 1    │  │                                     │   │
│    ▸ PART-99    qty 16   │  │ [Replace] [Phase out] [Substitute]  │   │
│  ▾ Service Items         │  └────────────────────────────────────┘   │
│    ▸ SVC-1     qty 2     │  WHERE-USED                                 │
│                          │  • WIDGET-1000 (this BOM)                  │
│                          │  • WIDGET-1100 (BOM rev 2)                 │
└──────────────────────────┴────────────────────────────────────────────┘
```

**Required:** Chevron expand/collapse; drag-reparent (with workflow
check); inline rename; right-pane detail of focused node;
where-used; cost roll-up.

**Loading children:** Lazy — load when expanded; show skeleton row.

**Keyboard:** `← →` collapse/expand; `↑↓` navigate; `Enter` rename;
`Cmd-X / Cmd-V` cut/paste subtree; `D` duplicate.

### 5.7 Graph / Network

**Wireframe:**

```
┌───────────────────────────────────────────────────────────────────────┐
│ S1  Entity Relations — Acme Corp           [Zoom: fit] [Filter ▾]     │
├──────────────────────────┬────────────────────────────────────────────┤
│ S5  GRAPH                │ S6  PANEL                                  │
│                          │                                            │
│       (Maya)──owns──┐    │  Selected: Deal Q3-Renewal                 │
│                     │    │  Source: Acme Corp                         │
│      (Devon)───┐    │    │  Target: 3 contracts                       │
│                ▼    ▼    │  Strength: high                            │
│   ┌─ Acme Corp ──┐  │    │                                            │
│   │              │  │    │  Path to: Maya R.                          │
│   ├─Deal Q3 ─────┤  │    │  [hop chain shown]                         │
│   ├─Contract C1──┤  │    │                                            │
│   └─Tickets (3)──┘  │    │  HOPS  IN  OUT  CLUSTER                    │
│                          │   2     8   12   "renewal-rs"              │
└──────────────────────────┴────────────────────────────────────────────┘
```

**Required:** Force-directed layout with cluster collapse;
`zoom-to-fit`; lasso select; min-distance enforcement; live updates
when underlying data mutates (subscribed via record-events).

**Performance:** Hard limit 5000 visible nodes / 20000 edges; beyond
that, automatic clustering with breadcrumb to drill in.

**Keyboard:** `+/-` zoom; `0` fit; arrow keys pan; `F` filter;
`L` lasso; `Esc` clear selection.

### 5.8 Split Inbox

**Wireframe:**

```
┌───────────────────────────────────────────────────────────────────────┐
│ S1  Inbox                                       [Compose] [⋯ Filter]  │
├──────────────────────────┬────────────────────────────────────────────┤
│ S5a  LIST                │ S5b  PREVIEW                               │
│  ☐ Alice  Re: Quote …    │  From: Alice (alice@acme.com)              │
│  ☐ Bob    Sprint review  │  Date: Today 09:14                         │
│  ☐ Carl   Invoice 0042   │  Subject: Re: Quote for renewal            │
│  ▣ Dana   Welcome aboard │                                            │
│  ☐ Eve    Inv error 500  │  Hi team,                                  │
│  ☐ Faye   Login issue    │  We're keen to renew with the new tier …   │
│  ...                     │                                            │
│                          │  [Reply] [Reply all] [Forward] [Snooze]    │
│                          │  [Convert to: Deal · Ticket · Task ▾]      │
└──────────────────────────┴────────────────────────────────────────────┘
```

**Required:** List density-toggleable; unread bold; thread grouping;
keyboard-driven; preview shows full message + attachments + actions;
"Convert to" creates a record in another plugin via the
`erp-actions-core` plugin.

**Keyboard:** `↑↓` move; `J K` next/prev; `Enter` open in full;
`R` reply; `A` reply all; `F` forward; `E` archive; `#` delete (with
confirm); `S` snooze; `M` mark read/unread; `/` search.

### 5.9 Timeline / Log

**Wireframe:**

```
┌───────────────────────────────────────────────────────────────────────┐
│ S1  Audit Log                                  [Verify chain] [Export]│
├───────────────────────────────────────────────────────────────────────┤
│ S3  [Filter: action=invoice.create OR user=devon]  [Live: ON]         │
├───────────────────────────────────────────────────────────────────────┤
│ S5  ─────●  09:14  invoice.create  by maya  inv:INV-0042  ✓ verified  │
│         │                                                             │
│     ────●  09:13  payment.received by webhook  inv:INV-0040  ✓        │
│         │                                                             │
│     ────●  09:11  user.login       by devon                         ✓ │
│         │                                                             │
│     ────●  09:10  invoice.send     by automation  inv:INV-0042  ✓     │
│         │                                                             │
│         …  load older                                                 │
└───────────────────────────────────────────────────────────────────────┘
```

**Required:** SHA-chain verify column (✓/✗); filter; live tail toggle;
expand row to see full payload diff; export JSONL; jump-to-time.

**Keyboard:** `L` toggle live; `V` verify chain; `→` expand;
`Cmd-F` filter; `Home / End` jump.

### 5.10 Map / Geo

**Wireframe:** tile map fills S5; left float-card has filter/legend;
right rail has selected-marker detail; bottom strip has live-status
chip ("16 active · 3 idle · 1 stalled"). Cluster bubbles up at low
zoom; route lines drawn for in-progress trips; geofences shaded.

**Keyboard:** `+/-` zoom; arrows pan; `0` fit; `C` toggle clusters;
`R` toggle routes; `Cmd-K` jump to location.

### 5.11 Editor Canvas

Full-bleed (sets `fullBleed: true` on the page descriptor — see §11).
Header collapses to a thin 32px bar. Toolbar floats. Right-side rail
is collapsible to icons. Yjs-backed if collaborative.

**Required:** Autosave every 800ms (debounced); offline queue; cursor
presence; comments; version history pill.

**Keyboard:** application-specific (slides, doc, whiteboard,
spreadsheet) — but `Cmd-S` always saves explicitly, `Cmd-Z/Cmd-Shift-Z`
always undo/redo, `Cmd-K` always opens command palette.

### 5.12 Detail-Rich Page

Wraps the existing `RichDetailPage` from the admin shell. The
archetype Workspace Hub is the dashboard-style flavour of this same
underlying surface. Detail-Rich is for "open one record, do
everything."

**Required tabs (in order):** Overview · domain tabs · Activity · Files · Audit.

---

## 6. Empty / loading / error / offline states

These are not optional. Every page MUST design all four.

### 6.1 Empty

The empty state is a **first-class screen**, not a placeholder. It
must:
- Explain why the page is empty in plain language
- Offer the highest-leverage next action as a button
- Optionally show a sample-data button (env=dev only)
- Use an illustration only if it teaches something — never decorative

Pattern: `<EmptyState title subtitle action onAction sample />`

### 6.2 Loading

Skeleton-first, no spinners on initial load. Structure of skeletons
must mirror real layout (KPI tiles look like KPI tiles; rows look
like rows). Spinners allowed for in-place actions only (saving a
form, sending an email).

### 6.3 Error

Three tiers:

| Tier | Trigger | Treatment |
|---|---|---|
| Widget | One widget on the page failed | Per-widget `<ErrorBoundary>` — small inline error card + retry |
| Page | The page's primary data failed | Full-page error screen with retry + "Report an issue" |
| Shell | Plugin failed to mount | Caught by shell; renders the plugin-failure card with traceId |

Errors MUST surface a `traceId` (linked to the request — see
[OBSERVABILITY.md](./OBSERVABILITY.md)) so support can find the
matching log line.

### 6.4 Offline / degraded

For pages with realtime/collab features, show a small `<OfflineChip>`
in S1 when WS disconnected. Queue mutations locally; replay on
reconnect. Never silently swallow offline writes.

---

## 7. Accessibility

All archetypes inherit:

- Tab order matches reading order; never trapped.
- Focus rings: 2px `border-accent` with 2px offset; never removed.
- ARIA: live region for KPI updates (`aria-live="polite"`); roles for
  grids (`role="grid"`), kanban (`role="list"`), tabs (`role="tablist"`).
- Keyboard: all archetypes documented above; `?` opens keymap on every page.
- Color contrast: text ≥4.5:1; large text ≥3:1; focus ring ≥3:1.
- Reduce motion: respect `prefers-reduced-motion: reduce`.
- Screen reader: every chart has a `<caption>` and `aria-describedby`
  pointing at a textual summary; data tables have proper headers.
- Density modes: comfortable mode meets WCAG 2.5.5 Target Size (≥24×24).
  Compact mode degrades gracefully but warns under WCAG AAA.

---

## 8. Performance contract

| Metric | Budget |
|---|---|
| First paint | <200ms (cache hit) / <800ms (cold) |
| First KPI value | <400ms |
| Hero strip complete | <800ms |
| Largest contentful paint | <1500ms |
| Time to interactive | <2000ms |
| Smart List 60fps | up to 100k virtualised rows |
| Kanban drag latency | <16ms per frame |
| Editor input → render | <50ms |

Pages MUST cache S2 KPI values + S6 rail card via SWR (stale-while-
revalidate). On revisit, show cached instantly; refetch in background.

Pages MUST instrument these via the existing telemetry-ui library and
emit to `/api/_metrics`.

---

## 9. URL state contract

Every filter, view, period, tab, group, sort, page must round-trip
through the URL. Two reasons: deep-linkable (paste link → same view)
and undoable (back button restores).

URL parameters use the format:
- `?view=<saved-view-id>` — saved view (overrides filters below)
- `?filter=<field>:<op>:<value>;<field>:<op>:<value>` — ad-hoc filters
- `?group=<field>` · `?sort=<field>` (prefix `-` for desc)
- `?page=<n>` · `?size=<n>`
- `?period=<7d|30d|qtd|ytd|custom:start..end>`
- `?tab=<tab-id>`

Saved views collapse all the above into one ID.

---

## 10. Cross-plugin contracts

A page is rarely sealed off from the rest of the app. Use these to
reach across:

- **`record-links-core`** — show "Linked from / Linked to" in the rail.
  Every entity gets a free relations graph.
- **`timeline-core`** — append events; surface in `RailActivityTimeline`.
- **`favorites-core`** — every entity can be starred.
- **`saved-views-core`** — pages with a list MUST register their
  filterable schema; users get free saved views + sharing.
- **`awesome-search-core`** — every page MUST register its searchable
  fields so global search works.
- **`erp-actions-core`** — every page MAY register quick-actions (e.g.
  "convert email → deal"). Surfaced in the Cmd-K palette.
- **`workflow-core`** — for archetypes #4 / #5, hook into workflow
  state transitions for guards and side effects.
- **`ai-core` / `ai-assist-core`** — every Workspace Hub MUST embed
  a `RailAiAssistant` scoped to the entity.
- **`notifications-core`** — long actions toast on completion;
  failures route to the persistent inbox.
- **`audit-core`** — every mutation auto-emits an audit row; pages
  do not need to call this manually.

---

## 11. Plugin contract additions

To make this design system real, the plugin UI contract gains
optional fields. None are required — defaults preserve current
behaviour.

```ts
type PluginPageDescriptor = {
  id: string;
  path: string;
  title: string;
  Component: ComponentType;
  icon?: string;

  // ─── added by this design system ───
  archetype?:
    | "dashboard" | "workspace-hub" | "smart-list"
    | "kanban" | "calendar" | "tree" | "graph"
    | "split-inbox" | "timeline" | "map"
    | "editor-canvas" | "detail-rich";

  fullBleed?: boolean;          // skip max-w-[1400px] wrapper (editor canvas)
  density?: "comfortable" | "compact" | "cozy";  // page default; user can override

  searchable?: SearchSchema;    // for awesome-search-core
  savedViews?: ViewSchema;      // for saved-views-core
  quickActions?: QuickAction[]; // for cmd-k + erp-actions-core
};
```

The shell uses `archetype` only to add a `data-archetype` attribute
on the outer container (for analytics + theme overrides). Plugins
remain free to render any component.

---

## 12. Naming, copy, microcopy

- **Page title:** noun phrase, sentence-case, no trailing period.
  ✓ "Sales pipeline"  ✗ "Sales Pipelines."
- **Section title:** ≤4 words.
- **Empty state title:** verb + object.
  ✓ "Add your first invoice"  ✗ "No data."
- **Confirm destructive:** name the thing + verb + count.
  ✓ "Delete 3 invoices?"  ✗ "Are you sure?"
- **Status pills:** one word.
- **Numbers:** localised with `Intl.NumberFormat`. Currency with currency
  code on hover. Tabular numerals always.

---

## 13. Polish checklist

Every page MUST tick these before shipping. The plugin-author
checklist in [PLUGIN-DEVELOPMENT.md §13](./PLUGIN-DEVELOPMENT.md)
references this list.

**Layout & structure**
- [ ] Archetype declared on the page descriptor
- [ ] Slots used as documented (no S1 substitutes; no rogue chrome)
- [ ] Rail collapses below 1100px
- [ ] Header sticks on scroll
- [ ] No horizontal scrollbar at 1280px

**Data**
- [ ] Empty state designed and reachable in <5 minutes by clearing the filter
- [ ] Loading state mirrors real layout (skeleton, not spinner)
- [ ] Three-tier error handling: widget · page · shell
- [ ] URL round-trips all filters, view, period, tab, sort, group, page

**Performance**
- [ ] First KPI <400ms (cached); first paint <800ms (cold)
- [ ] Virtualised lists past 100 rows
- [ ] SWR on hero/rail surfaces

**Keyboard & a11y**
- [ ] All actions reachable without mouse
- [ ] Focus visible everywhere
- [ ] `?` opens keymap
- [ ] Charts have textual descriptions
- [ ] Color is never the only signal

**Cross-plugin**
- [ ] Searchable schema registered (`awesome-search-core`)
- [ ] Saved views schema registered (`saved-views-core`)
- [ ] Quick actions registered (`erp-actions-core`)
- [ ] Activity events emitted (`timeline-core`)
- [ ] Audit auto-emits (no manual calls needed)

**Polish**
- [ ] Density mode supported (or doc'd as fixed)
- [ ] Numbers tabular
- [ ] Status pills semantic-coloured
- [ ] Motion respects `prefers-reduced-motion`
- [ ] Microcopy passes the rules in §12

---

## 14. Comparison: ERPNext / Twenty / Gutu

| Capability | ERPNext | Twenty | Gutu |
|---|---|---|---|
| Pages are domain-shaped | List + Form only | Grid only | 12 archetypes |
| Plugin-owned canvas | No (form-engine driven) | No (record schema driven) | Yes (whole middle) |
| Per-page archetype declaration | n/a | n/a | `archetype` field |
| Intelligent dashboard with anomaly + forecast | Limited | None | First-class archetype |
| Tree / Graph / Kanban / Calendar as primary surfaces | Limited (Kanban only) | None | All four |
| Editor canvas (slides, whiteboard, doc) | None | None | First-class archetype |
| Cross-entity rails (related, activity, AI) | Manual | Manual | Wired through 6 plugins |
| Realtime / collaborative pages | None | Limited | Yjs + WS-backed |
| Saved views with shareable URLs | Limited | Yes | Yes + URL round-trip |
| Per-tenant plugin-page enable/disable | No | No | Yes (`tenant-enablement`) |
| Density modes | One | One | Three |
| Hash-chained audit on every page | Manual | None | Automatic |
| Plugin-author can ship any archetype | No | No | Yes |
| Keyboard-driven by default | Partial | Partial | Required (each archetype documented) |

---

## 15. Versioning

This document is versioned. Breaking changes (e.g., renaming an
archetype, removing a slot, changing a token) bump major. Additive
changes (new archetype, new widget, new token) bump minor.

Per-plugin design briefs reference `design-system: 1.0` in their
frontmatter. Briefs older than the current major version trigger a
docs-CI warning.

Current version: **1.0** (2026-04-26).
