import { Hono, type Context } from "hono";
import { requireAuth, currentUser } from "../middleware/auth";
import { getTenantContext } from "../tenancy/context";
import {
  deleteRecord,
  getRecord,
  insertRecord,
  listRecords,
  updateRecord,
} from "../lib/query";
import { uuid } from "../lib/id";
import { recordAudit } from "../lib/audit";
import { broadcastResourceChange } from "../lib/ws";
import {
  compileMetricQuerySql,
  createLocalRecordWarehouseAdapter,
  createChartVersion,
  createDashboardVersion,
  drillDownRows,
  stableShareToken,
  validateChart,
  validateDashboard,
  validateSchedule,
  type AnalyticsExplore,
  type DashboardContent,
  type MetricQuery,
  type SavedChart,
  type ScheduledDelivery,
  type ShareUrl,
  type ValidationResult,
  type WarehouseAdapter,
} from "../../../../libraries/gutu-lib-analytics/framework/libraries/analytics/src/index";

const RES = {
  explore: "analytics-bi.explore",
  chart: "analytics-bi.chart",
  chartVersion: "analytics-bi.chart-version",
  dashboard: "analytics-bi.dashboard-content",
  dashboardVersion: "analytics-bi.dashboard-version",
  space: "analytics-bi.space",
  share: "analytics-bi.share-url",
  schedule: "analytics-bi.schedule",
  deliveryRun: "analytics-bi.delivery-run",
  validation: "analytics-bi.validation-result",
} as const;

export const analyticsBiRoutes = new Hono();

analyticsBiRoutes.get("/public/:token", (c) => {
  const token = c.req.param("token");
  const share = all<ShareUrl>(RES.share).find((row) => row.token === token);
  if (!share) return c.json({ error: "share not found" }, 404);
  if (share.expiresAt && share.expiresAt < new Date().toISOString()) {
    return c.json({ error: "share expired" }, 410);
  }
  const target =
    share.targetKind === "chart"
      ? getRecord(RES.chart, share.targetId)
      : getRecord(RES.dashboard, share.targetId);
  if (!target) return c.json({ error: "target not found" }, 404);
  return c.json({ share, target });
});

analyticsBiRoutes.use("*", requireAuth);

analyticsBiRoutes.get("/explores", (c) => c.json({ rows: all<AnalyticsExplore>(RES.explore) }));
analyticsBiRoutes.get("/spaces", (c) => c.json({ rows: all(RES.space) }));
analyticsBiRoutes.get("/charts", (c) => c.json({ rows: all<SavedChart>(RES.chart) }));
analyticsBiRoutes.get("/dashboards", (c) => c.json({ rows: all<DashboardContent>(RES.dashboard) }));
analyticsBiRoutes.get("/schedules", (c) => c.json({ rows: all<ScheduledDelivery>(RES.schedule) }));
analyticsBiRoutes.get("/delivery-runs", (c) => c.json({ rows: all(RES.deliveryRun) }));
analyticsBiRoutes.get("/shares", (c) => c.json({ rows: all<ShareUrl>(RES.share) }));

analyticsBiRoutes.post("/query/run", async (c) => {
  const body = await bodyJson<{ query?: MetricQuery }>(c);
  if (!body.query) return c.json({ error: "query required" }, 400);
  const explore = findExplore(body.query.exploreId);
  if (!explore) return c.json({ error: "explore not found" }, 404);
  try {
    return c.json(await localWarehouseAdapter().run(body.query, explore));
  } catch (err) {
    return c.json({ error: messageOf(err) }, 422);
  }
});

analyticsBiRoutes.post("/query/compile", async (c) => {
  const body = await bodyJson<{ query?: MetricQuery }>(c);
  if (!body.query) return c.json({ error: "query required" }, 400);
  const explore = findExplore(body.query.exploreId);
  if (!explore) return c.json({ error: "explore not found" }, 404);
  try {
    return c.json(compileMetricQuerySql(explore, body.query));
  } catch (err) {
    return c.json({ error: messageOf(err) }, 422);
  }
});

