/** Reference Field Service Map / Geo archetype. */

import * as React from "react";
import { Plus, MapPin, Truck, AlertTriangle } from "lucide-react";
import { Button } from "@/primitives/Button";
import { defineCustomView } from "@/builders";
import {
  MapGeo,
  WidgetShell,
  RailNextActions,
  RailRiskFlags,
  CommandHints,
  useArchetypeKeyboard,
  useUrlState,
  type LoadState,
} from "@/admin-archetypes";
import { useAllRecords } from "@/runtime/hooks";
import { cn } from "@/lib/cn";

interface Job {
  id: string;
  customer: string;
  status: "scheduled" | "in_progress" | "stalled" | "completed";
  tech: string;
  /** Synthetic 0..100 grid coordinates so we can render an SVG dispatch map
   *  without depending on any tile/library code in this reference page. */
  x: number;
  y: number;
  eta: string;
}

const JOBS: Job[] = [
  { id: "J-001", customer: "Acme Corp", status: "in_progress", tech: "Anika", x: 22, y: 38, eta: "11:30" },
  { id: "J-002", customer: "Globex", status: "scheduled", tech: "Bjorn", x: 60, y: 18, eta: "13:00" },
  { id: "J-003", customer: "Initech", status: "stalled", tech: "Cara", x: 78, y: 60, eta: "—" },
  { id: "J-004", customer: "Soylent", status: "scheduled", tech: "Anika", x: 30, y: 70, eta: "14:30" },
  { id: "J-005", customer: "Hooli", status: "completed", tech: "Bjorn", x: 50, y: 50, eta: "done" },
  { id: "J-006", customer: "Pied Piper", status: "in_progress", tech: "Cara", x: 14, y: 80, eta: "12:15" },
  { id: "J-007", customer: "Massive", status: "scheduled", tech: "Devon", x: 68, y: 80, eta: "15:00" },
];

const STATUS_FILL: Record<Job["status"], string> = {
  scheduled: "fill-info",
  in_progress: "fill-warning",
  stalled: "fill-danger",
  completed: "fill-success",
};

async function fetchJobs(): Promise<Job[]> {
  try {
    const res = await fetch("/api/field-service/jobs/today");
    if (res.ok) return (await res.json()) as Job[];
  } catch {/* fall through */}
  return JOBS;
}

interface JobRow {
  id: string;
  customer?: string;
  status?: "scheduled" | "in_progress" | "stalled" | "completed" | string;
  technician?: string;
  technicianName?: string;
  /** Optional pre-resolved canvas coords. Otherwise we hash the id. */
  x?: number;
  y?: number;
  eta?: string;
  scheduledStart?: string;
}

function hashCoord(id: string, axis: "x" | "y"): number {
  let h = axis === "x" ? 17 : 31;
  for (let i = 0; i < id.length; i++) h = (h * 33 + id.charCodeAt(i)) | 0;
  return ((Math.abs(h) % 80) + 8); // 8..88 inside the 100x100 canvas
}

