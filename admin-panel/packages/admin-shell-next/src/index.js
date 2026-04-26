/** @gutu/admin-shell-next — public API surface.
 *
 *  This package is the versioned, public contract plugin authors depend on.
 *  Internals live in admin-panel/src/. This package re-exports the parts
 *  that are safe to depend on and marks everything else as implementation
 *  detail.
 *
 *  Plugins use the v2 contract (`definePlugin({ manifest, activate })`).
 *  There is one supported API — the legacy contract has been fully
 *  retired and the bridge package is no longer part of the runtime.
 */
export * from "./builders";
export * from "./contracts";
export * from "./runtime";
export * from "./shell";
export * from "./host";
/* Component exports ------------------------------------------------------
 *
 * The widget descriptor types in `./contracts` (HeaderWidget, NumberCardWidget,
 * ChartWidget, ShortcutCardWidget, QuickListWidget, SpacerWidget) share names
 * with the React components in `./admin-primitives/widgets`. TypeScript can't
 * merge the two via wildcard re-exports, so:
 *   - descriptor TYPES are the canonical `HeaderWidget` name from the barrel
 *   - React COMPONENTS are imported from `@gutu/admin-shell-next/widgets` or
 *     `@gutu/admin-shell-next/admin-primitives`.
 * A few common surfaces are re-exposed here for convenience. */
export { PageHeader, Breadcrumbs, DetailHeader, TabBar, KPI, MetricGrid, StatCard, Card, CardHeader, CardContent, CardTitle, CardDescription, EmptyState, EmptyStateFramework, ErrorState, ErrorRecoveryFramework, Skeleton, FreshnessIndicator, DataTable, FilterBar, QuickFilterBar, Toolbar, SmartColumnConfigurator, SavedViewManager, AdvancedFilterBuilder, PropertyList, FormField, Timeline, Kanban, StatusDot, HealthMonitorWidget, AIInsightPanel, AutomationHookPanel, AlertCenter, WorkflowStepper, ApprovalPanel, KeyboardShortcutsOverlay, ImportWizard, ExportCenter, ReportBuilder, ConnectionsPanel, } from "./admin-primitives";
export { WidgetGrid, WorkspaceRenderer, formatValue, formatDelta } from "./widgets";
export const packageId = "admin-shell-next";
export const packageVersion = "0.1.0";
export const packageDescription = "Schema-driven plugin-first admin shell — next-gen API parallel to @platform/admin-contracts.";