analyticsBiRoutes.post("/query/drilldown", async (c) => {
  const body = await bodyJson<{
    query?: MetricQuery;
    dimensionValues?: Record<string, unknown>;
    limit?: number;
  }>(c);
  if (!body.query) return c.json({ error: "query required" }, 400);
  const explore = findExplore(body.query.exploreId);
  if (!explore) return c.json({ error: "explore not found" }, 404);
  return c.json({
    rows: drillDownRows({
      explore,
      query: body.query,
      rows: all(explore.resource),
      dimensionValues: body.dimensionValues,
      limit: body.limit,
    }),
  });
});

analyticsBiRoutes.get("/charts/:id", (c) => one(c, RES.chart));
analyticsBiRoutes.get("/charts/:id/history", (c) => {
  const id = c.req.param("id");
  return c.json({
    rows: all(RES.chartVersion).filter((row) => row.chartId === id),
  });
});
analyticsBiRoutes.post("/charts", async (c) => {
  const user = currentUser(c);
  const patch = await bodyJson<Partial<SavedChart>>(c);
  const now = new Date().toISOString();
  const id = String(patch.id ?? `chart_${uuid().slice(0, 8)}`);
  if (getRecord(RES.chart, id)) return c.json({ error: "duplicate id" }, 409);
  const chart = {
    ...patch,
    id,
    name: String(patch.name ?? "Untitled chart"),
    exploreId: String(patch.exploreId ?? patch.query?.exploreId ?? ""),
    query: patch.query,
    config: patch.config ?? { kind: "table" },
    version: 1,
    createdBy: user.email,
    updatedBy: user.email,
    createdAt: now,
    updatedAt: now,
  } as SavedChart;
  const explore = findExplore(chart.exploreId);
  if (!explore) return c.json({ error: "explore not found" }, 422);
  const errors = validateChart(chart, explore).filter((v) => v.severity === "error");
  if (errors.length > 0) return c.json({ error: errors[0]?.message, validation: errors }, 422);
  save(RES.chart, id, chart, user.email, "created");
  const version = createChartVersion(chart, user.email, "created");
  save(RES.chartVersion, version.id, version, user.email, "created");
  return c.json(chart, 201);
});
analyticsBiRoutes.patch("/charts/:id", async (c) => {
  const user = currentUser(c);
  const id = c.req.param("id");
  const existing = getTyped<SavedChart>(RES.chart, id);
  if (!existing) return c.json({ error: "not found" }, 404);
  const patch = await bodyJson<Partial<SavedChart> & { expectedVersion?: number }>(c);
  if (patch.expectedVersion && patch.expectedVersion !== existing.version) {
    return c.json({ error: "stale version" }, 409);
  }
  const chart = {
    ...existing,
    ...patch,
    id,
    version: existing.version + 1,
    updatedBy: user.email,
    updatedAt: new Date().toISOString(),
  } as SavedChart;
  const explore = findExplore(chart.exploreId);
  const errors = validateChart(chart, explore).filter((v) => v.severity === "error");
  if (errors.length > 0) return c.json({ error: errors[0]?.message, validation: errors }, 422);
  save(RES.chart, id, chart, user.email, "updated");
  const version = createChartVersion(chart, user.email, "updated");
  save(RES.chartVersion, version.id, version, user.email, "created");
  return c.json(chart);
});
analyticsBiRoutes.post("/charts/:id/rollback", async (c) => {
  const user = currentUser(c);
  const id = c.req.param("id");
  const existing = getTyped<SavedChart>(RES.chart, id);
  if (!existing) return c.json({ error: "not found" }, 404);
  const body = await bodyJson<{ version?: number }>(c);
  const target = all<{ chartId: string; version: number; chart: SavedChart }>(RES.chartVersion)
    .find((row) => row.chartId === id && row.version === body.version);
  if (!target) return c.json({ error: "version not found" }, 404);
  const chart = {
    ...target.chart,
    version: existing.version + 1,
    updatedBy: user.email,
    updatedAt: new Date().toISOString(),
  } as SavedChart;
  save(RES.chart, id, chart, user.email, "rolled_back");
  const version = createChartVersion(chart, user.email, `rollback:${target.version}`);
  save(RES.chartVersion, version.id, version, user.email, "created");
  return c.json(chart);
});

