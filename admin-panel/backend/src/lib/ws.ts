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
      // Fail-closed: refuse to broadcast unless BOTH the message and the
      // socket have a tenant, and they match. A missing message tenant
      // (broadcast outside any request context) or a missing socket tenant
      // (connection that never completed authentication) is treated as
      // cross-tenant risk and rejected. The only exception is socket hello
      // messages (type=hello), which are addressed to a single socket
      // directly (not via broadcast).
      if (!tenantId || !socketTenant) return false;
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

/** Close every socket attached to a given tenant. Used when a tenant is
 *  deleted or suspended so clients drop their stale realtime subscription. */
export function closeSocketsForTenant(tenantId: string, code = 4001, reason = "tenant_terminated"): number {
  let closed = 0;
  for (const ws of sockets) {
    if (ws.data?.tenantId === tenantId) {
      try { ws.close(code, reason); closed++; } catch { /* best effort */ }
    }
  }
  return closed;
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
