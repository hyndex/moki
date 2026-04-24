import * as React from "react";
import { Card, CardContent } from "../Card";
import { Sparkline } from "../charts/Sparkline";
import { useAggregation } from "@/runtime/useAggregation";
import { formatDelta, formatValue } from "./formatters";
import { cn } from "@/lib/cn";
import type { NumberCardWidget as NumberCardSpec } from "@/contracts/widgets";
import { mergeFilters, useWorkspaceFilter } from "./workspaceFilter";

export function NumberCardWidget({ widget }: { widget: NumberCardSpec }) {
  const workspaceFilter = useWorkspaceFilter();
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

  const value = data?.value ?? 0;
  const prev = data?.previousValue;
  const delta = prev !== undefined && widget.trend !== false ? formatDelta(value, prev) : null;

  const over = (v: number, t?: number) =>
    t !== undefined && (widget.invertThreshold ? v <= t : v >= t);

  const intent =
    over(value, widget.dangerAbove)
      ? "danger"
      : over(value, widget.warnAbove)
        ? "warning"
        : widget.intent ?? "neutral";

  const valueClass =
    intent === "danger"
      ? "text-intent-danger"
      : intent === "warning"
        ? "text-intent-warning"
        : intent === "success"
          ? "text-intent-success"
          : "text-text-primary";

  const onClick = widget.drilldown
    ? () => (window.location.hash = widget.drilldown!)
    : undefined;

  return (
    <Card
      className={cn(
        "h-full",
        onClick && "cursor-pointer hover:border-accent/50 transition-colors",
      )}
      onClick={onClick}
    >
      <CardContent className="flex flex-col gap-1 py-4">
        <div className="flex items-baseline justify-between gap-2">
          <div className="text-xs uppercase tracking-wider text-text-muted font-medium truncate">
            {widget.label}
          </div>
          {delta && (
            <div
              className={cn(
                "text-xs tabular-nums font-medium shrink-0",
                delta.positive ? "text-intent-success" : "text-intent-danger",
              )}
            >
              {delta.label}
            </div>
          )}
        </div>
        <div
          className={cn(
            "text-2xl font-semibold tabular-nums",
            valueClass,
            loading && "opacity-50",
          )}
        >
          {loading && !data ? "…" : formatValue(value, widget.format, widget.currency)}
        </div>
        {(widget.sublabel || data?.series) && (
          <div className="flex items-center justify-between text-xs text-text-muted min-h-[18px]">
            {widget.sublabel && <span className="truncate">{widget.sublabel}</span>}
            {data?.series && data.series.length > 1 && (
              <Sparkline
                data={data.series.map((s) => s.value)}
                color={
                  intent === "danger"
                    ? "rgb(var(--intent-danger))"
                    : intent === "warning"
                      ? "rgb(var(--intent-warning))"
                      : "rgb(var(--accent))"
                }
              />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