analyticsBiRoutes.get("/dashboards/:id", (c) => one(c, RES.dashboard));
analyticsBiRoutes.get("/dashboards/:id/history", (c) => {
  const id = c.req.param("id");
  return c.json({
    rows: all(RES.dashboardVersion).filter((row) => row.dashboardId === id),
  });
});
analyticsBiRoutes.post("/dashboards", async (c) => {
  const user = currentUser(c);
  const patch = await bodyJson<Partial<DashboardContent>>(c);
  const now = new Date().toISOString();
  const id = String(patch.id ?? `dash_${uuid().slice(0, 8)}`);
  if (getRecord(RES.dashboard, id)) return c.json({ error: "duplicate id" }, 409);
  const dashboard = {
    id,
    name: String(patch.name ?? "Untitled dashboard"),
    description: patch.description,
    spaceId: patch.spaceId,
    tabs: patch.tabs?.length ? patch.tabs : [{ id: "main", label: "Main", order: 0 }],
    filters: patch.filters ?? [],
    tiles: patch.tiles ?? [],
    version: 1,
    createdBy: user.email,
    updatedBy: user.email,
    createdAt: now,
    updatedAt: now,
  } as DashboardContent;
  const errors = validateDashboard(dashboard, all<SavedChart>(RES.chart)).filter((v) => v.severity === "error");
  if (errors.length > 0) return c.json({ error: errors[0]?.message, validation: errors }, 422);
  save(RES.dashboard, id, dashboard, user.email, "created");
  const version = createDashboardVersion(dashboard, user.email, "created");
  save(RES.dashboardVersion, version.id, version, user.email, "created");
  return c.json(dashboard, 201);
});
analyticsBiRoutes.patch("/dashboards/:id", async (c) => {
  const user = currentUser(c);
  const id = c.req.param("id");
  const existing = getTyped<DashboardContent>(RES.dashboard, id);
  if (!existing) return c.json({ error: "not found" }, 404);
  const patch = await bodyJson<Partial<DashboardContent> & { expectedVersion?: number }>(c);
  if (patch.expectedVersion && patch.expectedVersion !== existing.version) {
    return c.json({ error: "stale version" }, 409);
  }
  const dashboard = {
    ...existing,
    ...patch,
    id,
    version: existing.version + 1,
    updatedBy: user.email,
    updatedAt: new Date().toISOString(),
  } as DashboardContent;
  const errors = validateDashboard(dashboard, all<SavedChart>(RES.chart)).filter((v) => v.severity === "error");
  if (errors.length > 0) return c.json({ error: errors[0]?.message, validation: errors }, 422);
  save(RES.dashboard, id, dashboard, user.email, "updated");
  const version = createDashboardVersion(dashboard, user.email, "updated");
  save(RES.dashboardVersion, version.id, version, user.email, "created");
  return c.json(dashboard);
});
analyticsBiRoutes.post("/dashboards/:id/rollback", async (c) => {
  const user = currentUser(c);
  const id = c.req.param("id");
  const existing = getTyped<DashboardContent>(RES.dashboard, id);
  if (!existing) return c.json({ error: "not found" }, 404);
  const body = await bodyJson<{ version?: number }>(c);
  const target = all<{ dashboardId: string; version: number; dashboard: DashboardContent }>(RES.dashboardVersion)
    .find((row) => row.dashboardId === id && row.version === body.version);
  if (!target) return c.json({ error: "version not found" }, 404);
  const dashboard = {
    ...target.dashboard,
    version: existing.version + 1,
    updatedBy: user.email,
    updatedAt: new Date().toISOString(),
  } as DashboardContent;
  save(RES.dashboard, id, dashboard, user.email, "rolled_back");
  const version = createDashboardVersion(dashboard, user.email, `rollback:${target.version}`);
  save(RES.dashboardVersion, version.id, version, user.email, "created");
  return c.json(dashboard);
});

