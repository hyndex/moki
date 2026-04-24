import * as React from "react";
import { ArrowUpRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../Card";
import { LineChart } from "../charts/LineChart";
import { BarChart } from "../charts/BarChart";
import { Donut } from "../charts/Donut";
import { Funnel } from "../charts/Funnel";
import { Sparkline } from "../charts/Sparkline";
import { EmptyStateFramework } from "../EmptyStateFramework";
import { Spinner } from "@/primitives/Spinner";
import { useAggregation } from "@/runtime/useAggregation";
import { formatValue } from "./formatters";
import type { ChartWidget as ChartSpec } from "@/contracts/widgets";
import { mergeFilters, useWorkspaceFilter } from "./workspaceFilter";
import { useRegistries } from "@/host/pluginHostContext";

export function ChartWidget({ widget }: { widget: ChartSpec }) {
  const workspaceFilter = useWorkspaceFilter(widget.aggregation.resource);
  const effectiveSpec = React.useMemo(
    () =>
      workspaceFilter
        ? {
            ...widget.aggregation,
            filter: mergeFilters(widget.aggregation.filter, workspaceFilter),
          }
        : widget.aggregation,
    [widget.aggregation, workspaceFilter],
  );
  const { data, loading } = useAggregation(effectiveSpec);
  const fmt = (v: number) => formatValue(v, widget.format, widget.currency);

  const onOpen = widget.drilldown
    ? () => (window.location.hash = widget.drilldown!)
    : undefined;

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <div className="flex items-start justify-between w-full">
          <div>
            <CardTitle>{widget.label}</CardTitle>
            {widget.description && <CardDescription>{widget.description}</CardDescription>}
          </div>
          {onOpen && (
            <button
              type="button"
              onClick={onOpen}
              className="text-text-muted hover:text-text-primary"
              aria-label="Open report"
            >
              <ArrowUpRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col">
        {loading && !data ? (
          <div className="flex-1 flex items-center justify-center text-xs text-text-muted gap-2">
            <Spinner size={12} /> Loading…
          </div>
        ) : !data || (!data.series?.length && !data.groups?.length) ? (
          <EmptyStateFramework kind="no-results" />
        ) : (
          <ChartBody widget={widget} data={data} fmt={fmt} />
        )}
      </CardContent>
    </Card>
  );
}

function ChartBody({
  widget,
  data,
  fmt,
}: {
  widget: ChartSpec;
  data: NonNullable<ReturnType<typeof useAggregation>["data"]>;
  fmt: (v: number) => string;
}) {
  const height = widget.height ?? 200;
  if (widget.chart === "line" || widget.chart === "area") {
    const series = data.series ?? [];
    return (
      <LineChart
        xLabels={series.map((s) => s.label)}
        series={[{ label: widget.label, data: series.map((s) => s.value) }]}
        height={height}
        valueFormatter={fmt}
        area={widget.chart === "area"}
      />
    );
  }
  if (widget.chart === "bar") {
    const rows = data.series ?? data.groups ?? [];
    return <BarChart data={rows} height={height} valueFormatter={fmt} />;
  }
  if (widget.chart === "donut") {
    return <Donut data={data.groups ?? []} />;
  }
  if (widget.chart === "funnel") {
    return <Funnel data={data.groups ?? []} />;
  }
  if (widget.chart === "sparkline") {
    return <Sparkline data={(data.series ?? []).map((s) => s.value)} />;
  }
  /* Plugin-contributed chart kind — registries.chartKinds fallback. */
  return <PluginContributedChart widget={widget} data={data} fmt={fmt} />;
}

function PluginContributedChart({
  widget,
  data,
  fmt,
}: {
  widget: ChartSpec;
  data: NonNullable<ReturnType<typeof useAggregation>["data"]>;
  fmt: (v: number) => string;
}) {
  const registries = useRegistries();
  const spec = registries?.chartKinds.get(widget.chart as string);
  if (!spec) {
    return (
      <div className="text-xs text-text-muted p-2 border border-dashed border-border rounded">
        Unknown chart kind "<code className="font-mono">{widget.chart}</code>".
      </div>
    );
  }
  const Render = spec.render;
  return <Render data={data} height={widget.height} format={fmt} />;
}
