/** Risk classification — pure logic, no DB. The wire contract for
 *  every tool flows through these helpers; a regression here lets
 *  the wrong agent invoke the wrong action. */

import { describe, test, expect } from "bun:test";
import { ceilingAllows, requiresDualKey, requiresIdempotency, RISK_RANK, VERB_RISK } from "./risk";

describe("ceilingAllows", () => {
  test("safe-read agents can only do safe-read", () => {
    expect(ceilingAllows("safe-read", "safe-read")).toBe(true);
    expect(ceilingAllows("safe-read", "low-mutation")).toBe(false);
    expect(ceilingAllows("safe-read", "high-mutation")).toBe(false);
    expect(ceilingAllows("safe-read", "irreversible")).toBe(false);
  });
  test("low-mutation ceiling allows safe-read + low-mutation only", () => {
    expect(ceilingAllows("low-mutation", "safe-read")).toBe(true);
    expect(ceilingAllows("low-mutation", "low-mutation")).toBe(true);
    expect(ceilingAllows("low-mutation", "high-mutation")).toBe(false);
    expect(ceilingAllows("low-mutation", "irreversible")).toBe(false);
  });
  test("high-mutation ceiling allows up to high-mutation; irreversible NEVER granted by ceiling alone", () => {
    expect(ceilingAllows("high-mutation", "high-mutation")).toBe(true);
    expect(ceilingAllows("high-mutation", "irreversible")).toBe(false);
  });
});

describe("requiresDualKey", () => {
  test("only irreversible needs dual-key", () => {
    expect(requiresDualKey("safe-read")).toBe(false);
    expect(requiresDualKey("low-mutation")).toBe(false);
    expect(requiresDualKey("high-mutation")).toBe(false);
    expect(requiresDualKey("irreversible")).toBe(true);
  });
});

describe("requiresIdempotency", () => {
  test("safe-read + low-mutation don't require keys; high-mutation + irreversible do", () => {
    expect(requiresIdempotency("safe-read")).toBe(false);
    expect(requiresIdempotency("low-mutation")).toBe(false);
    expect(requiresIdempotency("high-mutation")).toBe(true);
    expect(requiresIdempotency("irreversible")).toBe(true);
  });
});

describe("RISK_RANK", () => {
  test("strictly monotonic", () => {
    expect(RISK_RANK["safe-read"]).toBeLessThan(RISK_RANK["low-mutation"]);
    expect(RISK_RANK["low-mutation"]).toBeLessThan(RISK_RANK["high-mutation"]);
    expect(RISK_RANK["high-mutation"]).toBeLessThan(RISK_RANK["irreversible"]);
  });
});

describe("VERB_RISK", () => {
  test("read verbs are safe-read", () => {
    expect(VERB_RISK.list).toBe("safe-read");
    expect(VERB_RISK.get).toBe("safe-read");
    expect(VERB_RISK.search).toBe("safe-read");
    expect(VERB_RISK.count).toBe("safe-read");
  });
  test("hard delete + send + pay are irreversible", () => {
    expect(VERB_RISK.delete).toBe("irreversible");
    expect(VERB_RISK.destroy).toBe("irreversible");
    expect(VERB_RISK.send).toBe("irreversible");
    expect(VERB_RISK.pay).toBe("irreversible");
  });
  test("create + update + archive are low-mutation", () => {
    expect(VERB_RISK.create).toBe("low-mutation");
    expect(VERB_RISK.update).toBe("low-mutation");
    expect(VERB_RISK.archive).toBe("low-mutation");
  });
  test("upsert + bulk are high-mutation", () => {
    expect(VERB_RISK.upsert).toBe("high-mutation");
    expect(VERB_RISK.bulk_create).toBe("high-mutation");
    expect(VERB_RISK.bulk_update).toBe("high-mutation");
  });
});
