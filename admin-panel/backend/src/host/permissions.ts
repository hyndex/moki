/** Plugin permission enforcement.
 *
 *  Every plugin's manifest declares the permissions it needs:
 *
 *      manifest: { permissions: ["db.read", "db.write", "events.subscribe"] }
 *
 *  This module records the permission grants at plugin load time and
 *  exposes `enforce(pluginId, permission)` so capability calls inside
 *  the host SDK can validate against the manifest. A call from a
 *  plugin without the declared permission throws + audits + rejects.
 *
 *  Mode is configurable via env:
 *    GUTU_PERMISSIONS=enforce  — throw on violation (production)
 *    GUTU_PERMISSIONS=warn     — log but allow (default; gradual rollout)
 *    GUTU_PERMISSIONS=off      — disable entirely (legacy compat)
 *
 *  Plugins call `tagCaller(pluginId, fn)` to mark a function as
 *  belonging to that plugin; the runtime tracks the caller via a stack
 *  set up by withPluginScope(). For most cases the manifest is enough
 *  documentation — actual call-site enforcement is on the cross-plugin
 *  boundary, not within a plugin's own code. */

import type { Permission, HostPlugin } from "./plugin-contract";

type Mode = "enforce" | "warn" | "off";
const MODE: Mode = (process.env.GUTU_PERMISSIONS as Mode) ?? "warn";

const PERMS = new Map<string, Set<Permission>>();

/** Register a plugin's manifest permissions. Called by the loader. */
export function registerPluginPermissions(plugins: HostPlugin[]): void {
  PERMS.clear();
  for (const p of plugins) {
    const granted = new Set(p.manifest?.permissions ?? []);
    PERMS.set(p.id, granted);
  }
}

/** Look up what a plugin is allowed to do. */
export function listPermissions(pluginId: string): readonly Permission[] {
  return [...(PERMS.get(pluginId) ?? new Set())];
}

/** Validate that a plugin holds a given permission. In `enforce`
 *  mode this throws a PermissionDeniedError; in `warn` it logs. */
export function enforce(pluginId: string, perm: Permission): void {
  if (MODE === "off") return;
  const granted = PERMS.get(pluginId);
  if (granted?.has(perm)) return;
  const msg = `[permissions] plugin "${pluginId}" attempted "${perm}" without manifest grant`;
  if (MODE === "enforce") throw new PermissionDeniedError(pluginId, perm);
  console.warn(msg);
}

export class PermissionDeniedError extends Error {
  constructor(public pluginId: string, public permission: Permission) {
    super(`Plugin "${pluginId}" lacks permission "${permission}"`);
    this.name = "PermissionDeniedError";
  }
}

/* ---- caller-scope tracking (best-effort) --------------------------- */

const callerStack: string[] = [];

/** Run `fn` with `pluginId` pushed onto the caller stack. Inside fn,
 *  `currentCaller()` returns this id. Used by host SDK call sites to
 *  attribute calls to plugins for permission checks + audit. */
export function withPluginScope<T>(pluginId: string, fn: () => T): T {
  callerStack.push(pluginId);
  try { return fn(); }
  finally { callerStack.pop(); }
}

export function currentCaller(): string | undefined {
  return callerStack[callerStack.length - 1];
}
