import { describe, expect, it } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  ActionMenu,
  ActivityFeed,
  ChartCard,
  EmptyState,
  KpiCard,
  StatusBadge,
  buildCartesianChartOption,
  defineDashboard,
  defineSavedQuestion,
  packageId
} from "../../src";

describe("admin-widgets", () => {
  it("exposes a stable package id", () => {
    expect(packageId).toBe("admin-widgets");
  });

  it("defines dashboards and saved questions", () => {
    const dashboard = defineDashboard({
      id: "crm.home",
      title: "CRM Home",
      widgets: [{ widgetId: "crm.pipeline", colSpan: 2, rowSpan: 1 }]
    });
    const question = defineSavedQuestion({
      id: "crm.pipeline.summary",
      label: "Pipeline Summary",
      query: "crm.pipeline.summary",
      kind: "chart"
    });

    expect(dashboard.widgets[0]?.widgetId).toBe("crm.pipeline");
    expect(question.query).toBe("crm.pipeline.summary");
  });

  it("renders dashboard widget primitives and echarts options", () => {
    const option = buildCartesianChartOption({
      title: "Pipeline",
      labels: ["Jan", "Feb"],
      series: [{ name: "Open", data: [10, 12] }]
    });
    const markup = renderToStaticMarkup(
      React.createElement(
        React.Fragment,
        null,
        React.createElement(KpiCard, { label: "MRR", value: "$12k", drilldown: { href: "/admin/reports/mrr", label: "Open report" } }),
        React.createElement(ChartCard, { title: "Pipeline", option }),
        React.createElement(ActivityFeed, {
          items: [{ id: "evt-1", title: "Opportunity advanced", at: "2026-01-01T00:00:00.000Z" }]
        }),
        React.createElement(StatusBadge, { label: "Healthy", tone: "positive" }),
        React.createElement(ActionMenu, { actions: [{ id: "new", label: "Create account", href: "/admin/crm/accounts/new" }] }),
        React.createElement(EmptyState, { title: "No widgets yet", description: "Start with a KPI or saved question." })
      )
    );

    expect(option.xAxis).toBeDefined();
    expect(markup).toContain("Open report");
    expect(markup).toContain("Opportunity advanced");
    expect(markup).toContain("No widgets yet");
  });
});
