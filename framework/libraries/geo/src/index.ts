export const packageId = "geo" as const;
export const packageDisplayName = "Geo" as const;
export const packageDescription = "Geo abstraction and provider contracts." as const;

export type Coordinates = {
  lat: number;
  lon: number;
};

export type BoundingBox = {
  north: number;
  south: number;
  east: number;
  west: number;
};

export type GeocodeRequest = {
  query: string;
  locale?: string | undefined;
  country?: string | undefined;
};

export type ReverseGeocodeRequest = {
  coordinates: Coordinates;
  locale?: string | undefined;
};

export type GeocodeResult = {
  label: string;
  coordinates: Coordinates;
  countryCode?: string | undefined;
  postalCode?: string | undefined;
  components?: Record<string, string> | undefined;
};

export type GeoProvider = {
  id: string;
  geocode(request: GeocodeRequest): Promise<GeocodeResult[]> | GeocodeResult[];
  reverseGeocode(request: ReverseGeocodeRequest): Promise<GeocodeResult | null> | GeocodeResult | null;
};

export function defineGeoProvider(provider: GeoProvider): GeoProvider {
  return Object.freeze(provider);
}

export function haversineDistanceKm(start: Coordinates, end: Coordinates): number {
  assertCoordinates(start);
  assertCoordinates(end);
  const earthRadiusKm = 6371;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const deltaLat = toRadians(end.lat - start.lat);
  const deltaLon = toRadians(end.lon - start.lon);
  const startLat = toRadians(start.lat);
  const endLat = toRadians(end.lat);

  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.sin(deltaLon / 2) ** 2 * Math.cos(startLat) * Math.cos(endLat);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusKm * c;
}

export function calculateBoundingBox(center: Coordinates, radiusKm: number): BoundingBox {
  assertCoordinates(center);
  const latDegrees = radiusKm / 110.574;
  const lonDegrees = radiusKm / (111.32 * Math.cos((center.lat * Math.PI) / 180));
  return {
    north: center.lat + latDegrees,
    south: center.lat - latDegrees,
    east: center.lon + lonDegrees,
    west: center.lon - lonDegrees
  };
}

export async function geocode(provider: GeoProvider, request: GeocodeRequest): Promise<GeocodeResult[]> {
  return provider.geocode(request);
}

export async function reverseGeocode(provider: GeoProvider, request: ReverseGeocodeRequest): Promise<GeocodeResult | null> {
  return provider.reverseGeocode(request);
}

export function normalizeGeocodeComponents(components: Record<string, string> = {}): Record<string, string> {
  return Object.fromEntries(
    Object.entries(components)
      .filter(([, value]) => value !== "")
      .sort(([left], [right]) => left.localeCompare(right))
  );
}

function assertCoordinates(point: Coordinates): void {
  if (point.lat < -90 || point.lat > 90 || point.lon < -180 || point.lon > 180) {
    throw new Error("coordinates are outside valid ranges");
  }
}
