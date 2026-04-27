/** Idempotency-key + arg-hash tests. The store sits in SQLite; we
 *  let the migrations on import set up the table. */

import { describe, test, expect, beforeAll } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

let lookup: typeof import("./idempotency").lookup;
let store: typeof import("./idempotency").store;
let hashArgs: typeof import("./idempotency").hashArgs;
let purgeExpired: typeof import("./idempotency").purgeExpired;

beforeAll(async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), "gutu-mcp-idem-test-"));
  process.env.DB_PATH = path.join(dataDir, "test.db");
  process.env.NODE_ENV = "test";
  await import("../../db");
  const tenancyMig = await import("../../tenancy/migrations");
  await tenancyMig.migrateGlobal();
  const mod = await import("./idempotency");
  lookup = mod.lookup;
  store = mod.store;
  hashArgs = mod.hashArgs;
  purgeExpired = mod.purgeExpired;
});

describe("hashArgs", () => {
  test("stable across key order", () => {
    expect(hashArgs({ a: 1, b: 2 })).toBe(hashArgs({ b: 2, a: 1 }));
  });
  test("distinguishes different values", () => {
    expect(hashArgs({ a: 1 })).not.toBe(hashArgs({ a: 2 }));
  });
  test("handles nested objects", () => {
    const h1 = hashArgs({ a: { x: 1 } });
    const h2 = hashArgs({ a: { x: 2 } });
    expect(h1).not.toBe(h2);
  });
});

describe("idempotency store", () => {
  test("missing key returns null", () => {
    expect(lookup("agent-1", "no-such-key")).toBeNull();
  });

  test("store + lookup roundtrip", () => {
    store({
      agentId: "agent-1",
      key: "key-1",
      toolName: "crm.contact.create",
      argumentsHash: "abc",
      result: { hello: "world" },
      ok: true,
    });
    const r = lookup("agent-1", "key-1");
    expect(r).not.toBeNull();
    expect(r!.ok).toBe(true);
    expect(r!.toolName).toBe("crm.contact.create");
    expect(r!.argumentsHash).toBe("abc");
    expect(r!.result).toEqual({ hello: "world" });
  });

  test("each agent has its own keyspace", () => {
    store({
      agentId: "agent-2",
      key: "shared-key",
      toolName: "tool.a",
      argumentsHash: "h1",
      result: { v: 1 },
      ok: true,
    });
    store({
      agentId: "agent-3",
      key: "shared-key",
      toolName: "tool.b",
      argumentsHash: "h2",
      result: { v: 2 },
      ok: true,
    });
    expect(lookup("agent-2", "shared-key")!.toolName).toBe("tool.a");
    expect(lookup("agent-3", "shared-key")!.toolName).toBe("tool.b");
  });

  test("empty key is a no-op", () => {
    store({ agentId: "agent-1", key: "", toolName: "x", argumentsHash: "h", result: 1, ok: true });
    expect(lookup("agent-1", "")).toBeNull();
  });

  test("purgeExpired is callable + non-throwing", () => {
    expect(typeof purgeExpired()).toBe("number");
  });
});
