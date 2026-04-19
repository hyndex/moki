import type { EChartsCoreOption } from "echarts";
import React from "react";

export const packageId = "chart" as const;
export const packageDisplayName = "Chart" as const;
export const packageDescription = "Canonical ECharts-backed chart presets and rendering contracts." as const;

export type CartesianSeriesInput = {
  name: string;
  data: number[];
};

export type PieSeriesInput = {
  name: string;
  value: number;
};

export type DrilldownLink = {
  href: string;
  label: string;
};

export function buildCartesianChartOption(input: {
  title: string;
  labels: string[];
  series: CartesianSeriesInput[];
  kind?: "line" | "bar";
  stacked?: boolean | undefined;
}): EChartsCoreOption {
  return {
    title: {
      text: input.title
    },
    tooltip: {
      trigger: "axis"
    },
    legend: {
      top: 8
    },
    xAxis: {
      type: "category",
      data: input.labels
    },
    yAxis: {
      type: "value"
    },
    series: input.series.map((series) => ({
      name: series.name,
      type: input.kind ?? "line",
      smooth: input.kind !== "bar",
      stack: input.stacked ? "total" : undefined,
      data: series.data
    }))
  };
}

export function createLineChartOption(input: {
  title: string;
  labels: string[];
  series: CartesianSeriesInput[];
}): EChartsCoreOption {
  return buildCartesianChartOption({
    ...input,
    kind: "line"
  });
}

export function createBarChartOption(input: {
  title: string;
  labels: string[];
  series: CartesianSeriesInput[];
}): EChartsCoreOption {
  return buildCartesianChartOption({
    ...input,
    kind: "bar"
  });
}

export function createStackedBarChartOption(input: {
  title: string;
  labels: string[];
  series: CartesianSeriesInput[];
}): EChartsCoreOption {
  return buildCartesianChartOption({
    ...input,
    kind: "bar",
    stacked: true
  });
}

export function createPieChartOption(input: {
  title: string;
  items: PieSeriesInput[];
}): EChartsCoreOption {
  return {
    title: {
      text: input.title
    },
    tooltip: {
      trigger: "item"
    },
    legend: {
      bottom: 0
    },
    series: [
      {
        type: "pie",
        radius: ["40%", "70%"],
        data: input.items.map((item) => ({
          name: item.name,
          value: item.value
        }))
      }
    ]
  };
}

export function createTrendChartOption(input: {
  title: string;
  labels: string[];
  series: CartesianSeriesInput[];
}): EChartsCoreOption {
  return createLineChartOption(input);
}

export function countChartSeries(option: EChartsCoreOption): number {
  return Array.isArray((option as { series?: unknown[] }).series) ? (option as { series?: unknown[] }).series?.length ?? 0 : 0;
}

export function createDrilldownLink(input: DrilldownLink): DrilldownLink {
  return Object.freeze({
    ...input
  });
}

export function ChartSurface(props: {
  title: string;
  option: EChartsCoreOption;
  drilldown?: DrilldownLink | undefined;
}) {
  return React.createElement(
    "section",
    {
      className: "awb-chart-card",
      "data-testid": "chart-surface",
      "data-chart-option": JSON.stringify(props.option)
    },
    React.createElement("div", { className: "awb-panel-title" }, props.title),
    props.drilldown
      ? React.createElement("a", { href: props.drilldown.href, className: "awb-inline-link" }, props.drilldown.label)
      : null,
    React.createElement(
      "div",
      { className: "awb-chart-placeholder" },
      `Prepared ${countChartSeries(props.option)} series for client hydration`
    )
  );
}
