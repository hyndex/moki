# Page Design Implementation Guide

The runtime API + recipes for building plugin pages from the design
system contract in [`PAGE-DESIGN-SYSTEM.md`](./PAGE-DESIGN-SYSTEM.md).

This is what you read after the system doc. It tells you the imports,
the types, the hooks, the patterns. Reference implementations in
[`apps/admin-panel/src/examples/sales-crm/crm-archetype-dashboard.tsx`]
and `crm-archetype-list.tsx` show every concept in working code.

---

## 1. Where the runtime lives

```
admin-panel/src/admin-archetypes/
├── index.ts                    # barrel exports
├── types.ts                    # ArchetypeId, Density, KpiTrend, etc.
├── slots/                      # the 7 slot components
│   ├── Page.tsx
│   ├── PageHeaderSlot.tsx
│   ├── HeroStrip.tsx
│   ├── Toolbar.tsx
│   ├── Layout.tsx              # BodyLayout (main + rail)
│   ├── MainCanvas.tsx
│   ├── Rail.tsx
│   └── ActionBar.tsx
├── widgets/                    # the widget catalog
│   ├── KpiTile.tsx
│   ├── KpiRing.tsx
│   ├── AnomalyTile.tsx
│   ├── ForecastTile.tsx
│   ├── Sparkline.tsx
│   ├── AttentionQueue.tsx
│   ├── RailEntityCard.tsx
│   ├── RailNextActions.tsx
│   ├── RailRiskFlags.tsx
│   ├── RailRecordHealth.tsx
│   ├── RailRelatedEntities.tsx
│   ├── PeriodSelector.tsx
│   ├── DensityToggle.tsx
│   ├── CommandHints.tsx
│   ├── FilterChipBar.tsx
│   └── BulkActionBar.tsx
├── archetypes/                 # the 12 archetype compositions
│   ├── IntelligentDashboard.tsx
│   ├── WorkspaceHub.tsx
│   ├── SmartList.tsx
│   ├── KanbanArchetype.tsx
│   ├── CalendarSchedule.tsx
│   ├── TreeExplorer.tsx
│   ├── GraphNetwork.tsx
│   ├── SplitInbox.tsx
│   ├── TimelineLog.tsx
│   ├── MapGeo.tsx
│   ├── EditorCanvas.tsx
│   └── DetailRichArchetype.tsx
├── hooks/
│   ├── useUrlState.ts
│   ├── useArchetypeKeyboard.ts
│   ├── useDensity.ts
│   ├── useSwr.ts
│   ├── useFilterChips.ts
│   └── useSelection.ts
├── state/
│   ├── WidgetErrorBoundary.tsx
│   ├── WidgetSkeleton.tsx
│   ├── WidgetShell.tsx
│   ├── ArchetypeEmptyState.tsx
│   └── OfflineChip.tsx
└── __tests__/                  # filterCodec + keyMatcher pure-fn tests
```

Plugins import everything from a single barrel:

```ts
import {
  IntelligentDashboard, SmartList, /* …archetypes */
  KpiTile, KpiRing, AnomalyTile, /* …widgets */
  WidgetShell, ArchetypeEmptyState,
  useUrlState, useArchetypeKeyboard, useSwr, useFilterChips, useSelection,
} from "@/admin-archetypes";
```

---

## 2. Plugin descriptor: opting into an archetype

In your plugin's `host-plugin/ui/index.ts`:

```ts
import { defineAdminUi } from "@/host/plugin-ui-contract";
import MyDashboard from "./pages/MyDashboard";

export const adminUi = defineAdminUi({
  id: "my-plugin",
  pages: [
    {
      id: "my-plugin.dashboard",
      path: "/my-plugin",
      title: "My plugin",
      icon: "Activity",
      Component: MyDashboard,

      // ── new fields (optional) ──
      archetype: "dashboard",     // tags data-archetype + analytics
      fullBleed: false,            // skip max-w wrapper (editor canvas, POS)
      density: "comfortable",      // page default; user pref still wins

      searchable: {                // → awesome-search-core
        resource: "my-plugin.thing",
        fields: ["name", "tags", "owner"],
      },
      savedViews: {                // → saved-views-core
        resource: "my-plugin.thing",
        filterFields: ["status", "owner", "tag"],
        sortFields: ["created", "updated", "name"],
      },
      quickActions: [              // → erp-actions-core + Cmd-K
        {
          id: "my-plugin.cmd.new",
          label: "New thing",
          icon: "Plus",
          run: () => { window.location.hash = "/my-plugin/new"; },
        },
      ],
    },
  ],
});
```

