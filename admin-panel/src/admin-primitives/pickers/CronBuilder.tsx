/** Cron expression builder — replaces the "type 5 stars and hope" input.
 *
 *  Two-tier UX:
 *
 *    1. **Presets**: every-minute, every-5-min, hourly, daily-9am,
 *       weekly-mon-9am, monthly-1st-9am. One click writes the matching
 *       expression. This handles 90% of admin needs.
 *
 *    2. **Advanced**: a raw expression input with a live human-readable
 *       summary and validation. The summary is intentionally
 *       conservative — we don't try to interpret every cron extension,
 *       we just confirm the structure looks valid. */

import * as React from "react";
import { Input } from "../../primitives/Input";
import { Button } from "../../primitives/Button";
import { Label } from "../../primitives/Label";

export interface CronBuilderProps {
  value: string;
  onChange: (next: string) => void;
  className?: string;
  id?: string;
}

interface Preset {
  expr: string;
  label: string;
  description: string;
}

const PRESETS: Preset[] = [
  { expr: "* * * * *", label: "Every minute", description: "Useful only for testing" },
  { expr: "*/5 * * * *", label: "Every 5 minutes", description: "Frequent polling" },
  { expr: "*/15 * * * *", label: "Every 15 minutes", description: "" },
  { expr: "0 * * * *", label: "Hourly", description: "Top of every hour" },
  { expr: "0 */4 * * *", label: "Every 4 hours", description: "" },
  { expr: "0 9 * * *", label: "Daily at 9 AM", description: "Server time zone" },
  { expr: "0 18 * * *", label: "Daily at 6 PM", description: "Server time zone" },
  { expr: "0 9 * * 1", label: "Mondays at 9 AM", description: "Weekly start-of-week" },
  { expr: "0 9 * * 1-5", label: "Weekdays at 9 AM", description: "Mon–Fri" },
  { expr: "0 9 1 * *", label: "1st of month at 9 AM", description: "Monthly billing-style" },
  { expr: "0 0 1 1 *", label: "Annually on Jan 1", description: "Yearly housekeeping" },
];

function describe(expr: string): { ok: boolean; summary: string } {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) {
    return { ok: false, summary: "Expected 5 fields: minute hour day month dayOfWeek" };
  }
  const [min, hour, dom, mon, dow] = parts as [string, string, string, string, string];
  const matched = PRESETS.find((p) => p.expr === expr.trim());
  if (matched) return { ok: true, summary: matched.label };
  // Light-touch summary — don't ship a full cron parser.
  const segments: string[] = [];
  segments.push(min === "*" ? "every minute" : min.startsWith("*/") ? `every ${min.slice(2)} min` : `at minute ${min}`);
  segments.push(hour === "*" ? "every hour" : hour.startsWith("*/") ? `every ${hour.slice(2)} h` : `hour ${hour}`);
  segments.push(dom === "*" ? "every day" : `day ${dom}`);
  segments.push(mon === "*" ? "every month" : `month ${mon}`);
  segments.push(dow === "*" ? "any weekday" : `weekday ${dow}`);
  return { ok: true, summary: segments.join(", ") };
}

export function CronBuilder({ value, onChange, className, id }: CronBuilderProps): React.ReactElement {
  const desc = describe(value || "* * * * *");
  return (
    <div className={["space-y-2", className].filter(Boolean).join(" ")}>
      <div className="flex items-center gap-2">
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="*/5 * * * *"
          className="font-mono text-xs h-8"
        />
        <span
          className={[
            "text-[11px] whitespace-nowrap",
            desc.ok ? "text-text-secondary" : "text-danger-strong",
          ].join(" ")}
          aria-live="polite"
        >
          {desc.ok ? `→ ${desc.summary}` : desc.summary}
        </span>
      </div>
      <div>
        <Label className="text-[11px] text-text-muted">Presets</Label>
        <div className="flex flex-wrap gap-1 mt-1">
          {PRESETS.map((p) => (
            <Button
              key={p.expr}
              type="button"
              size="sm"
              variant={value.trim() === p.expr ? "primary" : "outline"}
              onClick={() => onChange(p.expr)}
              title={p.description || p.label}
            >
              {p.label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
