# @gutu/admin-shell-next

The next-generation Gutu admin shell — a schema-driven, plugin-first framework that **coexists** with the existing `@platform/admin-contracts` API. Both APIs render in the same admin surface.

## Why a new package?

The existing ecosystem ships one admin API (`definePage`, `defineAdminNav`, `defineCommand`, `defineWorkspace`) where plugins own their React components. It works, and 55+ plugins depend on it.

This package adds a **second API** focused on schema-driven pages:

```ts
import { definePlugin, defineListView, defineResource } from "@gutu/admin-shell-next";

export const crmPlugin = definePlugin({
  id: "crm",
  label: "CRM",
  admin: {
    resources: [
      defineResource({
        id: "crm.contact",
        schema: ContactSchema,
        fields: [
          { name: "name", kind: "text", required: true, sortable: true },
          { name: "email", kind: "email", required: true },
          { name: "stage", kind: "enum", options: STAGES, sortable: true },
          // ...
        ],
      }),
    ],
    views: [
      defineListView({
        id: "crm.contacts",
        resource: "crm.contact",
        columns: [/* ... */],
        filters: [/* ... */],
        actions: [/* ... */],
      }),
      // ...
    ],
  },
});
```

You get for free: realtime cache invalidation, audit events, permission checks, keyboard nav, saved views, column configurator, density toggle, export, import, command palette, workspace switcher, multi-tenancy awareness.

## When to use which API

| Need | Use |
|---|---|
| Plain CRUD list/form/detail | `@gutu/admin-shell-next` with `defineListView`/`defineFormView`/`defineDetailView` |
| Custom JSX page (calendar, graph, workflow builder, chat playground) | `@gutu/admin-shell-next` `defineCustomView` **or** `@platform/admin-contracts` `definePage({ component })` |
| Already-built existing plugin using `@platform/admin-contracts` | keep it — `@gutu/admin-shell-bridge` surfaces it inside the new shell |
| Dashboard with KPIs + charts + shortcuts | `@gutu/admin-shell-next/widgets` — `WorkspaceRenderer` + widget descriptors |

## Subpackages

| Export path | Contents |
|---|---|
| `@gutu/admin-shell-next` | Everything re-exported from the sub-paths below |
| `@gutu/admin-shell-next/builders` | `definePlugin`, `defineListView`, `defineFormView`, `defineDetailView`, `defineDashboardView`, `defineCustomView`, `defineResource`, `defineAction`, `defineCommand` |
| `@gutu/admin-shell-next/contracts` | All stable types (plugin, nav, view, action, command, resource, field, permission, analytics, feature-flag, saved-view, widget) |
| `@gutu/admin-shell-next/runtime` | `ResourceClient`, `QueryCache`, `AuthStore`, `AnalyticsEmitter`, `PermissionEvaluator`, `FeatureFlagStore`, `SavedViewStore`, `useList`, `useRecord`, `useAllRecords`, `useReport`, `useAggregation`, `RuntimeProvider`, `useRuntime` |
| `@gutu/admin-shell-next/shell` | `AppShell`, `Sidebar`, `Topbar`, `CommandPalette`, `Toaster`, `ConfirmHost`, `ErrorBoundary`, `WorkspaceSwitcher`, `resolveRoute` |
| `@gutu/admin-shell-next/admin-primitives` | Composite surfaces — `PageHeader`, `DataTable`, `FilterBar`, `KPI`, `MetricGrid`, `Card`, `EmptyStateFramework`, `ErrorRecoveryFramework`, `FreshnessIndicator`, `SmartColumnConfigurator`, `SavedViewManager`, `AdvancedFilterBuilder`, `HealthMonitorWidget`, `AIInsightPanel`, `AutomationHookPanel`, `AlertCenter`, `WorkflowStepper`, `ApprovalPanel`, `KeyboardShortcutsOverlay`, `ImportWizard`, `ExportCenter`, `ReportBuilder`, `ConnectionsPanel` |
| `@gutu/admin-shell-next/widgets` | `WidgetGrid`, `WorkspaceRenderer`, `NumberCardWidget`, `ChartWidget`, `ShortcutCardWidget`, `HeaderWidget`, `SpacerWidget`, `QuickListWidget`, formatters |
| `@gutu/admin-shell-next/host` | `AdminRoot`, `AuthGuard` |

## Usage

```tsx
import { AdminRoot, AuthGuard } from "@gutu/admin-shell-next/host";
import { nativePlugins } from "./my-native-plugins";
import { adoptLegacyContributions } from "@gutu/admin-shell-bridge";
import { crmCoreContributions } from "gutu-plugin-crm-core";

const plugins = [
  ...nativePlugins,
  adoptLegacyContributions(crmCoreContributions), // existing-API plugin
];

export default function App() {
  return (
    <AuthGuard>
      <AdminRoot plugins={plugins} />
    </AuthGuard>
  );
}
```

## Migration from `@platform/admin-contracts`

Staying on the legacy API is **always supported**. The bridge surfaces legacy contributions in the new shell with no code changes. Migrate plugin-by-plugin only when there's a concrete upside — richer views, realtime invalidation, saved views, multi-tenancy, etc. See `@gutu/admin-shell-bridge/MIGRATION.md`.

## License

MIT (matches the rest of the Gutu ecosystem).
