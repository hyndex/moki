import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type {
  AnalyticsExplore,
  DashboardContent,
  MetricQuery,
  SavedChart,
} from "../../../../libraries/gutu-lib-analytics/framework/libraries/analytics/src/index";

let app: Awaited<ReturnType<typeof setup>>;

async function setup() {
  const dataDir = await mkdtemp(path.join(tmpdir(), "gutu-analytics-bi-test-"));
  process.env.DB_PATH = path.join(dataDir, "test.db");
  process.env.FILES_ROOT = path.join(dataDir, "files");
  process.env.STORAGE_SIGNING_KEY = "k".repeat(64);
  process.env.NODE_ENV = "test";

  const { migrate } = await import("../../src/migrations");
  migrate();
  const { migrateGlobal } = await import("../../src/tenancy/migrations");
  await migrateGlobal();
  const { db } = await import("../../src/db");

  const tenantA = "11111111-1111-1111-1111-111111111111";
  const tenantB = "22222222-2222-2222-2222-222222222222";
  db.exec("PRAGMA foreign_keys = OFF");
  db.exec("DELETE FROM audit_events; DELETE FROM records; DELETE FROM sessions; DELETE FROM tenant_memberships; DELETE FROM tenants; DELETE FROM users");
  for (const [id, slug, name] of [
    [tenantA, "main", "Main"],
    [tenantB, "globex", "Globex"],
  ]) {
    db.exec(
      `INSERT INTO tenants (id, slug, name, schema_name, status, plan, settings, created_at, updated_at)
       VALUES ('${id}', '${slug}', '${name}', 'tenant_${slug}', 'active', 'builtin', '{}', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')`,
    );
  }
  for (const [userId, email, tenantId, token] of [
    ["user-1", "tester@gutu.dev", tenantA, "test-token"],
    ["user-2", "other@gutu.dev", tenantB, "other-token"],
  ]) {
    db.exec(
      `INSERT INTO users (id, email, name, role, password_hash, mfa_enabled, created_at, updated_at)
       VALUES ('${userId}', '${email}', '${email}', 'admin', 'x', 0, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')`,
    );
    db.exec(
      `INSERT INTO tenant_memberships (tenant_id, user_id, role, joined_at)
       VALUES ('${tenantId}', '${userId}', 'owner', '2026-01-01T00:00:00.000Z')`,
    );
    db.exec(
      `INSERT INTO sessions (token, user_id, tenant_id, created_at, expires_at, ua, ip)
       VALUES ('${token}', '${userId}', '${tenantId}', '2026-01-01T00:00:00.000Z', '2099-01-01T00:00:00.000Z', 'test', '127.0.0.1')`,
    );
  }

  const { bulkInsert } = await import("../../src/lib/query");
  const explore: AnalyticsExplore = {
    id: "sales-deals",
    label: "Sales deals",
    resource: "sales.deal",
    dimensions: [
      { id: "stage", label: "Stage", type: "string", sourceField: "stage" },
      { id: "owner", label: "Owner", type: "string", sourceField: "owner" },
    ],
    metrics: [
      { id: "deal_count", label: "Deals", aggregation: "count" },
      { id: "amount_sum", label: "Amount", aggregation: "sum", sourceField: "amountMinor" },
    ],
    defaultQuery: { exploreId: "sales-deals", dimensions: ["stage"], metrics: ["amount_sum"], filters: [], sorts: [], limit: 100 },
  };
  bulkInsert("analytics-bi.explore", [{ ...explore, tenantId: tenantA }]);
  bulkInsert("sales.deal", [
    { id: "deal-1", tenantId: tenantA, stage: "Won", owner: "Ada", amountMinor: 12000 },
    { id: "deal-2", tenantId: tenantA, stage: "Won", owner: "Ada", amountMinor: 8000 },
    { id: "deal-3", tenantId: tenantA, stage: "Lost", owner: "Lin", amountMinor: 4000 },
    { id: "deal-4", tenantId: tenantB, stage: "Won", owner: "Other", amountMinor: 999999 },
  ]);

  const { createApp } = await import("../../src/server");
  return { app: createApp(), dataDir, tenantA, tenantB, db };
}

beforeAll(async () => {
  app = await setup();
});

