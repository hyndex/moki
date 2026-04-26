/** Pure-function tests for the KPI spec hook helpers. The fetch path
 *  is exercised by the integration tests (browser-verified) — here we
 *  cover only the JS-only branches: `ApiError` discrimination. */

import { describe, test, expect } from "bun:test";
import { isKpiEndpointMissing } from "../hooks/useKpiSpec";
import { ApiError } from "@/runtime/auth";

describe("isKpiEndpointMissing", () => {
  test("returns true for ApiError(404)", () => {
    expect(isKpiEndpointMissing(new ApiError(404, null, "not found"))).toBe(true);
  });

  test("returns false for ApiError with non-404 status", () => {
    expect(isKpiEndpointMissing(new ApiError(500, null, "server error"))).toBe(false);
    expect(isKpiEndpointMissing(new ApiError(401, null, "unauthorized"))).toBe(false);
  });

  test("returns false for non-ApiError values", () => {
    expect(isKpiEndpointMissing(new Error("network"))).toBe(false);
    expect(isKpiEndpointMissing(null)).toBe(false);
    expect(isKpiEndpointMissing(undefined)).toBe(false);
    expect(isKpiEndpointMissing("not an error")).toBe(false);
    expect(isKpiEndpointMissing({ status: 404 })).toBe(false);
  });
});
