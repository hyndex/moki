/** Reference Field Service Map / Geo archetype.
 *
 *  Real Leaflet map (replaces the previous SVG fake-map). Job records
 *  with `{ lat, lng }` coordinates render as colored markers on an
 *  OpenStreetMap base layer. Records that have no real coords fall
 *  back to a deterministic hash → lat/lng mapping inside a small
 *  bounding box so the demo dataset still has something to render. */

import * as React from "react";
import "leaflet/dist/leaflet.css";
import { Plus } from "lucide-react";
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
  /** Real-world coordinates. The fake-coord fallback uses a SF-area
   *  bounding box so the demo dataset paints inside a recognisable
   *  city. */
  lat: number;
  lng: number;
  eta: string;
}

/** Demo lat/lng around San Francisco — fallback when the resource is
 *  empty so the page renders something on first paint. */
const JOBS: Job[] = [
  { id: "J-001", customer: "Acme Corp", status: "in_progress", tech: "Anika", lat: 37.7849, lng: -122.4094, eta: "11:30" },
  { id: "J-002", customer: "Globex", status: "scheduled", tech: "Bjorn", lat: 37.7649, lng: -122.4294, eta: "13:00" },
  { id: "J-003", customer: "Initech", status: "stalled", tech: "Cara", lat: 37.7549, lng: -122.4194, eta: "—" },
  { id: "J-004", customer: "Soylent", status: "scheduled", tech: "Anika", lat: 37.7949, lng: -122.4194, eta: "14:30" },
  { id: "J-005", customer: "Hooli", status: "completed", tech: "Bjorn", lat: 37.7749, lng: -122.4194, eta: "done" },
  { id: "J-006", customer: "Pied Piper", status: "in_progress", tech: "Cara", lat: 37.7849, lng: -122.4394, eta: "12:15" },
  { id: "J-007", customer: "Massive", status: "scheduled", tech: "Devon", lat: 37.7649, lng: -122.4094, eta: "15:00" },
];

const STATUS_COLOR: Record<Job["status"], string> = {
  scheduled: "#3b82f6",
  in_progress: "#f59e0b",
  stalled: "#ef4444",
  completed: "#10b981",
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
  /** Either an explicit lat/lng pair on the record, or a `location`
   *  geo.point GeoJSON-ish object — both are supported. */
  lat?: number;
  lng?: number;
  location?: { lat?: number; lng?: number };
  eta?: string;
  scheduledStart?: string;
}

/** Deterministic fallback coords inside an SF-area bounding box for
 *  records that don't carry real lat/lng yet. The hash keeps a job in
 *  the same spot across renders so users don't see jitter. */
const SF_BOX = { minLat: 37.74, maxLat: 37.81, minLng: -122.46, maxLng: -122.38 };
function hashLatLng(id: string): { lat: number; lng: number } {
  let h1 = 17, h2 = 31;
  for (let i = 0; i < id.length; i++) {
    h1 = (h1 * 33 + id.charCodeAt(i)) | 0;
    h2 = (h2 * 31 + id.charCodeAt(i)) | 0;
  }
  const t1 = (Math.abs(h1) % 1000) / 1000;
  const t2 = (Math.abs(h2) % 1000) / 1000;
  return {
    lat: SF_BOX.minLat + (SF_BOX.maxLat - SF_BOX.minLat) * t1,
    lng: SF_BOX.minLng + (SF_BOX.maxLng - SF_BOX.minLng) * t2,
  };
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
      const explicit = typeof j.lat === "number" && typeof j.lng === "number"
        ? { lat: j.lat, lng: j.lng }
        : typeof j.location?.lat === "number" && typeof j.location?.lng === "number"
          ? { lat: j.location.lat, lng: j.location.lng }
          : null;
      const coords = explicit ?? hashLatLng(j.id);
      return {
        id: j.id,
        customer: j.customer ?? "—",
        status,
        tech: j.technicianName ?? j.technician ?? "—",
        lat: coords.lat,
        lng: coords.lng,
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
        <Button size="sm" onClick={() => { window.location.hash = "#/field-service/jobs/new"; }}>
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
                className="inline-flex items-center gap-1 text-xs font-medium text-info hover:text-info-strong transition-colors group pt-1 border-t border-border-subtle"
              >
                Open job detail
                <span aria-hidden className="transition-transform duration-fast group-hover:translate-x-0.5">→</span>
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
        <DispatchLeafletMap
          jobs={jobs}
          selectedId={selectedId}
          onSelect={(id) => setParams({ sel: id })}
        />
      </WidgetShell>
    </MapGeo>
  );
}

