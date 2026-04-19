import { describe, expect, it } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  ChartSurface,
  countChartSeries,
  createBarChartOption,
  createLineChartOption,
  createPieChartOption,
  createStackedBarChartOption,
  packageId
} from "../../src";

describe("chart", () => {
  it("exposes a stable package id", () => {
    expect(packageId).toBe("chart");
  });

  it("builds shared echarts option presets", () => {
    const line = createLineChartOption({
      title: "MRR",
      labels: ["Jan", "Feb"],
      series: [{ name: "MRR", data: [12, 14] }]
    });
    const bar = createBarChartOption({
      title: "Pipeline",
      labels: ["Open", "Won"],
      series: [{ name: "Deals", data: [4, 2] }]
    });
    const stacked = createStackedBarChartOption({
      title: "Stages",
      labels: ["Q1"],
      series: [
        { name: "Open", data: [4] },
        { name: "Won", data: [2] }
      ]
    });
    const pie = createPieChartOption({
      title: "Segments",
      items: [
        { name: "SMB", value: 4 },
        { name: "Enterprise", value: 2 }
      ]
    });

    expect(countChartSeries(line)).toBe(1);
    expect(countChartSeries(bar)).toBe(1);
    expect(countChartSeries(stacked)).toBe(2);
    expect(countChartSeries(pie)).toBe(1);
  });

  it("renders chart surfaces without exposing raw echarts usage to plugin code", () => {
    const option = createLineChartOption({
      title: "Pipeline",
      labels: ["Jan", "Feb"],
      series: [{ name: "Open", data: [10, 12] }]
    });
    const markup = renderToStaticMarkup(
      React.createElement(ChartSurface, {
        title: "Pipeline",
        option,
        drilldown: {
          href: "/admin/reports/crm-pipeline",
          label: "Open report"
        }
      })
    );

    expect(markup).toContain("Open report");
    expect(markup).toContain("Prepared 1 series");
  });
});
