/** Plugin host SDK.
 *
 *  Plugins import platform services from `@gutu-host/*`. The barrel
 *  re-exports the small, stable surface; sub-paths (e.g.
 *  `@gutu-host/leader`, `@gutu-host/plugin-contract`) expose
 *  capability modules. The SDK is intentionally tiny — anything
 *  bigger should be its own plugin or contributed primitive.
 *
 *  Quick reference:
 *    - core platform:     db, nowIso, uuid, token, recordAudit, Hono
 *    - request-scope:     getTenantContext, requireAuth, currentUser
 *    - cross-plugin:      pluginContext, registries (via /plugin-contract)
 *    - leader election:   withLeadership, acquireOnce (via /leader)
 *    - tenant gating:     pluginGate, isPluginEnabled (via /tenant-enablement)
 *    - WS routing:        registerPluginWsRoutes (via /ws-router)
 *    - schema lifecycle:  HostPlugin contract (via /plugin-contract) */

export { db, nowIso } from "../db";
export { uuid, token } from "../lib/id";
export { recordAudit } from "../lib/audit";
export { getTenantContext } from "../tenancy/context";
export { requireAuth, currentUser } from "../middleware/auth";
export { Hono } from "hono";
export type { Context } from "hono";

// Contract types — re-exported here so plugins can import everything
// from a single `@gutu-host` for simple cases.
export type {
  HostPlugin,
  PluginManifest,
  PluginContext,
  PluginDep,
  PluginRoute,
  PluginWsHandler,
  Permission,
} from "./plugin-contract";
export { pluginContext, satisfies } from "./plugin-contract";

// Leader-election helpers.
export { withLeadership, acquireOnce, listLeases } from "./leader";

// Tenant-gating middleware.
export { pluginGate, isPluginEnabled, setPluginEnabled, listPluginEnablement } from "./tenant-enablement";
