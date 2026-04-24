import * as React from "react";
import ReactECharts from "echarts-for-react";
import type { EChartsOption, ECharts } from "echarts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../Card";
import { EmptyStateFramework } from "../EmptyStateFramework";
import { Spinner } from "@/primitives/Spinner";
import { FreshnessIndicator } from "../FreshnessIndicator";
import { cn } from "@/lib/cn";
import { getTheme } from "@/tokens";
import { ArrowUpRight, Download } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/primitives/DropdownMenu";

/** Themed ECharts card.
 *
 *  Wraps echarts-for-react with:
 *    - our design tokens (colors, font, grid spacing) applied to every chart
 *    - loading + empty + error states that match the rest of the platform
 *    - a toolbox menu (zoom reset / save as PNG)
 *    - a drilldown hook (onSegmentClick → route)
 *    - a freshness indicator in the header
 *    - responsive auto-resize
 *
 *  Replaces the hand-rolled BarChart, LineChart, Donut, Funnel, Sparkline —
 *  those stay exported for backward compatibility but new code should use
 *  this. See admin-panel/src/examples/platform-core/WorkspaceHome.tsx for
 *  widget-grid integration.
 */

export interface EChartsCardProps {
  title?: React.ReactNode;
  description?: React.ReactNode;
  option: EChartsOption;
  height?: number;
  loading?: boolean;
  /** If true, shows the empty state rather than the chart. */
  empty?: boolean;
  /** Last update time for the FreshnessIndicator. */
  lastUpdatedAt?: Date | string | number | null;
  /** "live" pulse when realtime-driven. */
  live?: boolean;
  /** Fires when the user clicks a chart element. */
  onSegmentClick?: (params: { name: string; value: number | number[]; seriesName: string }) => void;
  /** Open a drilldown route on top-right arrow click. */
  drilldown?: string;
  /** Extra actions in the kebab menu. */
  extraActions?: { label: string; onClick: () => void }[];
  className?: string;
}

const NEUTRAL_PALETTE = [
  "rgb(79, 70, 229)",   // accent indigo
  "rgb(34, 197, 94)",   // green
  "rgb(251, 146, 60)",  // orange
  "rgb(236, 72, 153)",  // pink
  "rgb(59, 130, 246)",  // blue
  "rgb(168, 85, 247)",  // purple
  "rgb(234, 179, 8)",   // yellow
  "rgb(239, 68, 68)",   // red
];

function useCssVar(name: string, fallback: string): string {
  const [value, setValue] = React.useState(fallback);
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const read = () => {
      const computed = getComputedStyle(document.documentElement)
        .getPropertyValue(name)
        .trim();
      if (computed) setValue(`rgb(${computed})`);
    };
    read();
    // Re-read when theme / density changes (tokens.ts toggles html attributes).
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme", "data-density"],
    });
    return () => observer.disconnect();
  }, [name]);
  return value;
}

/** Apply our design tokens on top of the caller's option so every chart
 *  looks consistent with the rest of the shell. Caller-provided values win. */
function themeOption(option: EChartsOption, textColor: string, mutedColor: string, borderColor: string): EChartsOption {
  return {
    textStyle: { fontFamily: "system-ui, -apple-system, sans-serif", color: textColor },
    color: NEUTRAL_PALETTE,
    grid: { top: 24, right: 12, bottom: 32, left: 48, containLabel: true },
    tooltip: {
      backgroundColor: "rgba(17, 24, 39, 0.96)",
      borderWidth: 0,
      textStyle: { color: "white", fontSize: 12 },
      padding: [8, 12],
      extraCssText: "border-radius: 6px; box-shadow: 0 8px 24px rgba(0,0,0,0.18);",
    },
    xAxis: {
      axisLine: { lineStyle: { color: borderColor } },
      axisTick: { show: false },
      axisLabel: { color: mutedColor, fontSize: 11 },
      splitLine: { show: false },
    },
    yAxis: {
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: mutedColor, fontSize: 11 },
      splitLine: { lineStyle: { color: borderColor, type: "dashed" as const } },
    },
    legend: {
      textStyle: { color: mutedColor, fontSize: 11 },
      icon: "circle",
      itemWidth: 8,
      itemHeight: 8,
      top: 0,
    },
    ...option,
  };
}

