/** Sparkline field kind — renders a tiny inline chart from an
 *  `number[]` value. Read-only: there's no real "form input" for a
 *  series of points so the form falls back to a JSON-like text editor
 *  exposing the array. The list cell + detail viewer are the primary
 *  use case (e.g. "trend over the last 14 days" inside a customers
 *  list). */

import * as React from "react";
import { Sparkline } from "@/admin-primitives/charts/Sparkline";
import type {
  FieldKindFormProps,
  FieldKindListCellProps,
  FieldKindDetailProps,
  FieldKindRenderer,
} from "../fieldKindRegistry";

function asSeries(v: unknown): number[] {
  if (Array.isArray(v)) return v.filter((n) => typeof n === "number" && Number.isFinite(n)) as number[];
  if (typeof v === "string" && v) {
    try {
      const parsed = JSON.parse(v);
      if (Array.isArray(parsed)) return parsed.filter((n) => typeof n === "number" && Number.isFinite(n)) as number[];
    } catch {
      /* fall through */
    }
  }
  return [];
}

function SparklineForm(props: FieldKindFormProps): React.ReactElement {
  const series = asSeries(props.value);
  const text = JSON.stringify(series);
  return (
    <div className="space-y-2">
      <Sparkline data={series.length > 0 ? series : [0, 0]} width={240} height={48} />
      <textarea
        value={text}
        onChange={(e) => {
          try {
            const parsed = JSON.parse(e.target.value);
            if (Array.isArray(parsed)) props.onChange(parsed);
          } catch {
            /* hold the draft */
          }
        }}
        disabled={props.disabled}
        className="w-full h-16 px-2 py-1 rounded-md border border-border bg-surface-0 text-xs font-mono outline-none focus:border-accent focus:shadow-focus"
        aria-label="Sparkline data points (JSON array)"
      />
    </div>
  );
}

function SparklineCell(props: FieldKindListCellProps): React.ReactElement {
  const series = asSeries(props.value);
  if (series.length === 0) return <span className="text-text-muted">—</span>;
  return <Sparkline data={series} width={80} height={20} />;
}

function SparklineDetail(props: FieldKindDetailProps): React.ReactElement {
  const series = asSeries(props.value);
  if (series.length === 0) return <span className="text-text-muted">—</span>;
  return <Sparkline data={series} width={240} height={56} />;
}

export const sparklineKind: FieldKindRenderer = {
  Form: SparklineForm,
  ListCell: SparklineCell,
  Detail: SparklineDetail,
};