/** Real Leaflet dispatch map. Replaces the previous SVG fake-map.
 *  Builds an OSM tile layer + circleMarkers for each job, colored by
 *  status. Selection draws a ring highlight + pans the map to centre
 *  the chosen marker. */
function DispatchLeafletMap({
  jobs,
  selectedId,
  onSelect,
}: {
  jobs: readonly Job[];
  selectedId: string | undefined;
  onSelect: (id: string) => void;
}): React.ReactElement {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const mapRef = React.useRef<import("leaflet").Map | null>(null);
  const markersRef = React.useRef<Map<string, import("leaflet").CircleMarker>>(new Map());
  const [L, setL] = React.useState<typeof import("leaflet") | null>(null);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    let alive = true;
    void import("leaflet").then((m) => {
      if (alive) setL(m);
    });
    return () => {
      alive = false;
    };
  }, []);

  // One-time map init.
  React.useEffect(() => {
    if (!L || !containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current).setView([37.7749, -122.4194], 12);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);
    mapRef.current = map;
    setTimeout(() => map.invalidateSize(), 0);
    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current.clear();
    };
  }, [L]);

  // Sync markers with jobs.
  React.useEffect(() => {
    const map = mapRef.current;
    if (!L || !map) return;
    // Remove markers that are no longer in the jobs list.
    for (const [id, marker] of markersRef.current) {
      if (!jobs.find((j) => j.id === id)) {
        map.removeLayer(marker);
        markersRef.current.delete(id);
      }
    }
    // Add / update markers.
    for (const j of jobs) {
      const existing = markersRef.current.get(j.id);
      const isSelected = j.id === selectedId;
      const color = STATUS_COLOR[j.status];
      if (existing) {
        existing.setLatLng([j.lat, j.lng]);
        existing.setStyle({
          color: isSelected ? "#000" : color,
          weight: isSelected ? 3 : 1,
          fillColor: color,
          fillOpacity: 0.85,
          radius: isSelected ? 10 : 7,
        });
      } else {
        const marker = L.circleMarker([j.lat, j.lng], {
          color: isSelected ? "#000" : color,
          weight: isSelected ? 3 : 1,
          fillColor: color,
          fillOpacity: 0.85,
          radius: isSelected ? 10 : 7,
        }).addTo(map);
        marker.bindTooltip(`${j.id} · ${j.customer}`, { direction: "top", offset: [0, -8] });
        marker.on("click", () => onSelect(j.id));
        markersRef.current.set(j.id, marker);
      }
    }
    // Auto-fit when the marker count changes (first paint, page navigated).
    if (jobs.length > 0 && markersRef.current.size > 0) {
      const points = jobs.map((j) => [j.lat, j.lng] as [number, number]);
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14, animate: false });
    }
  }, [L, jobs, selectedId, onSelect]);

  // Pan to selected marker on selection change.
  React.useEffect(() => {
    if (!selectedId) return;
    const map = mapRef.current;
    if (!map) return;
    const marker = markersRef.current.get(selectedId);
    if (marker) map.panTo(marker.getLatLng());
  }, [selectedId]);

  return (
    <div className="rounded-lg border border-border bg-surface-0 overflow-hidden">
      <div
        ref={containerRef}
        className="w-full h-[55vh]"
        role="application"
        aria-label="Field service dispatch map"
      />
    </div>
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

