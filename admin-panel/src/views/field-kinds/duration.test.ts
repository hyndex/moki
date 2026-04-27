/** Pure tests for the duration parser/formatter. These functions sit
 *  inside the form input — a regression silently breaks every field
 *  that stores SLA windows / timeouts / human-friendly durations. */

import { describe, test, expect } from "bun:test";
import { parseDuration, formatDuration } from "./duration";

describe("parseDuration", () => {
  test("plain integer = seconds", () => {
    expect(parseDuration("0")).toBe(0);
    expect(parseDuration("90")).toBe(90);
  });
  test("single units", () => {
    expect(parseDuration("30s")).toBe(30);
    expect(parseDuration("5m")).toBe(300);
    expect(parseDuration("2h")).toBe(7_200);
    expect(parseDuration("1d")).toBe(86_400);
    expect(parseDuration("1w")).toBe(604_800);
  });
  test("compound shorthand", () => {
    expect(parseDuration("1h 30m")).toBe(5_400);
    expect(parseDuration("2d 4h 15m")).toBe(2 * 86_400 + 4 * 3600 + 15 * 60);
    expect(parseDuration("90s 1m")).toBe(150);
  });
  test("case + plural insensitive", () => {
    expect(parseDuration("2HRS")).toBe(7_200);
    expect(parseDuration("3 days")).toBe(3 * 86_400);
    expect(parseDuration("45 mins")).toBe(45 * 60);
  });
  test("bad input → null", () => {
    expect(parseDuration("abc")).toBeNull();
    expect(parseDuration("")).toBeNull();
    expect(parseDuration("xyz123")).toBeNull();
  });
});

describe("formatDuration", () => {
  test("seconds branch (< 60)", () => {
    expect(formatDuration(0)).toBe("0s");
    expect(formatDuration(45)).toBe("45s");
  });
  test("minutes only", () => {
    expect(formatDuration(60)).toBe("1m");
    expect(formatDuration(120)).toBe("2m");
  });
  test("hours + minutes", () => {
    expect(formatDuration(5_400)).toBe("1h 30m");
    expect(formatDuration(3_600)).toBe("1h");
  });
  test("days + hours + minutes", () => {
    expect(formatDuration(2 * 86_400 + 4 * 3600 + 15 * 60)).toBe("2d 4h 15m");
  });
  test("rounds + handles bad input", () => {
    expect(formatDuration(-1)).toBe("—");
    expect(formatDuration(NaN)).toBe("—");
  });
});

describe("roundtrip", () => {
  test("formatted shorthand parses back to the same number (minute-aligned values)", () => {
    // The formatter intentionally drops sub-minute residue once the
    // value is past 60s — SLA / status durations don't need it.
    // Round-trip accuracy is therefore guaranteed only for values
    // that are multiples of 60.
    for (const seconds of [60, 300, 3_600, 5_400, 7_200, 90_000, 199_980]) {
      const formatted = formatDuration(seconds);
      const parsed = parseDuration(formatted);
      expect(parsed).toBe(seconds);
    }
  });
});
