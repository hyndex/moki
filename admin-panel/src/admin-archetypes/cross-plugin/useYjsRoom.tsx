/** Cross-plugin hook for collaborative editing rooms (Slides, Whiteboard,
 *  Spreadsheet, Editor Canvas archetypes). Pages that want shared state
 *  declare a `room` (resource + record id) and the adapter creates a Y.Doc
 *  bound to that room. Plugins like editor-core and slides-core install a
 *  real adapter; in their absence the noop returns a local-only doc proxy
 *  so the page still renders.
 *
 *  Why an adapter and not a direct Yjs import: keeping `yjs` /
 *  `y-websocket` out of the archetype runtime means smaller bundles for
 *  any dashboard / list / hub page that doesn't need collab. The adapter
 *  is wired by whichever plugin owns the editing surface. */

import * as React from "react";

export interface YjsRoomKey {
  /** Logical kind ("slides", "whiteboard", "spreadsheet", "page", …). */
  kind: string;
  /** Backend record id the room is bound to. */
  id: string;
}

export type YjsRoomStatus = "connecting" | "connected" | "disconnected" | "unavailable";

export interface YjsPeerUser {
  id: string;
  name: string;
  color: string;
}

export interface YjsPeer {
  clientId: number;
  user: YjsPeerUser;
}

/** Minimal handle the archetype layer can use without importing Yjs.
 *  `doc` is `unknown` because the concrete type is `Y.Doc` only when a
 *  Yjs adapter is installed — the noop returns null. Pages that need to
 *  bind editors cast the doc to `Y.Doc` after the type guard. */
export interface YjsRoomHandle {
  /** The shared document, or null when no collaboration is available. */
  doc: unknown | null;
  status: YjsRoomStatus;
  peers: readonly YjsPeer[];
  /** Disconnects the underlying provider — call from the unmount cleanup
   *  of any consuming component. Idempotent. */
  destroy: () => void;
}

export interface YjsAdapter {
  /** Create a room. Adapters typically open a WebSocket and return a
   *  Y.Doc + an awareness state. Noop returns null. */
  open: (room: YjsRoomKey, onChange: (handle: YjsRoomHandle) => void) => YjsRoomHandle;
}

const NOOP_ADAPTER: YjsAdapter = {
  open: () => ({
    doc: null,
    status: "unavailable",
    peers: [],
    destroy: () => {
      /* nothing to disconnect */
    },
  }),
};

const YjsContext = React.createContext<YjsAdapter>(NOOP_ADAPTER);

export interface YjsProviderProps {
  adapter: YjsAdapter;
  children: React.ReactNode;
}

export function YjsProvider({ adapter, children }: YjsProviderProps) {
  return <YjsContext.Provider value={adapter}>{children}</YjsContext.Provider>;
}

/** Open a Yjs room. Reopens automatically when the room key changes. The
 *  handle's `destroy` runs on unmount AND on key change. */
export function useYjsRoom(room: YjsRoomKey | null): YjsRoomHandle {
  const adapter = React.useContext(YjsContext);
  const [handle, setHandle] = React.useState<YjsRoomHandle>(() => ({
    doc: null,
    status: room ? "connecting" : "unavailable",
    peers: [],
    destroy: () => undefined,
  }));

  React.useEffect(() => {
    if (!room) {
      setHandle({ doc: null, status: "unavailable", peers: [], destroy: () => undefined });
      return;
    }
    let alive = true;
    const opened = adapter.open(room, (next) => {
      if (alive) setHandle(next);
    });
    setHandle(opened);
    return () => {
      alive = false;
      opened.destroy();
    };
  }, [adapter, room?.kind, room?.id]);

  return handle;
}

/** Quick boolean for "is real collab available". Pages can use this to
 *  swap presence avatars in/out without inspecting the handle. */
export function useYjsAvailable(): boolean {
  const adapter = React.useContext(YjsContext);
  return adapter !== NOOP_ADAPTER;
}
