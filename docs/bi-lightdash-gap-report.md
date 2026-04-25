# Lightdash Reference vs Framework Analytics & BI Gap Report

Date: 2026-04-25

Scope:
- Reference product: `ref/Business/lightdash`
- Framework implementation reviewed:
  - `plugins/gutu-plugin-analytics-bi-core/framework/builtin-plugins/analytics-bi-core`
  - `admin-panel/src/examples/analytics-bi.ts`
  - `admin-panel/src/examples/analytics-bi-pages.tsx`
  - `admin-panel/src/examples/_factory/*`
  - `admin-panel/src/admin-primitives/ReportBuilder.tsx`
  - `libraries/gutu-lib-analytics/framework/libraries/analytics/src/index.ts`
  - `tooling/business-os/specs.mjs`

Method:
- Read the Graphify report first, per repo instructions.
- Used graph queries for analytics BI relationships and plugin structure.
- Read Lightdash source, routes, frontend pages, backend services, query compiler, common types, and README.
- Read Framework BI plugin, admin example, report builder, domain plugin factory, seed data, library helper, and business OS spec.
- This is a source-level implementation and UX audit. I did not run either application UI in a browser, so screenshot-level visual polish is not claimed.

## Implementation Status Update

Status date: 2026-04-25

This report started as a pre-implementation gap audit. The branch
`codex/native-bi-product` now implements the first native BI product layer
described in the recommended path:

- `@platform/analytics` now carries BI contracts for semantic explores,
  dimensions, metrics, query filters, metric queries, compiled SQL, query
  results, chart configs, saved charts, chart versions, dashboard content,
  dashboard versions, spaces, share URLs, schedules, delivery runs, and
  validation results.
- The shared analytics library now has a deterministic local-record warehouse
  adapter, query runner, compiled-SQL preview, drill-down helper,
  chart/dashboard/schedule validation, and version snapshot helpers.
- The admin backend mounts `/api/analytics-bi/*` with authenticated routes for
  explores, query run/compile/drill-down, charts, chart history/rollback,
  dashboards, dashboard history/rollback, spaces, schedules, share URLs,
  delivery runs, and validation. Public share-token lookup is exposed at
  `/api/analytics-bi/public/:token`.
- BI content persists through existing generic records resources including
  `analytics-bi.explore`, `analytics-bi.chart`,
  `analytics-bi.chart-version`, `analytics-bi.dashboard-content`,
  `analytics-bi.dashboard-version`, `analytics-bi.space`,
  `analytics-bi.share-url`, `analytics-bi.schedule`,
  `analytics-bi.delivery-run`, and `analytics-bi.validation-result`.
- The admin panel now has native BI routes for explorer, charts, chart detail,
  chart history, dashboards, dashboard builder, dashboard history, spaces,
  metrics catalog, SQL runner, schedules, validation, and shared links.
- Seed data now includes real explores, saved charts, a dashboard with chart,
  markdown, and heading tiles, spaces, a schedule, a share URL, and delivery
  history.
- Existing `analytics-bi-core` remains the governed operational spine. The new
  authoring/product layer lives in `@platform/analytics`,
  `admin-panel/backend/src/routes/analytics-bi.ts`, and
  `admin-panel/src/examples/analytics-bi/*`.

Remaining honest gaps:

- The current query runner is production-grade for local seeded/admin records
  but is not a live Snowflake/BigQuery/Postgres/dbt connector.
- The production-hardening pass closed the previous admin build/typecheck
  blockers, added renderers for gauge/treemap/map-ready charts, strengthened
  dashboard layout editing with drag reorder, sizing, duplication, removal,
  markdown tiles, filters, dashboard share/schedule actions, and extended
  validation for chart kinds, dashboard tabs/layouts/overlap, and schedule
  delivery targets.

Remaining honest integration boundaries:

- Local-record BI execution is implemented through a `WarehouseAdapter`.
- External Snowflake, BigQuery, Postgres, or dbt semantic sync requires a
  configured adapter with credentials and provider-specific tests before it can
  be claimed as live connector support.
- External email/Slack/Teams delivery and export rendering require configured
  delivery adapters before they can be claimed as sent outside the local
  delivery-run log.

## Executive Verdict

Lightdash is a complete, BI-specific product. It has a semantic layer, query
compiler, field explorer, chart builder, dashboard builder, content spaces,
version history, sharing, scheduling, exports, validation, and direct URL
flows. It is built around how analysts and business users actually explore
data.

Framework now has a native BI authoring product beside
`analytics-bi-core`. The core plugin remains the governance spine for
packaging, actions, resources, migrations, jobs, workflows, audit posture, and
business runtime alignment. The product layer now supplies the analyst-facing
shape: explores, metric queries, local-record warehouse execution, SQL preview,
drill-down, saved charts, chart versions, dashboard content, dashboard
versions, spaces, schedules, validation, and share links.

The remaining gap is no longer the absence of product shape. It is external
ecosystem integration: live provider adapters, dbt/YAML sync, outbound delivery
execution, export rendering, granular ACLs, and embedding policies must be
implemented behind the already-typed contracts before they are claimed as live
capabilities.

## High-Level Comparison

The table below is the original pre-implementation audit baseline. The status
update above is the current source of truth for this branch.