analyticsBiRoutes.post("/spaces", async (c) => createSimple(c, RES.space, "space"));
analyticsBiRoutes.patch("/spaces/:id", async (c) => patchSimple(c, RES.space));
analyticsBiRoutes.post("/schedules", async (c) => {
  const user = currentUser(c);
  const patch = await bodyJson<Partial<ScheduledDelivery>>(c);
  const now = new Date().toISOString();
  const id = String(patch.id ?? `sched_${uuid().slice(0, 8)}`);
  const targetResource = targetResourceFor(patch.targetKind);
  if (!targetResource || !patch.targetId) {
    return c.json({ error: "targetKind and targetId required" }, 400);
  }
  if (!getTyped(targetResource, patch.targetId)) return c.json({ error: "target not found" }, 404);
  const schedule = {
    ...patch,
    id,
    name: String(patch.name ?? "Untitled schedule"),
    targetKind: patch.targetKind,
    targetId: patch.targetId,
    cron: String(patch.cron ?? "every 1d"),
    timezone: String(patch.timezone ?? "UTC"),
    format: patch.format ?? "pdf",
    enabled: patch.enabled ?? true,
    includeLinks: patch.includeLinks ?? true,
    targets: patch.targets ?? [],
    createdBy: user.email,
    updatedAt: now,
  } as ScheduledDelivery;
  const errors = validateSchedule(schedule).filter((v) => v.severity === "error");
  if (errors.length > 0) return c.json({ error: errors[0]?.message, validation: errors }, 422);
  save(RES.schedule, id, schedule, user.email, "created");
  return c.json(schedule, 201);
});
analyticsBiRoutes.patch("/schedules/:id", async (c) => patchSimple(c, RES.schedule));
analyticsBiRoutes.post("/schedules/:id/run", async (c) => {
  const user = currentUser(c);
  const id = c.req.param("id");
  if (!getRecord(RES.schedule, id)) return c.json({ error: "not found" }, 404);
  const now = new Date().toISOString();
  const run = {
    id: `run_${uuid().slice(0, 8)}`,
    scheduleId: id,
    status: "sent",
    message: "Local delivery logged. External delivery adapters are not enabled.",
    startedAt: now,
    finishedAt: now,
  };
  save(RES.deliveryRun, run.id, run, user.email, "created");
  return c.json(run, 201);
});

analyticsBiRoutes.post("/shares", async (c) => {
  const user = currentUser(c);
  const body = await bodyJson<Partial<ShareUrl>>(c);
  const targetKind = body.targetKind;
  const targetId = body.targetId;
  const targetResource = targetResourceFor(targetKind);
  if (!targetResource || !targetId || !targetKind) {
    return c.json({ error: "targetKind and targetId required" }, 400);
  }
  if (!getTyped(targetResource, targetId)) return c.json({ error: "target not found" }, 404);
  const now = new Date().toISOString();
  const id = String(body.id ?? `share_${uuid().slice(0, 8)}`);
  const token = body.token ?? stableShareToken(targetKind, targetId, user.email);
  const existing = all<ShareUrl>(RES.share).find((share) => share.token === token);
  if (existing) return c.json(existing);
  const share: ShareUrl = {
    id,
    token,
    targetKind,
    targetId,
    includeFilters: body.includeFilters ?? true,
    expiresAt: body.expiresAt,
    createdBy: user.email,
    createdAt: now,
  };
  save(RES.share, id, share, user.email, "created");
  return c.json(share, 201);
});

analyticsBiRoutes.get("/validation", (c) => {
  const now = new Date();
  const explores = new Map(all<AnalyticsExplore>(RES.explore).map((explore) => [explore.id, explore]));
  const charts = all<SavedChart>(RES.chart);
  const dashboards = all<DashboardContent>(RES.dashboard);
  const schedules = all<ScheduledDelivery>(RES.schedule);
  const results: ValidationResult[] = [
    ...charts.flatMap((chart) => validateChart(chart, explores.get(chart.exploreId), now)),
    ...dashboards.flatMap((dashboard) => validateDashboard(dashboard, charts, now)),
    ...schedules.flatMap((schedule) => validateSchedule(schedule, now)),
  ];
  for (const result of results) save(RES.validation, result.id, result, "system", "updated");
  return c.json({ rows: results });
});

