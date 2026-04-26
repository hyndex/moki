/** Admin Archetypes — the implementation of the Page Design System.
 *
 *  Plugins compose pages from these primitives. See:
 *    docs/PAGE-DESIGN-SYSTEM.md   — design contract (12 archetypes)
 *    docs/page-design/<plugin>.md — per-plugin page plans
 *    docs/PAGE-DESIGN-IMPLEMENTATION.md — runtime API + recipes
 */

// Types
export * from "./types";

// State wrappers
export * from "./state/WidgetErrorBoundary";
export * from "./state/WidgetSkeleton";
export * from "./state/WidgetShell";
export * from "./state/ArchetypeEmptyState";
export * from "./state/OfflineChip";

// Slots
export * from "./slots/Page";
export * from "./slots/PageHeaderSlot";
export * from "./slots/HeroStrip";
export * from "./slots/Toolbar";
export * from "./slots/Layout";
export * from "./slots/MainCanvas";
export * from "./slots/Rail";
export * from "./slots/ActionBar";

// Hooks
export * from "./hooks/useUrlState";
export * from "./hooks/useArchetypeKeyboard";
export * from "./hooks/useDensity";
export * from "./hooks/useSwr";
export * from "./hooks/useFilterChips";
export * from "./hooks/useSelection";
export * from "./hooks/usePrefersReducedMotion";
export * from "./hooks/useArchetypeTelemetry";

// Inference (used by the shell + plugin authors who want to introspect)
export { inferArchetype } from "./inferArchetype";
export type { InferableView, InferredArchetype } from "./inferArchetype";

// State surfaces (cont.)
export * from "./state/KeyboardHelpOverlay";

// Widgets (cont.)
export * from "./widgets/SavedViewSwitcher";
export * from "./widgets/ArchetypeDataGrid";
export * from "./widgets/charts";

// Archetypes (cont.)
export * from "./archetypes/FormArchetype";
export * from "./archetypes/WizardArchetype";
export * from "./archetypes/ComparatorArchetype";

// Hooks (cont.)
export * from "./hooks/useMutation";
export * from "./hooks/useSavedViews";
export * from "./hooks/useQuickActions";

// Permissions
export * from "./permissions/PermissionsContext";

// Observability
export * from "./observability/telemetrySink";

// Widgets
export * from "./widgets/Sparkline";
export * from "./widgets/KpiTile";
export * from "./widgets/KpiRing";
export * from "./widgets/AnomalyTile";
export * from "./widgets/ForecastTile";
export * from "./widgets/AttentionQueue";
export * from "./widgets/RailEntityCard";
export * from "./widgets/RailNextActions";
export * from "./widgets/RailRiskFlags";
export * from "./widgets/RailRecordHealth";
export * from "./widgets/RailRelatedEntities";
export * from "./widgets/PeriodSelector";
export * from "./widgets/DensityToggle";
export * from "./widgets/CommandHints";
export * from "./widgets/FilterChipBar";
export * from "./widgets/BulkActionBar";

// Archetypes
export * from "./archetypes/IntelligentDashboard";
export * from "./archetypes/WorkspaceHub";
export * from "./archetypes/SmartList";
export * from "./archetypes/KanbanArchetype";
export * from "./archetypes/CalendarSchedule";
export * from "./archetypes/TreeExplorer";
export * from "./archetypes/GraphNetwork";
export * from "./archetypes/SplitInbox";
export * from "./archetypes/TimelineLog";
export * from "./archetypes/MapGeo";
export * from "./archetypes/EditorCanvas";
export * from "./archetypes/DetailRichArchetype";