| Area | Lightdash | Framework Analytics & BI today | Gap severity |
| --- | --- | --- | --- |
| Product category | BI product and semantic exploration platform | Governed business plugin plus admin example | Critical |
| Data modeling | dbt/YAML semantic layer, explores, joins, metrics, dimensions | Generic business primary/secondary/exception records; simple `MetricDefinition` helper | Critical |
| Query building | Full `MetricQuery`, compiler, warehouse-aware SQL builder | Static report `execute()` functions and simple metric aggregation | Critical |
| End-user builder | Explorer with field tree, filters, custom fields, table calcs, chart config | Generated CRUD forms plus static report runner | Critical |
| Visualization | Many chart types, rich configs, pivots, custom charts | Basic admin charts, table/chart/pivot modes in ReportBuilder | High |
| Dashboard builder | Editable grid, tabs, filters, parameters, tile types, versioning | Dashboard resource rows plus static executive dashboard | Critical |
| Content organization | Spaces, nested spaces, access, favorites, pinning, resource views | Generic plugin nav and report library cards | High |
| Sharing | Short URLs, minimal views, embed/EE surfaces, public-ish share flows | No BI-native share URL model | High |
| Scheduling | Slack, email, Teams, Google Chat, Google Sheets, CSV/XLSX/PDF/image | No BI-native scheduler delivery model | High |
| History and rollback | Chart and dashboard history, versions, comparison, rollback | Generic `revisionNo` on records, not content versions | High |
| Permissions | Project, space, chart, dashboard, scheduler, view/edit abilities | Plugin action permissions and generated admin access | Medium-high |
| Validation | Chart, dashboard, table validation and fixes | Plugin tests and migration validation, not BI content validation | High |
| UX maturity | BI-specific flows, deep links, context menus, modals, sidebars | Framework admin surfaces, generic detail pages, static dashboards | High |
| Framework strengths | BI-specific depth | Plugin governance, business runtime, docs/tests/migrations, admin consistency | Preserve |

## What Lightdash Actually Provides

Lightdash is organized as a full BI stack:

- `packages/common`: BI domain contracts, query types, chart types, dashboard types, scheduler types, spaces, validation, catalog, share URLs.
- `packages/backend`: query compiler, metric query builder, services for saved charts, dashboards, spaces, schedulers, sharing, validation, project metadata, permissions.
- `packages/frontend`: project layout, explorer, saved chart page, dashboard page, spaces, metrics catalog, SQL runner, history pages, source code drawer, scheduler UI, export UI.
- `packages/warehouses`: warehouse integration layer.
- `packages/cli`: project and developer workflows.

Its README positions it as an open-source Looker alternative. The actual code supports that positioning:
- Define dimensions and metrics in YAML next to dbt models.
- Auto-create dimensions from dbt models.
- Sync descriptions and metadata.
- Explore tables and fields.
- Drill into underlying records.
- Build table calculations.
- Save charts.
- Build dashboards.
- Validate content.
- Preview BI environments.
- Version charts and dashboards.
- Share by URL.
- Schedule delivery to Slack or email.

## What Our BI Implementation Provides Today

Our implementation has three mostly separate layers.

### 1. `analytics-bi-core` plugin

Path:
- `plugins/gutu-plugin-analytics-bi-core/framework/builtin-plugins/analytics-bi-core`

This is a hardened business plugin scaffold. It provides:
- Actions:
  - publish analytics dataset
  - refresh KPI definitions
  - enqueue warehouse sync
  - hold
  - release
  - amend
  - reverse
- Resources:
  - `analytics.datasets`
  - `analytics.kpis`
  - `analytics.warehouse-sync`
- Jobs:
  - refresh projections
  - reconcile exceptions
- Workflow:
  - analytics BI lifecycle
- Migrations:
  - Postgres and SQLite tables for primary, secondary, and exception records
- Admin contribution:
  - `/admin/business/analytics`
- Documentation and tests:
  - README, TODO, business rules, edge cases, flows, glossary, mandatory steps, tests.

The core model is generic:
- `BusinessPrimaryRecord`
- `BusinessSecondaryRecord`
- `BusinessExceptionRecord`

Those records include fields such as `title`, `recordState`, `approvalState`, `postingState`, `fulfillmentState`, `amountMinor`, `currencyCode`, `revisionNo`, `reasonCode`, `correlationId`, `processId`, `upstreamRefs`, and `downstreamRefs`.

That is useful for governed business workflows, but it is not yet a BI semantic model. There are no first-class saved charts, metrics, dimensions, explores, query runs, chart configs, dashboard tiles, spaces, schedules, share URLs, or validation results.

### 2. Admin example plugin

Paths:
- `admin-panel/src/examples/analytics-bi.ts`
- `admin-panel/src/examples/analytics-bi-pages.tsx`

This is the visible BI tool surface inside the admin example system. It provides:
- A Control Room with KPIs:
  - reports
  - dashboards
  - datasets
  - saved queries
- Static charts:
  - reports by dataset
  - dashboards by owner
- Resources:
  - reports
  - dashboards
  - datasets
  - queries
- A report library.
- An executive dashboard with seeded ARR, revenue mix, and cohort data.
- Commands and hash-based shortcuts.

This surface is helpful for demos and admin navigation, but the resources are flat generic records:
- report: name, description, dataset, owner, kind, views, scheduled, dates
- dashboard: name, owner, widgets, views, shared, updatedAt
- dataset: name, source, row count, refresh schedule
- query: name, language, owner, dataset, run count

There is no field explorer, semantic layer, query compiler, visual chart editor, dashboard grid editor, direct content version history, scheduler setup, or public share link.

### 3. Shared admin/report primitives

Relevant paths:
- `admin-panel/src/examples/_factory/buildDomainPlugin.tsx`
- `admin-panel/src/examples/_factory/richDetailFactory.tsx`
- `admin-panel/src/examples/_factory/detailSections.tsx`
- `admin-panel/src/examples/_factory/reportLibraryHelper.tsx`
- `admin-panel/src/admin-primitives/ReportBuilder.tsx`

These are stronger than the BI-specific implementation itself. They give the platform:
- Generated list/form/detail views.
- Rich detail pages with overview, BI, connections, actions, activity, and audit tabs.
- A report runner with filters, table/chart/pivot display modes, sorting, totals, export, print, and refresh actions.
- Control-room layouts with metric widgets and chart widgets.
- Heuristic record connections and deep links.

