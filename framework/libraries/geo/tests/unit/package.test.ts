import { describe, expect, it } from "bun:test";

import {
  calculateBoundingBox,
  defineGeoProvider,
  geocode,
  haversineDistanceKm,
  normalizeGeocodeComponents,
  packageId,
  reverseGeocode
} from "../../src";

describe("geo", () => {
  it("exposes a stable package id", () => {
    expect(packageId).toBe("geo");
  });

  it("computes distances and bounding boxes", () => {
    expect(
      haversineDistanceKm(
        {
          lat: 40.7128,
          lon: -74.006
        },
        {
          lat: 34.0522,
          lon: -118.2437
        }
      )
    ).toBeGreaterThan(3000);

    expect(calculateBoundingBox({ lat: 40.7128, lon: -74.006 }, 5).north).toBeGreaterThan(40.7);
  });

  it("normalizes provider-neutral result components", () => {
    expect(
      normalizeGeocodeComponents({
        city: "New York",
        postalCode: "",
        country: "US"
      })
    ).toEqual({
      city: "New York",
      country: "US"
    });
  });

  it("runs geocode and reverse-geocode through provider adapters", async () => {
    const provider = defineGeoProvider({
      id: "test-provider",
      geocode: () => [
        {
          label: "New York, NY",
          coordinates: {
            lat: 40.7128,
            lon: -74.006
          }
        }
      ],
      reverseGeocode: () => ({
        label: "New York, NY",
        coordinates: {
          lat: 40.7128,
          lon: -74.006
        }
      })
    });

    expect((await geocode(provider, { query: "New York" }))[0]?.label).toBe("New York, NY");
    expect((await reverseGeocode(provider, { coordinates: { lat: 40.7128, lon: -74.006 } }))?.label).toBe("New York, NY");
  });
});
