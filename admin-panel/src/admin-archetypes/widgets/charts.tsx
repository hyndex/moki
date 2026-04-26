/** Lightweight, dependency-free SVG chart catalog used by Intelligent
 *  Dashboards and Workspace Hubs. These charts consciously trade
 *  pixel-perfection for zero-dependency, deterministic-output
 *  rendering (so screenshot diffs are stable and bundle stays small).
 *
 *  Every chart accepts:
 *    - description?: text consumed by aria-label and screen readers
 *    - className?: applied to the outer <svg> for sizing / colour
 *    - reduce-motion compliance — none of these animate
 *
 *  Series-style charts use the shared `DriftPoint[]` shape from
 *  `../types`. Categorical charts accept `[label, value]` tuples.
 */

import * as React from "react";
import type { DriftPoint } from "../types";
import { cn } from "@/lib/cn";

const NICE_PALETTE = [
  "#3B82F6", // info / blue
  "#10B981", // success / green
  "#F59E0B", // warning / amber
  "#EF4444", // danger / red
  "#8B5CF6", // purple
  "#EC4899", // pink
  "#14B8A6", // teal
  "#F97316", // orange
];

/* ============================================================ helpers */

interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

function computeBounds(series: ReadonlyArray<DriftPoint>): Bounds {
  if (series.length === 0) return { minX: 0, maxX: 1, minY: 0, maxY: 1 };
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of series) {
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  if (minY === maxY) {
    // Avoid divide-by-zero by giving a 10% pad.
    minY -= Math.max(1, Math.abs(minY) * 0.1);
    maxY += Math.max(1, Math.abs(maxY) * 0.1);
  }
  return {
    minX: 0,
    maxX: series.length - 1,
    minY,
    maxY,
  };
}

function project(
  value: number,
  min: number,
  max: number,
  pixels: number,
  invert = false,
): number {
  if (max === min) return pixels / 2;
  const t = (value - min) / (max - min);
  return invert ? pixels - t * pixels : t * pixels;
}

interface ChartSlot {
  label: string;
  series: ReadonlyArray<DriftPoint>;
}

/* ============================================================ LineSeries */

export interface LineSeriesProps {
  /** One or more series to draw. Multiple series share the same x-axis. */
  series: readonly ChartSlot[];
  width?: number;
  height?: number;
  /** Pad in px around the plotting area. */
  pad?: number;
  /** Show axis labels (min/max y, first/last x). Default false. */
  axisLabels?: boolean;
  /** Custom x-axis tick formatter. */
  formatX?: (value: string | number) => string;
  /** Custom y-axis tick formatter. */
  formatY?: (value: number) => string;
  description?: string;
  className?: string;
}

