/** /api/_plugins — operator-facing plugin admin.
 *
 *  Surface:
 *    GET  /api/_plugins                       — list all loaded plugins + health
 *    GET  /api/_plugins/:id                   — single plugin detail
 *    POST /api/_plugins/:id/uninstall         — run plugin's uninstall hook
 *    GET  /api/_plugins/_leases               — current leader leases
 *    GET  /api/_plugins/_ws-routes            — registered ws routes
 *
 *    Per-tenant enablement (admin only):
 *    GET  /api/_plugins/_enablement           — current tenant's enablement
 *    POST /api/_plugins/_enablement           — { pluginId, enabled, settings? } */

import { Hono } from "hono";
import { requireAuth, currentUser } from "../middleware/auth";
import { getTenantContext } from "../tenancy/context";
import {
  checkPluginHealth,
  listPluginRecords,
  uninstallPlugin,
  getPluginRecord,
  type HostPlugin,
} from "../host/plugin-contract";
import { listLeases } from "../host/leader";
import { listWsRoutes } from "../host/ws-router";
import {
  isPluginEnabled,
  setPluginEnabled,
  listPluginEnablement,
} from "../host/tenant-enablement";

let CURRENT_PLUGINS: HostPlugin[] = [];
export function setActivePlugins(plugins: HostPlugin[]): void { CURRENT_PLUGINS = plugins; }

export const pluginsRoutes = new Hono();
pluginsRoutes.use("*", requireAuth);

/** Public-ish: list plugins. Returns manifest + status, NO secrets. */
pluginsRoutes.get("/", async (c) => {
  const health = await checkPluginHealth(CURRENT_PLUGINS);
  const records = listPluginRecords();
  const tenantId = getTenantContext().tenantId;
  const out = records.map((r) => ({
    id: r.plugin.id,
    version: r.plugin.version,
    manifest: r.plugin.manifest ?? null,
    status: r.status,
    errors: r.errors,
    installedAt: r.installedAt ?? null,
    startedAt: r.startedAt ?? null,
    enabledForTenant: isPluginEnabled(tenantId, r.plugin.id),
    health: health.find((h) => h.id === r.plugin.id) ?? null,
    routes: r.plugin.routes?.map((rt) => rt.mountPath) ?? [],
    ws: r.plugin.ws?.map((w) => w.path) ?? [],
    provides: r.plugin.provides ?? [],
    consumes: r.plugin.consumes ?? [],
    dependsOn: r.plugin.dependsOn ?? [],
  }));
  return c.json({ rows: out });
});

pluginsRoutes.get("/_leases", (c) => c.json({ rows: listLeases() }));
pluginsRoutes.get("/_ws-routes", (c) => c.json({ rows: listWsRoutes() }));

pluginsRoutes.get("/_enablement", (c) => {
  const tenantId = getTenantContext().tenantId;
  return c.json({ rows: listPluginEnablement(tenantId) });
});

pluginsRoutes.post("/_enablement", async (c) => {
  const user = currentUser(c);
  if (user.role !== "admin") return c.json({ error: "admin role required" }, 403);
  const body = (await c.req.json().catch(() => ({}))) as {
    pluginId?: string;
    enabled?: boolean;
    settings?: Record<string, unknown>;
  };
  if (typeof body.pluginId !== "string" || typeof body.enabled !== "boolean") {
    return c.json({ error: "pluginId (string) + enabled (boolean) required" }, 400);
  }
  const tenantId = getTenantContext().tenantId;
  setPluginEnabled(tenantId, body.pluginId, body.enabled, body.settings);
  return c.json({ ok: true, pluginId: body.pluginId, enabled: body.enabled });
});

pluginsRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");
  const rec = getPluginRecord(id);
  if (!rec) return c.json({ error: "plugin not loaded", code: "not-found" }, 404);
  const health = await checkPluginHealth([rec.plugin]);
  return c.json({
    id: rec.plugin.id,
    version: rec.plugin.version,
    manifest: rec.plugin.manifest ?? null,
    status: rec.status,
    errors: rec.errors,
    installedAt: rec.installedAt ?? null,
    startedAt: rec.startedAt ?? null,
    health: health[0] ?? null,
    routes: rec.plugin.routes?.map((r) => r.mountPath) ?? [],
    ws: rec.plugin.ws?.map((w) => w.path) ?? [],
    provides: rec.plugin.provides ?? [],
    consumes: rec.plugin.consumes ?? [],
    dependsOn: rec.plugin.dependsOn ?? [],
  });
});

pluginsRoutes.post("/:id/uninstall", async (c) => {
  const user = currentUser(c);
  if (user.role !== "admin") return c.json({ error: "admin role required" }, 403);
  const id = c.req.param("id");
  const rec = getPluginRecord(id);
  if (!rec) return c.json({ error: "plugin not loaded", code: "not-found" }, 404);
  const result = await uninstallPlugin(rec.plugin);
  return c.json(result, result.ok ? 200 : 500);
});