analyticsBiRoutes.delete("/:kind/:id", (c) => {
  const kind = c.req.param("kind") as keyof typeof deleteMap;
  const resource = deleteMap[kind];
  if (!resource) return c.json({ error: "unsupported delete target" }, 404);
  const id = c.req.param("id");
  const ok = deleteRecord(resource, id);
  if (!ok) return c.json({ error: "not found" }, 404);
  const user = currentUser(c);
  recordAudit({ actor: user.email, action: `${resource}.deleted`, resource, recordId: id });
  broadcastResourceChange(resource, id, "delete", user.email);
  return c.json({ ok: true });
});

const deleteMap = {
  charts: RES.chart,
  dashboards: RES.dashboard,
  spaces: RES.space,
  schedules: RES.schedule,
  shares: RES.share,
} as const;

function all<T = Record<string, unknown>>(resource: string): T[] {
  return listRecords(resource, { page: 1, pageSize: 1000, filters: {} }).rows
    .filter(visibleToTenant) as T[];
}

function getTyped<T>(resource: string, id: string): T | null {
  const row = getRecord(resource, id);
  return row && visibleToTenant(row) ? (row as T) : null;
}

function findExplore(id: string): AnalyticsExplore | undefined {
  return all<AnalyticsExplore>(RES.explore).find((explore) => explore.id === id);
}

function save(
  resource: string,
  id: string,
  data: unknown,
  actor: string,
  verb: "created" | "updated" | "rolled_back",
): Record<string, unknown> {
  const existing = getRecord(resource, id);
  const record = tenantTagged(asRecord(data));
  const row = existing ? updateRecord(resource, id, record) : insertRecord(resource, id, record);
  recordAudit({
    actor,
    action: `${resource}.${verb}`,
    resource,
    recordId: id,
    payload: record,
  });
  broadcastResourceChange(resource, id, existing ? "update" : "create", actor);
  return row ?? record;
}

async function createSimple(c: Context, resource: string, prefix: string) {
  const user = currentUser(c);
  const body = await bodyJson<Record<string, unknown>>(c);
  const id = String(body.id ?? `${prefix}_${uuid().slice(0, 8)}`);
  if (getRecord(resource, id)) return c.json({ error: "duplicate id" }, 409);
  const now = new Date().toISOString();
  const row = { ...body, id, updatedAt: now, createdBy: user.email };
  save(resource, id, row, user.email, "created");
  return c.json(row, 201);
}

async function patchSimple(c: Context, resource: string) {
  const user = currentUser(c);
  const id = c.req.param("id") ?? "";
  const existing = getTyped(resource, id);
  if (!existing) return c.json({ error: "not found" }, 404);
  const body = await bodyJson<Record<string, unknown>>(c);
  const row = { ...existing, ...body, id, updatedAt: new Date().toISOString() };
  save(resource, id, row, user.email, "updated");
  return c.json(row);
}

function one(c: Context, resource: string) {
  const row = getTyped(resource, c.req.param("id") ?? "");
  if (!row) return c.json({ error: "not found" }, 404);
  return c.json(row);
}

async function bodyJson<T>(c: { req: { json: () => Promise<unknown> } }): Promise<T> {
  return (await c.req.json().catch(() => ({}))) as T;
}

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function tenantTagged(record: Record<string, unknown>): Record<string, unknown> {
  const tenantId = getTenantContext()?.tenantId;
  if (!tenantId || record.tenantId) return record;
  return { ...record, tenantId };
}

function visibleToTenant(record: Record<string, unknown>): boolean {
  const tenantId = getTenantContext()?.tenantId;
  if (!tenantId || !record.tenantId) return true;
  return record.tenantId === tenantId;
}

function targetResourceFor(kind: unknown): string | null {
  if (kind === "chart") return RES.chart;
  if (kind === "dashboard") return RES.dashboard;
  return null;
}

function localWarehouseAdapter(): WarehouseAdapter {
  return createLocalRecordWarehouseAdapter({
    rowsForResource: (resource) => all(resource),
  });
}
