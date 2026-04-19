import React from "react";

import {
  adaptLegacyUiRegistry,
  canLaunchZone,
  canUseBuilder,
  canUseCommand,
  canViewPage,
  canViewReport,
  canSeeWidget,
  createAdminContributionRegistry,
  type AdminContributionRegistry,
  type BuilderContribution,
  type CommandContribution,
  type PageContribution,
  type ReportContribution,
  type SearchResultItem,
  type WidgetContribution,
  type WorkspaceContribution,
  type ZoneLaunchContribution
} from "@platform/admin-contracts";
import {
  BulkActionBar,
  DrawerInspector,
  FilterBar,
  MetricCard,
  ObjectHeader,
  PageSection,
  PlatformIcon,
  PlatformToaster,
  SavedViewSelector,
  TimelinePanel,
  ToastStack,
  createMemoryToastDispatcher,
  createToastController,
  formatPlatformRelativeTime
} from "@platform/ui";
import {
  BuilderCanvas,
  BuilderHost,
  BuilderInspector,
  BuilderPalette
} from "@platform/admin-builders";
import {
  ActivityFeed,
  ChartCard,
  StatusBadge
} from "@platform/admin-widgets";
import { buildCartesianChartOption } from "@platform/chart";
import { PlatformCommandDialog } from "@platform/command-palette";
import { trackCommandPalette, trackPageView } from "@platform/telemetry-ui";
import type { ShellProviderContract, UiRegistry } from "@platform/ui-shell";

export const packageId = "admin-shell-workbench" as const;
export const packageDisplayName = "Admin Shell Workbench" as const;
export const packageDescription = "Universal admin desk layered on the shared ui-shell substrate." as const;

export type AdminFavorite = {
  id: string;
  label: string;
  href: string;
  kind: "page" | "report" | "builder" | "zone";
};

export type AdminRecentItem = {
  id: string;
  label: string;
  href: string;
  kind: "page" | "report" | "builder" | "zone" | "workspace";
  at: string;
};

export type SavedDashboardPreference = {
  id: string;
  label: string;
  widgetIds: string[];
};

export type AdminPreferenceScope = {
  shellId: string;
  tenantId: string;
  actorId: string;
};

export type AdminPreferenceRecord = {
  favorites: AdminFavorite[];
  recentItems: AdminRecentItem[];
  savedViews: Array<{
    id: string;
    label: string;
    filterState: Record<string, string | number | boolean | null>;
    sortState: Array<{ id: string; desc: boolean }>;
    columnVisibility: Record<string, boolean>;
  }>;
  dashboards: SavedDashboardPreference[];
  activeWorkspace?: string | undefined;
};

export type AdminPreferenceStore = {
  load(scope: AdminPreferenceScope): AdminPreferenceRecord;
  save(scope: AdminPreferenceScope, next: AdminPreferenceRecord): AdminPreferenceRecord;
  remember(scope: AdminPreferenceScope, item: AdminRecentItem): AdminPreferenceRecord;
  toggleFavorite(scope: AdminPreferenceScope, favorite: AdminFavorite): AdminPreferenceRecord;
  invalidateMissing(scope: AdminPreferenceScope, registry: AdminContributionRegistry): AdminPreferenceRecord;
};

export type AdminDeskRouteState = {
  status: 200 | 403 | 404;
  kind: "home" | "workspace" | "page" | "report" | "builder" | "zone" | "zone-degraded" | "forbidden" | "not-found";
  pathname: string;
  workspaceId?: string | undefined;
  page?: PageContribution | undefined;
  report?: ReportContribution | undefined;
  builder?: BuilderContribution | undefined;
  zone?: ZoneLaunchContribution | undefined;
  deniedPermission?: string | undefined;
};

export type AdminWorkbenchShellProps = {
  registry: AdminContributionRegistry;
  providers: ShellProviderContract;
  pathname: string;
  queryState?: Record<string, string | undefined> | undefined;
  preferences: AdminPreferenceRecord;
  searchQuery?: string | undefined;
  searchResults?: SearchResultItem[] | undefined;
  searchErrors?: string[] | undefined;
  zoneAvailability?: Record<string, boolean> | undefined;
  environmentLabel?: string | undefined;
  customization?: AdminWorkbenchCustomization | undefined;
};

export type AdminWorkbenchTheme = {
  accent?: string | undefined;
  accentSoft?: string | undefined;
  sidebar?: string | undefined;
  sidebarAccent?: string | undefined;
  canvas?: string | undefined;
  surface?: string | undefined;
  text?: string | undefined;
  muted?: string | undefined;
};

export type AdminWorkbenchTenantOption = {
  id: string;
  label: string;
  href?: string | undefined;
  active?: boolean | undefined;
};

export type AdminWorkbenchMenuItem = {
  id: string;
  label: string;
  href: string;
  detail?: string | undefined;
};

export type AdminWorkbenchNotification = {
  id: string;
  title: string;
  detail: string;
  tone?: "default" | "positive" | "warning" | "critical" | undefined;
};

export type AdminWorkbenchAppearancePreset = {
  id: string;
  label: string;
  href: string;
  active?: boolean | undefined;
};

export type AdminWorkbenchShortcut = {
  id: string;
  label: string;
  keys: string;
};

export type AdminWorkbenchCustomization = {
  brandKicker?: string | undefined;
  brandTitle?: string | undefined;
  brandSubtitle?: string | undefined;
  density?: "comfortable" | "compact" | undefined;
  theme?: AdminWorkbenchTheme | undefined;
  tenantOptions?: AdminWorkbenchTenantOption[] | undefined;
  userMenuItems?: AdminWorkbenchMenuItem[] | undefined;
  utilityLinks?: AdminWorkbenchMenuItem[] | undefined;
  helpItems?: AdminWorkbenchMenuItem[] | undefined;
  notificationItems?: AdminWorkbenchNotification[] | undefined;
  appearancePresets?: AdminWorkbenchAppearancePreset[] | undefined;
  shortcutHints?: AdminWorkbenchShortcut[] | undefined;
};

const defaultWorkbenchCustomization = {
  brandKicker: "Universal Desk",
  brandTitle: "Admin Shell",
  brandSubtitle: "Governed operational workbench for admin, reporting, builders, and product zones.",
  density: "comfortable" as const
};

