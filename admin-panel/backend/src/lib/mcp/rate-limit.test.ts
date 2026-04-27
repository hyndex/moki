/** Rate-limit + circuit-breaker + budget tests. The agent state is
 *  in-memory; we reset between tests so each scenario starts clean. */

import { describe, test, expect, beforeEach } from "bun:test";
import { consume, recordFailure, recordSuccess, _resetRateLimitState_forTest } from "./rate-limit";
import type { Agent } from "./agents";

function fakeAgent(overrides: Partial<Agent> = {}): Agent {
  return {
    id: overrides.id ?? "agent-x",
    name: "Test",
    description: "",
    tenantId: "t",
    issuerUserId: "u",
    scopes: {},
    riskCeiling: "high-mutation",
    rateLimits: {},
    budget: {},
    status: "active",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("rate limiter", () => {
  beforeEach(() => _resetRateLimitState_forTest());

  test("first call passes", () => {
    expect(consume(fakeAgent(), "safe-read")).toBeNull();
  });

  test("zero-limit agent is rejected immediately", () => {
    const agent = fakeAgent({ rateLimits: { "low-mutation": 0 } });
    const r = consume(agent, "low-mutation");
    expect(r).not.toBeNull();
    expect(r!.error).toMatch(/zero/);
  });

  test("token bucket depletes after enough calls", () => {
    const agent = fakeAgent({ rateLimits: { "low-mutation": 3 } });
    expect(consume(agent, "low-mutation")).toBeNull();
    expect(consume(agent, "low-mutation")).toBeNull();
    expect(consume(agent, "low-mutation")).toBeNull();
    const r = consume(agent, "low-mutation");
    expect(r).not.toBeNull();
    expect(r!.error).toMatch(/rate-limit/);
  });
});

describe("circuit breaker", () => {
  beforeEach(() => _resetRateLimitState_forTest());

  test("5 mutation failures inside window opens the circuit", () => {
    const agent = fakeAgent();
    for (let i = 0; i < 5; i++) recordFailure(agent, "low-mutation");
    const r = consume(agent, "low-mutation");
    expect(r).not.toBeNull();
    expect(r!.error).toMatch(/circuit open/);
  });

  test("read calls are unaffected by circuit", () => {
    const agent = fakeAgent();
    for (let i = 0; i < 5; i++) recordFailure(agent, "low-mutation");
    expect(consume(agent, "safe-read")).toBeNull();
  });

  test("success resets failure count", () => {
    const agent = fakeAgent();
    recordFailure(agent, "low-mutation");
    recordFailure(agent, "low-mutation");
    recordSuccess(agent, "low-mutation");
    // 4 more shouldn't trip — count was reset
    for (let i = 0; i < 4; i++) recordFailure(agent, "low-mutation");
    expect(consume(agent, "low-mutation")).toBeNull();
  });
});

describe("daily budget", () => {
  beforeEach(() => _resetRateLimitState_forTest());

  test("dailyWriteCap caps mutation calls per UTC day", () => {
    const agent = fakeAgent({ budget: { dailyWriteCap: 2 } });
    expect(consume(agent, "low-mutation")).toBeNull();
    expect(consume(agent, "low-mutation")).toBeNull();
    const r = consume(agent, "low-mutation");
    expect(r).not.toBeNull();
    expect(r!.error).toMatch(/budget/);
  });

  test("budget cap doesn't apply to safe-read", () => {
    const agent = fakeAgent({ budget: { dailyWriteCap: 0 } });
    expect(consume(agent, "safe-read")).toBeNull();
    expect(consume(agent, "safe-read")).toBeNull();
    expect(consume(agent, "safe-read")).toBeNull();
  });
});

describe("limit clamping", () => {
  beforeEach(() => _resetRateLimitState_forTest());

  test("agent's configured limit can only LOWER the global default", () => {
    // Default for safe-read is 600/min. Configured 5 — only 5 should pass.
    const agent = fakeAgent({ rateLimits: { "safe-read": 5 } });
    for (let i = 0; i < 5; i++) expect(consume(agent, "safe-read")).toBeNull();
    expect(consume(agent, "safe-read")).not.toBeNull();
  });
});
