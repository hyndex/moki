/** Reference Maintenance work-order schedule (Calendar archetype). */

import * as React from "react";
import { Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/primitives/Button";
import { defineCustomView } from "@/builders";
import {
  CalendarSchedule,
  WidgetShell,
  CommandHints,
  useArchetypeKeyboard,
  useUrlState,
  useSwr,
} from "@/admin-archetypes";
import { cn } from "@/lib/cn";

interface WorkOrder {
  id: string;
  asset: string;
  tech: string;
  /** ISO date (YYYY-MM-DD). */
  date: string;
  hour: number;
  durationHours: number;
  status: "scheduled" | "in_progress" | "done";
  priority: "low" | "med" | "high";
}

const TECHS = ["Anika", "Bjorn", "Cara", "Devon", "Elin"];

function generateOrders(weekStart: Date): WorkOrder[] {
  const out: WorkOrder[] = [];
  for (let day = 0; day < 5; day++) {
    for (let i = 0; i < 6 + (day % 3); i++) {
      const date = new Date(weekStart);
      date.setDate(date.getDate() + day);
      out.push({
        id: `wo-${day}-${i}`,
        asset: `ASSET-${100 + ((day * 7 + i) % 24)}`,
        tech: TECHS[(day + i) % TECHS.length],
        date: date.toISOString().slice(0, 10),
        hour: 8 + ((i * 2) % 8),
        durationHours: 1 + (i % 3),
        status: i % 5 === 0 ? "in_progress" : i % 7 === 0 ? "done" : "scheduled",
        priority: (["low", "med", "high"] as const)[i % 3],
      });
    }
  }
  return out;
}

function startOfWeek(d: Date) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1); // monday
  return new Date(date.setDate(diff));
}

const PRIORITY_BG: Record<WorkOrder["priority"], string> = {
  low: "bg-info-soft text-info-strong border-info/30",
  med: "bg-warning-soft text-warning-strong border-warning/30",
  high: "bg-danger-soft text-danger-strong border-danger/30",
};

const STATUS_OPACITY: Record<WorkOrder["status"], string> = {
  scheduled: "",
  in_progress: "ring-2 ring-warning/60",
  done: "opacity-50",
};

export function MaintenanceArchetypeCalendar() {
  const [params, setParams] = useUrlState(["start"] as const);
  const startStr = params.start ?? startOfWeek(new Date()).toISOString().slice(0, 10);
  const start = React.useMemo(() => new Date(startStr), [startStr]);

  const data = useSwr<WorkOrder[]>(
    `maintenance.calendar?start=${startStr}`,
    async () => generateOrders(start),
  );
  const orders = data.data ?? [];

  const days: Date[] = Array.from({ length: 5 }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return d;
  });

  const goWeek = (delta: number) => {
    const next = new Date(start);
    next.setDate(next.getDate() + delta * 7);
    setParams({ start: next.toISOString().slice(0, 10) });
  };

  useArchetypeKeyboard([
    { label: "Prev week", combo: "left", run: () => goWeek(-1) },
    { label: "Next week", combo: "right", run: () => goWeek(1) },
    { label: "Today", combo: "t", run: () => setParams({ start: startOfWeek(new Date()).toISOString().slice(0, 10) }) },
  ]);

  const techCapacity = TECHS.map((tech) => {
    const tot = orders.filter((o) => o.tech === tech).reduce((s, o) => s + o.durationHours, 0);
    const cap = 5 * 8;
    return { tech, used: tot, cap, pct: Math.min(100, Math.round((tot / cap) * 100)) };
  });

  return (
    <CalendarSchedule
      id="maintenance.work-orders"
      title="Work-order schedule"
      subtitle={`${start.toDateString()} — ${days[4].toDateString()}`}
      actions={
        <>
          <Button variant="outline" size="sm" onClick={() => goWeek(-1)} aria-label="Previous week">
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setParams({ start: startOfWeek(new Date()).toISOString().slice(0, 10) })}>
            Today
          </Button>
          <Button variant="outline" size="sm" onClick={() => goWeek(1)} aria-label="Next week">
            <ChevronRight className="h-4 w-4" aria-hidden />
          </Button>
          <Button size="sm">
            <Plus className="h-4 w-4 mr-1" aria-hidden /> New WO
          </Button>
        </>
      }
      toolbarEnd={
        <CommandHints hints={[
          { keys: "←/→", label: "Week" },
          { keys: "T", label: "Today" },
        ]} />
      }
      rail={
        <div className="rounded-lg border border-border bg-surface-0 p-3 flex flex-col gap-2">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
            Tech capacity (this week)
          </div>
          {techCapacity.map((c) => (
            <div key={c.tech}>
              <div className="flex items-center justify-between text-xs">
                <span className="text-text-primary">{c.tech}</span>
                <span className="tabular-nums text-text-muted">{c.used}h / {c.cap}h</span>
              </div>
              <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden mt-1">
                <div
                  className={cn(
                    "h-full",
                    c.pct >= 95 ? "bg-danger" : c.pct >= 80 ? "bg-warning" : "bg-success",
                  )}
                  style={{ width: `${c.pct}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      }
    >
      <WidgetShell label="Calendar" state={data.state} skeleton="chart" onRetry={data.refetch}>
        <div className="rounded-lg border border-border overflow-hidden bg-surface-0">
          <div className="grid grid-cols-[120px_repeat(5,minmax(0,1fr))] text-xs">
            <div className="px-2 py-2 bg-surface-1 font-medium text-text-muted uppercase tracking-wide">Tech</div>
            {days.map((d) => (
              <div key={d.toISOString()} className="px-2 py-2 bg-surface-1 font-medium text-text-muted uppercase tracking-wide border-l border-border">
                {d.toLocaleDateString(undefined, { weekday: "short", day: "2-digit" })}
              </div>
            ))}
            {TECHS.map((tech) => (
              <React.Fragment key={tech}>
                <div className="px-2 py-3 border-t border-border-subtle text-text-primary font-medium">{tech}</div>
                {days.map((d) => {
                  const isoDate = d.toISOString().slice(0, 10);
                  const dayOrders = orders.filter((o) => o.tech === tech && o.date === isoDate);
                  return (
                    <div key={isoDate + tech} className="px-1.5 py-1.5 border-t border-l border-border-subtle min-h-[60px]">
                      <div className="space-y-1">
                        {dayOrders.map((o) => (
                          <div
                            key={o.id}
                            className={cn(
                              "rounded px-1.5 py-0.5 border text-[11px] leading-tight",
                              PRIORITY_BG[o.priority],
                              STATUS_OPACITY[o.status],
                            )}
                            title={`${o.asset} · ${o.hour}:00 (${o.durationHours}h) · ${o.status}`}
                          >
                            <span className="font-medium">{o.hour}:00</span> {o.asset}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        </div>
      </WidgetShell>
    </CalendarSchedule>
  );
}

export const maintenanceArchetypeCalendarView = defineCustomView({
  id: "maintenance.archetype-calendar.view",
  title: "Schedule (archetype)",
  description: "Reference Calendar / Schedule archetype.",
  resource: "maintenance.work-order",
  archetype: "calendar",
  render: () => <MaintenanceArchetypeCalendar />,
});

export const maintenanceArchetypeNav = [
  {
    id: "maintenance.archetype-calendar",
    label: "Schedule (new)",
    icon: "Calendar",
    path: "/maintenance/archetype-calendar",
    view: "maintenance.archetype-calendar.view",
    section: "operations",
    order: 0.5,
  },
];