These primitives are a good foundation, but they are not yet equivalent to a BI builder. `ReportBuilder` executes predefined `ReportDefinition`s. It does not let users select metrics and dimensions from a semantic model, define joins, create calculated fields, configure advanced charts, save content versions, or assemble dashboard tiles.

## End-to-End Flow Comparison

### Flow 1: Create or connect a BI project

Lightdash:
1. Connects to dbt/warehouse context.
2. Reads models, descriptions, metrics, dimensions, metadata, and lineage.
3. Creates explores/tables users can browse.
4. Supports preview environments and validation through CI/CD-style workflows.

Framework today:
1. Registers the `analytics-bi-core` plugin.
2. Creates generic plugin database tables.
3. Seeds demo resources in the admin panel.
4. Exposes generic admin actions and resources.

Missing:
- Project connection model.
- Warehouse connection model inside BI.
- dbt/YAML parser or equivalent semantic source.
- Explore/table metadata.
- Field-level descriptions, labels, tags, groups, lineage.
- Preview environment support.
- BI content validation before publish.

### Flow 2: Explore data

Lightdash:
1. User opens project explorer route.
2. Left sidebar shows tables, dimensions, metrics, custom fields, and search.
3. User selects fields.
4. User adds filters, parameters, sorts, limits, pivots, custom dimensions, additional metrics, and table calculations.
5. Query state syncs into URL/store.
6. Backend compiles the metric query into warehouse SQL.
7. User sees visualization, result table, and compiled SQL if permitted.
8. User can drill into underlying data.

Framework today:
1. User opens reports/dashboards/datasets/queries resource pages.
2. User can view/create/edit flat records through generated forms.
3. User can open predefined reports in the report library.
4. The executive dashboard shows fixed seeded metrics and charts.

Missing:
- Explore sidebar.
- Searchable metric/dimension tree.
- Field selection.
- Metric query model.
- Runtime SQL compilation.
- Warehouse execution.
- URL-persisted query state.
- Drill-down and underlying data.
- Compiled SQL inspection.
- Custom dimensions.
- Custom metrics.
- Table calculations.
- Pivots as query-level objects.
- Parameterized BI queries.

### Flow 3: Build a chart

Lightdash:
1. User starts from an explore or saved chart.
2. User picks fields and filters.
3. User configures chart type.
4. User adjusts chart-specific settings.
5. User can use table, big number, cartesian, pie, funnel, treemap, gauge, map, sankey, or custom chart modes.
6. User can save the chart.
7. Existing charts create new versions.
8. Header actions support duplicate, move, history, share, schedule, sync, verify, promote, pin, favorite, add to dashboard, and delete.

Framework today:
1. Developer defines a report in TypeScript.
2. User can run the report.
3. User can switch predefined display mode between table/chart/pivot.
4. User can use basic chart kinds in `ReportBuilder`.
5. Report cards link to report detail pages.

Missing:
- Chart entity.
- Chart config entity.
- End-user chart save.
- Chart edit mode.
- Chart versions.
- Rollback.
- Chart header action system.
- Chart validation.
- Chart-level permissions.
- Dashboard-add flow.
- Rich chart config per type.
- Conditional formatting.
- Reference lines.
- Custom tooltip/config.
- Custom visualization code.

### Flow 4: Build a dashboard

Lightdash:
1. User creates dashboard in a space.
2. User adds saved chart tiles, SQL chart tiles, markdown tiles, headings, Loom/media tiles.
3. User edits grid layout.
4. User adds dashboard filters and parameters.
5. User can use tabs.
6. User can export, schedule, duplicate, verify, view history, compare versions, rollback, pin, and share.
7. Dashboard routes support view/edit modes and tab-specific deep links.

Framework today:
1. `analytics-bi.dashboard` exists as a flat resource with fields like `widgets`, `views`, `shared`.
2. The executive dashboard is a fixed page.
3. The broader Framework has dashboard-related primitives, but the BI plugin does not expose a Lightdash-like dashboard builder.

Missing:
- Dashboard content model.
- Dashboard tile model.
- Dashboard grid editor.
- Dashboard filters.
- Dashboard parameters.
- Dashboard tabs.
- Dashboard versioning.
- Dashboard rollback/comparison.
- Dashboard export/schedule/share integration.
- BI chart-to-dashboard flow.
- Embedded/minimal dashboard view.

### Flow 5: Organize content

Lightdash:
1. Content lives in spaces.
2. Spaces can be nested.
3. Spaces have breadcrumbs.
4. Users can assign access roles.
5. Content can be moved, pinned, favorited, transferred, and listed through resource views.
6. Spaces can contain dashboards, charts, and child spaces.

Framework today:
1. Admin nav groups resources under the Analytics & BI plugin.
2. The report library shows static report cards.
3. Rich detail pages can discover related records.

Missing:
- Spaces.
- Nested spaces.
- Space access roles.
- Content movement.
- Favorites.
- Pinning.
- Resource list/search UX for BI content.
- Breadcrumb content hierarchy.
- Ownership/access flows for charts and dashboards.

### Flow 6: Share and deliver insights

Lightdash:
1. User can create share URLs.
2. User can schedule chart/dashboard/sql deliveries.
3. Targets include Slack, email, Teams, Google Chat, Google Sheets, CSV, XLSX, image, and PDF depending on context.
4. Scheduler includes cron, timezone, thresholds, enabled state, and include-links behavior.

Framework today:
1. Dashboard record has a `shared` boolean.
2. ReportBuilder has export controls.
3. There is no BI-native schedule or share service.

Missing:
- Short share URL object.
- Public/minimal view.
- Embed/share route.
- Scheduled deliveries.
- Threshold alerts.
- Delivery target types.
- Export job model.
- Delivery history/failure diagnostics.

### Flow 7: Validate and govern BI content

Lightdash:
1. Common types include validation targets and errors for charts, dashboards, and tables.
2. Backend services can validate content and report errors.
3. UI exposes verification and content health concepts.
4. Versioned content can be compared and rolled back.