const adminWorkbenchStyles = `
  :root {
    color-scheme: light;
  }

  body {
    margin: 0;
    background: #eff2f7;
    color: #172033;
    font-family: "Aptos", "IBM Plex Sans", "Segoe UI Variable", "Inter", sans-serif;
  }

  a {
    color: inherit;
    text-decoration: none;
  }

  .awb-root {
    min-height: 100vh;
    background:
      radial-gradient(circle at top right, rgba(14, 116, 144, 0.10), transparent 24%),
      linear-gradient(180deg, rgba(255, 255, 255, 0.82), rgba(244, 247, 251, 0.96));
    color: var(--awb-text, #172033);
  }

  .awb-root * {
    box-sizing: border-box;
  }

  .awb-shell {
    display: grid;
    grid-template-columns: 280px minmax(0, 1fr) 320px;
    gap: 20px;
    padding: 20px;
    align-items: start;
  }

  .awb-root[data-density="compact"] .awb-shell {
    gap: 16px;
    padding: 16px;
  }

  .awb-topbar {
    position: sticky;
    top: 0;
    z-index: 20;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 20px;
    padding: 18px 20px;
    border-bottom: 1px solid rgba(136, 155, 182, 0.20);
    background: rgba(248, 250, 253, 0.86);
    backdrop-filter: blur(16px);
  }

  .awb-brand {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .awb-brand-mark {
    width: 46px;
    height: 46px;
    border-radius: 14px;
    background: linear-gradient(145deg, var(--awb-accent, #0f766e), var(--awb-sidebar-accent, #155e75));
    box-shadow: 0 18px 32px rgba(15, 118, 110, 0.22);
  }

  .awb-brand-copy {
    display: grid;
    gap: 4px;
  }

  .awb-brand-kicker,
  .awb-panel-kicker {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #5d6983;
  }

  .awb-brand-title {
    margin: 0;
    font-size: 28px;
    font-weight: 700;
    letter-spacing: -0.03em;
  }

  .awb-brand-subtitle,
  .awb-muted-copy,
  .awb-object-subtitle,
  .awb-feed-detail,
  .awb-timeline-detail,
  .awb-command-hint,
  .awb-filter-summary,
  .awb-sidebar-meta,
  .awb-empty-copy {
    color: var(--awb-muted, #607086);
  }

  .awb-topbar-actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    gap: 12px;
  }

  .awb-search-form {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 320px;
    padding: 10px 14px;
    border: 1px solid rgba(136, 155, 182, 0.26);
    border-radius: 16px;
    background: var(--awb-surface, #ffffff);
    box-shadow: 0 8px 20px rgba(23, 32, 51, 0.05);
  }

  .awb-search-form input {
    width: 100%;
    border: 0;
    background: transparent;
    color: inherit;
    font: inherit;
    outline: none;
  }

  .awb-pill,
  .awb-chip,
  .awb-saved-view-chip,
  .awb-step-chip,
  .awb-status-badge {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 7px 12px;
    border-radius: 999px;
    border: 1px solid rgba(136, 155, 182, 0.20);
    background: rgba(255, 255, 255, 0.78);
    font-size: 12px;
    font-weight: 600;
  }

  .awb-pill.is-accent,
  .awb-chip.is-active,
  .awb-saved-view-chip.is-active,
  .awb-step-chip.is-current {
    background: var(--awb-accent-soft, rgba(15, 118, 110, 0.14));
    color: var(--awb-accent, #0f766e);
    border-color: rgba(15, 118, 110, 0.24);
  }

  .awb-step-chip.is-complete,
  .awb-status-badge.is-positive {
    background: rgba(34, 197, 94, 0.12);
    color: #166534;
    border-color: rgba(34, 197, 94, 0.18);
  }

  .awb-status-badge.is-warning,
  .awb-tone-warning {
    background: rgba(245, 158, 11, 0.14);
    color: #92400e;
    border-color: rgba(245, 158, 11, 0.22);
  }

  .awb-status-badge.is-critical {
    background: rgba(239, 68, 68, 0.12);
    color: #991b1b;
    border-color: rgba(239, 68, 68, 0.18);
  }

  .awb-status-badge.is-default,
  .awb-tone-default {
    background: rgba(15, 23, 42, 0.04);
    color: #334155;
  }

  .awb-sidebar {
    position: sticky;
    top: 88px;
    display: grid;
    gap: 14px;
    padding: 18px;
    border-radius: 26px;
    background: linear-gradient(180deg, var(--awb-sidebar, #1f2937), #202939);
    color: #e7edf7;
    box-shadow: 0 22px 48px rgba(15, 23, 42, 0.20);
  }

  .awb-sidebar-header {
    display: grid;
    gap: 4px;
    padding-bottom: 12px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .awb-sidebar-title {
    margin: 0;
    font-size: 16px;
    font-weight: 700;
  }

  .awb-sidebar-group {
    display: grid;
    gap: 10px;
  }

  .awb-sidebar-links,
  .awb-link-list,
  .awb-command-list,
  .awb-feed-list,
  .awb-timeline-list,
  .awb-action-menu,
  .awb-check-list {
    display: grid;
    gap: 8px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .awb-sidebar-link {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 11px 12px;
    border-radius: 14px;
    color: rgba(231, 237, 247, 0.86);
    transition: background 120ms ease, color 120ms ease, transform 120ms ease;
  }

  .awb-sidebar-link:hover,
  .awb-sidebar-link:focus-visible,
  .awb-link-item:hover,
  .awb-link-item:focus-visible,
  .awb-inline-link:hover,
  .awb-inline-link:focus-visible {
    outline: none;
    transform: translateY(-1px);
  }

  .awb-sidebar-link.is-active {
    background: rgba(255, 255, 255, 0.12);
    color: #ffffff;
  }

  .awb-sidebar-link-copy {
    display: grid;
    gap: 2px;
  }

  .awb-sidebar-link strong,
  .awb-link-label,
  .awb-command-label,
  .awb-feed-title,
  .awb-timeline-title,
  .awb-object-title,
  .awb-panel-title {
    font-weight: 700;
  }

  .awb-main {
    display: grid;
    gap: 18px;
  }

  .awb-main-header {
    display: grid;
    gap: 12px;
    padding: 18px 22px;
    border-radius: 24px;
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.9), rgba(249, 251, 254, 0.96));
    border: 1px solid rgba(136, 155, 182, 0.18);
    box-shadow: 0 14px 32px rgba(148, 163, 184, 0.12);
  }

  .awb-breadcrumbs {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    font-size: 12px;
    color: #526176;
  }

  .awb-breadcrumb-sep {
    color: #94a3b8;
  }

  .awb-shell-summary {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }

  .awb-shell-grid {
    display: grid;
    gap: 18px;
  }

  .awb-home-layout,
  .awb-content-grid {
    display: grid;
    gap: 18px;
  }

  .awb-hero-grid {
    display: grid;
    grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr);
    gap: 18px;
  }

  .awb-section,
  .awb-hero-card,
  .awb-widget-card,
  .awb-notice-card,
  .awb-builder-panel,
  .awb-form-card,
  .awb-inline-banner,
  .awb-search-surface {
    padding: 18px;
    border-radius: 22px;
    border: 1px solid rgba(136, 155, 182, 0.18);
    background: var(--awb-surface, #ffffff);
    box-shadow: 0 12px 28px rgba(148, 163, 184, 0.10);
  }

  .awb-object-header {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 14px;
  }

  .awb-object-copy {
    display: grid;
    gap: 6px;
  }

  .awb-object-title {
    margin: 0;
    font-size: 26px;
    letter-spacing: -0.03em;
  }

  .awb-object-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
  }

  .awb-section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 14px;
  }

  .awb-filter-bar {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    align-items: center;
    padding: 14px 16px;
    border-radius: 18px;
    border: 1px dashed rgba(136, 155, 182, 0.28);
    background: rgba(247, 250, 252, 0.88);
  }

  .awb-saved-view-nav {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .awb-link-list {
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  }

  .awb-link-item {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    padding: 14px 16px;
    border-radius: 16px;
    border: 1px solid rgba(136, 155, 182, 0.18);
    background: rgba(246, 248, 252, 0.92);
  }

  .awb-link-copy {
    display: grid;
    gap: 4px;
  }

  .awb-workspace-grid,
  .awb-inline-grid {
    display: grid;
    gap: 14px;
  }

  .awb-inline-grid-2 {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .awb-inline-grid-3,
  .awb-workspace-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .awb-widget-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 16px;
  }

  .awb-mini-stat,
  .awb-metric-card {
    display: grid;
    gap: 6px;
    padding: 14px;
    border-radius: 16px;
    background: rgba(246, 248, 252, 0.92);
    border: 1px solid rgba(136, 155, 182, 0.12);
  }

  .awb-mini-stat-label,
  .awb-metric-label {
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: #5c6d82;
  }

  .awb-mini-stat-value,
  .awb-metric-value {
    font-size: 26px;
    font-weight: 700;
    letter-spacing: -0.03em;
  }

  .awb-inline-row {
    display: flex;
    gap: 10px;
    align-items: center;
  }

  .awb-inline-row-wrap {
    flex-wrap: wrap;
  }

  .awb-inline-stack,
  .awb-surface-stack {
    display: grid;
    gap: 14px;
  }

  .awb-inline-table-wrap {
    overflow: auto;
    border: 1px solid rgba(136, 155, 182, 0.18);
    border-radius: 18px;
    background: #ffffff;
  }

  .awb-inline-table {
    width: 100%;
    border-collapse: collapse;
  }

  .awb-inline-table th,
  .awb-inline-table td {
    padding: 12px 14px;
    border-bottom: 1px solid rgba(226, 232, 240, 0.8);
    font-size: 14px;
    text-align: left;
  }

  .awb-inline-table th {
    font-size: 12px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #526176;
  }

  .awb-detail-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px 16px;
    margin: 0;
  }

  .awb-detail-grid div {
    padding: 12px 14px;
    border-radius: 16px;
    background: rgba(246, 248, 252, 0.92);
    border: 1px solid rgba(136, 155, 182, 0.12);
  }

  .awb-detail-grid dt {
    margin: 0 0 6px;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #607086;
  }

  .awb-detail-grid dd {
    margin: 0;
    font-size: 15px;
    font-weight: 600;
  }

  .awb-check-list li,
  .awb-action-menu li,
  .awb-command-item,
  .awb-feed-item,
  .awb-timeline-entry {
    padding: 12px 14px;
    border-radius: 16px;
    background: rgba(246, 248, 252, 0.9);
    border: 1px solid rgba(136, 155, 182, 0.12);
  }

  .awb-command-dialog {
    display: grid;
    gap: 12px;
    padding: 18px;
    border-radius: 22px;
    background: linear-gradient(180deg, rgba(22, 28, 45, 0.98), rgba(29, 39, 61, 0.96));
    color: #f8fafc;
    box-shadow: 0 28px 56px rgba(15, 23, 42, 0.34);
  }

  .awb-command-query {
    padding: 14px 16px;
    border-radius: 16px;
    background: rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.88);
  }

  .awb-widget-spotlight,
  .awb-chart-card {
    display: grid;
    gap: 12px;
  }

  .awb-inline-link {
    color: var(--awb-accent, #0f766e);
    font-weight: 700;
  }

  .awb-chart-placeholder {
    display: grid;
    place-items: center;
    min-height: 220px;
    border-radius: 18px;
    border: 1px dashed rgba(136, 155, 182, 0.28);
    background:
      linear-gradient(180deg, rgba(240, 253, 250, 0.8), rgba(248, 250, 252, 0.92)),
      repeating-linear-gradient(
        90deg,
        transparent 0,
        transparent 48px,
        rgba(136, 155, 182, 0.10) 48px,
        rgba(136, 155, 182, 0.10) 49px
      );
    color: #526176;
  }

  .awb-bulk-action-bar {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-radius: 18px;
    background: rgba(15, 118, 110, 0.08);
    border: 1px solid rgba(15, 118, 110, 0.12);
  }

  .awb-builder-host {
    display: grid;
    grid-template-columns: 220px minmax(0, 1fr) 280px;
    gap: 16px;
  }

  .awb-builder-panel {
    display: grid;
    gap: 12px;
  }

  .awb-builder-chip {
    padding: 10px 12px;
    border-radius: 14px;
    background: rgba(246, 248, 252, 0.94);
    border: 1px solid rgba(136, 155, 182, 0.14);
    font-weight: 600;
  }

  .awb-right-rail {
    position: sticky;
    top: 88px;
    display: grid;
    gap: 14px;
  }

  .awb-notice-list {
    display: grid;
    gap: 10px;
  }

  .awb-empty-state {
    display: grid;
    gap: 8px;
    text-align: center;
    border-style: dashed;
    background: rgba(255, 255, 255, 0.74);
  }

  .awb-dev-overlay {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 12px 16px;
    border-radius: 18px;
    background: rgba(15, 23, 42, 0.04);
    border: 1px dashed rgba(136, 155, 182, 0.24);
    font-size: 12px;
    color: #526176;
  }

  .awb-notification-center {
    display: grid;
    gap: 10px;
  }

  .awb-utility-list {
    display: grid;
    gap: 8px;
  }

  .awb-utility-link {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    padding: 11px 12px;
    border-radius: 14px;
    background: rgba(246, 248, 252, 0.92);
    border: 1px solid rgba(136, 155, 182, 0.12);
  }

  .awb-strong {
    font-weight: 700;
  }

  @media (max-width: 1180px) {
    .awb-shell,
    .awb-hero-grid,
    .awb-widget-grid,
    .awb-inline-grid-3,
    .awb-builder-host {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 920px) {
    .awb-shell {
      grid-template-columns: 1fr;
    }

    .awb-sidebar,
    .awb-right-rail {
      position: static;
    }

    .awb-topbar {
      grid-template-columns: 1fr;
    }

    .awb-search-form {
      min-width: 0;
      width: 100%;
    }

    .awb-inline-grid-2,
    .awb-detail-grid {
      grid-template-columns: 1fr;
    }
  }
`;

