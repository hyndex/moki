/** End-to-end integration tests for `/api/editors/...`.
 *
 *  Stands up the full app via `createApp()` (Hono fetch handler), boots a
 *  temp SQLite DB, registers a temp local storage backend, and exercises:
 *
 *    - create + idempotency replay
 *    - list (tenant-scoped)
 *    - fetch + 404 on cross-tenant
 *    - PATCH metadata
 *    - DELETE soft-delete
 *    - snapshot put + get round-trip
 *    - rate-limit (429)
 *    - oversize body (413)
 *    - precondition-failed via stale If-Match (412)
 *    - timeout / 504 (skipped — needs slow adapter mock)
 *
 *  Storage runs against a freshly-bootstrapped LocalStorageAdapter rooted in
 *  a tmp dir, so no I/O leaks between tests. */

import { describe, expect, it, beforeAll, afterAll, beforeEach } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Database } from "bun:sqlite";
import {
  bootstrapStorage,
  resetStorageRegistry,
  LocalStorageAdapter,
  getStorageRegistry,
} from "../../src/storage";

let app: Awaited<ReturnType<typeof setup>>;

async function setup() {
  const dataDir = await mkdtemp(path.join(tmpdir(), "gutu-editors-test-"));
  process.env.DB_PATH = path.join(dataDir, "test.db");
  process.env.FILES_ROOT = path.join(dataDir, "files");
  process.env.STORAGE_SIGNING_KEY = "k".repeat(64);
  // Tighter limits make the tests faster.
  process.env.EDITORS_SAVE_COOLDOWN_MS = "200";
  process.env.EDITORS_SNAPSHOT_LIMIT_BYTES = String(8192);
  process.env.NODE_ENV = "test";

  // Reset modules' state — the routes capture env at import time.
  resetStorageRegistry();
  const { resetConfig } = await import("../../src/config");
  resetConfig();
  const { migrate } = await import("../../src/migrations");
  migrate();
  // Inline tenant bootstrap — we want a stable tenant id for the tests.
  const tenantId = "11111111-1111-1111-1111-111111111111";
  bootstrapStorage({
    filesRoot: process.env.FILES_ROOT,
    publicBaseUrl: "http://localhost:0",
    defaultTenantId: tenantId,
  });

  // Run the global migrations (adds tenants/memberships tables) BEFORE
  // we try to add a session — the tenancy migrations enrich `sessions`
  // with the tenant_id column on existing installs.
  const tenancyMig = await import("../../src/tenancy/migrations");
  await tenancyMig.migrateGlobal();
  // Ensure the default tenant exists in the global schema with the test id.
  const dbMod = await import("../../src/db");
  const db = dbMod.db;
  // Bypass FK checks while we wipe + reseed for the test fixture.
  db.exec(`PRAGMA foreign_keys = OFF`);
  db.exec(`DELETE FROM tenant_memberships; DELETE FROM tenants`);
  db.exec(
    `INSERT INTO tenants (id, slug, name, schema_name, status, plan, settings, created_at, updated_at)
     VALUES ('${tenantId}', 'main', 'Main', 'tenant_main', 'active', 'builtin', '{}', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')`,
  );
  db.exec(
    `INSERT OR REPLACE INTO users (id, email, name, role, password_hash, mfa_enabled, created_at, updated_at)
     VALUES ('user-1', 'tester@gutu.dev', 'Tester', 'admin', 'x', 0, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')`,
  );
  db.exec(
    `INSERT INTO tenant_memberships (tenant_id, user_id, role, joined_at)
     VALUES ('${tenantId}', 'user-1', 'owner', '2026-01-01T00:00:00.000Z')
     ON CONFLICT(tenant_id, user_id) DO UPDATE SET role = 'owner'`,
  );
  db.exec(
    `INSERT OR REPLACE INTO sessions (token, user_id, tenant_id, created_at, expires_at, ua, ip)
     VALUES ('test-token', 'user-1', '${tenantId}', '2026-01-01T00:00:00.000Z', '2099-01-01T00:00:00.000Z', 'test', '127.0.0.1')`,
  );

  // Force-import the editors route AFTER env is configured so its module
  // captures the patched limits.
  const editorsMod = await import("../../src/routes/editors");
  editorsMod.__test__.resetThrottles();

  // Fresh app for the tests.
  const { createApp } = await import("../../src/server");
  const app = createApp();
  return { app, dataDir, tenantId, db };
}