Framework today:
1. Plugin docs and tests validate plugin exports, migrations, action ids, permissions, and seed behavior.
2. Business actions have permissions and idempotency.
3. Generic records have revision numbers and states.

Missing:
- BI content validation model.
- Broken chart/dashboard detection.
- Fixable validation errors.
- Chart/dashboard verification workflow.
- Content health surface.
- Version compare/rollback for BI content.

## UI and UX Comparison

### Overall navigation

Lightdash:
- Project-scoped navigation.
- Dedicated project layout with `NavBar` and source-code drawer.
- Routes are direct, nested, and content-specific:
  - explorer
  - saved charts
  - chart history
  - dashboards
  - dashboard history
  - dashboard tabs
  - SQL runner
  - spaces
  - metrics catalog
  - minimal dashboard/chart views
  - source-code editor redirects
- URL state matters. Explorer state is derived from and synced to route state.

Framework today:
- Admin plugin nav is clean and consistent.
- Many surfaces use hash navigation through generated views.
- Plugin commands set `window.location.hash`.
- The report library uses hash-based card navigation.
- Rich detail pages have generated deep links and related-record links.

UX gap:
- Lightdash URLs are product-level contracts. Users can bookmark precise chart/dashboard/explorer states.
- Our BI links are mostly admin shell destinations, not persistent BI-content URLs.
- We do not have public, minimal, embedded, history, tab, or shared content URLs.

### Page layout

Lightdash:
- Uses flexible `Page` layout:
  - left sidebar
  - right sidebar
  - header
  - full-height modes
  - centered and wide content modes
  - scroll behavior controls
- Explorer uses a dense BI workbench layout:
  - left field sidebar
  - header
  - parameter card
  - filters card
  - visualization card
  - results card
  - SQL card
  - config drawers and modals
- Dashboard pages are built around editing and viewing grid content.

Framework today:
- Generated admin list/detail/form pages are consistent.
- `PageHeader`, `MetricGrid`, `ChartPanel`, `WorkspaceRenderer`, and rich detail factories provide usable enterprise admin composition.
- Executive dashboard is readable but static.
- Core plugin admin page is very plain server-rendered content with lists and counts.

UX gap:
- Our admin pages are resource-management pages first.
- Lightdash pages are task workbenches: explore, build, configure, save, share, schedule.
- The core plugin admin page is below the polish level of the example admin panel.
- The BI-specific pages do not expose builder density, sidebars, modals, context menus, or progressive authoring flows.

### Detail pages

Lightdash:
- Detail pages are content-specific:
  - saved chart detail/editor
  - dashboard detail/editor
  - space detail
  - table detail
  - metric catalog peek
  - history pages
- Header actions are contextual and deep:
  - save
  - duplicate
  - move
  - share
  - schedule
  - sync
  - verify
  - promote
  - favorite
  - pin
  - add to dashboard
  - delete

Framework today:
- Rich detail factory gives all resources a strong generic detail page:
  - overview
  - BI panel
  - connections
  - actions
  - activity
  - audit
  - metadata rail
- This is a strong Framework capability.

UX gap:
- Generic detail is not enough for BI content.
- A chart detail page needs visualization config, SQL, fields, result state, dashboard usage, history, schedules, share links, and validation.
- A dashboard detail page needs tile grid editing, filters, tabs, parameters, schedule/export/share/history.
- A dataset detail page needs schema, fields, lineage, freshness, row counts, joins, metrics, dimensions, and warehouse sync state.

### Builders

Lightdash builders:
- Explorer builder.
- Chart config builder.
- Custom metric builder.
- Custom dimension builder.
- Table calculation builder.
- Period-over-period builder.
- Dashboard grid builder.
- SQL runner.
- Scheduler builder.
- Space/content organization flows.
- Metrics catalog/canvas.

Framework builders today:
- Generated CRUD builder from field config.
- Static report runner.
- Rich detail factory.
- Compact control room factory.
- Dashboard/page builders in the admin system generally, but not integrated as a BI self-serve authoring flow.

Builder gap:
- Lightdash builders are user-facing and BI-native.
- Our builders are developer-facing or framework-facing.
- Our users can manage records; they cannot naturally create insights.

## Rigidity vs Flexibility

### Where our implementation is rigid

1. Data model rigidity
   - `analytics-bi-core` models are generic business records.
   - BI concepts are represented indirectly by generic primary/secondary/exception states.
   - The admin example resources are flat fields.
   - No native metric/dimension/explore/chart/dashboard contracts exist.

2. Report rigidity
   - Reports are predefined in TypeScript.
   - Users can run and filter reports, but cannot compose new metrics/dimensions from a semantic layer.
   - Chart options are limited to the runner's predefined display modes.

3. Dashboard rigidity
   - The executive dashboard is fixed.
   - The dashboard resource stores a simple widget count rather than real tile config.
   - There is no drag/drop layout, tabs, filters, or parameters.

4. Navigation rigidity
   - Routes are admin-resource oriented.
   - Many flows use hash navigation.
   - There is no saved query URL state or direct chart/dashboard version route.

5. Content lifecycle rigidity
   - Generic `revisionNo` does not equal chart/dashboard content history.
   - No rollback, compare, content verification, favorites, pins, moves, or spaces.

6. Integration rigidity
   - No warehouse adapter is visible in the BI implementation.
   - No dbt/YAML or semantic sync path is visible.
   - No query compiler ties user selections to SQL.

### Where Lightdash is flexible

1. Semantic flexibility
   - Explores contain tables, joined tables, metrics, dimensions, parameters, warnings, tags, labels, paths, and lineage context.
   - Users can select fields dynamically.

2. Query flexibility
   - `MetricQuery` supports dimensions, metrics, filters, sorts, limits, table calculations, additional metrics, custom dimensions, pivots, timezone, and metadata.
   - Backend compiler transforms this into warehouse-aware SQL.