export function createMemoryAdminPreferenceStore(
  initial: Record<string, AdminPreferenceRecord> = {}
): AdminPreferenceStore {
  const entries = new Map(Object.entries(initial));

  return {
    load(scope) {
      return structuredClone(entries.get(scopeKey(scope)) ?? createEmptyPreferenceRecord());
    },
    save(scope, next) {
      entries.set(scopeKey(scope), structuredClone(next));
      return structuredClone(next);
    },
    remember(scope, item) {
      const record = this.load(scope);
      return this.save(scope, {
        ...record,
        recentItems: [item, ...record.recentItems.filter((entry) => entry.href !== item.href)].slice(0, 8)
      });
    },
    toggleFavorite(scope, favorite) {
      const record = this.load(scope);
      const exists = record.favorites.some((entry) => entry.href === favorite.href);
      return this.save(scope, {
        ...record,
        favorites: exists
          ? record.favorites.filter((entry) => entry.href !== favorite.href)
          : [...record.favorites, favorite].sort((left, right) => left.label.localeCompare(right.label))
      });
    },
    invalidateMissing(scope, registry) {
      const record = this.load(scope);
      const validHrefs = new Set<string>([
        ...registry.pages.map((entry) => entry.route),
        ...registry.reports.map((entry) => entry.route),
        ...registry.builders.map((entry) => entry.route),
        ...registry.zoneLaunchers.map((entry) => entry.route),
        ...registry.workspaces.map((entry) => entry.homePath).filter((entry): entry is string => Boolean(entry))
      ]);

      return this.save(scope, {
        ...record,
        favorites: record.favorites.filter((entry) => validHrefs.has(entry.href)),
        recentItems: record.recentItems.filter((entry) => validHrefs.has(entry.href))
      });
    }
  };
}

export function composeAdminRegistry(input: {
  base?: AdminContributionRegistry | undefined;
  legacyUiRegistry?: UiRegistry | undefined;
}): AdminContributionRegistry {
  const base = input.base ?? createAdminContributionRegistry();
  if (!input.legacyUiRegistry) {
    return base;
  }

  const legacy = adaptLegacyUiRegistry(input.legacyUiRegistry);
  return {
    workspaces: dedupeById([...base.workspaces, ...legacy.workspaces]),
    nav: dedupeNav([...base.nav, ...legacy.nav]),
    pages: dedupeById([...base.pages, ...legacy.pages], "route"),
    widgets: dedupeById([...base.widgets, ...legacy.widgets]),
    reports: [...base.reports],
    commands: [...base.commands],
    searchProviders: [...base.searchProviders],
    builders: [...base.builders],
    zoneLaunchers: dedupeById([...base.zoneLaunchers, ...legacy.zoneLaunchers], "route")
  };
}

export function filterAdminRegistryForPermissions(
  registry: AdminContributionRegistry,
  providers: ShellProviderContract
): AdminContributionRegistry {
  return {
    workspaces: registry.workspaces.filter((workspace) => providers.permissions.has(workspace.permission)),
    nav: registry.nav
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => providers.permissions.has(item.permission))
      }))
      .filter((group) => group.items.length > 0),
    pages: registry.pages.filter((page) => canViewPage(providers.permissions, page)),
    widgets: registry.widgets.filter((widget) => canSeeWidget(providers.permissions, widget)),
    reports: registry.reports.filter((report) => canViewReport(providers.permissions, report)),
    commands: registry.commands.filter((command) => canUseCommand(providers.permissions, command)),
    searchProviders: registry.searchProviders.filter((provider) => providers.permissions.has(provider.permission)),
    builders: registry.builders.filter((builder) => canUseBuilder(providers.permissions, builder)),
    zoneLaunchers: registry.zoneLaunchers.filter((zone) => canLaunchZone(providers.permissions, zone))
  };
}

export function resolveAdminDeskRoute(input: {
  pathname: string;
  registry: AdminContributionRegistry;
  providers: ShellProviderContract;
  zoneAvailability?: Record<string, boolean> | undefined;
}): AdminDeskRouteState {
  const path = normalizePathname(input.pathname);
  const zoneAvailability = input.zoneAvailability ?? {};

  if (path === "/admin") {
    return {
      status: 200,
      kind: "home",
      pathname: path,
      workspaceId: input.registry.workspaces.some((workspace) => workspace.id === "overview")
        ? "overview"
        : inferWorkspaceFromPath(path, input.registry.workspaces)
    };
  }

  if (path.startsWith("/admin/workspace/")) {
    const workspaceId = path.split("/").filter(Boolean).at(-1);
    if (workspaceId && input.registry.workspaces.some((workspace) => workspace.id === workspaceId)) {
      const workspace = input.registry.workspaces.find((entry) => entry.id === workspaceId)!;
      if (!input.providers.permissions.has(workspace.permission)) {
        return {
          status: 403,
          kind: "forbidden",
          pathname: path,
          workspaceId,
          deniedPermission: workspace.permission
        };
      }
      return {
        status: 200,
        kind: "workspace",
        pathname: path,
        workspaceId
      };
    }
  }

  const builder = input.registry.builders.find((entry) => matchesRoute(entry.route, path));
  if (builder) {
    if (!canUseBuilder(input.providers.permissions, builder)) {
      return {
        status: 403,
        kind: "forbidden",
        pathname: path,
        workspaceId: "tools",
        deniedPermission: builder.permission
      };
    }
    return {
      status: 200,
      kind: "builder",
      pathname: path,
      workspaceId: "tools",
      builder
    };
  }

  const page = input.registry.pages.find((entry) => matchesRoute(entry.route, path));
  if (page) {
    if (!canViewPage(input.providers.permissions, page)) {
      return {
        status: 403,
        kind: "forbidden",
        pathname: path,
        workspaceId: page.workspace,
        deniedPermission: page.permission
      };
    }
    return {
      status: 200,
      kind: "page",
      pathname: path,
      workspaceId: page.workspace,
      page
    };
  }

  const report = input.registry.reports.find((entry) => matchesRoute(entry.route, path));
  if (report) {
    if (!canViewReport(input.providers.permissions, report)) {
      return {
        status: 403,
        kind: "forbidden",
        pathname: path,
        workspaceId: "reports",
        deniedPermission: report.permission
      };
    }
    return {
      status: 200,
      kind: "report",
      pathname: path,
      workspaceId: "reports",
      report
    };
  }

  const zone = input.registry.zoneLaunchers.find((entry) => path === entry.route || path.startsWith(`${entry.route}/`));
  if (zone) {
    if (!canLaunchZone(input.providers.permissions, zone)) {
      return {
        status: 403,
        kind: "forbidden",
        pathname: path,
        workspaceId: zone.workspace,
        deniedPermission: zone.permission
      };
    }
    if (zoneAvailability[zone.zoneId] === false) {
      return {
        status: 200,
        kind: "zone-degraded",
        pathname: path,
        workspaceId: zone.workspace,
        zone
      };
    }
    return {
      status: 200,
      kind: "zone",
      pathname: path,
      workspaceId: zone.workspace,
      zone
    };
  }

  return {
    status: 404,
    kind: "not-found",
    pathname: path
  };
}

