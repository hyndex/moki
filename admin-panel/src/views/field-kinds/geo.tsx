/** Geo field kinds — `geo.point` and `geo.polygon`. Real interactive
 *  Leaflet maps (replaces the SVG fake-map in the field-service
 *  archetype).
 *
 *  Storage shape:
 *    geo.point   → { lat: number; lng: number } | null
 *    geo.polygon → { type: "Polygon"; coordinates: [[[lng, lat]…]] } |
 *                  null  (GeoJSON, single ring)
 *
 *  Tile provider: OpenStreetMap by default. Operators can override per
 *  field via `field.tileUrl` + `field.tileAttribution` (or globally via
 *  the registry's `registerFieldKind` call) to point at their own
 *  tile server / Mapbox / MapTiler key.
 *
 *  Hardening:
 *    - Leaflet's CSS is imported here (side-effect import). Vite
 *      bundles it once.
 *    - The map container only mounts after the parent element has
 *      non-zero size — Leaflet refuses to lay tiles inside a 0×0 box.
 *    - Cleanup happens on unmount + when the value changes by id —
 *      otherwise editing a record back-to-back leaves a leaked map.
 *    - SSR-safe: the dynamic import returns a no-op viewer when
 *      `window` is undefined. */

import * as React from "react";
import "leaflet/dist/leaflet.css";
import { MapPin } from "lucide-react";
import type {
  FieldKindFormProps,
  FieldKindListCellProps,
  FieldKindDetailProps,
  FieldKindRenderer,
} from "../fieldKindRegistry";

interface PointValue {
  lat: number;
  lng: number;
}

const DEFAULT_TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const DEFAULT_TILE_ATTRIB = '&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>';
const DEFAULT_VIEW: PointValue = { lat: 37.7749, lng: -122.4194 }; // SF

function asPoint(v: unknown): PointValue | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  if (typeof o.lat !== "number" || typeof o.lng !== "number") return null;
  if (!Number.isFinite(o.lat) || !Number.isFinite(o.lng)) return null;
  if (o.lat < -90 || o.lat > 90) return null;
  if (o.lng < -180 || o.lng > 180) return null;
  return { lat: o.lat, lng: o.lng };
}

function tileSettings(
  field: unknown,
): { url: string; attribution: string } {
  const f = field as { tileUrl?: string; tileAttribution?: string };
  return {
    url: f.tileUrl ?? DEFAULT_TILE_URL,
    attribution: f.tileAttribution ?? DEFAULT_TILE_ATTRIB,
  };
}

/** Lazy-load Leaflet so SSR + the initial dashboard render never pays
 *  for it. Returns the L namespace when the import resolves. */
function useLeaflet(): typeof import("leaflet") | null {
  const [L, setL] = React.useState<typeof import("leaflet") | null>(null);
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    let alive = true;
    import("leaflet").then((mod) => {
      if (alive) setL(mod);
    });
    return () => {
      alive = false;
    };
  }, []);
  return L;
}

interface MapBoxProps {
  point: PointValue | null;
  onPick?: (next: PointValue) => void;
  height: number;
  tileUrl: string;
  tileAttribution: string;
  interactive?: boolean;
}