3. Visualization flexibility
   - Chart configs are typed per visualization.
   - Users can switch chart types and configure chart-specific options.
   - Custom chart mode exists.

4. Dashboard flexibility
   - Dashboard tiles are typed.
   - Dashboards support tabs, filters, parameters, pinned parameters, layout, versioning, and multiple tile types.

5. Content flexibility
   - Spaces can nest.
   - Content can be moved, duplicated, favorited, pinned, shared, scheduled, verified, and versioned.

6. URL flexibility
   - Explorer state, chart views, dashboard modes, dashboard tabs, minimal views, and history pages all have explicit routes.

## Where Lightdash Is Ahead

### 1. BI domain depth

Lightdash has real BI primitives:
- `Explore`
- `MetricQuery`
- `SavedChart`
- `Dashboard`
- `DashboardTile`
- `Space`
- `Scheduler`
- `ShareUrl`
- `ValidationError`
- `CatalogField`

Our implementation has:
- generic business records
- generated admin resources
- static reports
- seeded dashboard data

This is the largest gap.

### 2. Query compiler and warehouse execution

Lightdash includes:
- metric query compilation
- warehouse SQL generation
- join handling
- filters
- custom fields
- table calculations
- period-over-period metrics
- timezone handling
- pivot configuration
- parameter handling
- SQL inspection

Our implementation has:
- static report functions
- simple metric snapshot aggregation helper
- no user-authored query compiler

### 3. Self-serve explorer UX

Lightdash has a full explorer:
- searchable field tree
- selected dimensions/metrics
- filters
- parameters
- visualization
- results
- SQL
- custom metric and custom dimension modals
- column context menus
- drill-down
- save chart flow

Our implementation has:
- resource CRUD
- report library
- executive dashboard

### 4. Chart content lifecycle

Lightdash supports:
- saved charts
- chart versions
- chart history
- duplicate/move/delete
- add to dashboard
- share links
- scheduling
- sync
- verification
- pin/favorite

Our implementation supports:
- flat report rows
- static report definitions
- generic admin actions

### 5. Dashboard authoring

Lightdash dashboards are content workspaces:
- grid layout
- tabs
- filters
- parameters
- saved chart tiles
- SQL chart tiles
- markdown/heading/media tiles
- edit/view modes
- version history
- export and schedule

Our dashboard resource is currently an admin record with a widget count. The executive dashboard is not a builder.

### 6. Sharing and distribution

Lightdash treats distribution as core BI:
- short share URLs
- minimal routes
- scheduled deliveries
- multiple delivery targets
- Google Sheets sync
- export formats
- thresholds

Our implementation does not have a BI distribution layer.

### 7. Content organization

Lightdash spaces make BI content manageable:
- nested folders/spaces
- breadcrumbs
- access roles
- inherited permissions
- content lists
- move/transfer

Our implementation has plugin nav and generic related-record discovery, but no BI content hierarchy.

### 8. Validation and reliability

Lightdash validates charts, dashboards, and tables as content.

Our plugin validates plugin contracts and migrations, which is good engineering, but it does not validate whether a chart/dashboard/query still works after data model changes.

## Where Framework Is Stronger or Better Positioned

The comparison should not erase what our implementation already does well.

### 1. Plugin governance

`analytics-bi-core` has mature Framework packaging:
- manifest
- capabilities
- resources
- actions
- permissions
- jobs
- workflows
- migrations
- admin contributions
- tests
- docs

Lightdash is product-complete, but our plugin is better aligned with the broader Gutu/Framework business runtime.

### 2. Cross-domain business runtime

Our BI plugin is designed to coexist with:
- auth
- org/tenant
- role policy
- audit
- workflow
- dashboard core
- traceability
- accounting
- sales
- procurement
- inventory

That is a good enterprise foundation. BI can become a governed business capability rather than an isolated app.

### 3. Generated admin consistency

`buildDomainPlugin` and the rich detail factory can create consistent resource surfaces quickly:
- list
- form
- detail
- tabs
- connection panels
- audit/activity style pages

Lightdash has deeper BI UX, but Framework has a reusable admin grammar that can speed up non-BI resources.

### 4. Traceability posture

The core plugin already thinks in:
- upstream refs
- downstream refs
- correlation IDs
- process IDs
- exception queues
- reconciliation jobs

That posture is valuable for enterprise BI governance, especially if we add lineage, validation, and warehouse sync diagnostics.

### 5. Honest maturity and test posture

The plugin docs explicitly avoid claiming live connector or distributed worker support. That honesty should be preserved. The current plugin is not fake BI; it is a real governed scaffold that should be extended with real BI contracts.

## Missing Product Objects

To reach Lightdash-level capability, our BI layer needs first-class objects that do not currently exist.

### Semantic objects

Needed:
- `AnalyticsProject`
- `WarehouseConnection`
- `SemanticModel`
- `Explore`
- `ExploreJoin`
- `Dataset`
- `Dimension`
- `Metric`
- `Parameter`
- `FieldGroup`
- `LineageNode`
- `FreshnessStatus`

Current approximation:
- `analytics.datasets` generic primary record
- flat admin `dataset` resource
- simple `MetricDefinition` in `gutu-lib-analytics`

### Query objects

Needed:
- `MetricQuery`
- `QueryFilter`
- `QuerySort`
- `TableCalculation`
- `CustomMetric`
- `CustomDimension`
- `PivotConfig`
- `CompiledSql`
- `QueryRun`
- `QueryResult`
- `DrillDownRequest`
- `UnderlyingDataRequest`

Current approximation:
- static `ReportDefinition.execute()`
- `MetricQuery` helper in `gutu-lib-analytics` with only metric ids/date range/segments/groupBy and limited aggregation

### Visualization objects