export async function searchAdminRegistry(input: {
  registry: AdminContributionRegistry;
  providers: ShellProviderContract;
  query: string;
}): Promise<{ results: SearchResultItem[]; errors: string[] }> {
  const query = input.query.trim().toLowerCase();
  if (!query) {
    return {
      results: [],
      errors: []
    };
  }

  const results: SearchResultItem[] = [];
  const errors: string[] = [];
  const addMatch = (item: SearchResultItem) => {
    if (!results.some((entry) => entry.id === item.id)) {
      results.push(item);
    }
  };

  for (const page of input.registry.pages) {
    if (page.label.toLowerCase().includes(query) || page.route.toLowerCase().includes(query)) {
      addMatch({
        id: page.id,
        label: page.label,
        href: page.route,
        kind: "page",
        permission: page.permission
      });
    }
  }

  for (const report of input.registry.reports) {
    if (report.label.toLowerCase().includes(query)) {
      addMatch({
        id: report.id,
        label: report.label,
        href: report.route,
        kind: "report",
        permission: report.permission
      });
    }
  }

  for (const builder of input.registry.builders) {
    if (builder.label.toLowerCase().includes(query)) {
      addMatch({
        id: builder.id,
        label: builder.label,
        href: builder.route,
        kind: "page",
        permission: builder.permission
      });
    }
  }

  for (const command of input.registry.commands) {
    if (command.label.toLowerCase().includes(query) || command.keywords?.some((keyword) => keyword.toLowerCase().includes(query))) {
      addMatch({
        id: command.id,
        label: command.label,
        href: command.href ?? "/admin",
        kind: "command",
        permission: command.permission
      });
    }
  }

  for (const provider of input.registry.searchProviders) {
    try {
      const providerResults = await provider.search(query, {
        permissions: input.providers.permissions,
        tenantId: input.providers.session.tenantId,
        actorId: input.providers.session.actorId
      });
      for (const result of providerResults) {
        addMatch(result);
      }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : `search provider '${provider.id}' failed`);
    }
  }

  return {
    results: results.sort((left, right) => left.label.localeCompare(right.label)),
    errors
  };
}

export function listVisibleCommands(
  registry: AdminContributionRegistry,
  providers: ShellProviderContract
): CommandContribution[] {
  return registry.commands.filter((command) => canUseCommand(providers.permissions, command));
}

