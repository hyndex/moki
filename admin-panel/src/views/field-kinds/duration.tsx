/** Duration field kind — stores an integer number of seconds.
 *  Form input accepts either a number (seconds) or a human shorthand
 *  ("1h 30m", "45s", "2d 4h") and normalises on blur. Cell + detail
 *  format the value as a compact human string ("1h 30m").
 *
 *  Why integer seconds in storage: portable across SQL/JSON/Y.js,
 *  comparable, sortable, doesn't drift between locales. The UI is
 *  the only layer that worries about formatting. */

import * as React from "react";
import { Clock } from "lucide-react";
import { cn } from "@/lib/cn";
import type {
  FieldKindFormProps,
  FieldKindListCellProps,
  FieldKindDetailProps,
  FieldKindRenderer,
} from "../fieldKindRegistry";

const UNIT_SEC: Record<string, number> = {
  s: 1,
  sec: 1,
  m: 60,
  min: 60,
  h: 3600,
  hr: 3600,
  d: 86_400,
  day: 86_400,
  w: 604_800,
  wk: 604_800,
};

export function parseDuration(input: string): number | null {
  const s = input.trim().toLowerCase();
  if (!s) return null;
  if (/^\d+(\.\d+)?$/.test(s)) {
    const n = parseFloat(s);
    return Number.isFinite(n) ? Math.round(n) : null;
  }
  let total = 0;
  let any = false;
  const re = /(\d+(?:\.\d+)?)\s*([a-z]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) {
    const n = parseFloat(m[1]!);
    const unit = m[2]!;
    const k = UNIT_SEC[unit] ?? UNIT_SEC[unit.replace(/s$/, "")];
    if (k === undefined || !Number.isFinite(n)) continue;
    total += n * k;
    any = true;
  }
  return any ? Math.round(total) : null;
}

export function formatDuration(seconds: number): string {
  if (seconds < 0 || !Number.isFinite(seconds)) return "—";
  if (seconds < 60) return `${seconds}s`;
  const parts: string[] = [];
  let remaining = Math.round(seconds);
  const days = Math.floor(remaining / 86_400);
  if (days) {
    parts.push(`${days}d`);
    remaining %= 86_400;
  }
  const hours = Math.floor(remaining / 3600);
  if (hours) {
    parts.push(`${hours}h`);
    remaining %= 3600;
  }
  const minutes = Math.floor(remaining / 60);
  if (minutes) parts.push(`${minutes}m`);
  // Drop seconds from the rendered form once we're past 60s — the
  // truncation matches user expectation for status / SLA durations.
  return parts.join(" ") || `${seconds}s`;
}

function DurationForm(props: FieldKindFormProps): React.ReactElement {
  const { value, onChange, disabled, invalid } = props;
  const numeric = typeof value === "number" ? value : 0;
  const [draft, setDraft] = React.useState(numeric ? formatDuration(numeric) : "");
  const [error, setError] = React.useState<string | undefined>();
  React.useEffect(() => {
    setDraft(numeric ? formatDuration(numeric) : "");
  }, [numeric]);

  const commit = (s: string): void => {
    if (!s.trim()) {
      onChange(0);
      setError(undefined);
      return;
    }
    const parsed = parseDuration(s);
    if (parsed === null) {
      setError(`Couldn't parse "${s}"`);
      return;
    }
    setError(undefined);
    onChange(parsed);
  };

  return (
    <div className="space-y-1">
      <div
        className={cn(
          "rounded-md border bg-surface-0 inline-flex items-center gap-2 px-2 h-9 w-full",
          invalid || error ? "border-danger" : "border-border focus-within:border-accent focus-within:shadow-focus",
          disabled && "opacity-50 pointer-events-none",
        )}
      >
        <Clock className="h-3.5 w-3.5 text-text-muted shrink-0" aria-hidden />
        <input
          type="text"
          value={draft}
          placeholder="1h 30m"
          disabled={disabled}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => commit(draft)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit(draft);
            }
          }}
          className="flex-1 bg-transparent outline-none text-sm font-mono"
          aria-label={props.field.label ?? props.field.name}
        />
      </div>
      {error && <div className="text-[11px] text-danger">{error}</div>}
    </div>
  );
}

function DurationCell(props: FieldKindListCellProps): React.ReactElement {
  const v = props.value;
  if (typeof v !== "number" || v <= 0) return <span className="text-text-muted">—</span>;
  return <span className="font-mono text-xs tabular-nums">{formatDuration(v)}</span>;
}

function DurationDetail(props: FieldKindDetailProps): React.ReactElement {
  return <DurationCell field={props.field} value={props.value} record={props.record} />;
}

export const durationKind: FieldKindRenderer = {
  Form: DurationForm,
  ListCell: DurationCell,
  Detail: DurationDetail,
};