The shell automatically:

- Sets `data-archetype="dashboard"` on the outer container
- Sets `data-density="<value>"` so descendants can react via CSS var
- When `fullBleed: true` (or `archetype === "editor-canvas"`), skips the
  `max-w-[1400px] px-6 py-6` wrapper and lets the page take the full
  viewport
- Reads the user's `gutu.ui.density` localStorage pref and overrides the
  `density` field

---

## 3. The 12 archetypes — when to use which

| Archetype | Component | Use when |
|---|---|---|
| Intelligent Dashboard | `<IntelligentDashboard>` | Landing page of any plugin — "what should I do today?" |
| Workspace Hub | `<WorkspaceHub>` | Entity 360 — open one customer / project / vehicle and see everything |
| Smart List | `<SmartList>` | Browse / filter / group / save / bulk-act on N records |
| Kanban | `<KanbanArchetype>` | Stage-driven flow (deals, tickets, work orders) |
| Calendar | `<CalendarSchedule>` | Time-bound resources with conflicts and capacity |
| Tree Explorer | `<TreeExplorer>` | Hierarchical (BOM, COA, org chart, folders) |
| Graph / Network | `<GraphNetwork>` | Topology of links — accounts, relations, dependencies |
| Split Inbox | `<SplitInbox>` | Triage queue + preview + actions (mail, notifications, approvals) |
| Timeline / Log | `<TimelineLog>` | Time-ordered events (audit, activity, diagnostics) |
| Map / Geo | `<MapGeo>` | Geographic — fleet, field service, deliveries |
| Editor Canvas | `<EditorCanvas>` | Full-bleed creation surface (slides, doc, whiteboard, sheets) |
| Detail-Rich | `<DetailRichArchetype>` | Wraps the existing `RichDetailPage` primitive |

