/** Real-time collaboration provider — connects an editor's Y.Doc to
 *  the backend Yjs WebSocket sync server.
 *
 *  Endpoint shape (matches `/api/yjs/<resource>/<recordId>`):
 *      ws://host/api/yjs/<resource>/<recordId>?token=<session-token>
 *
 *  The standard `y-websocket` `WebsocketProvider` builds URLs as
 *  `${serverUrl}/${roomName}` so we set `serverUrl = "/api/yjs"` and
 *  `roomName = "<resource>/<recordId>"`. The `params` map gets
 *  appended as a query string — `token=<…>` is how we authenticate
 *  the upgrade since browsers can't set Authorization headers on
 *  WebSocket constructors.
 *
 *  Awareness state: every client publishes its own `user` field —
 *  `{ name, email, color }` — so the OTHER clients can paint cursors
 *  with the right name + color via `@tiptap/extension-collaboration-
 *  cursor`. A single ConnectionInfo describes:
 *    - status      "connecting" | "connected" | "disconnected"
 *    - peers       array of { clientId, user, anchor? } for every
 *                  remote awareness state (excluding self)
 *  We expose this via a tiny event emitter so React components can
 *  subscribe via `useSyncExternalStore`. */
import { WebsocketProvider } from "y-websocket";
import { authStore } from "@/runtime/auth";
/** Stable per-user color so OTHER tabs see the same color even before
 *  the server's awareness states arrive. */
const PALETTE = [
    "#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6",
    "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#a855f7",
];
export function colorForUser(userId) {
    let h = 0;
    for (let i = 0; i < userId.length; i++) {
        h = (h * 31 + userId.charCodeAt(i)) >>> 0;
    }
    return PALETTE[h % PALETTE.length];
}
/** Construct the WebSocket URL the y-websocket client will connect to.
 *  Uses same-origin so it picks up cookies and the existing Vite proxy. */
function wsBase() {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${proto}//${window.location.host}/api/yjs`;
}
export function connectCollab({ doc, kind, id }) {
    const token = authStore.token ?? "";
    const user = authStore.user;
    const userId = user?.id ?? "anonymous";
    const userName = user?.name ?? user?.email ?? "User";
    const userEmail = user?.email ?? "";
    const color = colorForUser(userId);
    const provider = new WebsocketProvider(wsBase(), `${kind}/${id}`, doc, {
        params: { token },
        // Disable broadcast-channel cross-tab sync — every tab connects
        // to the server independently which is the correct authoritative
        // path. (Cross-tab BC is a y-websocket optimization that bypasses
        // the server; here it would skip the ACL re-check.)
        disableBc: true,
        connect: true,
    });
    // Publish our identity into awareness so peers' CollaborationCursor
    // sees who we are.
    provider.awareness.setLocalStateField("user", {
        id: userId,
        name: userName,
        email: userEmail,
        color,
    });
    /* ---- Connection info plumbing ---- */
    let info = { status: "connecting", peers: [] };
    const listeners = new Set();
    const fan = () => listeners.forEach((l) => l(info));
    const computePeers = () => {
        const states = provider.awareness.getStates();
        const peers = [];
        states.forEach((state, clientId) => {
            if (clientId === provider.awareness.clientID)
                return; // skip self
            const u = state.user;
            if (!u)
                return;
            peers.push({
                clientId,
                user: u,
                anchor: state.anchor,
                head: state.head,
            });
        });
        return peers;
    };
    const onAwarenessChange = () => {
        info = { ...info, peers: computePeers() };
        fan();
    };
    provider.awareness.on("change", onAwarenessChange);
    const onStatus = (e) => {
        info = { ...info, status: e.status };
        fan();
    };
    provider.on("status", onStatus);
    return {
        provider,
        subscribe(cb) {
            listeners.add(cb);
            // Push current snapshot synchronously so subscribers don't see
            // a flash of stale state.
            cb(info);
            return () => listeners.delete(cb);
        },
        getInfo: () => info,
        destroy() {
            try {
                provider.awareness.off("change", onAwarenessChange);
            }
            catch { /* ignore */ }
            try {
                provider.off("status", onStatus);
            }
            catch { /* ignore */ }
            try {
                provider.awareness.setLocalState(null);
            }
            catch { /* ignore */ }
            try {
                provider.disconnect();
            }
            catch { /* ignore */ }
            try {
                provider.destroy();
            }
            catch { /* ignore */ }
            listeners.clear();
        },
    };
}
