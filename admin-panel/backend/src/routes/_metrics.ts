/** GET /api/_metrics — operator-facing metrics snapshot.
 *
 *  Cheap JSON; no Prometheus exposition format yet (a future plugin
 *  could wrap this in `# HELP` / `# TYPE` lines if needed). */

import { Hono } from "hono";
import { requireAuth } from "../middleware/auth";
import { readRouteMetrics } from "../host/middleware-stack";
import { lifecycleSnapshot } from "../host/lifecycle";
import { listLeases } from "../host/leader";
import { listPluginRecords } from "../host/plugin-contract";

export const metricsRoutes = new Hono();
metricsRoutes.use("*", requireAuth);

metricsRoutes.get("/", (c) => {
  const lifecycle = lifecycleSnapshot();
  const leases = listLeases();
  const plugins = listPluginRecords().map((r) => ({
    id: r.plugin.id,
    version: r.plugin.version,
    status: r.status,
    errorCount: r.errors.length,
  }));
  return c.json({
    lifecycle,
    process: {
      pid: process.pid,
      uptimeMs: Math.round(process.uptime() * 1000),
      memory: process.memoryUsage(),
    },
    leases,
    plugins,
    routes: readRouteMetrics(),
  });
});