Needed:
- `Chart`
- `ChartVersion`
- `ChartConfig`
- `TableConfig`
- `BigNumberConfig`
- `CartesianConfig`
- `PieConfig`
- `FunnelConfig`
- `MapConfig`
- `GaugeConfig`
- `SankeyConfig`
- `CustomChartConfig`

Current approximation:
- `ReportBuilder` chart mode and basic chart kinds
- flat `report.kind`

### Dashboard objects

Needed:
- `Dashboard`
- `DashboardVersion`
- `DashboardTile`
- `DashboardTab`
- `DashboardFilter`
- `DashboardParameter`
- `DashboardExport`
- `DashboardValidationResult`

Current approximation:
- flat dashboard resource
- static executive dashboard

### Collaboration and distribution objects

Needed:
- `Space`
- `SpaceAccess`
- `Favorite`
- `Pin`
- `ShareUrl`
- `ScheduledDelivery`
- `DeliveryTarget`
- `DeliveryRun`
- `ThresholdAlert`
- `ContentVerification`

Current approximation:
- `shared` boolean on dashboard resource
- generic owner fields
- generated record actions

## Detailed Feature Gap Matrix

| Capability | Lightdash behavior | Framework behavior | Recommended direction |
| --- | --- | --- | --- |
| dbt integration | Models, metrics, descriptions, YAML, lineage | Not present in BI layer | Add semantic ingestion adapter; keep connector claims honest |
| Warehouse SQL | Warehouse-aware metric query builder | Not present | Add compiler service with warehouse adapter interface |
| Explore sidebar | Searchable virtualized metrics/dimensions tree | Not present | Build BI Explorer page using admin shell primitives |
| Query state | URL/store synchronized | Not present | Create `MetricQuery` route serialization |
| Filters | Query-level filters and dashboard filters | ReportBuilder filters for static reports | Promote filters into saved query/chart/dashboard contracts |
| Parameters | Explore and dashboard params | Not present | Add parameter contracts to query/dashboard models |
| Custom fields | Custom metrics and dimensions | Not present | Add guarded custom field builder |
| Table calculations | Formula table calcs | Not present | Add formula/calculation layer after base compiler |
| Pivots | Query-level pivot dimensions/config | Simple pivot display mode | Add pivot config to query/chart result contracts |
| Drill-down | Underlying records and drill modal | Not present | Add drill request and row-level detail resolver |
| SQL inspection | Compiled SQL card for permitted users | Not present | Add compiled SQL output and permission gate |
| Saved charts | Rich chart content model | Flat report records | Add `analytics.chart` resource |
| Chart history | Version history and rollback | Generic revision only | Add chart versions and rollback |
| Chart config | Per-chart-type config | Basic report chart mode | Add typed chart config models |
| Dashboard builder | Grid, tabs, filters, params, tile types | Static dashboard/resource | Integrate with dashboard-core or build BI dashboard layer |
| Dashboard history | Version compare and rollback | Not present | Add dashboard versions |
| Spaces | Nested spaces and access roles | Not present | Add content hierarchy |
| Sharing | Short URLs and minimal routes | Not present | Add share URL service and minimal views |
| Scheduling | Slack/email/Teams/GChat/GSheets/PDF/etc. | Not present | Add scheduler resource with delivery runs |
| Export | Chart/dashboard/report exports | ReportBuilder export only | Unify export service for charts/dashboards/reports |
| Validation | Chart/dashboard/table validation | Plugin contract tests | Add content validation service |
| Catalog | Metrics catalog/canvas | Not present | Build catalog from semantic model and usage |
| Permissions | Fine-grained content/project/space abilities | Plugin action permissions | Extend role-policy integration to content-level access |
| UX actions | Context menus and header actions | Generic CRUD/detail actions | Add BI-specific command surface |
| Mobile/minimal | Minimal routes | Not present | Add minimal chart/dashboard renderers |
| Embed | EE embed surfaces | Not present | Consider later after share/minimal views |

## Page-by-Page UX Findings

### Lightdash Explorer page

Key strengths:
- Purpose-built workbench.
- Left field tree makes discovery natural.
- Search supports large projects.
- Query controls are visible and progressive.
- Visualization and results are side-by-side in the workflow.
- SQL is available when permissions allow.
- Modals handle advanced edits without leaving the page.

Framework gap:
- No equivalent page. Our closest surfaces are resource lists and static report library pages.

Required Framework page:
- `/analytics/explore`
- Left sidebar: datasets/explores, metrics, dimensions, search.
- Main area: query header, filters, parameters, visualization, results, SQL.
- Right drawer: chart config.
- Footer/header actions: run, save, duplicate, add to dashboard, export.

### Lightdash saved chart page

Key strengths:
- Same explorer experience, but initialized from saved content.
- Edit/view modes.
- Header carries all chart lifecycle actions.
- Direct history route.

Framework gap:
- No saved chart page. Report detail is static and report definitions are code-defined.

Required Framework page:
- `/analytics/charts/:chartId`
- `/analytics/charts/:chartId/edit`
- `/analytics/charts/:chartId/history`

### Lightdash dashboard page

Key strengths:
- Dashboard is a living canvas.
- Supports tabs, filters, parameters, tile editing, full-screen, export, schedule, history.
- Dashboard-specific unsaved-change handling.

Framework gap:
- `analytics-bi.dashboard` is a record, not a canvas.
- Executive dashboard is fixed.

Required Framework page:
- `/analytics/dashboards/:dashboardId`
- `/analytics/dashboards/:dashboardId/edit`
- `/analytics/dashboards/:dashboardId/history`
- `/analytics/dashboards/:dashboardId/tabs/:tabId`

### Lightdash spaces

Key strengths:
- Content organization feels like a BI library.
- Nested spaces and access control make large organizations manageable.

Framework gap:
- No spaces.
- Admin nav is not a content library.

