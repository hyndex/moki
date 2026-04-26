/** Per-tenant plugin enablement.
 *
 *  In a multi-tenant SaaS, not every tenant gets every plugin. Tenant
 *  A subscribes to the field-service plan, tenant B doesn't. Today we
 *  load plugins globally but we want to gate access per-tenant.
 *
 *  Storage: a `plugin_enablement` table keyed on (tenant_id, plugin_id).
 *  Default policy: all plugins enabled (opt-out) unless a row says
 *  `enabled = 0`. This means existing tenants don't break when a new
 *  plugin ships, and the operator can disable per tenant.
 *
 *  Middleware: `pluginGate(pluginId)` short-circuits 404 for
 *  disabled tenants — applied to the plugin's mount path.  */

import { db } from "../db";
import { getTenantContext } from "../tenancy/context";
import type { Context, Next } from "hono";

export function ensureTenantEnablementSchema(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS plugin_enablement (
      tenant_id TEXT NOT NULL,
      plugin_id TEXT NOT NULL,
      enabled   INTEGER NOT NULL DEFAULT 1,
      settings  TEXT,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (tenant_id, plugin_id)
    );
    CREATE INDEX IF NOT EXISTS plugin_enablement_tenant_idx
      ON plugin_enablement(tenant_id);
  `);
}

interface EnablementRow {
  tenant_id: string;
  plugin_id: string;
  enabled: number;
  settings: string | null;
  updated_at: string;
}

/** Default-on read: a missing row counts as enabled. */
export function isPluginEnabled(tenantId: string, pluginId: string): boolean {
  try {
    const row = db
      .prepare("SELECT enabled FROM plugin_enablement WHERE tenant_id = ? AND plugin_id = ?")
      .get(tenantId, pluginId) as { enabled: number } | undefined;
    if (!row) return true; // default-on
    return row.enabled === 1;
  } catch { return true; }
}

/** Operator API: enable / disable for a tenant. */
export function setPluginEnabled(tenantId: string, pluginId: string, enabled: boolean, settings?: Record<string, unknown>): void {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO plugin_enablement (tenant_id, plugin_id, enabled, settings, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, plugin_id) DO UPDATE
       SET enabled = excluded.enabled, settings = excluded.settings, updated_at = excluded.updated_at`,
  ).run(tenantId, pluginId, enabled ? 1 : 0, settings ? JSON.stringify(settings) : null, now);
}

/** Operator API: list enablement rows for a tenant. Missing rows count as enabled. */
export function listPluginEnablement(tenantId: string): Array<{
  pluginId: string; enabled: boolean; settings: Record<string, unknown> | null; updatedAt: string;
}> {
  try {
    const rows = db
      .prepare("SELECT * FROM plugin_enablement WHERE tenant_id = ? ORDER BY plugin_id ASC")
      .all(tenantId) as EnablementRow[];
    return rows.map((r) => ({
      pluginId: r.plugin_id,
      enabled: r.enabled === 1,
      settings: r.settings ? (JSON.parse(r.settings) as Record<string, unknown>) : null,
      updatedAt: r.updated_at,
    }));
  } catch { return []; }
}

/** Hono middleware: refuses requests for a plugin that's disabled
 *  for the current tenant. Plugins wrap their routers with this. */
export function pluginGate(pluginId: string) {
  return async (c: Context, next: Next) => {
    let tenantId: string;
    try { tenantId = getTenantContext().tenantId; }
    catch { return next(); /* unauth path — let auth middleware handle it */ }

    if (!isPluginEnabled(tenantId, pluginId)) {
      return c.json({
        error: `Plugin "${pluginId}" is not enabled for this tenant`,
        code: "plugin-disabled",
        pluginId,
      }, 404);
    }
    await next();
  };
}
