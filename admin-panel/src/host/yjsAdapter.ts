/** Real Yjs adapter for the archetype `useYjsRoom` hook. Bridges the
 *  archetype layer to the framework's existing collab provider so any
 *  archetype page (Slides, Whiteboard, Spreadsheet, Editor Canvas) can
 *  share docs without reaching into the editor-frame internals.
 *
 *  Heavy imports (`yjs`, `y-websocket`) are dynamic so dashboards that
 *  never mount a collab surface don't pay for them on first paint. */

import type {
  YjsAdapter,
  YjsPeer,
  YjsRoomHandle,
  YjsRoomKey,
} from "@/admin-archetypes";

interface DynamicYjs {
  Doc: new () => unknown;
}

interface DynamicCollab {
  connectCollab: (args: {
    doc: unknown;
    kind: string;
    id: string;
  }) => {
    provider: { destroy: () => void };
    subscribe: (cb: (info: {
      status: "connecting" | "connected" | "disconnected";
      peers: Array<{ clientId: number; user: { id?: string; name: string; color: string } }>;
    }) => void) => () => void;
    getInfo: () => {
      status: "connecting" | "connected" | "disconnected";
      peers: Array<{ clientId: number; user: { id?: string; name: string; color: string } }>;
    };
    destroy: () => void;
  };
}

/** Adapter factory. Returns a `YjsAdapter` that lazily imports `yjs` and
 *  `y-websocket` on first room open. SSR-safe: when called outside a
 *  browser context the noop fallback keeps the page rendering. */
export function createBrowserYjsAdapter(): YjsAdapter {
  if (typeof window === "undefined") {
    return {
      open: () => ({
        doc: null,
        status: "unavailable",
        peers: [],
        destroy: () => undefined,
      }),
    };
  }

  return {
    open(room: YjsRoomKey, onChange: (h: YjsRoomHandle) => void): YjsRoomHandle {
      let destroyed = false;
      let liveHandle: YjsRoomHandle = {
        doc: null,
        status: "connecting",
        peers: [],
        destroy: () => {
          destroyed = true;
        },
      };

      // Kick off the dynamic import. The placeholder handle returned from
      // `open()` updates via `onChange` once the modules resolve.
      Promise.all([
        import("yjs") as unknown as Promise<DynamicYjs>,
        import("@/editor-frame/collab") as unknown as Promise<DynamicCollab>,
      ])
        .then(([Y, collab]) => {
          if (destroyed) return;
          const doc = new Y.Doc();
          const handle = collab.connectCollab({ doc, kind: room.kind, id: room.id });
          const toPeers = (
            raw: Array<{ clientId: number; user: { id?: string; name: string; color: string } }>,
          ): YjsPeer[] =>
            raw.map((p) => ({
              clientId: p.clientId,
              user: { id: p.user.id ?? "", name: p.user.name, color: p.user.color },
            }));
          const update = (info: {
            status: "connecting" | "connected" | "disconnected";
            peers: Array<{ clientId: number; user: { id?: string; name: string; color: string } }>;
          }) => {
            liveHandle = {
              doc,
              status: info.status,
              peers: toPeers(info.peers),
              destroy: () => {
                destroyed = true;
                handle.destroy();
              },
            };
            onChange(liveHandle);
          };
          update(handle.getInfo());
          const off = handle.subscribe(update);
          // Replace the placeholder destroy with one that also detaches
          // the subscription.
          liveHandle = {
            ...liveHandle,
            doc,
            destroy: () => {
              destroyed = true;
              off();
              handle.destroy();
            },
          };
          onChange(liveHandle);
        })
        .catch(() => {
          // Module not installed (e.g., editor-frame stripped from the
          // bundle) — fall back to "unavailable" so the page renders the
          // local-only path.
          if (destroyed) return;
          liveHandle = {
            doc: null,
            status: "unavailable",
            peers: [],
            destroy: () => undefined,
          };
          onChange(liveHandle);
        });

      return liveHandle;
    },
  };
}