export function AdminWorkbenchShell(props: AdminWorkbenchShellProps) {
  trackPageView(props.providers, props.pathname, "admin_workbench");
  const customization = {
    ...defaultWorkbenchCustomization,
    ...props.customization
  };
  const currentPath = normalizePathname(props.pathname);
  const queryState = props.queryState ?? {};
  const resolved = resolveAdminDeskRoute({
    pathname: currentPath,
    registry: props.registry,
    providers: props.providers,
    zoneAvailability: props.zoneAvailability
  });
  const visibleRegistry = filterAdminRegistryForPermissions(props.registry, props.providers);
  const currentWorkspace = resolved.workspaceId ?? props.preferences.activeWorkspace ?? visibleRegistry.workspaces[0]?.id;
  const workspaces = visibleRegistry.workspaces;
  const activeWorkspace = workspaces.find((workspace) => workspace.id === currentWorkspace) ?? workspaces[0];
  const navGroups = visibleRegistry.nav.filter((group) => group.workspace === currentWorkspace);
  const visibleWidgets = visibleRegistry.widgets.filter(
    (widget) => widget.slot === `dashboard.${currentWorkspace}` || widget.slot === "dashboard.home"
  );
  const impersonating = Boolean(
    props.providers.session.userId && props.providers.session.userId !== props.providers.session.actorId
  );
  const commandItems = listVisibleCommands(visibleRegistry, props.providers).map((command) => ({
    id: command.id,
    label: command.label,
    hint: command.href ?? command.keywords?.join(", ")
  }));
  const notifications = deriveNotificationItems({
    customization,
    resolved,
    searchErrors: props.searchErrors,
    impersonating
  });
  const toastDispatcher = createMemoryToastDispatcher();
  const toastController = createToastController(toastDispatcher.dispatch);
  if (queryState.toast === "success") {
    toastController.success({
      title: queryState.toastTitle ?? "Saved",
      description: queryState.toastDetail ?? "Your workbench state was saved."
    });
  } else if (queryState.toast === "error") {
    toastController.error({
      title: queryState.toastTitle ?? "Action failed",
      description: queryState.toastDetail ?? "A governed action could not be completed."
    });
  } else if (queryState.toast === "warning") {
    toastController.warning({
      title: queryState.toastTitle ?? "Attention required",
      description: queryState.toastDetail ?? "A surface needs review before continuing."
    });
  }
  const breadcrumbs = createBreadcrumbs({
    resolved,
    workspace: activeWorkspace
  });
  const commandPanelOpen = queryState.panel === "commands";
  if (commandPanelOpen) {
    trackCommandPalette(props.providers, {
      route: props.pathname,
      query: props.searchQuery ?? ""
    });
  }
  const appearancePresets = customization.appearancePresets ?? [];
  const shortcutHints = customization.shortcutHints ?? [];
  const tenantOptions =
    customization.tenantOptions && customization.tenantOptions.length > 0
      ? customization.tenantOptions
      : [
          {
            id: props.providers.session.tenantId,
            label: props.providers.session.tenantId,
            active: true
          }
        ];
  const userMenuItems = customization.userMenuItems ?? [];
  const utilityLinks = customization.utilityLinks ?? [];
  const helpItems = customization.helpItems ?? [];
  const compact = customization.density === "compact";
  const headerTitle: string =
    resolved.kind === "workspace" || resolved.kind === "home"
      ? activeWorkspace?.label ?? customization.brandTitle ?? defaultWorkbenchCustomization.brandTitle
      : breadcrumbs.at(-1)?.label ?? customization.brandTitle ?? defaultWorkbenchCustomization.brandTitle;
  const headerSubtitle: string =
    resolved.kind === "workspace" || resolved.kind === "home"
      ? activeWorkspace?.description ?? customization.brandSubtitle ?? defaultWorkbenchCustomization.brandSubtitle
      : createSurfaceSubtitle(resolved);

  return React.createElement(
    "div",
    {
      className: "awb-root",
      "data-testid": "admin-workbench-shell",
      "data-route-kind": resolved.kind,
      "data-route-status": String(resolved.status),
      "data-density": customization.density,
      style: resolveWorkbenchThemeStyle(customization)
    },
    React.createElement("style", null, adminWorkbenchStyles),
    impersonating
      ? React.createElement(
          "div",
          {
            className: "awb-dev-overlay",
            "data-testid": "impersonation-banner"
          },
          React.createElement("span", { className: "awb-strong" }, `Impersonating as ${props.providers.session.actorId}`),
          React.createElement("span", null, "Support-safe mode stays visible and auditable across every admin surface.")
        )
      : null,
    React.createElement(
      "header",
      { className: "awb-topbar" },
      React.createElement(
        "div",
        { className: "awb-brand" },
        React.createElement("div", { className: "awb-brand-mark", "aria-hidden": "true" }),
        React.createElement(
          "div",
          { className: "awb-brand-copy" },
          React.createElement("div", { className: "awb-brand-kicker" }, customization.brandKicker),
          React.createElement("h1", { className: "awb-brand-title" }, customization.brandTitle),
          React.createElement(
            "div",
            { className: "awb-brand-subtitle" },
            customization.brandSubtitle,
            " ",
            React.createElement("span", { "data-testid": "tenant-context" }, props.providers.session.tenantId)
          )
        )
      ),
      React.createElement(
          "div",
          { className: "awb-topbar-actions" },
          React.createElement(
            "form",
            { action: currentPath, method: "get", className: "awb-search-form" },
            ...createQueryInputElements(queryState, ["panel", "search"]),
            React.createElement("span", { className: "awb-brand-kicker" }, "Search"),
            React.createElement("input", {
              name: "search",
              defaultValue: props.searchQuery ?? "",
            placeholder: "Jump to objects, reports, commands, or help",
            "data-testid": "global-search-input"
          })
        ),
          React.createElement(
            "a",
            {
              href: buildDeskHref(currentPath, queryState, {
                panel: commandPanelOpen ? undefined : "commands"
              }),
              className: "awb-pill is-accent",
              "data-testid": "open-command-palette"
            },
            "Command Palette · Cmd+K"
          ),
        React.createElement(
          "div",
          { className: "awb-shell-summary" },
          tenantOptions.map((tenant) =>
            tenant.href
              ? React.createElement(
                  "a",
                  {
                    key: tenant.id,
                    href: tenant.href,
                    className: tenant.active ? "awb-pill is-accent" : "awb-pill"
                  },
                  tenant.label
                )
              : React.createElement(
                  "span",
                  {
                    key: tenant.id,
                    className: tenant.active ? "awb-pill is-accent" : "awb-pill"
                  },
                  tenant.label
                )
          )
        ),
        React.createElement(
          "span",
          {
            className: compact ? "awb-pill" : "awb-pill is-accent",
            "data-testid": "environment-indicator"
          },
          props.environmentLabel ?? "development"
        ),
        React.createElement("span", { className: "awb-pill", "data-testid": "actor-context" }, props.providers.session.actorId),
        notifications.length > 0 ? React.createElement("span", { className: "awb-pill" }, `${notifications.length} inbox`) : null,
        userMenuItems.map((item) =>
          React.createElement(
            "a",
            {
              key: item.id,
              href: item.href,
              className: "awb-pill"
            },
            item.label
          )
        )
      )
    ),
    React.createElement(
      "div",
      { className: "awb-shell" },
      React.createElement(
        "aside",
        { className: "awb-sidebar" },
        React.createElement(
          "div",
          { className: "awb-sidebar-header" },
          React.createElement("div", { className: "awb-panel-kicker" }, activeWorkspace?.label ?? "Admin"),
          React.createElement("h2", { className: "awb-sidebar-title" }, "Workspaces"),
          React.createElement(
            "div",
            { className: "awb-sidebar-meta" },
            `${workspaces.length} visible workspace${workspaces.length === 1 ? "" : "s"}`
          )
        ),
        React.createElement(
          "div",
          { className: "awb-sidebar-group" },
          React.createElement(
            "ul",
            { className: "awb-sidebar-links", "data-testid": "workspace-list" },
            workspaces.map((workspace) =>
              React.createElement(
                "li",
                { key: workspace.id },
                React.createElement(
                  "a",
                  {
                    href: workspace.homePath ?? `/admin/workspace/${workspace.id}`,
                    className: currentWorkspace === workspace.id ? "awb-sidebar-link is-active" : "awb-sidebar-link"
                  },
                  React.createElement(
                    "span",
                    { className: "awb-sidebar-link-copy" },
                    React.createElement(
                      "strong",
                      null,
                      React.createElement(PlatformIcon, { name: workspace.icon, size: 14, "aria-hidden": true }),
                      " ",
                      workspace.label
                    ),
                    React.createElement("span", { className: "awb-sidebar-meta" }, workspace.description ?? "Governed workspace")
                  ),
                  React.createElement("span", { className: "awb-sidebar-meta" }, "Open")
                )
              )
            )
          )
        ),
        React.createElement(
          "div",
          { className: "awb-sidebar-group" },
          React.createElement("div", { className: "awb-panel-kicker" }, "Modules"),
          navGroups.length === 0
            ? React.createElement("p", { className: "awb-sidebar-meta" }, "No visible navigation in this workspace.")
            : navGroups.map((group) =>
                React.createElement(
                  "section",
                  { key: `${group.workspace}:${group.group}`, className: "awb-sidebar-group" },
                  React.createElement("h3", { className: "awb-panel-kicker" }, group.group),
                  React.createElement(
                    "ul",
                    { className: "awb-sidebar-links" },
                    group.items.map((item) =>
                      React.createElement(
                        "li",
                        { key: item.id },
                        React.createElement(
                          "a",
                          {
                            href: item.to,
                            className: normalizePathname(item.to) === currentPath ? "awb-sidebar-link is-active" : "awb-sidebar-link"
                          },
                          React.createElement(
                            "span",
                            { className: "awb-sidebar-link-copy" },
                            React.createElement(
                              "strong",
                              null,
                              React.createElement(PlatformIcon, { name: item.icon, size: 14, "aria-hidden": true }),
                              " ",
                              item.label
                            ),
                            React.createElement("span", { className: "awb-sidebar-meta" }, item.icon ?? "Surface")
                          ),
                          React.createElement("span", { className: "awb-sidebar-meta" }, "Go")
                        )
                      )
                    )
                  )
                )
              )
        ),
        React.createElement(
          "div",
          { className: "awb-sidebar-group" },
          React.createElement("div", { className: "awb-panel-kicker" }, "Favorites"),
          props.preferences.favorites.length === 0
            ? React.createElement("p", { className: "awb-sidebar-meta" }, "No favorites yet.")
            : React.createElement(
                "ul",
                { className: "awb-sidebar-links", "data-testid": "favorites-list" },
                props.preferences.favorites.map((favorite) =>
                  React.createElement(
                    "li",
                    { key: favorite.id },
                    React.createElement(
                      "a",
                      { href: favorite.href, className: "awb-sidebar-link" },
                      React.createElement(
                        "span",
                        { className: "awb-sidebar-link-copy" },
                        React.createElement("strong", null, favorite.label),
                        React.createElement("span", { className: "awb-sidebar-meta" }, favorite.kind)
                      ),
                      React.createElement("span", { className: "awb-sidebar-meta" }, "Pinned")
                    )
                  )
                )
              )
        ),
        React.createElement(
          "div",
          { className: "awb-sidebar-group" },
          React.createElement("div", { className: "awb-panel-kicker" }, "Recent"),
          props.preferences.recentItems.length === 0
            ? React.createElement("p", { className: "awb-sidebar-meta" }, "Recent items will appear here.")
            : React.createElement(
                "ul",
                { className: "awb-sidebar-links", "data-testid": "recent-list" },
                props.preferences.recentItems.map((recent) =>
                  React.createElement(
                    "li",
                    { key: `${recent.id}:${recent.at}` },
                    React.createElement(
                      "a",
                      { href: recent.href, className: "awb-sidebar-link" },
                      React.createElement(
                        "span",
                        { className: "awb-sidebar-link-copy" },
                        React.createElement("strong", null, recent.label),
                        React.createElement("span", { className: "awb-sidebar-meta" }, recent.kind)
                      ),
                      React.createElement("span", { className: "awb-sidebar-meta" }, formatRecentTime(recent.at))
                    )
                  )
                )
              )
        )
      ),
      React.createElement(
        "main",
        { className: "awb-main" },
        React.createElement(
          "section",
          { className: "awb-main-header" },
          React.createElement(
            "div",
            { className: "awb-breadcrumbs", "data-testid": "breadcrumb-trail" },
            breadcrumbs.map((breadcrumb, index) =>
              React.createElement(
                React.Fragment,
                { key: `${breadcrumb.label}:${index}` },
                breadcrumb.href
                  ? React.createElement("a", { href: breadcrumb.href }, breadcrumb.label)
                  : React.createElement("span", { className: "awb-strong" }, breadcrumb.label),
                index < breadcrumbs.length - 1 ? React.createElement("span", { className: "awb-breadcrumb-sep" }, "›") : null
              )
            )
          ),
          React.createElement(ObjectHeader, {
            title: headerTitle,
            subtitle: headerSubtitle
          }),
          React.createElement(
            "div",
            { className: "awb-shell-summary" },
            React.createElement(StatusBadge, { label: `route ${resolved.status}`, tone: resolved.status === 200 ? "positive" : "warning" }),
            activeWorkspace ? React.createElement("span", { className: "awb-pill" }, `${activeWorkspace.label} workspace`) : null,
            React.createElement("span", { className: "awb-pill" }, `${visibleWidgets.length} dashboard widgets`),
            React.createElement("span", { className: "awb-pill" }, `${commandItems.length} commands`)
          ),
          props.environmentLabel?.includes("dev")
            ? React.createElement(
                "div",
                { className: "awb-dev-overlay" },
                React.createElement("span", null, "Developer overlay"),
                React.createElement("span", null, "Shell tokens, permission gating, and route ownership are visible in this harness.")
              )
            : null
        ),
        props.searchQuery
          ? React.createElement(
              "section",
              { className: "awb-search-surface", "data-testid": "search-results" },
              React.createElement(ObjectHeader, {
                title: `Search results for "${props.searchQuery}"`,
                subtitle: `${props.searchResults?.length ?? 0} matches across pages, reports, commands, and providers`
              }),
              React.createElement(
                "ul",
                { className: "awb-link-list" },
                (props.searchResults ?? []).map((result) =>
                  React.createElement(
                    "li",
                    { key: result.id },
                    React.createElement(
                      "a",
                      { href: result.href, className: "awb-link-item" },
                      React.createElement(
                        "span",
                        { className: "awb-link-copy" },
                        React.createElement("span", { className: "awb-link-label" }, result.label),
                        result.description ? React.createElement("span", { className: "awb-muted-copy" }, result.description) : null
                      ),
                      React.createElement(StatusBadge, { label: result.kind, tone: "default" })
                    )
                  )
                )
              ),
              props.searchErrors && props.searchErrors.length > 0
                ? React.createElement(
                    "div",
                    { className: "awb-notice-card" },
                    React.createElement("div", { className: "awb-panel-title" }, "Search providers degraded"),
                    React.createElement("p", { className: "awb-muted-copy" }, props.searchErrors.join("; "))
                  )
                : null
            )
          : null,
        commandPanelOpen
          ? React.createElement(PlatformCommandDialog, {
              query: props.searchQuery ?? "",
              items: commandItems
            })
          : null,
        renderDeskBody({
          resolved,
          registry: visibleRegistry,
          preferences: props.preferences,
          widgets: visibleWidgets
        }),
        React.createElement(ToastStack, { toasts: toastDispatcher.history })
      ),
      React.createElement(
        "aside",
        { className: "awb-right-rail" },
        React.createElement(
          DrawerInspector,
          { title: "Utilities" },
          React.createElement(
            "div",
            { className: "awb-utility-list" },
            React.createElement(
              "div",
              { className: "awb-utility-link" },
              React.createElement("span", { className: "awb-muted-copy" }, "Current path"),
              React.createElement("span", { className: "awb-strong", "data-testid": "current-path" }, currentPath)
            ),
            React.createElement(
              "div",
              { className: "awb-utility-link" },
              React.createElement("span", { className: "awb-muted-copy" }, "Route state"),
              React.createElement("span", { className: "awb-strong", "data-testid": "route-state" }, `${resolved.kind}:${resolved.status}`)
            ),
            React.createElement(
              "div",
              { className: "awb-utility-link" },
              React.createElement("span", { className: "awb-muted-copy" }, "Shell health"),
              React.createElement(
                StatusBadge,
                {
                  label: resolved.kind === "zone-degraded" ? "Zone degraded" : "Desk healthy",
                  tone: resolved.kind === "zone-degraded" ? "warning" : "positive"
                }
              )
            )
          ),
          utilityLinks.length > 0
            ? React.createElement(
                "div",
                { className: "awb-utility-list" },
                utilityLinks.map((item) =>
                  React.createElement(
                    "a",
                    {
                      key: item.id,
                      href: item.href,
                      className: "awb-utility-link"
                    },
                    React.createElement("span", { className: "awb-strong" }, item.label),
                    React.createElement("span", { className: "awb-muted-copy" }, "Open")
                  )
                )
              )
            : null
        ),
        appearancePresets.length > 0
          ? React.createElement(
              DrawerInspector,
              { title: "Appearance" },
              React.createElement(
                "div",
                { className: "awb-utility-list" },
                appearancePresets.map((preset) =>
                  React.createElement(
                    "a",
                    {
                      key: preset.id,
                      href: preset.href,
                      className: "awb-utility-link"
                    },
                    React.createElement("span", { className: "awb-strong" }, preset.label),
                    React.createElement("span", { className: "awb-muted-copy" }, preset.active ? "Active" : "Preview")
                  )
                )
              )
            )
          : null,
        React.createElement(
          DrawerInspector,
          { title: "Inbox" },
          React.createElement(
            "div",
            { className: "awb-notification-center" },
            notifications.length === 0
              ? React.createElement("p", { className: "awb-muted-copy" }, "No alerts need operator attention.")
              : React.createElement(
                  "div",
                  { className: "awb-notice-list" },
                  notifications.map((notice) =>
                    React.createElement(
                      "section",
                      { key: notice.id, className: "awb-notice-card" },
                      React.createElement(
                        "div",
                        { className: "awb-section-header" },
                        React.createElement("div", { className: "awb-panel-title" }, notice.title),
                        React.createElement(StatusBadge, { label: notice.tone ?? "default", tone: notice.tone ?? "default" })
                      ),
                      React.createElement("p", { className: "awb-muted-copy" }, notice.detail)
                    )
                  )
                )
          )
        ),
        React.createElement(TimelinePanel, {
          entries: props.providers.audit.history.slice(-6).map((event, index) => ({
            id: `${event.type}:${index}`,
            title: event.type,
            detail: `${event.shell} ${event.route}`,
            at: event.at
          }))
        }),
        React.createElement(ActivityFeed, {
          items: props.providers.telemetry.history.slice(-5).map((event, index) => ({
            id: `${event.name}:${index}`,
            title: event.name,
            detail: `${event.namespace} on ${event.route}`,
            at: event.at
          }))
        }),
        React.createElement(PlatformToaster, null),
        shortcutHints.length > 0
          ? React.createElement(
              DrawerInspector,
              { title: "Shortcuts" },
              React.createElement(
                "div",
                { className: "awb-utility-list" },
                shortcutHints.map((shortcut) =>
                  React.createElement(
                    "div",
                    {
                      key: shortcut.id,
                      className: "awb-utility-link"
                    },
                    React.createElement("span", { className: "awb-strong" }, shortcut.label),
                    React.createElement("span", { className: "awb-muted-copy" }, shortcut.keys)
                  )
                )
              )
            )
          : null,
        helpItems.length > 0
          ? React.createElement(
              DrawerInspector,
              { title: "Help" },
              React.createElement(
                "div",
                { className: "awb-utility-list" },
                helpItems.map((item) =>
                  React.createElement(
                    "a",
                    {
                      key: item.id,
                      href: item.href,
                      className: "awb-utility-link"
                    },
                    React.createElement("span", { className: "awb-strong" }, item.label),
                    React.createElement("span", { className: "awb-muted-copy" }, "Open")
                  )
                )
              )
            )
          : null
      )
    )
  );
}