Required Framework page:
- `/analytics/spaces`
- `/analytics/spaces/:spaceId`

### Lightdash metrics catalog

Key strengths:
- Metrics can be discovered independently of building a chart.
- Catalog supports trust, reuse, and governance.

Framework gap:
- No metrics catalog. The `gutu-lib-analytics` definitions are code-level helpers.

Required Framework page:
- `/analytics/metrics`
- `/analytics/metrics/:metricId`
- optional canvas/lineage view later.

### Lightdash SQL runner

Key strengths:
- Gives power users a SQL-native workflow.
- Saved SQL charts can become dashboard tiles.

Framework gap:
- Query resource has `language: sql/kql`, but no SQL runner.

Required Framework page:
- `/analytics/sql-runner`
- `/analytics/sql-runner/:queryId`

## Hyperlinks and Direct Navigation

### Lightdash direct links

Lightdash has direct routes for:
- saved charts
- chart edit/view modes
- chart history
- dashboards
- dashboard edit/view modes
- dashboard tabs
- dashboard history
- SQL runner
- spaces
- metric catalog
- metric peek routes
- minimal chart/dashboard renderers
- source code redirects
- share redirects

This means the URL is part of the product model.

### Framework direct links today

Framework has:
- generated resource paths such as `/analytics/reports`, `/analytics/dashboards`, `/analytics/datasets`, `/analytics/queries`
- shortcuts to `/analytics/reports/new`, `/analytics/dashboards/new`, `/analytics/executive`, `/analytics/reports-library`
- report library detail links via hash parsing
- rich detail links for generic records and connections
- core plugin admin route `/admin/business/analytics`

These are useful, but they do not encode BI content state deeply enough.

Missing direct-link patterns:
- open an unsaved explore state
- open a saved chart
- open chart edit mode
- open chart version history
- open a dashboard tab
- open dashboard edit mode
- open a minimal/public dashboard
- open a shared link
- open a scheduled delivery
- open validation errors
- open source semantic model for a metric/dimension

## Ease of Use

### Lightdash ease

Lightdash is easy for analysts because:
- Fields are discoverable.
- Users do not start from a blank SQL text box.
- Metrics and dimensions have labels/descriptions.
- Users can move from exploration to chart to dashboard.
- Common actions are present in headers and menus.
- Results, visualization, and SQL are all connected.
- Sharing and scheduling are built into the same content model.

### Framework ease today

Framework is easy for administrators because:
- Resource CRUD is generated.
- Detail pages are consistent.
- Reports can be run from a library.
- Executive dashboard is immediately readable.
- Control room shortcuts are clear.

But Framework is not yet easy for BI authors because:
- There is no exploratory field tree.
- There is no semantic query composition.
- There is no chart save/edit lifecycle.
- There is no dashboard canvas.
- There is no content library.
- There is no share/schedule flow.

## Customizability

### Lightdash customizability

Lightdash customizes at multiple levels:
- Data team customizes metrics/dimensions in semantic YAML/dbt context.
- Analysts customize queries with fields, filters, sorts, pivots, custom fields, and table calculations.
- Authors customize chart config.
- Dashboard editors customize layouts, tabs, filters, params, and tiles.
- Admins customize spaces, access, schedules, and delivery.

### Framework customizability today

Framework customizes mostly at developer level:
- Developers define plugin resources.
- Developers define report definitions.
- Developers define admin pages.
- Developers wire commands and views.

User-level customization is limited to:
- CRUD record field values.
- Static report filters.
- Generic exports.

The main product shift needed is moving from developer-authored BI pages to user-authored BI content.

## Recommended Target Architecture

Keep `analytics-bi-core` as the governance spine, but add a BI product layer.

### Layer 1: Governance spine

Keep and extend:
- plugin manifest
- actions
- permissions
- audit hooks
- traceability links
- workflows
- exceptions
- warehouse sync status
- migration discipline

This layer answers:
- Who can publish a dataset?
- Who can refresh a KPI?
- What failed during sync?
- What upstream/downstream business objects are affected?
- What audit trail exists?

### Layer 2: Semantic BI model

Add resources:
- `analytics.project`
- `analytics.connection`
- `analytics.semantic-model`
- `analytics.explore`
- `analytics.dataset`
- `analytics.metric`
- `analytics.dimension`
- `analytics.join`
- `analytics.parameter`
- `analytics.lineage`

This layer answers:
- What can users explore?
- Which fields exist?
- How do tables join?
- Which metrics are trusted?
- Which fields are hidden/deprecated?
- What is fresh or stale?

### Layer 3: Query and execution

Add services:
- `MetricQueryCompiler`
- `WarehouseAdapter`
- `QueryRunner`
- `ResultCache`
- `QueryHistory`
- `DrillDownService`
- `CompiledSqlService`

This layer answers:
- What SQL should this query produce?
- Can this user run it?
- What are the results?
- What rows are behind this metric?
- What changed since the last run?

### Layer 4: BI content

Add resources:
- `analytics.chart`
- `analytics.chart-version`
- `analytics.dashboard`
- `analytics.dashboard-version`
- `analytics.dashboard-tile`
- `analytics.space`
- `analytics.share-url`
- `analytics.schedule`
- `analytics.delivery-run`
- `analytics.validation-result`

This layer answers:
- What did the user save?
- Where does it live?
- Who can see/edit it?
- Can it be rolled back?
- Can it be shared or scheduled?
- Is it still valid?

### Layer 5: Product UI

Build pages:
- Explore
- Saved chart
- Chart history
- Dashboard canvas
- Dashboard history
- Spaces
- Metrics catalog
- SQL runner
- Scheduler
- Validation center
- Share/minimal views

This layer answers:
- Can business users build insights without developer intervention?

## Recommended Roadmap

### Phase 0: Honest framing and naming

Goal: prevent future confusion.