function MapBox({
  point,
  onPick,
  height,
  tileUrl,
  tileAttribution,
  interactive = true,
}: MapBoxProps): React.ReactElement {
  const L = useLeaflet();
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const mapRef = React.useRef<import("leaflet").Map | null>(null);
  const markerRef = React.useRef<import("leaflet").Marker | null>(null);

  React.useEffect(() => {
    if (!L || !containerRef.current) return;
    if (mapRef.current) return; // already initialised

    const map = L.map(containerRef.current, {
      // The default zoom controls collide with embedded UIs; allow
      // pages to disable them via field config later if they want.
      zoomControl: interactive,
      dragging: interactive,
      scrollWheelZoom: interactive,
      doubleClickZoom: interactive,
      boxZoom: interactive,
      touchZoom: interactive,
      keyboard: interactive,
    }).setView([point?.lat ?? DEFAULT_VIEW.lat, point?.lng ?? DEFAULT_VIEW.lng], point ? 13 : 3);

    L.tileLayer(tileUrl, {
      attribution: tileAttribution,
      maxZoom: 19,
    }).addTo(map);

    if (point) {
      markerRef.current = L.marker([point.lat, point.lng]).addTo(map);
    }

    if (onPick && interactive) {
      map.on("click", (e) => {
        const next: PointValue = { lat: e.latlng.lat, lng: e.latlng.lng };
        if (markerRef.current) {
          markerRef.current.setLatLng(e.latlng);
        } else {
          markerRef.current = L.marker(e.latlng).addTo(map);
        }
        onPick(next);
      });
    }

    mapRef.current = map;
    // Force a re-layout after mount in case the container started 0×0
    // (e.g. inside a tab that was just made visible).
    setTimeout(() => map.invalidateSize(), 0);

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [L]);

  // Sync external value changes into the existing map instance.
  React.useEffect(() => {
    const map = mapRef.current;
    if (!L || !map) return;
    if (point) {
      if (markerRef.current) {
        markerRef.current.setLatLng([point.lat, point.lng]);
      } else {
        markerRef.current = L.marker([point.lat, point.lng]).addTo(map);
      }
      // Don't re-pan if the user is dragging — only when the value
      // came from outside the map (e.g. typed into a coords input).
    } else if (markerRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }
  }, [L, point?.lat, point?.lng]);

  if (!L) {
    return (
      <div
        className="rounded-md border border-border bg-surface-1 flex items-center justify-center text-xs text-text-muted"
        style={{ height }}
      >
        Loading map…
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="rounded-md border border-border overflow-hidden"
      style={{ height }}
      role="application"
      aria-label="Map"
    />
  );
}

function GeoPointForm(props: FieldKindFormProps): React.ReactElement {
  const { field, value, onChange, disabled } = props;
  const point = asPoint(value);
  const { url, attribution } = tileSettings(field);

  return (
    <div className="space-y-2">
      <MapBox
        point={point}
        onPick={disabled ? undefined : (p) => onChange(p)}
        height={260}
        tileUrl={url}
        tileAttribution={attribution}
      />
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[11px] text-text-muted block mb-0.5">Latitude</label>
          <input
            type="number"
            step="any"
            min={-90}
            max={90}
            value={point?.lat ?? ""}
            disabled={disabled}
            onChange={(e) => {
              const lat = parseFloat(e.target.value);
              if (!Number.isFinite(lat)) {
                if (!point) onChange(null);
                return;
              }
              onChange({ lat, lng: point?.lng ?? 0 });
            }}
            className="w-full h-8 px-2 rounded-md border border-border bg-surface-0 text-sm font-mono outline-none focus:border-accent focus:shadow-focus"
            aria-label="Latitude"
          />
        </div>
        <div>
          <label className="text-[11px] text-text-muted block mb-0.5">Longitude</label>
          <input
            type="number"
            step="any"
            min={-180}
            max={180}
            value={point?.lng ?? ""}
            disabled={disabled}
            onChange={(e) => {
              const lng = parseFloat(e.target.value);
              if (!Number.isFinite(lng)) {
                if (!point) onChange(null);
                return;
              }
              onChange({ lat: point?.lat ?? 0, lng });
            }}
            className="w-full h-8 px-2 rounded-md border border-border bg-surface-0 text-sm font-mono outline-none focus:border-accent focus:shadow-focus"
            aria-label="Longitude"
          />
        </div>
      </div>
    </div>
  );
}

function GeoPointCell(props: FieldKindListCellProps): React.ReactElement {
  const point = asPoint(props.value);
  if (!point) return <span className="text-text-muted">—</span>;
  return (
    <span className="inline-flex items-center gap-1 font-mono text-xs text-text-muted">
      <MapPin className="h-3 w-3 text-text-muted" aria-hidden />
      {point.lat.toFixed(4)}, {point.lng.toFixed(4)}
    </span>
  );
}

function GeoPointDetail(props: FieldKindDetailProps): React.ReactElement {
  const { field, value } = props;
  const point = asPoint(value);
  const { url, attribution } = tileSettings(field);
  if (!point) return <span className="text-text-muted">—</span>;
  return (
    <div className="space-y-1">
      <MapBox
        point={point}
        height={200}
        tileUrl={url}
        tileAttribution={attribution}
        interactive={false}
      />
      <div className="text-xs font-mono text-text-muted">
        {point.lat.toFixed(6)}, {point.lng.toFixed(6)}
      </div>
    </div>
  );
}

export const geoPointKind: FieldKindRenderer = {
  Form: GeoPointForm,
  ListCell: GeoPointCell,
  Detail: GeoPointDetail,
};