export function FieldServiceArchetypeMap() {
  const [params, setParams] = useUrlState(["sel"] as const);
  const selectedId = params.sel;
  // Real backend read.
  const live = useAllRecords<JobRow>("field-service.job");
  const jobs = React.useMemo<Job[]>(() => {
    if (live.data.length === 0) return JOBS;
    return live.data.map<Job>((j) => {
      const status = (
        j.status === "scheduled" ||
        j.status === "in_progress" ||
        j.status === "stalled" ||
        j.status === "completed"
          ? j.status
          : "scheduled"
      );
      return {
        id: j.id,
        customer: j.customer ?? "—",
        status,
        tech: j.technicianName ?? j.technician ?? "—",
        x: j.x ?? hashCoord(j.id, "x"),
        y: j.y ?? hashCoord(j.id, "y"),
        eta: j.eta ?? (j.scheduledStart ? new Date(j.scheduledStart).toISOString().slice(11, 16) : "—"),
      };
    });
  }, [live.data]);
  const dataState: LoadState = live.error
    ? { status: "error", error: live.error }
    : live.loading && live.data.length === 0
      ? { status: "loading" }
      : { status: "ready" };
  const data = { state: dataState, refetch: live.refetch };

  useArchetypeKeyboard([
    { label: "Refresh", combo: "r", run: () => data.refetch() },
    {
      label: "Clear selection",
      combo: "esc",
      run: () => {
        if (params.sel) setParams({ sel: null });
      },
    },
  ]);

  const selected = jobs.find((j) => j.id === selectedId) ?? null;
  const counts = {
    in_progress: jobs.filter((j) => j.status === "in_progress").length,
    scheduled: jobs.filter((j) => j.status === "scheduled").length,
    stalled: jobs.filter((j) => j.status === "stalled").length,
    completed: jobs.filter((j) => j.status === "completed").length,
  };

  return (
    <MapGeo
      id="field-service.dispatch-map"
      title="Dispatch map"
      subtitle="Live tech and job positions"
      actions={
        <Button size="sm">
          <Plus className="h-4 w-4 mr-1" aria-hidden /> New job
        </Button>
      }
      toolbarStart={
        <div className="flex items-center gap-3 text-xs">
          <Legend dot="bg-info" label={`Scheduled · ${counts.scheduled}`} />
          <Legend dot="bg-warning" label={`Active · ${counts.in_progress}`} />
          <Legend dot="bg-danger" label={`Stalled · ${counts.stalled}`} />
          <Legend dot="bg-success" label={`Done · ${counts.completed}`} />
        </div>
      }
      toolbarEnd={
        <CommandHints hints={[
          { keys: "R", label: "Refresh" },
          { keys: "Esc", label: "Clear" },
        ]} />
      }
      rail={
        <>
          {selected ? (
            <div className="rounded-lg border border-border bg-surface-0 p-3 flex flex-col gap-2">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                Selected
              </div>
              <div className="text-sm font-semibold text-text-primary">{selected.id}</div>
              <div className="text-xs text-text-muted">{selected.customer}</div>
              <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs pt-1 border-t border-border-subtle">
                <Term label="Tech" value={selected.tech} />
                <Term label="ETA" value={selected.eta} />
                <Term label="Status" value={selected.status} />
              </dl>
              <a
                href={`#/field-service/jobs/${encodeURIComponent(selected.id)}`}
                className="text-xs font-medium text-info hover:underline pt-1 border-t border-border-subtle"
              >
                Open job detail →
              </a>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border bg-surface-0/40 p-3 text-xs text-text-muted text-center">
              Select a job marker to see details.
            </div>
          )}
          <RailNextActions actions={[
            { id: "reroute", label: `Reroute Cara (J-003 stalled ${counts.stalled > 0 ? "·" : ""})`, source: "ai" },
            { id: "dispatch", label: "Dispatch backup tech to Initech", source: "rule" },
          ]} />
          <RailRiskFlags flags={[
            { id: "sla", label: "1 SLA breach risk in 2h", detail: "J-003 (Initech)", severity: "danger" },
          ]} />
        </>
      }
    >
      <WidgetShell label="Map" state={data.state} skeleton="chart" onRetry={data.refetch}>
        <div className="rounded-lg border border-border bg-surface-0 overflow-hidden">
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="xMidYMid meet"
            className="w-full h-[55vh] bg-surface-1"
            role="img"
            aria-label="Field service dispatch map"
          >
            {/* gridded background */}
            {Array.from({ length: 11 }).map((_, i) => (
              <line key={`v${i}`} x1={i * 10} y1={0} x2={i * 10} y2={100} className="stroke-border opacity-40" strokeWidth={0.1} />
            ))}
            {Array.from({ length: 11 }).map((_, i) => (
              <line key={`h${i}`} x1={0} y1={i * 10} x2={100} y2={i * 10} className="stroke-border opacity-40" strokeWidth={0.1} />
            ))}
            {/* job markers */}
            {jobs.map((j) => (
              <g key={j.id} role="button" aria-label={`${j.id} ${j.customer}`}
                onClick={() => setParams({ sel: j.id })}
                style={{ cursor: "pointer" }}
              >
                <circle
                  cx={j.x}
                  cy={j.y}
                  r={selectedId === j.id ? 3 : 2}
                  className={cn(STATUS_FILL[j.status], "transition-all")}
                  stroke="white"
                  strokeWidth={selectedId === j.id ? 0.6 : 0.4}
                />
                <text x={j.x + 3.5} y={j.y + 1} className="fill-text-primary text-[2.2px] font-medium">
                  {j.id}
                </text>
              </g>
            ))}
          </svg>
        </div>
      </WidgetShell>
    </MapGeo>
  );
}

function Legend({ dot, label }: { dot: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-text-muted">
      <span className={cn("h-2 w-2 rounded-full", dot)} aria-hidden />
      {label}
    </span>
  );
}

function Term({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-text-muted truncate uppercase tracking-wide text-[10px]">{label}</dt>
      <dd className="text-text-primary truncate">{value}</dd>
    </div>
  );
}

export const fieldServiceArchetypeMapView = defineCustomView({
  id: "field-service.archetype-map.view",
  title: "Dispatch map (archetype)",
  description: "Reference Map / Geo archetype.",
  resource: "field-service.job",
  archetype: "map",
  render: () => <FieldServiceArchetypeMap />,
});

export const fieldServiceArchetypeNav = [
  {
    id: "field-service.archetype-map",
    label: "Dispatch map (new)",
    icon: "MapPin",
    path: "/field-service/archetype-map",
    view: "field-service.archetype-map.view",
    section: "operations",
    order: 0.5,
  },
];

/* keep some imports usable */
export { MapPin, Truck, AlertTriangle };
