import React from "react";
import type { EChartsCoreOption } from "echarts";

import {
  MetricCard,
  PageSection,
  cn
} from "@platform/ui";
import { ChartSurface, buildCartesianChartOption } from "@platform/chart";

import type { WidgetKind } from "@platform/admin-contracts";

export const packageId = "admin-widgets" as const;
export const packageDisplayName = "Admin Widgets" as const;
export const packageDescription = "Dashboard DSLs, saved questions, and widget primitives for the admin desk." as const;

export type DashboardFilterBinding = {
  id: string;
  target: string;
  filterKey: string;
};

export type DrilldownDefinition = {
  href: string;
  label: string;
};

export type DashboardLayoutDefinition = {
  id: string;
  title: string;
  widgets: Array<{ widgetId: string; colSpan: 1 | 2 | 3 | 4; rowSpan: 1 | 2 }>;
  filters?: DashboardFilterBinding[] | undefined;
};

export type SavedQuestionDefinition = {
  id: string;
  label: string;
  query: string;
  kind: Extract<WidgetKind, "kpi" | "chart" | "table">;
};

export function defineDashboard(definition: DashboardLayoutDefinition): DashboardLayoutDefinition {
  return Object.freeze({
    ...definition,
    widgets: [...definition.widgets].sort((left, right) => left.widgetId.localeCompare(right.widgetId)),
    filters: [...(definition.filters ?? [])].sort((left, right) => left.id.localeCompare(right.id))
  });
}

export function defineSavedQuestion(definition: SavedQuestionDefinition): SavedQuestionDefinition {
  return Object.freeze(definition);
}

export function KpiCard(props: {
  label: string;
  value: React.ReactNode;
  tone?: "default" | "positive" | "warning";
  drilldown?: DrilldownDefinition | undefined;
}) {
  const metricProps: {
    label: string;
    value: React.ReactNode;
    tone?: "default" | "positive" | "warning";
  } = {
    label: props.label,
    value: props.value
  };

  if (props.tone) {
    metricProps.tone = props.tone;
  }

  return React.createElement(
    "div",
    { className: "awb-widget-card awb-widget-kpi" },
    React.createElement(MetricCard, metricProps),
    props.drilldown
      ? React.createElement("a", { href: props.drilldown.href, className: "awb-inline-link" }, props.drilldown.label)
      : null
  );
}

export function ChartCard(props: {
  title: string;
  option: EChartsCoreOption;
  drilldown?: DrilldownDefinition | undefined;
}) {
  return React.createElement(
    "div",
    {
      className: "awb-widget-card awb-widget-chart"
    },
    React.createElement(ChartSurface, {
      title: props.title,
      option: props.option,
      drilldown: props.drilldown
    })
  );
}

export function ActivityFeed(props: {
  items: Array<{ id: string; title: string; detail?: string | undefined; at: string }>;
}) {
  return React.createElement(
    PageSection,
    { className: "awb-activity-feed" },
    React.createElement("h2", { className: "awb-panel-title" }, "Activity"),
    React.createElement(
      "ul",
      { className: "awb-feed-list" },
      props.items.map((item) =>
        React.createElement(
          "li",
          { key: item.id, className: "awb-feed-item" },
          React.createElement("div", { className: "awb-feed-title" }, item.title),
          item.detail ? React.createElement("div", { className: "awb-feed-detail" }, item.detail) : null,
          React.createElement("time", { className: "awb-feed-time" }, item.at)
        )
      )
    )
  );
}

export function StatusBadge(props: {
  label: string;
  tone?: "default" | "positive" | "warning" | "critical";
}) {
  const toneClass =
    props.tone === "positive"
      ? "is-positive"
      : props.tone === "warning"
        ? "is-warning"
        : props.tone === "critical"
          ? "is-critical"
          : "is-default";

  return React.createElement(
    "span",
    { className: cn("awb-status-badge", toneClass) },
    props.label
  );
}

export function ActionMenu(props: {
  actions: Array<{ id: string; label: string; href?: string | undefined }>;
}) {
  return React.createElement(
    "ul",
    { className: "awb-action-menu" },
    props.actions.map((action) =>
      React.createElement(
        "li",
        { key: action.id },
        action.href
          ? React.createElement("a", { href: action.href, className: "awb-inline-link" }, action.label)
          : React.createElement("span", { className: "awb-muted-copy" }, action.label)
      )
    )
  );
}

export function EmptyState(props: {
  title: string;
  description: string;
}) {
  return React.createElement(
    PageSection,
    { className: "awb-empty-state" },
    React.createElement("h2", { className: "awb-panel-title" }, props.title),
    React.createElement("p", { className: "awb-muted-copy" }, props.description)
  );
}

export { buildCartesianChartOption };
