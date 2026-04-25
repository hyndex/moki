/** Editor mounted inside the `/editor-frame.html` iframe.
 *
 *  Same lifecycle as the inline EditorHost (load Y.Doc from server, mount
 *  adapter, debounced auto-save) — but without StrictMode and with the
 *  full viewport for the editor canvas, so Univer / TipTap render
 *  correctly.
 *
 *  Save status flows BOTH ways so the page editor's built-in status
 *  pill stays in sync:
 *    - Local edits → debounced saveNow() → setStatus("saving") →
 *      adapter.setStatus → BlockEditor's status bar
 *    - On success: setStatus("saved") → adapter.setStatus
 *    - On error: setStatus("error") + setError(msg) → adapter.setError
 *  Univer adapters ignore setStatus/setError (they don't render their
 *  own status UI; the FrameEditor's outer banner covers them). */

import React, { useCallback, useEffect, useRef, useState } from "react";
import * as Y from "yjs";
import { fetchSnapshot, postSnapshot } from "@/editor-host/api";
import type { EditorKind } from "@/editor-host/types";
import { mountAdapter, type MountedAdapter, type SaveStatus } from "./mount";

// CSS bundles for the embedded editors.
import "@univerjs/design/lib/index.css";
import "@univerjs/ui/lib/index.css";
import "@univerjs/sheets-ui/lib/index.css";
import "@univerjs/docs-ui/lib/index.css";
import "@univerjs/slides-ui/lib/index.css";

// tippy.js base styles for the slash-menu popup. Kept here (rather than
// in BlockEditor) so it runs even before the lazy BlockEditor chunk
// resolves — avoids an unstyled flash on first / press.
import "tippy.js/dist/tippy.css";

interface Props {
  kind: EditorKind;
  id: string;
}

const SAVE_DEBOUNCE_MS = 1500;
const MAX_SAVE_RETRIES = 5;
const RETRY_BASE_MS = 800;

function postToParent(type: string, payload: Record<string, unknown> = {}): void {
  if (window.parent && window.parent !== window) {
    window.parent.postMessage({ type, ...payload }, window.location.origin);
  }
}

export function FrameEditor({ kind, id }: Props): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const docRef = useRef<Y.Doc | null>(null);
  const adapterRef = useRef<MountedAdapter | null>(null);
  const inFlightAbortRef = useRef<AbortController | null>(null);
  const dirtyRef = useRef(false);
  const [status, setStatus] = useState<SaveStatus>("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const doc = new Y.Doc();
    docRef.current = doc;
    setStatus("loading");

    (async () => {
      try {
        const yjs = await fetchSnapshot(kind, id, "yjs");
        if (yjs && yjs.bytes.byteLength > 0) Y.applyUpdate(doc, yjs.bytes);
      } catch {
        /* fresh doc */
      }
      let initialBytes: Uint8Array | undefined;
      try {
        const seed = await fetchSnapshot(kind, id, "export");
        if (seed && seed.bytes.byteLength > 0) initialBytes = seed.bytes;
      } catch { /* ignore */ }

      if (cancelled || !containerRef.current) return;

      // Wait for layout to settle so the container has measurable
      // dimensions before Univer queries `container.clientWidth/Height`.
      // Without this, Univer renders a 0×0 canvas and stays invisible.
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      if (cancelled || !containerRef.current) return;

      try {
        adapterRef.current = await mountAdapter(kind, containerRef.current, doc, initialBytes);
        // Sync the adapter's internal status with our state. The page
        // editor renders this; Univer ignores. (No-op if the adapter
        // didn't implement setStatus.)
        adapterRef.current.setStatus?.("ready");
        setStatus("ready");
        postToParent("editor-frame-ready", { kind, id });
      } catch (err) {
        setStatus("error");
        const msg = `mount failed: ${(err as Error).message}`;
        setErrorMsg(msg);
        adapterRef.current?.setError?.(msg);
        adapterRef.current?.setStatus?.("error");
        postToParent("editor-frame-status", { status: "error", error: (err as Error).message });
      }
    })();

    return () => {
      cancelled = true;
      inFlightAbortRef.current?.abort();
      adapterRef.current?.destroy().catch(() => undefined);
      adapterRef.current = null;
      doc.destroy();
      docRef.current = null;
    };
  }, [kind, id]);

  const saveNow = useCallback(async (): Promise<void> => {
    const doc = docRef.current;
    if (!doc) return;
    inFlightAbortRef.current?.abort();
    const ctrl = new AbortController();
    inFlightAbortRef.current = ctrl;
    let attempt = 0;
    let lastErr: Error | null = null;
    while (attempt < MAX_SAVE_RETRIES) {
      attempt++;
      const next: SaveStatus = attempt === 1 ? "saving" : "retrying";
      setStatus(next);
      adapterRef.current?.setStatus?.(next);
      postToParent("editor-frame-status", { status: next });
      try {
        const update = Y.encodeStateAsUpdate(doc);
        await postSnapshot(kind, id, "yjs", update, "application/octet-stream");
        if (adapterRef.current) {
          try {
            const exp = await adapterRef.current.exportSnapshot();
            if (exp.bytes.byteLength > 0) {
              await postSnapshot(kind, id, "export", exp.bytes, exp.contentType);
            }
          } catch { /* tolerate */ }
        }
        setStatus("saved");
        adapterRef.current?.setStatus?.("saved");
        adapterRef.current?.setError?.(null);
        setErrorMsg(null);
        dirtyRef.current = false;
        postToParent("editor-frame-status", { status: "saved" });
        inFlightAbortRef.current = null;
        return;
      } catch (err) {
        if (ctrl.signal.aborted) return;
        lastErr = err as Error;
        if (attempt < MAX_SAVE_RETRIES) {
          await new Promise((r) => setTimeout(r, Math.min(RETRY_BASE_MS * Math.pow(2, attempt - 1), 8000)));
          if (ctrl.signal.aborted) return;
        }
      }
    }
    setStatus("error");
    const msg = `save failed: ${lastErr?.message ?? "unknown"}`;
    setErrorMsg(msg);
    adapterRef.current?.setStatus?.("error");
    adapterRef.current?.setError?.(msg);
    postToParent("editor-frame-status", { status: "error", error: lastErr?.message });
    inFlightAbortRef.current = null;
  }, [kind, id]);

  useEffect(() => {
    const doc = docRef.current;
    if (!doc) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const handler = () => {
      dirtyRef.current = true;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        void saveNow();
      }, SAVE_DEBOUNCE_MS);
    };
    doc.on("update", handler);
    return () => {
      if (timer) clearTimeout(timer);
      doc.off("update", handler);
    };
  }, [saveNow]);

  // Listen for parent commands.
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      if (typeof e.data !== "object" || e.data === null) return;
      const msg = e.data as { type?: string };
      if (msg.type === "editor-frame-save-now") void saveNow();
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [saveNow]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", width: "100%" }}>
      <div
        ref={containerRef}
        // Explicit absolute fill — flex resolution can be deferred which
        // leaves Univer measuring 0×0 at first paint. Keep it absolute and
        // give the parent `position: relative` so it expands to fit.
        style={{
          flex: 1,
          minHeight: 0,
          minWidth: 0,
          position: "relative",
          width: "100%",
          height: "100%",
        }}
      />
      {errorMsg && (
        <div role="alert" style={{ padding: 8, background: "#fee", color: "#900", fontSize: 13, borderTop: "1px solid #f3c2c2" }}>
          {errorMsg}
        </div>
      )}
      <div data-status={status} hidden aria-hidden="true" />
    </div>
  );
}