function renderDeskBody(input: {
  resolved: AdminDeskRouteState;
  registry: AdminContributionRegistry;
  preferences: AdminPreferenceRecord;
  widgets: WidgetContribution[];
}) {
  if (input.resolved.kind === "forbidden") {
    return renderEmptySection("Access blocked", `You need '${input.resolved.deniedPermission}' to open this surface.`);
  }

  if (input.resolved.kind === "not-found") {
    return renderEmptySection("Surface not found", "This admin route is not registered in the active package graph.");
  }

  if (input.resolved.kind === "home" || input.resolved.kind === "workspace") {
    const workspace = input.registry.workspaces.find((entry) => entry.id === input.resolved.workspaceId) ?? input.registry.workspaces[0];
    const homePage = input.resolved.kind === "home" ? input.registry.pages.find((page) => page.route === "/admin") : undefined;
    const workspacePages = input.registry.pages.filter(
      (page) => page.workspace === workspace?.id && page.route !== "/admin" && page.kind !== "dashboard"
    );
    const reports = resolveWorkspaceReports(workspace, input.registry);
    const builders = resolveWorkspaceBuilders(workspace, input.registry);
    const zoneLaunchers = input.registry.zoneLaunchers.filter((zone) => zone.workspace === workspace?.id);
    const quickActions = resolveWorkspaceCommands(workspace, input.registry);
    const workspaceCards =
      workspace?.cards && workspace.cards.length > 0
        ? input.widgets.filter((widget) => workspace.cards?.includes(widget.id))
        : input.widgets;

    return React.createElement(
      React.Fragment,
      null,
      React.createElement(
        "div",
        { className: "awb-hero-grid" },
        React.createElement(
          PageSection,
          { className: "awb-hero-card" },
          React.createElement(ObjectHeader, {
            title: workspace?.label ?? "Admin Home",
            subtitle: workspace?.description ?? "Universal workspace home with governed extensions.",
            actions:
              quickActions.length > 0
                ? React.createElement(
                    "div",
                    { className: "awb-object-actions" },
                    quickActions.slice(0, 3).map((command) =>
                      React.createElement(
                        "a",
                        {
                          key: command.id,
                          href: command.href ?? "/admin",
                          className: "awb-pill is-accent"
                        },
                        command.label
                      )
                    )
                  )
                : undefined
          }),
          homePage?.component ? React.createElement(homePage.component) : null
        ),
        React.createElement(
          "div",
          { className: "awb-workspace-grid" },
          React.createElement(MetricCard, {
            label: "Pages",
            value: workspacePages.length
          }),
          React.createElement(MetricCard, {
            label: "Reports",
            value: reports.length,
            tone: reports.length > 0 ? "positive" : "default"
          }),
          React.createElement(MetricCard, {
            label: "Builders & Zones",
            value: builders.length + zoneLaunchers.length,
            tone: builders.length + zoneLaunchers.length > 0 ? "positive" : "warning"
          })
        )
      ),
      React.createElement(FilterBar, { summary: "Workspace filters, date ranges, and quick pivots remain shell-governed." }),
      React.createElement(SavedViewSelector, {
        views: input.preferences.savedViews.map((view) => ({
          id: view.id,
          label: view.label,
          active: false
        }))
      }),
      React.createElement(
        "div",
        { className: "awb-widget-grid" },
        workspaceCards.length === 0
          ? React.createElement(
              PageSection,
              { className: "awb-empty-state" },
              React.createElement("div", { className: "awb-panel-title" }, "No widgets registered"),
              React.createElement("p", { className: "awb-empty-copy" }, "Add widget contributions to surface KPIs, inbox cards, and drilldowns.")
            )
          : workspaceCards.map((widget) =>
              React.createElement(
                "div",
                { key: widget.id },
                widget.component
                  ? React.createElement(widget.component)
                  : React.createElement(MetricCard, {
                      label: widget.title ?? widget.id,
                      value: "Active"
                    }),
                widget.drillTo
                  ? React.createElement("a", { href: widget.drillTo, className: "awb-inline-link" }, "Open")
                  : null
              )
            )
      ),
      React.createElement(
        "div",
        { className: "awb-content-grid" },
        React.createElement(
          PageSection,
          null,
          React.createElement(
            "div",
            { className: "awb-section-header" },
            React.createElement("h2", { className: "awb-panel-title" }, "Workspace shortcuts"),
            React.createElement("span", { className: "awb-muted-copy" }, `${workspacePages.length} registered surface${workspacePages.length === 1 ? "" : "s"}`)
          ),
          workspacePages.length === 0
            ? React.createElement("p", { className: "awb-muted-copy" }, "No embedded pages are registered for this workspace.")
            : React.createElement(
                "ul",
                { className: "awb-link-list" },
                workspacePages.slice(0, 6).map((page) =>
                  React.createElement(
                    "li",
                    { key: page.id },
                    React.createElement(
                      "a",
                      { href: page.route, className: "awb-link-item" },
                      React.createElement(
                        "span",
                        { className: "awb-link-copy" },
                        React.createElement("span", { className: "awb-link-label" }, page.label),
                        React.createElement("span", { className: "awb-muted-copy" }, `${page.kind} surface`)
                      ),
                      React.createElement(StatusBadge, { label: page.kind, tone: "default" })
                    )
                  )
                )
              )
        ),
        React.createElement(
          PageSection,
          null,
          React.createElement(
            "div",
            { className: "awb-section-header" },
            React.createElement("h2", { className: "awb-panel-title" }, "Reports"),
            React.createElement("span", { className: "awb-muted-copy" }, `${reports.length} pinned report${reports.length === 1 ? "" : "s"}`)
          ),
          reports.length === 0
            ? React.createElement("p", { className: "awb-muted-copy" }, "No reports registered for this workspace.")
            : React.createElement(
                "ul",
                { className: "awb-link-list" },
                reports.map((report) =>
                  React.createElement(
                    "li",
                    { key: report.id },
                    React.createElement(
                      "a",
                      { href: report.route, className: "awb-link-item" },
                      React.createElement(
                        "span",
                        { className: "awb-link-copy" },
                        React.createElement("span", { className: "awb-link-label" }, report.label),
                        React.createElement("span", { className: "awb-muted-copy" }, `${report.filters.length} governed filters`)
                      ),
                      React.createElement(StatusBadge, { label: report.kind, tone: "positive" })
                    )
                  )
                )
              )
        ),
        React.createElement(
          PageSection,
          null,
          React.createElement(
            "div",
            { className: "awb-section-header" },
            React.createElement("h2", { className: "awb-panel-title" }, "Studios & zones"),
            React.createElement("span", { className: "awb-muted-copy" }, `${builders.length + zoneLaunchers.length} advanced surface${builders.length + zoneLaunchers.length === 1 ? "" : "s"}`)
          ),
          builders.length === 0 && zoneLaunchers.length === 0
            ? React.createElement("p", { className: "awb-muted-copy" }, "No governed builders or zones registered here.")
            : React.createElement(
                "ul",
                { className: "awb-link-list" },
                [
                  ...builders.map((builder) => ({
                    id: builder.id,
                    label: builder.label,
                    href: builder.route,
                    meta: builder.mode,
                    tone: "positive" as const
                  })),
                  ...zoneLaunchers.map((zone) => ({
                    id: zone.id,
                    label: zone.label,
                    href: zone.route,
                    meta: "zone launch",
                    tone: "warning" as const
                  }))
                ].map((surface) =>
                  React.createElement(
                    "li",
                    { key: surface.id },
                    React.createElement(
                      "a",
                      { href: surface.href, className: "awb-link-item" },
                      React.createElement(
                        "span",
                        { className: "awb-link-copy" },
                        React.createElement("span", { className: "awb-link-label" }, surface.label),
                        React.createElement("span", { className: "awb-muted-copy" }, surface.meta)
                      ),
                      React.createElement(StatusBadge, { label: "governed", tone: surface.tone })
                    )
                  )
                )
              )
        )
      )
    );
  }

  if (input.resolved.kind === "page" && input.resolved.page) {
    const page = input.resolved.page;
    return React.createElement(
      React.Fragment,
      null,
      React.createElement(ObjectHeader, {
        title: page.label,
        subtitle: `${page.kind} surface in ${page.workspace}`
      }),
      React.createElement(FilterBar, {
        summary: page.kind === "list" ? `Route ${page.route}` : `Governed page route ${page.route}`
      }),
      page.kind === "list"
        ? React.createElement(SavedViewSelector, {
            views: input.preferences.savedViews.map((view) => ({
              id: view.id,
              label: view.label,
              active: view.id === input.preferences.savedViews[0]?.id
            }))
          })
        : null,
      page.kind === "list"
        ? React.createElement(BulkActionBar, {
            selectedCount: 2,
            actions: React.createElement("button", { className: "awb-pill is-accent", type: "button" }, "Archive")
          })
        : null,
      page.component
        ? React.createElement(page.component)
        : React.createElement(PageSection, { className: "awb-empty-state" }, React.createElement("p", { className: "awb-empty-copy" }, "This page uses the contract-only fallback renderer."))
    );
  }

  if (input.resolved.kind === "report" && input.resolved.report) {
    const reportComponent = input.resolved.report.component;
    const chartOption = buildCartesianChartOption({
      title: input.resolved.report.label,
      labels: ["Mon", "Tue", "Wed", "Thu", "Fri"],
      series: [
        {
          name: "Throughput",
          data: [8, 11, 10, 14, 16]
        }
      ]
    });

    return React.createElement(
      React.Fragment,
      null,
      React.createElement(ObjectHeader, {
        title: input.resolved.report.label,
        subtitle: `Report query: ${input.resolved.report.query}`
      }),
      React.createElement(FilterBar, {
        summary: `${input.resolved.report.filters.length} approved filters`
      }),
      React.createElement(
        "div",
        { className: "awb-content-grid" },
        React.createElement(ChartCard, {
          title: `${input.resolved.report.label} trend`,
          option: chartOption,
          drilldown: {
            href: input.resolved.report.route,
            label: "Refresh report"
          }
        }),
        React.createElement(
          PageSection,
          null,
          React.createElement("div", { className: "awb-section-header" }, React.createElement("h2", { className: "awb-panel-title" }, "Export center")),
          React.createElement(
            "ul",
            { className: "awb-link-list" },
            input.resolved.report.export.map((format) =>
              React.createElement(
                "li",
                { key: format },
                React.createElement(
                  "span",
                  { className: "awb-link-item" },
                  React.createElement(
                    "span",
                    { className: "awb-link-copy" },
                    React.createElement("span", { className: "awb-link-label" }, `Export ${format.toUpperCase()}`),
                    React.createElement("span", { className: "awb-muted-copy" }, "Server-owned export with audit trail")
                  ),
                  React.createElement(StatusBadge, { label: "ready", tone: "positive" })
                )
              )
            )
          )
        ),
        reportComponent
          ? React.createElement(
              PageSection,
              null,
              React.createElement(reportComponent)
            )
          : null
      )
    );
  }

  if (input.resolved.kind === "builder" && input.resolved.builder) {
    const relatedPage = input.registry.pages.find((page) => page.route === input.resolved.builder?.route);
    const relatedZone = input.registry.zoneLaunchers.find((zone) => zone.zoneId === input.resolved.builder?.zoneId);
    const builderPreview = input.resolved.builder.component
      ? React.createElement(input.resolved.builder.component)
      : relatedPage?.component
        ? React.createElement(relatedPage.component)
        : React.createElement("p", { className: "awb-muted-copy" }, "Governed preview surface");

    return React.createElement(
      React.Fragment,
      null,
      React.createElement(ObjectHeader, {
        title: input.resolved.builder.label,
        subtitle: `Mode: ${input.resolved.builder.mode}`,
        actions: relatedZone
          ? React.createElement("a", { href: relatedZone.route, className: "awb-pill is-accent" }, "Open governed zone")
          : undefined
      }),
      React.createElement(FilterBar, { summary: "Palette, preview, and publish are isolated from raw data execution." }),
      React.createElement(BuilderHost, {
        layout: {
          left: "palette",
          center: "preview",
          right: "settings"
        },
        palette: React.createElement(BuilderPalette, {
          items: [
            { id: "text", label: "Text block" },
            { id: "table", label: "Data grid" },
            { id: "chart", label: "Chart frame" },
            { id: "hero", label: "Hero banner" }
          ]
        }),
        canvas: React.createElement(
          BuilderCanvas,
          { title: "Preview Canvas" },
          builderPreview,
          React.createElement(
            "div",
            { className: "awb-dev-overlay" },
            React.createElement("span", null, "Draft revision"),
            React.createElement("span", null, "Revision 12 is ready for compare-and-publish")
          )
        ),
        inspector: React.createElement(
          BuilderInspector,
          { title: "Inspector" },
          React.createElement(
            "ul",
            { className: "awb-check-list" },
            React.createElement("li", null, "Publish requires fresh revision and audit note"),
            React.createElement("li", null, "Preview uses platform session and governed API contracts"),
            React.createElement("li", null, relatedZone ? "Zone handoff available for dense editing flows" : "Embedded editing only")
          )
        )
      })
    );
  }

  if (input.resolved.kind === "zone" && input.resolved.zone) {
    return React.createElement(
      "div",
      { "data-testid": "zone-launch" },
      React.createElement(
        PageSection,
        null,
        React.createElement(ObjectHeader, {
          title: input.resolved.zone.label,
          subtitle: `Launching zone ${input.resolved.zone.zoneId}`
        }),
        React.createElement(FilterBar, { summary: "Zone handoff preserves platform auth, telemetry, and route ownership." }),
        React.createElement(
          "ul",
          { className: "awb-check-list" },
          React.createElement("li", null, "Platform session is reused across the zone transition"),
          React.createElement("li", null, "Telemetry remains correlated to the parent admin route"),
          React.createElement("li", null, "Zone assets stay isolated under a unique governed prefix")
        ),
        React.createElement("a", { href: input.resolved.zone.route, className: "awb-inline-link" }, "Open zone")
      )
    );
  }

  if (input.resolved.kind === "zone-degraded" && input.resolved.zone) {
    return renderEmptySection(
      `${input.resolved.zone.label} is temporarily unavailable`,
      "The zone stays governed and discoverable, but the shell is showing the degraded recovery state."
    );
  }

  return renderEmptySection("Unhandled desk state", "The admin desk reached an unexpected state.");
}

