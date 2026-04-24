/** @gutu/admin-shell-next — public API surface.
 *
 *  This package is the versioned, public contract plugin authors use.
 *  Internals live in admin-panel/src/. This package re-exports the parts
 *  that are safe to depend on and marks everything else as implementation
 *  detail.
 *
 *  Two coexisting APIs in the ecosystem today:
 *    - @platform/admin-contracts (existing) — workspace/page/command registry
 *    - @gutu/admin-shell-next (this)         — schema-driven resources + views
 *
 *  Use @gutu/admin-shell-bridge to consume legacy contributions in a shell
 *  that renders via this package. Both APIs render in the same AdminRoot.
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
export {
  PageHeader,
  Breadcrumbs,
  DetailHeader,
  TabBar,
  KPI,
  MetricGrid,
  StatCard,
  Card,
  CardHeader,
  CardContent,
  CardTitle,
  CardDescription,
  EmptyState,
  EmptyStateFramework,
  ErrorState,
  ErrorRecoveryFramework,
  Skeleton,
  FreshnessIndicator,
  DataTable,
  FilterBar,
  QuickFilterBar,
  Toolbar,
  SmartColumnConfigurator,
  SavedViewManager,
  AdvancedFilterBuilder,
  PropertyList,
  FormField,
  Timeline,
  Kanban,
  StatusDot,
  HealthMonitorWidget,
  AIInsightPanel,
  AutomationHookPanel,
  AlertCenter,
  WorkflowStepper,
  ApprovalPanel,
  KeyboardShortcutsOverlay,
  ImportWizard,
  ExportCenter,
  ReportBuilder,
  ConnectionsPanel,
} from "./admin-primitives";

export { WidgetGrid, WorkspaceRenderer, formatValue, formatDelta } from "./widgets";

export const packageId = "admin-shell-next" as const;
export const packageVersion = "0.1.0" as const;
export const packageDescription =
  "Schema-driven plugin-first admin shell — next-gen API parallel to @platform/admin-contracts." as const;