export function EChartsCard({
  title,
  description,
  option,
  height = 240,
  loading,
  empty,
  lastUpdatedAt,
  live,
  onSegmentClick,
  drilldown,
  extraActions,
  className,
}: EChartsCardProps) {
  const theme = getTheme();
  // Read token values directly from the DOM so we react to theme swaps.
  const textColor = useCssVar("--text-primary", theme === "dark" ? "rgb(229,231,235)" : "rgb(17,24,39)");
  const mutedColor = useCssVar("--text-muted", theme === "dark" ? "rgb(148,163,184)" : "rgb(100,116,139)");
  const borderColor = useCssVar("--border-subtle", theme === "dark" ? "rgb(51,65,85)" : "rgb(226,232,240)");

  const themed = React.useMemo(
    () => themeOption(option, textColor, mutedColor, borderColor),
    [option, textColor, mutedColor, borderColor],
  );

  const chartRef = React.useRef<ReactECharts | null>(null);

  const onEvents = React.useMemo(
    () => ({
      click: (params: {
        name: string;
        value: number | number[];
        seriesName: string;
      }) => {
        onSegmentClick?.(params);
      },
    }),
    [onSegmentClick],
  );

  const downloadPng = React.useCallback(() => {
    const instance = chartRef.current?.getEchartsInstance() as ECharts | undefined;
    if (!instance) return;
    const url = instance.getDataURL({ pixelRatio: 2, backgroundColor: "transparent" });
    const a = document.createElement("a");
    a.href = url;
    a.download = `${typeof title === "string" ? title : "chart"}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }, [title]);

  return (
    <Card className={cn("h-full flex flex-col", className)}>
      {(title || description || drilldown || extraActions?.length || lastUpdatedAt) && (
        <CardHeader>
          <div className="flex items-start justify-between w-full gap-2">
            <div className="min-w-0">
              {title && <CardTitle>{title}</CardTitle>}
              {description && <CardDescription>{description}</CardDescription>}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {lastUpdatedAt !== undefined && (
                <FreshnessIndicator lastUpdatedAt={lastUpdatedAt} live={live} />
              )}
              {drilldown && (
                <button
                  type="button"
                  onClick={() => (window.location.hash = drilldown)}
                  className="text-text-muted hover:text-text-primary"
                  aria-label="Open details"
                >
                  <ArrowUpRight className="h-4 w-4" />
                </button>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="text-text-muted hover:text-text-primary"
                    aria-label="Chart actions"
                  >
                    <Download className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={downloadPng}>
                    Download PNG
                  </DropdownMenuItem>
                  {extraActions?.map((a) => (
                    <DropdownMenuItem key={a.label} onSelect={a.onClick}>
                      {a.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardHeader>
      )}
      <CardContent className="flex-1 relative p-3">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center gap-2 text-xs text-text-muted">
            <Spinner size={12} /> Loading…
          </div>
        ) : empty ? (
          <EmptyStateFramework kind="no-results" />
        ) : (
          <ReactECharts
            ref={(r) => {
              chartRef.current = r;
            }}
            option={themed}
            style={{ height, width: "100%" }}
            notMerge
            lazyUpdate
            theme={theme === "dark" ? undefined : undefined /* ECharts renders tokens regardless */}
            onEvents={onEvents}
            opts={{ renderer: "svg" }}
          />
        )}
      </CardContent>
    </Card>
  );
}

/** Quick preset helpers — every function returns a themed EChartsOption
 *  you can pass directly to <EChartsCard option={preset.bar(...)} />. */
export const echartsPresets = {
  bar(data: readonly { label: string; value: number }[], opts?: { horizontal?: boolean; formatter?: (v: number) => string }): EChartsOption {
    const axis = {
      type: "category" as const,
      data: data.map((d) => d.label),
    };
    const value = { type: "value" as const, axisLabel: { formatter: opts?.formatter } };
    return {
      xAxis: opts?.horizontal ? value : axis,
      yAxis: opts?.horizontal ? axis : value,
      series: [
        {
          type: "bar",
          data: data.map((d) => d.value),
          itemStyle: { borderRadius: [4, 4, 0, 0] },
          barMaxWidth: 48,
        },
      ],
    };
  },

  line(xs: readonly string[], series: readonly { name: string; data: number[]; area?: boolean }[], formatter?: (v: number) => string): EChartsOption {
    return {
      xAxis: { type: "category", data: [...xs] },
      yAxis: { type: "value", axisLabel: { formatter } },
      legend: series.length > 1 ? { show: true } : { show: false },
      series: series.map((s) => ({
        name: s.name,
        type: "line",
        data: s.data,
        smooth: true,
        symbolSize: 6,
        lineStyle: { width: 2 },
        areaStyle: s.area ? { opacity: 0.15 } : undefined,
      })),
    };
  },

  donut(data: readonly { label: string; value: number }[]): EChartsOption {
    return {
      tooltip: { trigger: "item" },
      series: [
        {
          type: "pie",
          radius: ["55%", "80%"],
          label: { show: false },
          labelLine: { show: false },
          data: data.map((d) => ({ name: d.label, value: d.value })),
        },
      ],
      legend: { orient: "vertical", left: "right", top: "middle", textStyle: { fontSize: 11 } },
    };
  },

  funnel(data: readonly { label: string; value: number }[]): EChartsOption {
    return {
      tooltip: { trigger: "item" },
      series: [
        {
          type: "funnel",
          sort: "descending",
          gap: 2,
          label: { position: "inside", formatter: "{b}: {c}" },
          data: data.map((d) => ({ name: d.label, value: d.value })),
        },
      ],
    };
  },

  heatmap(xs: readonly string[], ys: readonly string[], values: readonly [number, number, number][]): EChartsOption {
    const max = Math.max(...values.map((v) => v[2]));
    return {
      grid: { top: 32, right: 16, bottom: 48, left: 60 },
      xAxis: { type: "category", data: [...xs], splitArea: { show: true } },
      yAxis: { type: "category", data: [...ys], splitArea: { show: true } },
      visualMap: {
        min: 0,
        max,
        calculable: true,
        orient: "horizontal",
        left: "center",
        bottom: 0,
        inRange: { color: ["#e0e7ff", "#4f46e5"] },
      },
      series: [
        {
          type: "heatmap",
          data: values.map((v) => [v[0], v[1], v[2]]),
          label: { show: false },
        },
      ],
    };
  },

  gauge(value: number, max = 100, label = ""): EChartsOption {
    return {
      series: [
        {
          type: "gauge",
          min: 0,
          max,
          splitNumber: 5,
          axisLine: { lineStyle: { width: 12, color: [[value / max, "#4f46e5"], [1, "#e2e8f0"]] } },
          pointer: { show: false },
          axisTick: { show: false },
          splitLine: { show: false },
          axisLabel: { show: false },
          data: [{ value, name: label }],
          detail: { fontSize: 20, formatter: "{value}", offsetCenter: [0, "0%"] },
          title: { fontSize: 11, offsetCenter: [0, "50%"] },
        },
      ],
    };
  },
};
