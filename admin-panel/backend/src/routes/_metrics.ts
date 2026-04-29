/** GET /api/_metrics — operator-facing metrics snapshot.
 *
 *  Content negotiation:
 *    Accept: application/json (default)            → JSON snapshot.
 *    Accept: text/plain | application/openmetrics  → Prometheus
 *                                                    exposition format.
 *
 *  Prometheus scrapers send `Accept: text/plain` (or `application/
 *  openmetrics-text`) by default — surfacing a parseable format on the
 *  same path means we don't need a separate /metrics endpoint. */

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
  const routeMetrics = readRouteMetrics();
  const snapshot = {
    lifecycle,
    process: {
      pid: process.pid,
      uptimeMs: Math.round(process.uptime() * 1000),
      memory: process.memoryUsage(),
    },
    leases,
    plugins,
    routes: routeMetrics,
  };
  const accept = (c.req.header("accept") ?? "").toLowerCase();
  const wantsPrometheus =
    accept.includes("text/plain") ||
    accept.includes("application/openmetrics");
  if (wantsPrometheus) {
    return new Response(toPrometheus(snapshot), {
      status: 200,
      headers: { "content-type": "text/plain; version=0.0.4; charset=utf-8" },
    });
  }
  return c.json(snapshot);
});

interface MetricsSnapshot {
  lifecycle: { booting: boolean; draining: boolean; inFlight: number; uptimeMs: number };
  process: { pid: number; uptimeMs: number; memory: NodeJS.MemoryUsage };
  leases: ReadonlyArray<{ name: string; holderId: string; expiresAt: string; mine: boolean }>;
  plugins: ReadonlyArray<{ id: string; version: string; status: string; errorCount: number }>;
  routes: ReadonlyArray<{
    route: string;
    count: number;
    errors: number;
    durAvgMs: number;
    durMinMs: number;
    durMaxMs: number;
  }>;
}

function toPrometheus(s: MetricsSnapshot): string {
  const lines: string[] = [];
  const num = (v: number | undefined): string =>
    v === undefined || Number.isNaN(v) ? "0" : String(v);
  const sanitize = (l: string): string => l.replace(/[^a-zA-Z0-9_:]/g, "_");

  lines.push("# HELP gutu_lifecycle_in_flight In-flight HTTP requests");
  lines.push("# TYPE gutu_lifecycle_in_flight gauge");
  lines.push(`gutu_lifecycle_in_flight ${num(s.lifecycle.inFlight)}`);
  lines.push("# HELP gutu_lifecycle_booting Process booting flag");
  lines.push("# TYPE gutu_lifecycle_booting gauge");
  lines.push(`gutu_lifecycle_booting ${s.lifecycle.booting ? 1 : 0}`);
  lines.push("# HELP gutu_lifecycle_draining Process draining flag");
  lines.push("# TYPE gutu_lifecycle_draining gauge");
  lines.push(`gutu_lifecycle_draining ${s.lifecycle.draining ? 1 : 0}`);

  lines.push("# HELP gutu_process_uptime_seconds Process uptime");
  lines.push("# TYPE gutu_process_uptime_seconds counter");
  lines.push(`gutu_process_uptime_seconds ${(s.process.uptimeMs / 1000).toFixed(3)}`);
  lines.push("# HELP gutu_process_memory_bytes Process memory usage");
  lines.push("# TYPE gutu_process_memory_bytes gauge");
  for (const [k, v] of Object.entries(s.process.memory)) {
    lines.push(`gutu_process_memory_bytes{kind="${sanitize(k)}"} ${num(v as number)}`);
  }

  lines.push("# HELP gutu_plugin_status Plugin lifecycle status (1=loaded)");
  lines.push("# TYPE gutu_plugin_status gauge");
  lines.push("# HELP gutu_plugin_errors_total Plugin error count");
  lines.push("# TYPE gutu_plugin_errors_total counter");
  for (const p of s.plugins) {
    const v = p.status === "loaded" ? 1 : 0;
    lines.push(`gutu_plugin_status{id="${sanitize(p.id)}",version="${p.version}",status="${sanitize(p.status)}"} ${v}`);
    lines.push(`gutu_plugin_errors_total{id="${sanitize(p.id)}"} ${num(p.errorCount)}`);
  }

  lines.push("# HELP gutu_lease_held Whether this process holds the lease (1) or not (0)");
  lines.push("# TYPE gutu_lease_held gauge");
  for (const lease of s.leases) {
    lines.push(`gutu_lease_held{name="${sanitize(lease.name)}"} ${lease.mine ? 1 : 0}`);
  }

  lines.push("# HELP gutu_route_calls_total Per-route call counter");
  lines.push("# TYPE gutu_route_calls_total counter");
  lines.push("# HELP gutu_route_errors_total Per-route error counter");
  lines.push("# TYPE gutu_route_errors_total counter");
  lines.push("# HELP gutu_route_duration_ms_avg Route duration average (ms)");
  lines.push("# TYPE gutu_route_duration_ms_avg gauge");
  lines.push("# HELP gutu_route_duration_ms_max Route duration max (ms)");
  lines.push("# TYPE gutu_route_duration_ms_max gauge");
  for (const r of s.routes) {
    const labels = `route="${sanitize(r.route)}"`;
    lines.push(`gutu_route_calls_total{${labels}} ${num(r.count)}`);
    lines.push(`gutu_route_errors_total{${labels}} ${num(r.errors)}`);
    lines.push(`gutu_route_duration_ms_avg{${labels}} ${num(r.durAvgMs)}`);
    lines.push(`gutu_route_duration_ms_max{${labels}} ${num(r.durMaxMs)}`);
  }
  return lines.join("\n") + "\n";
}