function renderEmptySection(title: string, description: string) {
  return React.createElement(
    PageSection,
    { className: "awb-empty-state" },
    React.createElement("h2", { className: "awb-panel-title" }, title),
    React.createElement("p", { className: "awb-empty-copy" }, description)
  );
}

function resolveWorkbenchThemeStyle(
  customization: AdminWorkbenchCustomization
): React.CSSProperties {
  const theme = customization.theme ?? {};
  const style: React.CSSProperties & Record<string, string | undefined> = {};
  style["--awb-accent"] = theme.accent ?? "#0f766e";
  style["--awb-accent-soft"] = theme.accentSoft ?? "rgba(15, 118, 110, 0.12)";
  style["--awb-sidebar"] = theme.sidebar ?? "#1f2937";
  style["--awb-sidebar-accent"] = theme.sidebarAccent ?? "#155e75";
  style["--awb-canvas"] = theme.canvas ?? "#eff2f7";
  style["--awb-surface"] = theme.surface ?? "#ffffff";
  style["--awb-text"] = theme.text ?? "#172033";
  style["--awb-muted"] = theme.muted ?? "#607086";
  return style;
}

function createBreadcrumbs(input: {
  resolved: AdminDeskRouteState;
  workspace?: WorkspaceContribution | undefined;
}): Array<{ label: string; href?: string | undefined }> {
  const breadcrumbs: Array<{ label: string; href?: string | undefined }> = [
    {
      label: "Home",
      href: "/admin"
    }
  ];

  if (input.workspace?.homePath && input.workspace.id !== "overview") {
    breadcrumbs.push({
      label: input.workspace.label,
      href: input.workspace.homePath
    });
  }

  if (input.resolved.kind === "page" && input.resolved.page) {
    breadcrumbs.push({
      label: input.resolved.page.label
    });
  }

  if (input.resolved.kind === "report" && input.resolved.report) {
    breadcrumbs.push(
      {
        label: "Reports",
        href: "/admin/workspace/reports"
      },
      {
        label: input.resolved.report.label
      }
    );
  }

  if (input.resolved.kind === "builder" && input.resolved.builder) {
    breadcrumbs.push(
      {
        label: "Tools",
        href: "/admin/workspace/tools"
      },
      {
        label: input.resolved.builder.label
      }
    );
  }

  if ((input.resolved.kind === "zone" || input.resolved.kind === "zone-degraded") && input.resolved.zone) {
    breadcrumbs.push(
      {
        label: input.resolved.zone.workspace ? `${input.resolved.zone.workspace} workspace` : "Apps",
        href: input.resolved.zone.workspace ? `/admin/workspace/${input.resolved.zone.workspace}` : "/admin"
      },
      {
        label: input.resolved.zone.label
      }
    );
  }

  if (input.resolved.kind === "forbidden") {
    breadcrumbs.push({
      label: "Access blocked"
    });
  }

  if (input.resolved.kind === "not-found") {
    breadcrumbs.push({
      label: "Not found"
    });
  }

  return breadcrumbs;
}

