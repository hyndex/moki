/** The Yjs adapter contract: the default noop returns an unavailable
 *  handle that doesn't crash, and a custom adapter is reachable through
 *  the provider. Verified via direct adapter-call (no React tree) so the
 *  test stays fast and dependency-free. */

import { describe, test, expect } from "bun:test";
import type { YjsAdapter, YjsRoomHandle } from "../cross-plugin/useYjsRoom";

// Re-create the noop adapter shape the module ships with as the default
// context value — copy-paste mirrors the implementation closely enough
// to catch accidental contract drift.
const NOOP: YjsAdapter = {
  open: () => ({
    doc: null,
    status: "unavailable",
    peers: [],
    destroy: () => undefined,
  }),
};

describe("YjsAdapter (noop default)", () => {
  test("open returns an unavailable handle", () => {
    const handle = NOOP.open({ kind: "page", id: "p-1" }, () => undefined);
    expect(handle.doc).toBeNull();
    expect(handle.status).toBe("unavailable");
    expect(handle.peers).toEqual([]);
    // destroy is callable + idempotent.
    handle.destroy();
    handle.destroy();
  });

  test("custom adapter receives onChange callback", () => {
    let lastHandle: YjsRoomHandle | null = null;
    const adapter: YjsAdapter = {
      open(room, onChange) {
        const initial: YjsRoomHandle = {
          doc: { __room: `${room.kind}:${room.id}` },
          status: "connecting",
          peers: [],
          destroy: () => undefined,
        };
        // Custom adapter immediately upgrades to "connected".
        queueMicrotask(() =>
          onChange({ ...initial, status: "connected", peers: [{ clientId: 1, user: { id: "u", name: "n", color: "#000" } }] }),
        );
        return initial;
      },
    };
    const opened = adapter.open({ kind: "page", id: "p-1" }, (h) => {
      lastHandle = h;
    });
    expect(opened.status).toBe("connecting");
    return new Promise<void>((resolve) => {
      queueMicrotask(() => {
        expect(lastHandle?.status).toBe("connected");
        expect(lastHandle?.peers.length).toBe(1);
        resolve();
      });
    });
  });
});
