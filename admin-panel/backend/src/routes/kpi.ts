/** Server-side KPI aggregation. The client posts a `KpiSpec` and gets back
 *  one number per metric, computed via SQL `json_extract` over the shared
 *  `records` table. Saves dashboards from shipping the entire dataset over
 *  the wire just to compute a counter.
 *
 *  Auth + ACL: every metric is filtered through the same accessible-record
 *  set the resource list endpoint uses, so users only count what they're
 *  allowed to see. Tenant isolation is enforced the same way. */

import { Hono } from "hono";
import { z } from "zod";
import { requireAuth, currentUser } from "../middleware/auth";
import { getTenantContext } from "../tenancy/context";
import { accessibleRecordIds } from "../lib/acl";
import { db } from "../db";

const MetricSpec = z.object({
  id: z.string().min(1).max(64),
  fn: z.enum(["count", "sum", "avg", "min", "max"]),
  field: z.string().min(1).max(64).optional(),
  filters: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
  withinDays: z.number().int().positive().max(3650).optional(),
});

const SpecBody = z.object({
  id: z.string().min(1).max(128),
  resource: z.string().min(1).max(128),
  metrics: z.array(MetricSpec).min(1).max(32),
});

export const kpiRoutes = new Hono();
kpiRoutes.use("*", requireAuth);

kpiRoutes.post("/aggregate", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = SpecBody.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "invalid spec", issues: parsed.error.issues }, 400);
  }
  const { resource, metrics } = parsed.data;
  const user = currentUser(c);
  const tenant = getTenantContext()?.tenantId ?? "default";

  // SAME ACL as listRecords: only count rows the caller can read.
  const accessible = accessibleRecordIds({ resource, userId: user.id, tenantId: tenant });
  if (accessible.size === 0) {
    return c.json({ data: Object.fromEntries(metrics.map((m) => [m.id, 0])) });
  }

  const data: Record<string, number> = {};
  for (const metric of metrics) {
    data[metric.id] = computeMetric(resource, metric, accessible, tenant);
  }
  return c.json({ data });
});

function computeMetric(
  resource: string,
  metric: z.infer<typeof MetricSpec>,
  accessibleIds: ReadonlySet<string>,
  tenantId: string,
): number {
  const where: string[] = ["resource = ?"];
  const bindings: unknown[] = [resource];

  // ACL gate — same shape `listRecords` uses.
  const placeholders = Array.from({ length: accessibleIds.size }, () => "?").join(",");
  where.push(`id IN (${placeholders})`);
  for (const id of accessibleIds) bindings.push(id);

  // Tenant + soft-delete — same predicates `listRecords` uses.
  where.push(
    `(json_extract(data, '$.tenantId') IS NULL OR json_extract(data, '$.tenantId') = 'default' OR json_extract(data, '$.tenantId') = ?)`,
  );
  bindings.push(tenantId);
  where.push(`(json_extract(data, '$.status') IS NULL OR json_extract(data, '$.status') != 'deleted')`);

  if (metric.filters) {
    for (const [field, value] of Object.entries(metric.filters)) {
      if (typeof value === "boolean") {
        where.push(`json_extract(data, ?) = ?`);
        bindings.push(`$.${field}`, value ? 1 : 0);
      } else if (typeof value === "number") {
        where.push(`CAST(json_extract(data, ?) AS REAL) = ?`);
        bindings.push(`$.${field}`, value);
      } else {
        where.push(`json_extract(data, ?) = ?`);
        bindings.push(`$.${field}`, value);
      }
    }
  }

  if (metric.withinDays !== undefined) {
    const sinceIso = new Date(Date.now() - metric.withinDays * 86_400_000).toISOString();
    where.push(`updated_at >= ?`);
    bindings.push(sinceIso);
  }

  const whereSql = `WHERE ${where.join(" AND ")}`;

  if (metric.fn === "count") {
    const row = db.prepare(`SELECT COUNT(*) AS v FROM records ${whereSql}`).get(...bindings) as { v: number };
    return row.v ?? 0;
  }
  if (!metric.field) return 0;

  const sqlFn = metric.fn === "avg" ? "AVG" : metric.fn === "sum" ? "SUM" : metric.fn === "min" ? "MIN" : "MAX";
  const row = db
    .prepare(
      `SELECT ${sqlFn}(CAST(json_extract(data, ?) AS REAL)) AS v FROM records ${whereSql}`,
    )
    .get(`$.${metric.field}`, ...bindings) as { v: number | null };
  return Number(row.v ?? 0);
}
