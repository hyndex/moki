import type { ServerWebSocket } from "bun";
import { getTenantContext } from "../tenancy/context";

/** Realtime broadcast hub.
 *
 *  Every mutation publishes a message to sockets whose `tenantId` matches.
 *  The frontend invalidates its cache for the resource.
 *
 *  Sockets tag themselves with a tenantId on connect (see main.ts) — we
 *  resolve it the same way the HTTP middleware does, using the Host header
 *  and session token from the upgrade request.
 */

export interface WsMessage {
  type: "resource.changed" | "audit.appended" | "hello";
  resource?: string;
  id?: string;
  op?: "create" | "update" | "delete";
  actor?: string;
  tenantId?: string;
  at: string;
}

export interface SocketData {
  userId?: string;
  tenantId?: string | null;
}

const sockets = new Set<ServerWebSocket<SocketData>>();

export function registerSocket(ws: ServerWebSocket<SocketData>): void {
  sockets.add(ws);
  ws.send(
    JSON.stringify({
      type: "hello",
      tenantId: ws.data?.tenantId ?? undefined,
      at: new Date().toISOString(),
    } satisfies WsMessage),
  );
}

export function unregisterSocket(ws: ServerWebSocket<SocketData>): void {
  sockets.delete(ws);
}

/** Broadcast to sockets matching the predicate. Defaults to "same tenant as
 *  the current AsyncLocalStorage context" (the request that triggered the
 *  mutation). Sockets with no tenantId (legacy / pre-multisite) receive
 *  everything when running in single-site mode. */
export function broadcast(
  msg: WsMessage,
  predicate?: (ws: ServerWebSocket<SocketData>) => boolean,
): void {
  const ctx = getTenantContext();
  const tenantId = msg.tenantId ?? ctx?.tenantId ?? null;
  const enrich: WsMessage = { ...msg, tenantId: tenantId ?? undefined };
  const payload = JSON.stringify(enrich);
  const matches =
    predicate ??
    ((ws: ServerWebSocket<SocketData>): boolean => {
      const socketTenant = ws.data?.tenantId ?? null;
      if (!tenantId) return true;
      if (!socketTenant) return true; // legacy client, include
      return socketTenant === tenantId;
    });
  for (const ws of sockets) {
    if (!matches(ws)) continue;
    try {
      ws.send(payload);
    } catch (err) {
      console.error("[ws] send failed", err);
    }
  }
}

export function broadcastResourceChange(
  resource: string,
  id: string,
  op: "create" | "update" | "delete",
  actor?: string,
): void {
  broadcast({
    type: "resource.changed",
    resource,
    id,
    op,
    actor,
    at: new Date().toISOString(),
  });
}

export function broadcastAudit(actor: string, action: string, resource: string): void {
  broadcast({
    type: "audit.appended",
    resource,
    actor,
    op: action.endsWith(".created")
      ? "create"
      : action.endsWith(".updated")
        ? "update"
        : action.endsWith(".deleted")
          ? "delete"
          : undefined,
    at: new Date().toISOString(),
  });
}
