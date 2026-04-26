/** WebSocket-upgrade routing through the plugin contract.
 *
 *  Plugins declare ws[] handlers — each with a path pattern + open/
 *  message/close callbacks. The shell composes them into a single
 *  upgrade router that main.ts wires into Bun.serve.
 *
 *  Path matching is param-style: "yjs/:room" → `params.room`. */

import type { ServerWebSocket } from "bun";
import type { HostPlugin, PluginWsHandler } from "./plugin-contract";

interface CompiledRoute {
  pluginId: string;
  pattern: RegExp;
  paramNames: string[];
  handler: PluginWsHandler;
}

const ROUTES: CompiledRoute[] = [];

function compilePath(p: string): { pattern: RegExp; paramNames: string[] } {
  const paramNames: string[] = [];
  const re = "^/api/ws/" + p.replace(/^\//, "").replace(/:(\w+)/g, (_m, name: string) => {
    paramNames.push(name);
    return "([^/]+)";
  }) + "/?$";
  return { pattern: new RegExp(re), paramNames };
}

/** Register every plugin's ws[] handlers. Idempotent — clears + repopulates. */
export function registerPluginWsRoutes(plugins: HostPlugin[]): void {
  ROUTES.length = 0;
  for (const p of plugins) {
    for (const h of p.ws ?? []) {
      const { pattern, paramNames } = compilePath(h.path);
      ROUTES.push({ pluginId: p.id, pattern, paramNames, handler: h });
    }
  }
}

/** Match an incoming /api/ws/* request to a plugin's ws handler. */
export function matchWsRoute(url: URL): null | {
  pluginId: string;
  handler: PluginWsHandler;
  params: Record<string, string>;
} {
  for (const r of ROUTES) {
    const m = r.pattern.exec(url.pathname);
    if (!m) continue;
    const params: Record<string, string> = {};
    r.paramNames.forEach((n, i) => { params[n] = decodeURIComponent(m[i + 1] ?? ""); });
    return { pluginId: r.pluginId, handler: r.handler, params };
  }
  return null;
}

/** All registered ws routes — for /api/_plugins to surface. */
export function listWsRoutes(): Array<{ pluginId: string; path: string }> {
  return ROUTES.map((r) => ({
    pluginId: r.pluginId,
    path: r.pattern.source.replace(/^\^\/api\/ws\//, "/api/ws/").replace(/\\\?\$$/, ""),
  }));
}