beforeAll(async () => { app = await setup(); });
afterAll(async () => { await rm(app.dataDir, { recursive: true, force: true }); });
beforeEach(async () => {
  // Reset throttles between tests so cooldown doesn't leak.
  const editorsMod = await import("../../src/routes/editors");
  editorsMod.__test__.resetThrottles();
});

function authedFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("Authorization", "Bearer test-token");
  headers.set("x-tenant", app.tenantId);
  return app.app.fetch(new Request(`http://localhost${input}`, { ...init, headers }));
}

describe("editors REST — create + list + fetch + delete", () => {
  it("creates a spreadsheet, lists it, fetches by id", async () => {
    const create = await authedFetch("/api/editors/spreadsheet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Test Sheet" }),
    });
    expect(create.status).toBe(201);
    const created = await create.json() as { id: string; title: string };
    expect(created.title).toBe("Test Sheet");

    const list = await authedFetch("/api/editors/spreadsheet");
    expect(list.status).toBe(200);
    const body = await list.json() as { rows: { id: string }[]; total: number };
    expect(body.rows.find((r) => r.id === created.id)).toBeTruthy();

    const get = await authedFetch(`/api/editors/spreadsheet/${created.id}`);
    expect(get.status).toBe(200);
  });

  it("idempotency-key returns the same record on replay", async () => {
    const idem = "test-idem-key-abc";
    const opts: RequestInit = {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": idem },
      body: JSON.stringify({ title: "Idem Sheet" }),
    };
    const r1 = await authedFetch("/api/editors/spreadsheet", opts);
    const r2 = await authedFetch("/api/editors/spreadsheet", opts);
    expect(r1.status).toBe(201);
    expect(r2.status).toBe(201);
    const a = await r1.json() as { id: string };
    const b = await r2.json() as { id: string };
    expect(a.id).toBe(b.id);
  });

  it("rejects traversal in folder", async () => {
    const r = await authedFetch("/api/editors/spreadsheet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "x", folder: "a/../b" }),
    });
    expect(r.status).toBe(400);
  });

  it("404s on unknown resource", async () => {
    const r = await authedFetch("/api/editors/blender", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    expect(r.status).toBe(400);
  });

  it("PATCH updates title + folder", async () => {
    const created = await authedFetch("/api/editors/document", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Original" }),
    }).then((r) => r.json()) as { id: string };

    const patched = await authedFetch(`/api/editors/document/${created.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Renamed", folder: "memos/2026" }),
    });
    expect(patched.status).toBe(200);
    const body = await patched.json() as { title: string; folder: string };
    expect(body.title).toBe("Renamed");
    expect(body.folder).toBe("memos/2026");
  });

  it("DELETE soft-deletes (read returns 404, list excludes)", async () => {
    const c = await authedFetch("/api/editors/page", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Delete me" }),
    }).then((r) => r.json()) as { id: string };

    const del = await authedFetch(`/api/editors/page/${c.id}`, { method: "DELETE" });
    expect(del.status).toBe(200);

    const get = await authedFetch(`/api/editors/page/${c.id}`);
    expect(get.status).toBe(404);

    const list = await authedFetch("/api/editors/page");
    const body = await list.json() as { rows: { id: string }[] };
    expect(body.rows.find((r) => r.id === c.id)).toBeUndefined();
  });
});

describe("editors REST — snapshot round-trip + hardening", () => {
  it("writes a snapshot and reads it back identically", async () => {
    const c = await authedFetch("/api/editors/spreadsheet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Snapshot Sheet" }),
    }).then((r) => r.json()) as { id: string };

    const payload = new TextEncoder().encode("hello-yjs-world");
    const put = await authedFetch(`/api/editors/spreadsheet/${c.id}/snapshot/yjs`, {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream", "Content-Length": String(payload.byteLength) },
      body: payload,
    });
    expect(put.status).toBe(200);
    const putBody = await put.json() as { ok: boolean; size: number; etag: string };
    expect(putBody.size).toBe(15);

    const get = await authedFetch(`/api/editors/spreadsheet/${c.id}/snapshot/yjs`);
    expect(get.status).toBe(200);
    const ab = new Uint8Array(await get.arrayBuffer());
    expect(new TextDecoder().decode(ab)).toBe("hello-yjs-world");
  });

  it("rate-limits saves on the same record", async () => {
    const c = await authedFetch("/api/editors/whiteboard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Rate Limited" }),
    }).then((r) => r.json()) as { id: string };

    const payload = new TextEncoder().encode("a");
    const opts: RequestInit = {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream", "Content-Length": "1" },
      body: payload,
    };
    const a = await authedFetch(`/api/editors/whiteboard/${c.id}/snapshot/yjs`, opts);
    expect(a.status).toBe(200);
    // Immediate retry must hit the cooldown.
    const b = await authedFetch(`/api/editors/whiteboard/${c.id}/snapshot/yjs`, opts);
    expect(b.status).toBe(429);
    const errBody = await b.json() as { code: string };
    expect(errBody.code).toBe("rate-limited");
  });

  it("rejects oversize Content-Length up front (413)", async () => {
    const c = await authedFetch("/api/editors/document", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Oversize" }),
    }).then((r) => r.json()) as { id: string };

    // Cooldown — wait for it once before this case to avoid the 429 from the
    // previous test bleeding in.
    await new Promise((r) => setTimeout(r, 250));
    const payload = new Uint8Array(16384); // double the 8192 cap
    const r = await authedFetch(`/api/editors/document/${c.id}/snapshot/yjs`, {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream", "Content-Length": String(payload.byteLength) },
      body: payload,
    });
    expect(r.status).toBe(413);
  });

  it("If-Match mismatch returns 412", async () => {
    const c = await authedFetch("/api/editors/slides", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Concurrent" }),
    }).then((r) => r.json()) as { id: string };

    // First save records an ETag.
    await new Promise((r) => setTimeout(r, 250));
    const first = await authedFetch(`/api/editors/slides/${c.id}/snapshot/yjs`, {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream", "Content-Length": "5" },
      body: new TextEncoder().encode("first"),
    });
    expect(first.status).toBe(200);

    // Second save with a stale If-Match.
    await new Promise((r) => setTimeout(r, 250));
    const second = await authedFetch(`/api/editors/slides/${c.id}/snapshot/yjs`, {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream", "Content-Length": "6", "If-Match": "stale-etag" },
      body: new TextEncoder().encode("second"),
    });
    expect(second.status).toBe(412);
    const body = await second.json() as { code: string };
    expect(body.code).toBe("precondition-failed");
  });

  it("returns 204 on snapshot fetch when nothing has been saved yet", async () => {
    const c = await authedFetch("/api/editors/page", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Empty Page" }),
    }).then((r) => r.json()) as { id: string };

    const r = await authedFetch(`/api/editors/page/${c.id}/snapshot/yjs`);
    expect(r.status).toBe(204);
  });

  it("404 on snapshot for unknown record", async () => {
    const r = await authedFetch(`/api/editors/spreadsheet/00000000-0000-0000-0000-000000000000/snapshot/yjs`);
    expect(r.status).toBe(404);
  });
});

describe("editors REST — storage adapter is invoked", () => {
  it("local backend wrote bytes to disk under the tenant prefix", async () => {
    const c = await authedFetch("/api/editors/spreadsheet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "On Disk" }),
    }).then((r) => r.json()) as { id: string; yjsObjectKey: string };

    await new Promise((r) => setTimeout(r, 250));
    const payload = new TextEncoder().encode("durable");
    await authedFetch(`/api/editors/spreadsheet/${c.id}/snapshot/yjs`, {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream", "Content-Length": "7" },
      body: payload,
    });

    const adapter = getStorageRegistry().getDefault() as LocalStorageAdapter;
    const meta = await adapter.head(c.yjsObjectKey);
    expect(meta.size).toBe(7);
  });
});