/** Multi-line time-series chart. Smooth, with hover dots on the last point. */
export function LineSeries({
  series,
  width = 320,
  height = 96,
  pad = 8,
  axisLabels = false,
  formatX,
  formatY,
  description,
  className,
}: LineSeriesProps) {
  const all = series.flatMap((s) => s.series);
  const bounds = computeBounds(all);
  const innerW = width - pad * 2;
  const innerH = height - pad * 2 - (axisLabels ? 14 : 0);

  return (
    <svg
      role="img"
      aria-label={description ?? series.map((s) => s.label).join(", ")}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn("inline-block overflow-visible", className)}
    >
      {/* gridlines */}
      <line
        x1={pad}
        x2={width - pad}
        y1={pad}
        y2={pad}
        className="stroke-border opacity-40"
        strokeWidth={0.5}
      />
      <line
        x1={pad}
        x2={width - pad}
        y1={pad + innerH}
        y2={pad + innerH}
        className="stroke-border opacity-40"
        strokeWidth={0.5}
      />
      {series.map((s, i) => {
        if (s.series.length < 2) return null;
        const stroke = NICE_PALETTE[i % NICE_PALETTE.length];
        const stepX = innerW / (s.series.length - 1);
        const path = s.series
          .map((p, idx) => {
            const x = pad + idx * stepX;
            const y = pad + project(p.y, bounds.minY, bounds.maxY, innerH, true);
            return `${idx === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
          })
          .join(" ");
        return (
          <g key={i}>
            <path d={path} fill="none" stroke={stroke} strokeWidth={1.5} />
            {/* terminal dot */}
            <circle
              cx={pad + innerW}
              cy={pad + project(s.series[s.series.length - 1].y, bounds.minY, bounds.maxY, innerH, true)}
              r={2}
              fill={stroke}
            />
          </g>
        );
      })}
      {axisLabels && (
        <g className="fill-text-muted text-[9px] font-mono tabular-nums">
          <text x={pad} y={height - 1}>
            {formatX ? formatX(series[0]?.series[0]?.x ?? "") : String(series[0]?.series[0]?.x ?? "")}
          </text>
          <text x={width - pad} y={height - 1} textAnchor="end">
            {formatX
              ? formatX(series[0]?.series.at(-1)?.x ?? "")
              : String(series[0]?.series.at(-1)?.x ?? "")}
          </text>
          <text x={pad} y={pad - 2}>
            {formatY ? formatY(bounds.maxY) : Math.round(bounds.maxY).toString()}
          </text>
          <text x={pad} y={pad + innerH + 9}>
            {formatY ? formatY(bounds.minY) : Math.round(bounds.minY).toString()}
          </text>
        </g>
      )}
    </svg>
  );
}

/* ============================================================ AreaSeries */

export interface AreaSeriesProps {
  data: ReadonlyArray<DriftPoint>;
  width?: number;
  height?: number;
  pad?: number;
  fill?: string;
  stroke?: string;
  description?: string;
  className?: string;
}

/** Single filled area chart. */
export function AreaSeries({
  data,
  width = 320,
  height = 96,
  pad = 6,
  fill,
  stroke,
  description,
  className,
}: AreaSeriesProps) {
  if (data.length < 2) {
    return (
      <svg
        role="img"
        aria-label={description}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className={cn("inline-block", className)}
      />
    );
  }
  const bounds = computeBounds(data);
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;
  const stepX = innerW / (data.length - 1);
  const points = data.map((p, i) => [
    pad + i * stepX,
    pad + project(p.y, bounds.minY, bounds.maxY, innerH, true),
  ]);
  const linePath = points
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(" ");
  const areaPath = `${linePath} L${(pad + innerW).toFixed(1)},${(pad + innerH).toFixed(1)} L${pad.toFixed(1)},${(pad + innerH).toFixed(1)} Z`;
  const f = fill ?? NICE_PALETTE[0];
  const s = stroke ?? f;
  return (
    <svg
      role="img"
      aria-label={description}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn("inline-block", className)}
    >
      <path d={areaPath} fill={f} opacity={0.2} />
      <path d={linePath} fill="none" stroke={s} strokeWidth={1.5} />
    </svg>
  );
}

/* ============================================================ BarSeries */

export interface BarSeriesProps {
  /** Categorical bars: `[label, value]` tuples. Multiple groups can be
   *  passed as an array of arrays for stacked / grouped variants. */
  bars: ReadonlyArray<readonly [string, number]>;
  /** Stacked groups (each group's bars share an x). Optional. */
  stacks?: ReadonlyArray<{ label: string; values: readonly number[] }>;
  width?: number;
  height?: number;
  pad?: number;
  /** Horizontal layout instead of vertical. Default false. */
  horizontal?: boolean;
  formatY?: (value: number) => string;
  description?: string;
  className?: string;
}

export function BarSeries({
  bars,
  stacks,
  width = 320,
  height = 120,
  pad = 16,
  horizontal = false,
  formatY,
  description,
  className,
}: BarSeriesProps) {
  // Use the basic categorical bars by default.
  const stackMode = !!stacks;
  const labels = bars.map(([l]) => l);
  const totals = stackMode
    ? labels.map((_, i) => stacks!.reduce((sum, s) => sum + (s.values[i] ?? 0), 0))
    : bars.map(([, v]) => v);
  const maxY = Math.max(1, ...totals);
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;
  const slotW = innerW / Math.max(1, labels.length);
  const barW = slotW * 0.65;
  const startX = pad + (slotW - barW) / 2;

  return (
    <svg
      role="img"
      aria-label={description}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn("inline-block overflow-visible", className)}
    >
      {/* baseline */}
      {!horizontal && (
        <line
          x1={pad}
          x2={width - pad}
          y1={height - pad}
          y2={height - pad}
          className="stroke-border opacity-50"
          strokeWidth={0.5}
        />
      )}
      {labels.map((label, i) => {
        if (!stackMode) {
          const v = bars[i][1];
          if (horizontal) {
            const w = (v / maxY) * innerW;
            const y = pad + i * slotW + (slotW - barW) / 2;
            return (
              <g key={i}>
                <rect x={pad} y={y} width={Math.max(0, w)} height={barW} fill={NICE_PALETTE[0]} rx={2} />
                <text x={pad - 2} y={y + barW / 2 + 3} textAnchor="end" className="fill-text-muted text-[9px]">{label}</text>
                <text x={pad + w + 3} y={y + barW / 2 + 3} className="fill-text-primary text-[9px] font-mono">
                  {formatY ? formatY(v) : v}
                </text>
              </g>
            );
          }
          const h = (v / maxY) * innerH;
          const x = startX + i * slotW;
          const y = height - pad - h;
          return (
            <g key={i}>
              <rect x={x} y={y} width={barW} height={h} fill={NICE_PALETTE[0]} rx={2} />
              <text x={x + barW / 2} y={height - 2} textAnchor="middle" className="fill-text-muted text-[9px]">{label}</text>
              <text x={x + barW / 2} y={y - 2} textAnchor="middle" className="fill-text-primary text-[9px] font-mono">
                {formatY ? formatY(v) : v}
              </text>
            </g>
          );
        }
        // Stacked
        let cursorY = height - pad;
        const x = startX + i * slotW;
        return (
          <g key={i}>
            {stacks!.map((s, si) => {
              const v = s.values[i] ?? 0;
              const h = (v / maxY) * innerH;
              const y = cursorY - h;
              cursorY = y;
              return (
                <rect
                  key={si}
                  x={x}
                  y={y}
                  width={barW}
                  height={h}
                  fill={NICE_PALETTE[si % NICE_PALETTE.length]}
                />
              );
            })}
            <text x={x + barW / 2} y={height - 2} textAnchor="middle" className="fill-text-muted text-[9px]">{label}</text>
          </g>
        );
      })}
    </svg>
  );
}

/* ============================================================ DonutSeries */

export interface DonutSeriesProps {
  data: ReadonlyArray<readonly [string, number]>;
  size?: number;
  innerRatio?: number;
  centerLabel?: React.ReactNode;
  centerValue?: React.ReactNode;
  description?: string;
  className?: string;
}

export function DonutSeries({
  data,
  size = 96,
  innerRatio = 0.62,
  centerLabel,
  centerValue,
  description,
  className,
}: DonutSeriesProps) {
  const total = data.reduce((s, [, v]) => s + Math.max(0, v), 0) || 1;
  const radius = size / 2 - 4;
  const inner = radius * innerRatio;
  const cx = size / 2;
  const cy = size / 2;
  let acc = 0;
  return (
    <svg
      role="img"
      aria-label={description ?? data.map(([l]) => l).join(", ")}
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={cn("inline-block", className)}
    >
      {data.map(([label, v], i) => {
        const start = (acc / total) * Math.PI * 2;
        acc += Math.max(0, v);
        const end = (acc / total) * Math.PI * 2;
        const large = end - start > Math.PI ? 1 : 0;
        const x1 = cx + Math.sin(start) * radius;
        const y1 = cy - Math.cos(start) * radius;
        const x2 = cx + Math.sin(end) * radius;
        const y2 = cy - Math.cos(end) * radius;
        const xi1 = cx + Math.sin(end) * inner;
        const yi1 = cy - Math.cos(end) * inner;
        const xi2 = cx + Math.sin(start) * inner;
        const yi2 = cy - Math.cos(start) * inner;
        const d = `M${x1},${y1} A${radius},${radius} 0 ${large} 1 ${x2},${y2} L${xi1},${yi1} A${inner},${inner} 0 ${large} 0 ${xi2},${yi2} Z`;
        return <path key={i} d={d} fill={NICE_PALETTE[i % NICE_PALETTE.length]}><title>{`${label}: ${v}`}</title></path>;
      })}
      {(centerLabel || centerValue) && (
        <g textAnchor="middle">
          {centerValue && (
            <text x={cx} y={cy + 1} dominantBaseline="central" className="fill-text-primary text-[14px] font-semibold tabular-nums">
              {centerValue}
            </text>
          )}
          {centerLabel && (
            <text x={cx} y={cy + 14} className="fill-text-muted text-[9px] uppercase tracking-wide">
              {centerLabel}
            </text>
          )}
        </g>
      )}
    </svg>
  );
}

/* ============================================================ Heatmap */

export interface HeatmapProps {
  /** 2-D matrix; rows = first axis, cols = second axis. */
  matrix: ReadonlyArray<ReadonlyArray<number>>;
  rowLabels?: readonly string[];
  colLabels?: readonly string[];
  width?: number;
  height?: number;
  description?: string;
  className?: string;
}

export function Heatmap({
  matrix,
  rowLabels,
  colLabels,
  width = 320,
  height = 120,
  description,
  className,
}: HeatmapProps) {
  const rows = matrix.length;
  const cols = matrix[0]?.length ?? 0;
  if (rows === 0 || cols === 0) return null;
  const flat = matrix.flat();
  const max = Math.max(0.0001, ...flat);
  const padTop = colLabels ? 14 : 0;
  const padLeft = rowLabels ? 60 : 0;
  const cellW = (width - padLeft) / cols;
  const cellH = (height - padTop) / rows;
  return (
    <svg
      role="img"
      aria-label={description ?? "Heatmap"}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn("inline-block", className)}
    >
      {colLabels && (
        <g>
          {colLabels.map((label, c) => (
            <text key={c} x={padLeft + c * cellW + cellW / 2} y={10} textAnchor="middle" className="fill-text-muted text-[9px] uppercase tracking-wide">
              {label}
            </text>
          ))}
        </g>
      )}
      {matrix.map((row, r) =>
        row.map((v, c) => {
          const intensity = Math.max(0, v / max);
          return (
            <g key={`${r}-${c}`}>
              <rect
                x={padLeft + c * cellW + 1}
                y={padTop + r * cellH + 1}
                width={cellW - 2}
                height={cellH - 2}
                fill={NICE_PALETTE[0]}
                opacity={0.1 + intensity * 0.85}
                rx={1}
              >
                <title>{`${rowLabels?.[r] ?? r} × ${colLabels?.[c] ?? c}: ${v}`}</title>
              </rect>
            </g>
          );
        }),
      )}
      {rowLabels && (
        <g>
          {rowLabels.map((label, r) => (
            <text
              key={r}
              x={padLeft - 4}
              y={padTop + r * cellH + cellH / 2 + 3}
              textAnchor="end"
              className="fill-text-muted text-[9px]"
            >
              {label}
            </text>
          ))}
        </g>
      )}
    </svg>
  );
}

/* ============================================================ Funnel */

export interface FunnelProps {
  /** Stages, in order from widest at top to narrowest at bottom. */
  stages: ReadonlyArray<{ label: string; value: number }>;
  width?: number;
  height?: number;
  description?: string;
  className?: string;
}

export function Funnel({
  stages,
  width = 320,
  height = 160,
  description,
  className,
}: FunnelProps) {
  if (stages.length === 0) return null;
  const top = stages[0].value || 1;
  const rowH = height / stages.length;
  return (
    <svg
      role="img"
      aria-label={description}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn("inline-block", className)}
    >
      {stages.map((stage, i) => {
        const w = (stage.value / top) * width * 0.95;
        const x = (width - w) / 2;
        const y = i * rowH + 2;
        const conv = i === 0 ? 1 : stage.value / stages[i - 1].value;
        return (
          <g key={i}>
            <rect
              x={x}
              y={y}
              width={Math.max(2, w)}
              height={rowH - 4}
              fill={NICE_PALETTE[i % NICE_PALETTE.length]}
              opacity={0.9}
              rx={4}
            />
            <text
              x={width / 2}
              y={y + (rowH - 4) / 2 + 3}
              textAnchor="middle"
              className="fill-white text-[10px] font-semibold"
            >
              {stage.label} · {stage.value}
            </text>
            {i > 0 && (
              <text
                x={width - 4}
                y={y - 1}
                textAnchor="end"
                className="fill-text-muted text-[9px] tabular-nums"
              >
                {(conv * 100).toFixed(0)}%
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/* ============================================================ GaugeArc */

export interface GaugeArcProps {
  /** 0..1 progress. */
  value: number;
  size?: number;
  /** Severity tier override. By default goes by value: <0.5 danger,
   *  <0.8 warning, >=0.8 success. */
  tone?: "info" | "success" | "warning" | "danger";
  centerLabel?: React.ReactNode;
  description?: string;
  className?: string;
}

export function GaugeArc({
  value,
  size = 96,
  tone,
  centerLabel,
  description,
  className,
}: GaugeArcProps) {
  const v = Math.max(0, Math.min(1, value));
  const cx = size / 2;
  const cy = size / 2 + size / 12;
  const r = size / 2 - 6;
  const angle = -Math.PI + v * Math.PI; // -PI .. 0
  const x = cx + Math.cos(angle) * r;
  const y = cy + Math.sin(angle) * r;
  const stroke = tone
    ? PALETTE[tone]
    : v >= 0.8
      ? PALETTE.success
      : v >= 0.5
        ? PALETTE.warning
        : PALETTE.danger;
  return (
    <svg
      role="img"
      aria-label={description}
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={cn("inline-block", className)}
    >
      {/* Background arc */}
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none"
        stroke="currentColor"
        opacity={0.15}
        strokeWidth={6}
        strokeLinecap="round"
        className="text-text-muted"
      />
      {/* Filled arc */}
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)}`}
        fill="none"
        stroke={stroke}
        strokeWidth={6}
        strokeLinecap="round"
      />
      {centerLabel && (
        <text
          x={cx}
          y={cy - 4}
          textAnchor="middle"
          dominantBaseline="central"
          className="fill-text-primary text-[14px] font-semibold tabular-nums"
        >
          {centerLabel}
        </text>
      )}
    </svg>
  );
}

const PALETTE = {
  info: "#3B82F6",
  success: "#10B981",
  warning: "#F59E0B",
  danger: "#EF4444",
} as const;

/* ============================================================ WaterfallSeries */

export interface WaterfallSeriesProps {
  /** Bars in order; positive values go up, negative go down. The first
   *  bar represents the starting value and is rendered as a totals bar. */
  bars: ReadonlyArray<{ label: string; value: number; type?: "start" | "delta" | "total" }>;
  width?: number;
  height?: number;
  formatY?: (n: number) => string;
  description?: string;
  className?: string;
}

export function WaterfallSeries({
  bars,
  width = 360,
  height = 160,
  formatY,
  description,
  className,
}: WaterfallSeriesProps) {
  if (bars.length === 0) return null;
  // Compute running totals.
  let running = 0;
  const computed = bars.map((b) => {
    const isTotal = b.type === "start" || b.type === "total";
    if (isTotal) {
      running = b.value;
      return { ...b, isTotal, top: 0, bottom: running, displayedAs: "total" as const };
    }
    const start = running;
    running += b.value;
    return {
      ...b,
      isTotal: false,
      top: Math.min(start, running),
      bottom: Math.max(start, running),
      displayedAs: b.value >= 0 ? ("up" as const) : ("down" as const),
    };
  });

  // Y-axis domain.
  const max = Math.max(...computed.flatMap((b) => [b.bottom, b.isTotal ? b.bottom : 0]));
  const min = Math.min(0, ...computed.flatMap((b) => [b.top, b.isTotal ? 0 : 0]));
  const padX = 16;
  const padY = 14;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;
  const slotW = innerW / Math.max(1, computed.length);
  const barW = slotW * 0.6;
  const yFor = (v: number) => padY + project(v, min, max, innerH, true);

  return (
    <svg
      role="img"
      aria-label={description}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn("inline-block", className)}
    >
      <line
        x1={padX}
        x2={width - padX}
        y1={yFor(0)}
        y2={yFor(0)}
        className="stroke-border opacity-50"
        strokeWidth={0.5}
      />
      {computed.map((b, i) => {
        const x = padX + i * slotW + (slotW - barW) / 2;
        const yTop = yFor(b.bottom);
        const yBot = yFor(b.top);
        const fill = b.isTotal
          ? "#94A3B8"
          : b.displayedAs === "up"
            ? PALETTE.success
            : PALETTE.danger;
        const h = Math.max(2, yBot - yTop);
        return (
          <g key={i}>
            <rect x={x} y={yTop} width={barW} height={h} fill={fill} rx={2} />
            <text x={x + barW / 2} y={height - 2} textAnchor="middle" className="fill-text-muted text-[9px]">
              {b.label}
            </text>
            <text
              x={x + barW / 2}
              y={Math.max(10, yTop - 2)}
              textAnchor="middle"
              className="fill-text-primary text-[9px] font-mono"
            >
              {formatY ? formatY(b.value) : Math.round(b.value)}
            </text>
            {!b.isTotal && i + 1 < computed.length && (
              <line
                x1={x + barW}
                x2={x + slotW}
                y1={b.displayedAs === "up" ? yTop : yBot}
                y2={b.displayedAs === "up" ? yTop : yBot}
                className="stroke-border opacity-60"
                strokeWidth={0.5}
                strokeDasharray="2 2"
              />
            )}
          </g>
        );
      })}
    </svg>
  );
}