Actions:
- Update plugin docs/TODO to say the current plugin is a governed analytics BI core, not a full BI authoring product.
- Keep non-goals honest: no live warehouse query compiler, no dbt semantic ingestion, no end-user chart builder yet.
- Rename user-facing demo labels only if necessary to distinguish "Analytics Control Room" from "BI Builder".

### Phase 1: BI domain contracts

Goal: define the missing objects before UI work.

Actions:
- Add shared TypeScript types for:
  - Explore
  - Metric
  - Dimension
  - MetricQuery
  - Chart
  - ChartConfig
  - Dashboard
  - DashboardTile
  - Space
  - ShareUrl
  - Schedule
  - ValidationResult
- Add tests that prove these contracts serialize cleanly.
- Keep `gutu-lib-analytics` as the likely home for reusable query/content types.

### Phase 2: Saved chart and metric query MVP

Goal: create the smallest real BI content loop.

Actions:
- Add `analytics.chart` resource.
- Add `MetricQuery` model.
- Add in-memory/mock query runner first, using seeded data.
- Add chart save/edit flow.
- Add direct chart routes.
- Add basic chart versions.

MVP user flow:
1. Pick dataset.
2. Pick dimensions/metrics.
3. Run query.
4. Configure chart type.
5. Save chart.
6. Reopen chart by URL.

### Phase 3: Explorer UI

Goal: replace record-first BI with explore-first BI.

Actions:
- Build `/analytics/explore`.
- Add left sidebar for datasets, metrics, dimensions.
- Add filter card.
- Add visualization card.
- Add results card.
- Add SQL/debug card with mock compiled output.
- Sync query state to URL.

This can initially run against mock/seeded datasets before real warehouse compilation.

### Phase 4: Query compiler and warehouse adapter

Goal: make the builder real.

Actions:
- Add compiler interface.
- Add SQL dialect abstraction.
- Add warehouse adapter interface.
- Implement one concrete adapter first.
- Add permissions around SQL visibility and execution.
- Add query history and cache metadata.

Do not claim broad connector support until implemented.

### Phase 5: Dashboard builder

Goal: give saved charts a destination.

Actions:
- Add `analytics.dashboard` content model.
- Add dashboard tile model.
- Add grid layout editing.
- Add dashboard filters and parameters.
- Add tabs.
- Add direct dashboard routes.
- Integrate with existing dashboard-core where possible.

### Phase 6: Spaces and content library

Goal: make BI content manageable at scale.

Actions:
- Add spaces.
- Add nested spaces.
- Add access roles.
- Add move/duplicate/favorite/pin.
- Add content search/resource view.

### Phase 7: Sharing, scheduling, and exports

Goal: move insights out of the app.

Actions:
- Add share URL model.
- Add minimal chart/dashboard renderers.
- Add scheduler model.
- Add delivery targets incrementally:
  - email first
  - Slack second
  - CSV/XLSX export
  - PDF/image later
- Add delivery run logs.

### Phase 8: Validation, history, and governance

Goal: close the enterprise trust loop.

Actions:
- Add chart/dashboard validation.
- Add broken content center.
- Add version compare/rollback.
- Add verification workflow.
- Add lineage/freshness pages.
- Connect validation events into existing audit/traceability infrastructure.

## Low-Effort, High-Leverage Improvements

These can be done before the full BI rebuild.

1. Make the report library more honest
   - Label static reports as "Prebuilt reports".
   - Add empty-state copy for custom report builder only after it exists.

2. Add first-class chart routes
   - Even before full query compiler, create `analytics.chart` as a content object.
   - Let static report outputs be saved as charts.

3. Promote `ReportBuilder` output into content
   - Add "Save as chart" to predefined reports.
   - Store selected filters and chart mode.

4. Replace generic dashboard `widgets` count
   - Store a JSON tile layout.
   - Render a simple editable grid.

5. Add BI content history
   - Use a version table for charts/dashboards rather than relying on generic `revisionNo`.

6. Add direct links for all BI content
   - Chart view/edit/history.
   - Dashboard view/edit/history.
   - Dataset/explore detail.

7. Improve core plugin admin page
   - Replace plain lists with the same admin primitives used by the example app.
   - Show dataset freshness, KPI refresh status, warehouse sync queue, and exceptions.

8. Update TODO/docs
   - The plugin TODO currently reads too complete when compared with Lightdash.
   - Add explicit "BI authoring platform gaps" so future work is tracked honestly.

## Recommended Near-Term Implementation Slice

If we want an end-to-end improvement without boiling the ocean, build this:

### "Saved Chart MVP"

Deliverables:
- `analytics.chart` resource.
- `MetricQuery` type.
- Mock seeded explore with dimensions and metrics.
- `/analytics/explore` page.
- Basic chart config:
  - table
  - line
  - bar
  - donut
  - big number
- Save chart.
- Reopen chart.
- Edit chart.
- Add chart history table.
- Add "add to dashboard" placeholder or simple dashboard tile insertion.

Why this slice:
- It creates the missing BI loop.
- It reuses existing admin primitives.
- It avoids premature warehouse connector claims.
- It gives future phases a content model to build on.

## Final Assessment

Lightdash is ahead in BI product depth, UX specificity, authoring workflows, direct routes, content lifecycle, sharing, scheduling, and validation.

Framework is ahead in plugin governance, business runtime integration, admin consistency, traceability posture, and honest hardened-plugin scaffolding.

The core issue is that our BI implementation is currently framework-native but not BI-native. It manages analytics-related business records. Lightdash enables analytics work.

The strategic move is to preserve our governance spine and add the missing BI-native layer:
- semantic model
- query compiler
- explorer
- saved charts
- dashboard builder
- spaces
- sharing/scheduling
- validation/history

Once those exist, Framework can become stronger than a Lightdash clone because it can combine BI authoring with the broader Gutu business runtime: audit, workflow, traceability, domain actions, and cross-module governance.