function deriveNotificationItems(input: {
  customization: AdminWorkbenchCustomization;
  resolved: AdminDeskRouteState;
  searchErrors?: string[] | undefined;
  impersonating: boolean;
}): AdminWorkbenchNotification[] {
  const items = [...(input.customization.notificationItems ?? [])];
  if (input.impersonating) {
    items.unshift({
      id: "impersonation",
      title: "Impersonation active",
      detail: "Support-safe mode is visible and auditable across the entire desk.",
      tone: "warning"
    });
  }
  if ((input.searchErrors?.length ?? 0) > 0) {
    items.push({
      id: "search-errors",
      title: "Search provider degraded",
      detail: input.searchErrors!.join("; "),
      tone: "warning"
    });
  }
  if (input.resolved.kind === "zone-degraded" && input.resolved.zone) {
    items.push({
      id: `zone:${input.resolved.zone.zoneId}`,
      title: `${input.resolved.zone.label} degraded`,
      detail: "The launcher stays visible, but the shell is serving the governed recovery state.",
      tone: "critical"
    });
  }
  return items;
}

function resolveWorkspaceReports(
  workspace: WorkspaceContribution | undefined,
  registry: AdminContributionRegistry
): ReportContribution[] {
  if (!workspace) {
    return [];
  }
  if (workspace.reports && workspace.reports.length > 0) {
    return registry.reports.filter((report) => workspace.reports?.includes(report.id));
  }
  return registry.reports.filter((report) => report.route.includes(workspace.id));
}

function resolveWorkspaceCommands(
  workspace: WorkspaceContribution | undefined,
  registry: AdminContributionRegistry
): CommandContribution[] {
  if (!workspace) {
    return [];
  }
  if (workspace.quickActions && workspace.quickActions.length > 0) {
    return registry.commands.filter((command) => workspace.quickActions?.includes(command.id));
  }
  return registry.commands.filter((command) => command.href?.includes(workspace.id));
}

function resolveWorkspaceBuilders(
  workspace: WorkspaceContribution | undefined,
  registry: AdminContributionRegistry
): BuilderContribution[] {
  if (!workspace) {
    return [];
  }
  return registry.builders.filter((builder) => builder.route.includes(workspace.id) || workspace.id === "tools");
}

function formatRecentTime(value: string): string {
  return formatPlatformRelativeTime(value);
}

function createSurfaceSubtitle(resolved: AdminDeskRouteState): string {
  if (resolved.kind === "page" && resolved.page) {
    return `${resolved.page.kind} surface in ${resolved.page.workspace}`;
  }
  if (resolved.kind === "report" && resolved.report) {
    return `Semantic report query ${resolved.report.query}`;
  }
  if (resolved.kind === "builder" && resolved.builder) {
    return `Mode: ${resolved.builder.mode}`;
  }
  if ((resolved.kind === "zone" || resolved.kind === "zone-degraded") && resolved.zone) {
    return resolved.zone.description ?? `Governed zone ${resolved.zone.zoneId}`;
  }
  if (resolved.kind === "forbidden") {
    return `Permission ${resolved.deniedPermission ?? "unknown"} is required for this surface.`;
  }
  if (resolved.kind === "not-found") {
    return "The requested surface is not part of the active admin graph.";
  }
  return "Governed operational workspace.";
}

function buildDeskHref(
  pathname: string,
  currentQuery: Record<string, string | undefined>,
  overrides: Record<string, string | undefined> = {}
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({
    ...currentQuery,
    ...overrides
  })) {
    if (value) {
      params.set(key, value);
    }
  }
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

function createQueryInputElements(
  queryState: Record<string, string | undefined>,
  excludedKeys: string[]
): React.ReactNode[] {
  const excluded = new Set(excludedKeys);
  return Object.entries(queryState)
    .filter(([key, value]) => !excluded.has(key) && Boolean(value))
    .map(([key, value]) =>
      React.createElement("input", {
        key,
        type: "hidden",
        name: key,
        value
      })
    );
}

function createEmptyPreferenceRecord(): AdminPreferenceRecord {
  return {
    favorites: [],
    recentItems: [],
    savedViews: [],
    dashboards: []
  };
}

function scopeKey(scope: AdminPreferenceScope): string {
  return `${scope.shellId}:${scope.tenantId}:${scope.actorId}`;
}

function normalizePathname(input: string): string {
  const [path] = input.split(/[?#]/);
  if (!path || path === "/") {
    return "/";
  }
  return path.endsWith("/") ? path.slice(0, -1) : path;
}

function matchesRoute(pattern: string, pathname: string): boolean {
  const normalizedPattern = normalizePathname(pattern);
  const normalizedPath = normalizePathname(pathname);
  const routeSegments = normalizedPattern.split("/").filter(Boolean);
  const pathSegments = normalizedPath.split("/").filter(Boolean);
  if (routeSegments.length !== pathSegments.length) {
    return false;
  }
  return routeSegments.every((segment, index) => segment.startsWith(":") || segment === pathSegments[index]);
}

function inferWorkspaceFromPath(pathname: string, workspaces: WorkspaceContribution[]): string | undefined {
  if (pathname.startsWith("/admin/workspace/")) {
    return pathname.split("/").filter(Boolean).at(-1);
  }
  const segment = pathname.split("/").filter(Boolean)[1];
  if (!segment) {
    return workspaces[0]?.id;
  }
  if (segment === "reports") {
    return "reports";
  }
  if (segment === "tools") {
    return "tools";
  }
  return segment;
}

function dedupeById<T extends { id: string }>(entries: T[], secondaryKey?: keyof T): T[] {
  const seen = new Set<string>();
  const deduped: T[] = [];
  for (const entry of entries) {
    const key = `${entry.id}:${secondaryKey ? String(entry[secondaryKey]) : ""}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(entry);
  }
  return deduped;
}

function dedupeNav(entries: AdminContributionRegistry["nav"]): AdminContributionRegistry["nav"] {
  const buckets = new Map<string, AdminContributionRegistry["nav"][number]>();
  for (const entry of entries) {
    const key = `${entry.workspace}:${entry.group}`;
    const existing = buckets.get(key);
    buckets.set(key, {
      ...entry,
      items: dedupeById([...(existing?.items ?? []), ...entry.items])
    });
  }
  return [...buckets.values()].sort((left, right) => {
    const leftKey = `${left.workspace}:${left.group}`;
    const rightKey = `${right.workspace}:${right.group}`;
    return leftKey.localeCompare(rightKey);
  });
}