If a page does not fit any of these, push back to design review before
inventing a new one. See [`PAGE-DESIGN-SYSTEM.md` §1](./PAGE-DESIGN-SYSTEM.md#1-the-12-page-archetypes).

---

## 4. Recipe: an Intelligent Dashboard

Worked reference: [`crm-archetype-dashboard.tsx`](../admin-panel/src/examples/sales-crm/crm-archetype-dashboard.tsx).

```tsx
import {
  IntelligentDashboard,
  KpiTile, KpiRing, AnomalyTile, ForecastTile,
  AttentionQueue,
  PeriodSelector, type PeriodKey,
  RailRecordHealth, RailNextActions, RailRiskFlags,
  WidgetShell,
  useUrlState, useArchetypeKeyboard, useSwr,
} from "@/admin-archetypes";

export default function MyDashboard() {
  const [params, setParams] = useUrlState(["period"] as const);
  const period = (params.period as PeriodKey | undefined) ?? "30d";

  const kpis = useSwr("my.kpis", () => fetchKpis(period), { ttlMs: 30_000 });
  const attention = useSwr("my.attention", fetchAttention, { ttlMs: 30_000 });

  useArchetypeKeyboard([
    { label: "Refresh", combo: "r", run: () => kpis.refetch() },
  ]);

  return (
    <IntelligentDashboard
      id="my.dashboard"
      title="My dashboard"
      subtitle="Everything in one place"
      actions={
        <PeriodSelector
          value={period}
          onChange={(p) => setParams({ period: p })}
          withCompare
        />
      }
      kpis={
        <>
          <WidgetShell label="MRR" state={kpis.state} skeleton="kpi" onRetry={kpis.refetch}>
            <KpiTile
              label="MRR"
              value={fmt(kpis.data?.mrr ?? 0)}
              period={period}
              trend={{ deltaPct: kpis.data?.mrrDelta, positiveIsGood: true }}
              drillTo={{ kind: "hash", hash: "/billing" }}
            />
          </WidgetShell>
          <WidgetShell label="Win rate" state={kpis.state} skeleton="kpi">
            <KpiRing label="Win rate" current={0.34} target={0.40} period={period} />
          </WidgetShell>
          <WidgetShell label="Anomaly" state={kpis.state} skeleton="kpi">
            <AnomalyTile
              label="Stalled"
              value={7}
              anomaly={{ score: 0.7, reason: "Avg dwell 18d", since: "..." }}
            />
          </WidgetShell>
          <WidgetShell label="Forecast" state={kpis.state} skeleton="kpi">
            <ForecastTile
              label="Forecast"
              current={fmt(kpis.data?.forecast.current ?? 0)}
              forecast={{ p10: 70_000, p50: 92_000, p90: 124_000, horizon: "30d" }}
            />
          </WidgetShell>
        </>
      }
      main={
        <WidgetShell
          label="Attention queue"
          state={attention.state}
          skeleton="list"
          empty={{ title: "Nothing's stuck" }}
        >
          <AttentionQueue items={attention.data?.items ?? []} />
        </WidgetShell>
      }
      rail={
        <>
          <RailRecordHealth score={{ score: 84, tier: "success" }} />
          <RailNextActions actions={[…]} />
          <RailRiskFlags flags={[…]} />
        </>
      }
    />
  );
}
```

---

## 5. Recipe: a Smart List

Worked reference: [`crm-archetype-list.tsx`](../admin-panel/src/examples/sales-crm/crm-archetype-list.tsx).

```tsx
import {
  SmartList, FilterChipBar, DensityToggle,
  WidgetShell, type BulkAction,
  useUrlState, useArchetypeKeyboard,
  useFilterChips, useSelection, useSwr,
} from "@/admin-archetypes";

export default function People() {
  const [params, setParams] = useUrlState(["q"] as const);
  const q = params.q ?? "";
  const { chips, add, remove, clear } = useFilterChips();
  const selection = useSelection<string>();

  const data = useSwr(`people?q=${q}&filters=${chips.length}`, fetchPeople);

  useArchetypeKeyboard([
    { label: "Search", combo: "/", run: () => focusSearch() },
    { label: "Select all", combo: "cmd+a", run: () => selection.setAll(rows.map(r => r.id)) },
    { label: "Clear", combo: "esc", run: () => selection.clear() },
  ]);

  const bulkActions: BulkAction[] = [
    { id: "email", label: "Send email", onAction: () => /* … */ },
    { id: "archive", label: "Archive", variant: "danger", confirm: { title: "…" }, onAction: /* … */ },
  ];

  return (
    <SmartList
      id="people.list"
      title="People"
      toolbarStart={<FilterChipBar chips={chips} onRemove={remove} onClear={clear} />}
      toolbarEnd={<DensityToggle />}
      selected={selection.ids}
      bulkActions={bulkActions}
      onClearSelection={selection.clear}
    >
      <WidgetShell label="People" state={data.state} skeleton="table">
        <Table rows={data.data ?? []} selection={selection} />
      </WidgetShell>
    </SmartList>
  );
}
```

---

## 6. Hooks reference

### `useUrlState(keys: readonly K[])`

Reactive URL-querystring state. Returns `[state, set]` where `state` is
`Record<K, string | undefined>` and `set` is `(patch, replace?) => void`.

- All page state that should round-trip via the URL goes here.
- `set(patch, true)` uses `replaceState` (no history entry — for typing
  in a search box).
- Pass `null` in the patch to remove the parameter.

### `useArchetypeKeyboard(bindings, options?)`

Binds a list of `{ label, combo, run }` shortcuts to the page.

- `combo`: lowercase string, `+`-separated (e.g. `"cmd+s"`, `"shift+/"`,
  `"r"`, `"esc"`, `"up"`).
- Returning `false` from `run` re-allows the default behaviour.
- Suppressed inside `INPUT/TEXTAREA/SELECT/[contenteditable]` by default.
- `options.enabled = false` disables.

### `useDensity(initial?)`

Returns `[density, setDensity]`. Persists in `localStorage` under
`gutu.ui.density`. Storage event syncs across tabs.

### `useSwr(key, fetcher, options?)`

Stale-while-revalidate. `key === null` skips fetching. Returns
`{ data, error, state, isValidating, refetch }`. State is one of
`idle / loading / ready / error / empty` and can be passed directly to
`<WidgetShell>`.

`invalidateSwr(prefix)` purges entries that share a prefix — call after
mutations to refresh dependent widgets.

### `useFilterChips()`

URL-backed filter chips encoded under `?filter=`. Methods: `add`,
`remove(predicate)`, `clear`, `replace`. Each chip is
`{ field, op, value }` where `op` is one of `eq | neq | gt | gte | lt
| lte | in | nin | contains | startswith | endswith | exists`.

### `useSelection<Id>()`

Set-typed selection. Methods: `has`, `toggle`, `add`, `remove`, `clear`,
`setAll`.

---

## 7. State surfaces — Widget Shell

`<WidgetShell>` wraps any widget with:

1. A per-widget `<ErrorBoundary>` — one failure does not blank the page
2. Loading skeleton matching the widget's eventual shape
3. Inline error with retry
4. Empty state (when `state.status === "empty"`)
5. Success: renders children

```tsx
<WidgetShell
  label="Revenue"
  state={data.state}             // from useSwr
  skeleton="kpi"                 // shape: kpi | chart | list | table | …
  onRetry={data.refetch}
  empty={{
    title: "No revenue yet",
    description: "Connect a payment provider or import a CSV.",
    action: { label: "Connect", onAction: () => goSettings() },
  }}
>
  <KpiTile label="Revenue" value={fmt(data.data!.value)} />
</WidgetShell>
```

---

## 8. Three-tier error handling

| Tier | Where | Component |
|---|---|---|
| Widget | One widget failed | `<WidgetErrorBoundary>` (used inside `<WidgetShell>`) |
| Page | Page-level data failed | `<ErrorState>` from `@/admin-primitives` |
| Shell | Plugin failed to mount | `<PluginBoundary>` from the shell — already wired |

Errors must surface a `traceId` when available — see [`OBSERVABILITY.md`](./OBSERVABILITY.md).

---

## 9. Performance contract

The runtime is wired so a page hits the budgets in
[`PAGE-DESIGN-SYSTEM.md` §8](./PAGE-DESIGN-SYSTEM.md#8-performance-contract):

- KPI hero strip uses SWR — first paint is cache-instant on revisit
- Skeletons match layout (no layout shift on hydrate)
- Each widget's error boundary keeps siblings live
- Tables: virtualise over 100 rows (use `@/admin-primitives/AdvancedDataTable`)

---

## 10. Migrating an existing page

1. Identify the archetype it currently is (or pick one if it's a CRUD form).
2. Wrap the page in the matching archetype component (e.g. `<IntelligentDashboard>`).
3. Move chrome (header, KPIs, rail) into the archetype's slot props.
4. Replace ad-hoc filter UI with `<FilterChipBar>` + `useFilterChips()`.
5. Replace any custom selection state with `useSelection<Id>()`.
6. Replace `<ErrorBoundary>` + spinner combos with `<WidgetShell>`.
7. Replace any `useState` URL params with `useUrlState`.
8. Wire `useArchetypeKeyboard` for the archetype's keyboard map.
9. Add `archetype` (and optionally `fullBleed`, `density`,
   `searchable`, `savedViews`, `quickActions`) to the page descriptor.
10. Run the in-browser checklist (header sticky, rail collapsing,
    URL round-trip, action bar, empty/loading/error states).

Reference migrations:

- [`crm-archetype-dashboard.tsx`](../admin-panel/src/examples/sales-crm/crm-archetype-dashboard.tsx) — Intelligent Dashboard
- [`crm-archetype-list.tsx`](../admin-panel/src/examples/sales-crm/crm-archetype-list.tsx) — Smart List

---

## 11. Testing

Pure-function helpers in the runtime are unit-tested with `bun test`:

```
admin-panel/src/admin-archetypes/__tests__/
├── filterCodec.test.ts   # encode/decode chips
└── keyMatcher.test.ts    # combo matcher + editable detection
```

Run: `bun test src/admin-archetypes/__tests__`.

Page-level rendering is verified in the browser — the
`crm-archetype-dashboard` and `crm-archetype-list` reference pages are
the integration tests. New archetype features ship with at least one
working reference page.

---

## 12. Production hardening

### useSwr — stale-while-revalidate, hardened

The fetcher has been built for the realities of production:

- **AbortController on every fetch.** Explicit `invalidateSwr(prefix)` aborts in-flight requests for matching keys before clearing the cache, preventing stale responses from poisoning state.
- **Per-fetch timeout** (default 15s) wrapping the fetcher; the controller aborts on timeout and reports a typed error.
- **In-flight dedup.** Multiple `useSwr` instances reading the same key share a single network call.
- **Retry with exponential backoff + full jitter** on automatic (non-user-triggered) failures. `refetch()` from the consumer always retries from scratch.
- **Refresh-on-focus** and **refresh-on-online** by default, configurable per call.
- **Polling** opt-in via `pollMs` for live-tail tiles.
- **Telemetry hook** (`onEvent`) that emits `fetch-start | fetch-success | fetch-error | abort | retry` events for every state transition.

### Widgets — error isolation and observability

`<WidgetErrorBoundary>` now:

- Tags every error surface with `data-widget-id` + `data-archetype` so a global listener can attribute failures.
- Dispatches a `gutu:widget-error` `CustomEvent` on `window` so the shell, audit-core, or a Sentry-style provider can subscribe centrally.
- Shows the original error stack in development; only the message + retry in production.
- Re-keys children on retry so a previously-broken subtree mounts cleanly instead of immediately re-throwing stale state.

### Telemetry — `useArchetypeTelemetry`

Pages call `useArchetypeTelemetry({ id, archetype })` near the top of the component. The hook emits `page-mount` / `page-unmount` events automatically and exposes an `event(...)` helper for ad-hoc emissions (`widget-render`, `interaction`).

Events are dispatched as `gutu:archetype-event` `CustomEvents`. Subscribe with `onArchetypeEvent(handler)` to forward to any sink.

### Auto-archetype inference

`inferArchetype(view)` reads `archetype` first, then `mode`, then keyword heuristics over `title + id + resource + path`, then falls back to `detail-rich`. The shell's `ArchetypeAwareMain` calls it for every plugin page so even pre-existing pages (no descriptor changes) get a meaningful `data-archetype` attribute and full-bleed behaviour where applicable.

### Accessibility & motion

- `usePrefersReducedMotion()` is a reactive media-query hook for any animated widget. Slots also use Tailwind's `motion-reduce:` modifier so transitions disable themselves automatically.
- `BodyLayout` falls back to `matchMedia` when `ResizeObserver` is unavailable.
- All hooks guard `typeof window === "undefined"` to keep the runtime SSR-safe.

### Test suite

```
src/admin-archetypes/__tests__/
├── filterCodec.test.ts      (chip codec round-trip + escapes)
├── keyMatcher.test.ts       (combo matcher)
├── keyMatcherEdge.test.ts   (alt/option, meta/cmd, ?, space, ctrl independence)
├── inferArchetype.test.ts   (explicit precedence, mode, keywords, fallback)
└── swrCore.test.ts          (cache reset + invalidate idempotence)
```

49 tests / 95 expects, all passing under `bun test`.

### The Archetypes Catalog

`/settings/archetypes` is an in-app, author-facing showcase — every archetype + every widget rendered with realistic data. Use it to find the page you want to copy from. Source: `admin-panel/src/examples/admin-tools/archetypes-catalog.tsx`.

## 13. Versioning

The runtime version is exported via the design-system version in
[`PAGE-DESIGN-SYSTEM.md` §15](./PAGE-DESIGN-SYSTEM.md#15-versioning).
Breaking changes (renamed archetypes, removed slots) bump major.
Additive changes (new archetype, new widget, new hook) bump minor.

Per-plugin design briefs declare `design-system: 1.0` in frontmatter.
Briefs older than the current major trigger a docs-CI warning.

Current runtime version: **1.0** (2026-04-27).
