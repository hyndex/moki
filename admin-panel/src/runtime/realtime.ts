import type { ResourceClient } from "./resourceClient";
import type { Emitter } from "@/lib/emitter";
import type { RuntimeEvents } from "./context";
import { authStore } from "./auth";

/** Subscribe the runtime to backend WebSocket events. Every `resource.changed`
 *  frame invalidates the matching query cache entries, so any open view
 *  re-fetches. Reconnects with exponential backoff. */
export function startRealtime(
  resources: ResourceClient,
  bus: Emitter<RuntimeEvents>,
): () => void {
  let ws: WebSocket | null = null;
  let closed = false;
  let backoff = 1000;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let intentionallyClosing = false;

  const clearReconnect = () => {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = null;
  };

  const socketUrl = (): string | null => {
    if (!authStore.token) return null;
    const env = (import.meta as { env?: { VITE_API_BASE?: string } }).env ?? {};
    const base = env.VITE_API_BASE?.trim() || window.location.origin;
    const url = new URL("/api/ws", base);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    url.searchParams.set("token", authStore.token);
    return url.toString();
  };

  const connect = () => {
    if (closed) return;
    clearReconnect();
    if (ws) return;
    const url = socketUrl();
    if (!url) return;
    try {
      ws = new WebSocket(url);
    } catch (err) {
      console.warn("[realtime] failed to open socket", err);
      scheduleReconnect();
      return;
    }

    ws.addEventListener("open", () => {
      backoff = 1000;
      console.info("[realtime] connected");
    });
    ws.addEventListener("message", (evt) => {
      try {
        const msg = JSON.parse(evt.data);
        if (msg.type === "resource.changed" && msg.resource) {
          resources.cache.invalidateResource(msg.resource);
          bus.emit("realtime:resource-changed", {
            resource: msg.resource,
            id: msg.id,
            op: msg.op,
            actor: msg.actor,
            at: msg.at,
          });
        }
      } catch {
        /* ignore malformed frames */
      }
    });
    ws.addEventListener("close", () => {
      const wasIntentional = intentionallyClosing;
      intentionallyClosing = false;
      ws = null;
      if (!wasIntentional) scheduleReconnect();
    });
    ws.addEventListener("error", () => {
      ws?.close();
    });
  };

  const scheduleReconnect = () => {
    if (closed) return;
    clearReconnect();
    if (!authStore.token) return;
    const delay = Math.min(30_000, backoff);
    backoff = Math.min(30_000, backoff * 2);
    reconnectTimer = setTimeout(connect, delay);
  };

  const scheduleConnect = () => {
    if (closed || !authStore.token) return;
    clearReconnect();
    reconnectTimer = setTimeout(connect, 150);
  };

  const resetSocket = () => {
    clearReconnect();
    backoff = 1000;
    const current = ws;
    ws = null;
    if (current) {
      intentionallyClosing = true;
      current.close();
    }
  };

  const offAuth = authStore.emitter.on("change", ({ token }) => {
    resetSocket();
    if (token) scheduleConnect();
  });
  const offTenant = authStore.emitter.on("tenant", () => {
    if (!authStore.token) return;
    resetSocket();
    scheduleConnect();
  });

  scheduleConnect();

  return () => {
    closed = true;
    offAuth();
    offTenant();
    clearReconnect();
    ws?.close();
  };
}