afterAll(async () => {
  await rm(app.dataDir, { recursive: true, force: true });
});

function authedFetch(input: string, init: RequestInit = {}, token = "test-token"): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  headers.set("x-tenant", token === "other-token" ? app.tenantB : app.tenantA);
  return app.app.fetch(new Request(`http://localhost${input}`, { ...init, headers }));
}

function json(body: unknown): RequestInit {
  return {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

const query: MetricQuery = {
  exploreId: "sales-deals",
  dimensions: ["stage"],
  metrics: ["amount_sum", "deal_count"],
  filters: [],
  sorts: [],
  limit: 100,
  tableCalculations: [],
  customMetrics: [],
};

describe("analytics BI API", () => {
  it("requires authentication on product routes", async () => {
    const res = await app.app.fetch(new Request("http://localhost/api/analytics-bi/explores"));
    expect(res.status).toBe(401);
  });

  it("ingests bounded shell analytics events with tenant and audit context", async () => {
    const res = await authedFetch("/api/analytics/events", json({
      events: [
        {
          name: "page.viewed",
          meta: { route: "/analytics/explore", sessionId: "session-1", at: "2026-01-01T00:00:00.000Z" },
          props: { variant: "test" },
        },
      ],
    }));
    expect(res.status).toBe(202);
    expect((await res.json() as { accepted: number }).accepted).toBe(1);

    const stored = app.db
      .prepare("SELECT data FROM records WHERE resource = ? ORDER BY created_at DESC LIMIT 1")
      .get("analytics.event") as { data: string } | undefined;
    expect(stored).toBeDefined();
    const event = JSON.parse(stored!.data) as { tenantId: string; name: string };
    expect(event.tenantId).toBe(app.tenantA);
    expect(event.name).toBe("page.viewed");

    const tooLarge = await authedFetch("/api/analytics/events", json({
      events: Array.from({ length: 101 }, (_, index) => ({
        name: "page.viewed",
        meta: { route: `/too-large-${index}`, sessionId: "session-1" },
        props: {},
      })),
    }));
    expect(tooLarge.status).toBe(413);
  });

  it("runs, compiles, and drills down metric queries", async () => {
    const run = await authedFetch("/api/analytics-bi/query/run", json({ query }));
    expect(run.status).toBe(200);
    const runBody = await run.json() as { rows: Record<string, unknown>[]; totalRows: number; compiledSql: string };
    expect(runBody.totalRows).toBe(2);
    expect(runBody.rows.find((row) => row.stage === "Won")?.amount_sum).toBe(20000);
    expect(runBody.rows.find((row) => row.stage === "Won")?.deal_count).toBe(2);
    expect(runBody.compiledSql).toContain("FROM records");

    const compile = await authedFetch("/api/analytics-bi/query/compile", json({ query }));
    expect(compile.status).toBe(200);
    expect((await compile.json() as { sql: string }).sql).toContain("sales.deal");

    const drill = await authedFetch("/api/analytics-bi/query/drilldown", json({ query, dimensionValues: { stage: "Lost" } }));
    expect(drill.status).toBe(200);
    expect((await drill.json() as { rows: Record<string, unknown>[] }).rows.map((row) => row.id)).toEqual(["deal-3"]);
  });

  it("versions charts, rejects stale writes, and records audit events", async () => {
    const create = await authedFetch("/api/analytics-bi/charts", json({
      id: "chart_pipeline",
      name: "Pipeline by stage",
      exploreId: "sales-deals",
      query,
      config: { kind: "bar", xField: "stage", yFields: ["amount_sum"] },
    }));
    expect(create.status).toBe(201);
    expect((await create.json() as SavedChart).version).toBe(1);

    const duplicate = await authedFetch("/api/analytics-bi/charts", json({
      id: "chart_pipeline",
      name: "Duplicate",
      exploreId: "sales-deals",
      query,
      config: { kind: "bar" },
    }));
    expect(duplicate.status).toBe(409);

    const update = await authedFetch("/api/analytics-bi/charts/chart_pipeline", {
      ...json({ expectedVersion: 1, name: "Pipeline by stage v2" }),
      method: "PATCH",
    });
    expect(update.status).toBe(200);
    expect((await update.json() as SavedChart).version).toBe(2);

    const stale = await authedFetch("/api/analytics-bi/charts/chart_pipeline", {
      ...json({ expectedVersion: 1, name: "Stale" }),
      method: "PATCH",
    });
    expect(stale.status).toBe(409);

    const rollback = await authedFetch("/api/analytics-bi/charts/chart_pipeline/rollback", json({ version: 1 }));
    expect(rollback.status).toBe(200);
    expect((await rollback.json() as SavedChart).version).toBe(3);

    const history = await authedFetch("/api/analytics-bi/charts/chart_pipeline/history");
    expect((await history.json() as { rows: unknown[] }).rows.length).toBe(3);

    const audit = app.db
      .prepare("SELECT COUNT(*) AS c FROM audit_events WHERE action = ? AND resource = ?")
      .get("analytics-bi.chart.created", "analytics-bi.chart") as { c: number };
    expect(audit.c).toBeGreaterThanOrEqual(1);
  });

  it("versions dashboards, validates missing chart references, shares, schedules, and logs deliveries", async () => {
    const invalidDashboard = await authedFetch("/api/analytics-bi/dashboards", json({
      id: "dash_invalid",
      name: "Invalid",
      tabs: [{ id: "main", label: "Main", order: 0 }],
      filters: [],
      tiles: [{ id: "missing", kind: "chart", chartId: "missing_chart", x: 0, y: 0, w: 6, h: 4 }],
    }));
    expect(invalidDashboard.status).toBe(422);

    const create = await authedFetch("/api/analytics-bi/dashboards", json({
      id: "dash_exec",
      name: "Executive dashboard",
      tabs: [{ id: "main", label: "Main", order: 0 }],
      filters: [{ id: "stage", label: "Stage", fieldId: "stage" }],
      tiles: [{ id: "tile_chart", kind: "chart", chartId: "chart_pipeline", x: 0, y: 0, w: 6, h: 4, tabId: "main" }],
    }));
    expect(create.status).toBe(201);
    expect((await create.json() as DashboardContent).version).toBe(1);

    const patch = await authedFetch("/api/analytics-bi/dashboards/dash_exec", {
      ...json({ expectedVersion: 1, pinned: true }),
      method: "PATCH",
    });
    expect(patch.status).toBe(200);
    expect((await patch.json() as DashboardContent).version).toBe(2);

    const rollback = await authedFetch("/api/analytics-bi/dashboards/dash_exec/rollback", json({ version: 1 }));
    expect(rollback.status).toBe(200);
    expect((await rollback.json() as DashboardContent).version).toBe(3);

    const share = await authedFetch("/api/analytics-bi/shares", json({ targetKind: "dashboard", targetId: "dash_exec" }));
    expect(share.status).toBe(201);
    const shareBody = await share.json() as { token: string };
    const publicShare = await app.app.fetch(new Request(`http://localhost/api/analytics-bi/public/${shareBody.token}`));
    expect(publicShare.status).toBe(200);

    const schedule = await authedFetch("/api/analytics-bi/schedules", json({
      id: "sched_exec",
      name: "Executive weekly",
      targetKind: "dashboard",
      targetId: "dash_exec",
      cron: "every 1w",
      timezone: "UTC",
      format: "pdf",
      enabled: true,
      includeLinks: true,
      targets: [{ kind: "email", address: "ops@gutu.dev" }],
    }));
    expect(schedule.status).toBe(201);

    const run = await authedFetch("/api/analytics-bi/schedules/sched_exec/run", json({}));
    expect(run.status).toBe(201);

    const validation = await authedFetch("/api/analytics-bi/validation");
    expect(validation.status).toBe(200);
    expect((await validation.json() as { rows: unknown[] }).rows).toEqual([]);
  });

  it("hides tenant-scoped content from other tenant sessions", async () => {
    const chart = await authedFetch("/api/analytics-bi/charts/chart_pipeline", {}, "other-token");
    expect(chart.status).toBe(404);

    const charts = await authedFetch("/api/analytics-bi/charts", {}, "other-token");
    expect(charts.status).toBe(200);
    expect((await charts.json() as { rows: SavedChart[] }).rows.some((row) => row.id === "chart_pipeline")).toBe(false);
  });
});
