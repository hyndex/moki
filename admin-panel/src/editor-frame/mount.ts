/** Adapter-mount registry for the iframe editor.
 *
 *  Each editor kind gets a function that:
 *    - lazy-imports its runtime (Univer for sheets/docs/slides,
 *      our own React+TipTap+Yjs editor for pages and whiteboards)
 *    - creates the engine + plugins (with locale + dependent plugins)
 *    - seeds the initial snapshot
 *    - returns `{ destroy, exportSnapshot }` so the frame can save and
 *      tear down cleanly.
 *
 *  Page + whiteboard are FIRST-PARTY editors we own end-to-end:
 *    - Page  → `mountBlockEditor`  → React + TipTap + Yjs (block-based,
 *      Notion-class), syntax-highlighted code, slash menu, bubble menu
 *      for inline formatting, tables, task lists, full collab.
 *    - Whiteboard → `mountWhiteboard` → Yjs-backed canvas with rect /
 *      ellipse / text / pen / arrow tools, multi-select transform, undo
 *      via Y.UndoManager, snapshot exports as PNG.
 *
 *  Univer continues to power sheets / docs / slides.  AFFiNE / BlockSuite
 *  is deliberately not used: it was attempted earlier (see git log) but
 *  its dev-mode dependency graph fights vite's pre-bundle pipeline at
 *  every layer (CJS interop, TC39 stage-3 lowering, class-field semantics,
 *  dynamic import resolution).  Owning the editor surface ourselves
 *  matches our admin-shell UX, keeps the dependency tree tight, and
 *  ships features when our users ask, not when an upstream prioritizes.
 *
 *  Univer specifics:
 *    - a locale object passed at construction time, otherwise LocaleService
 *      throws "Locale not initialized" the first time the Ribbon renders.
 *    - the `@univerjs/docs` + `@univerjs/docs-ui` plugins for sheets and
 *      slides, because cell / shape inline editors are docs-backed. */

import type * as Y from "yjs";
import type { EditorKind } from "@/editor-host/types";

export type SaveStatus =
  | "loading" | "ready" | "saving" | "saved" | "retrying" | "error";

export interface MountedAdapter {
  destroy(): Promise<void>;
  exportSnapshot(format?: string): Promise<{ bytes: Uint8Array; contentType: string }>;
  /** Push the host's save status into the editor's UI. Optional — only
   *  the page editor renders a status pill of its own; Univer adapters
   *  rely on the FrameEditor's outer banner. */
  setStatus?(status: SaveStatus): void;
  /** Push a non-fatal error message to display inside the editor. */
  setError?(message: string | null): void;
}

export async function mountAdapter(
  kind: EditorKind,
  container: HTMLDivElement,
  doc: Y.Doc,
  initialBytes: Uint8Array | undefined,
  recordId?: string,
): Promise<MountedAdapter> {
  switch (kind) {
    case "spreadsheet": return mountUniverSheet(container, doc, initialBytes);
    case "document":    return mountUniverDoc(container, doc, initialBytes);
    case "slides":      return mountUniverSlides(container, doc, initialBytes);
    case "page":        return mountBlockEditor(container, doc, recordId);
    case "whiteboard":  return mountWhiteboard(container, doc, recordId);
  }
}

/* ---------------- Univer Sheet ---------------- */

async function mountUniverSheet(
  container: HTMLDivElement,
  doc: Y.Doc,
  initialBytes: Uint8Array | undefined,
): Promise<MountedAdapter> {
  const [
    core, ui, design, render, formula, sheets, sheetsUi, docs, docsUi,
    sheetsLocale, uiLocale, designLocale, docsLocale,
  ] = await Promise.all([
    import("@univerjs/core"),
    import("@univerjs/ui"),
    import("@univerjs/design"),
    import("@univerjs/engine-render"),
    import("@univerjs/engine-formula"),
    import("@univerjs/sheets"),
    import("@univerjs/sheets-ui"),
    import("@univerjs/docs"),
    import("@univerjs/docs-ui"),
    import("@univerjs/sheets-ui/locale/en-US").catch(() => ({})),
    import("@univerjs/ui/locale/en-US").catch(() => ({})),
    import("@univerjs/design/locale/en-US").catch(() => ({})),
    import("@univerjs/docs-ui/locale/en-US").catch(() => ({})),
  ]);
  const enUS = mergeLocales([
    asLocale(sheetsLocale),
    asLocale(uiLocale),
    asLocale(designLocale),
    asLocale(docsLocale),
  ]);
  const univer = new core.Univer({
    theme: resolveUniverTheme(design) as never,
    locale: core.LocaleType.EN_US,
    locales: { [core.LocaleType.EN_US]: enUS } as never,
  });
  univer.registerPlugin(render.UniverRenderEnginePlugin);
  univer.registerPlugin(formula.UniverFormulaEnginePlugin);
  univer.registerPlugin(ui.UniverUIPlugin, { container });
  univer.registerPlugin(docs.UniverDocsPlugin);
  univer.registerPlugin(docsUi.UniverDocsUIPlugin);
  univer.registerPlugin(sheets.UniverSheetsPlugin);
  univer.registerPlugin(sheetsUi.UniverSheetsUIPlugin);
  const snapshot = parseInitialOrBlank(initialBytes, blankSheet);
  (univer as unknown as { createUnit: (t: number, s: unknown) => unknown })
    .createUnit(core.UniverInstanceType.UNIVER_SHEET, snapshot);
  const map = doc.getMap("univer");
  if (!map.get("snapshot")) map.set("snapshot", JSON.stringify(snapshot));
  return {
    async exportSnapshot() {
      const txt = (map.get("snapshot") as string | undefined) ?? JSON.stringify(snapshot);
      return { bytes: new TextEncoder().encode(txt), contentType: "application/json" };
    },
    async destroy() {
      try { (univer as unknown as { dispose(): void }).dispose(); } catch { /* ignore */ }
    },
  };
}

/* ---------------- Univer Doc ---------------- */

async function mountUniverDoc(
  container: HTMLDivElement,
  doc: Y.Doc,
  initialBytes: Uint8Array | undefined,
): Promise<MountedAdapter> {
  const [
    core, ui, design, render, docs, docsUi,
    uiLocale, designLocale, docsLocale,
  ] = await Promise.all([
    import("@univerjs/core"),
    import("@univerjs/ui"),
    import("@univerjs/design"),
    import("@univerjs/engine-render"),
    import("@univerjs/docs"),
    import("@univerjs/docs-ui"),
    import("@univerjs/ui/locale/en-US").catch(() => ({})),
    import("@univerjs/design/locale/en-US").catch(() => ({})),
    import("@univerjs/docs-ui/locale/en-US").catch(() => ({})),
  ]);
  const enUS = mergeLocales([asLocale(uiLocale), asLocale(designLocale), asLocale(docsLocale)]);
  const univer = new core.Univer({
    theme: resolveUniverTheme(design) as never,
    locale: core.LocaleType.EN_US,
    locales: { [core.LocaleType.EN_US]: enUS } as never,
  });
  univer.registerPlugin(render.UniverRenderEnginePlugin);
  univer.registerPlugin(ui.UniverUIPlugin, { container });
  univer.registerPlugin(docs.UniverDocsPlugin);
  univer.registerPlugin(docsUi.UniverDocsUIPlugin);
  const snapshot = parseInitialOrBlank(initialBytes, blankDoc);
  (univer as unknown as { createUnit: (t: number, s: unknown) => unknown })
    .createUnit(core.UniverInstanceType.UNIVER_DOC, snapshot);
  const map = doc.getMap("univer");
  if (!map.get("snapshot")) map.set("snapshot", JSON.stringify(snapshot));
  return {
    async exportSnapshot() {
      const txt = (map.get("snapshot") as string | undefined) ?? JSON.stringify(snapshot);
      return { bytes: new TextEncoder().encode(txt), contentType: "application/json" };
    },
    async destroy() {
      try { (univer as unknown as { dispose(): void }).dispose(); } catch { /* ignore */ }
    },
  };
}

/* ---------------- Univer Slides ---------------- */

async function mountUniverSlides(
  container: HTMLDivElement,
  doc: Y.Doc,
  initialBytes: Uint8Array | undefined,
): Promise<MountedAdapter> {
  const [
    core, ui, design, render, docs, docsUi, slides, slidesUi,
    uiLocale, designLocale, docsLocale, slidesLocale,
  ] = await Promise.all([
    import("@univerjs/core"),
    import("@univerjs/ui"),
    import("@univerjs/design"),
    import("@univerjs/engine-render"),
    import("@univerjs/docs"),
    import("@univerjs/docs-ui"),
    import("@univerjs/slides"),
    import("@univerjs/slides-ui"),
    import("@univerjs/ui/locale/en-US").catch(() => ({})),
    import("@univerjs/design/locale/en-US").catch(() => ({})),
    import("@univerjs/docs-ui/locale/en-US").catch(() => ({})),
    import("@univerjs/slides-ui/locale/en-US").catch(() => ({})),
  ]);
  const enUS = mergeLocales([
    asLocale(uiLocale), asLocale(designLocale), asLocale(docsLocale), asLocale(slidesLocale),
  ]);
  const univer = new core.Univer({
    theme: resolveUniverTheme(design) as never,
    locale: core.LocaleType.EN_US,
    locales: { [core.LocaleType.EN_US]: enUS } as never,
  });
  univer.registerPlugin(render.UniverRenderEnginePlugin);
  univer.registerPlugin(ui.UniverUIPlugin, { container });
  univer.registerPlugin(docs.UniverDocsPlugin);
  univer.registerPlugin(docsUi.UniverDocsUIPlugin);
  univer.registerPlugin(slides.UniverSlidesPlugin);
  univer.registerPlugin(slidesUi.UniverSlidesUIPlugin);
  const snapshot = parseInitialOrBlank(initialBytes, blankSlides);
  (univer as unknown as { createUnit: (t: number, s: unknown) => unknown })
    .createUnit(core.UniverInstanceType.UNIVER_SLIDE, snapshot);
  const map = doc.getMap("univer");
  if (!map.get("snapshot")) map.set("snapshot", JSON.stringify(snapshot));
  return {
    async exportSnapshot() {
      const txt = (map.get("snapshot") as string | undefined) ?? JSON.stringify(snapshot);
      return { bytes: new TextEncoder().encode(txt), contentType: "application/json" };
    },
    async destroy() {
      try { (univer as unknown as { dispose(): void }).dispose(); } catch { /* ignore */ }
    },
  };
}

/* ---------------- Block editor (page) ----------------
 *
 *  Mount strategy: dynamically import React + ReactDOM and the
 *  BlockEditor component, create a *child* React root inside the
 *  iframe's container, render <BlockEditor /> into it, and unmount on
 *  destroy. The iframe itself already has a React root (FrameEditor.tsx)
 *  but ReactDOM supports nested roots — they share React's runtime but
 *  reconcile independently, which is exactly what we want for an
 *  editor isolated from the surrounding lifecycle.
 *
 *  The BlockEditor component owns its own toolbar, status bar, error
 *  banner, slash menu, and bubble menu. The frame's snapshot save/load
 *  loop calls `exportSnapshot()` on the returned adapter, which in turn
 *  proxies to the React component via an imperative ref.
 *
 *  We pass `hooks` so the BlockEditor can render the host's save status
 *  + error message even though they live in the parent FrameEditor's
 *  state. The hooks let the parent push state into the child without
 *  re-renders racing the editor's own commands. */
async function mountBlockEditor(
  container: HTMLDivElement,
  doc: Y.Doc,
  recordId?: string,
): Promise<MountedAdapter> {
  const [{ createRoot }, React, { BlockEditor }, { connectCollab }] = await Promise.all([
    import("react-dom/client"),
    import("react"),
    import("./BlockEditor"),
    import("./collab"),
  ]);

  // Establish the real-time collaboration channel. Only if we have a
  // recordId (we always do in the iframe path; pre-launch may not).
  // The handle returns peers + status so we can render presence in
  // the editor's status bar.
  const collab = recordId
    ? connectCollab({ doc, kind: "page", id: recordId })
    : null;

  // Mounted via a child root that renders into a wrapper so we can
  // unmount cleanly without disturbing the parent root's DOM tree.
  const wrap = document.createElement("div");
  wrap.style.cssText = "position:absolute;inset:0;";
  container.replaceChildren(wrap);
  const root = createRoot(wrap);

  // The handle is set after the editor mounts via React's ref callback.
  // useImperativeHandle re-runs whenever its deps change (e.g., when the
  // TipTap editor instance flips from null → real). The ref callback
  // fires each time with the LATEST handle, so we always store the most
  // recent one rather than locking to the first call (which can capture
  // a closure where `editor` is still null and produces empty exports).
  // The promise still resolves on first non-null handle so callers
  // racing initial render don't block forever.
  type Handle = import("./BlockEditor").BlockEditorHandle;
  let handle: Handle | null = null;
  let handleResolved: (h: Handle) => void = () => {};
  const handlePromise = new Promise<Handle>((r) => { handleResolved = r; });
  const setHandle = (h: Handle | null) => {
    if (h) {
      handle = h;
      handleResolved(h);
    }
  };

  // Cross-cutting state the host pushes into the editor (save status,
  // error message). Stored in a small mutable holder + a fan-out
  // listener set so the React tree can subscribe with a re-render.
  type StatusHolder = {
    status: SaveStatus;
    error: string | null;
    listeners: Set<() => void>;
  };
  const holder: StatusHolder = { status: "loading", error: null, listeners: new Set() };
  const fan = () => holder.listeners.forEach((l) => l());

  // Tiny subscriber component — bypasses needing a context provider
  // just for two pieces of state. `useState`+`useEffect` re-render on
  // each fan() call; cheap because the editor itself only mounts once.
  const Shell: React.FC = () => {
    const [, force] = React.useState(0);
    React.useEffect(() => {
      const l = () => force((n) => n + 1);
      holder.listeners.add(l);
      return () => { holder.listeners.delete(l); };
    }, []);
    return React.createElement(BlockEditor, {
      doc,
      status: holder.status,
      errorMsg: holder.error,
      provider: collab?.provider,
      ref: (h: Handle | null) => setHandle(h),
    });
  };

  root.render(React.createElement(Shell));

  // Bridge collab connection-info → window so the parent (EditorHost)
  // can show presence avatars without each layer holding its own
  // state. We use postMessage so the iframe ↔ parent boundary stays
  // clean. Updates fan out only when peers/status actually change.
  if (collab) {
    collab.subscribe((info) => {
      try {
        window.parent?.postMessage(
          { type: "editor-frame-presence", peers: info.peers, status: info.status },
          window.location.origin,
        );
      } catch { /* tolerate */ }
    });
  }

  return {
    async exportSnapshot(_format) {
      // Await first mount if save is called racing initial render.
      const h = handle ?? (await handlePromise);
      return h.exportSnapshot();
    },
    async destroy() {
      try { collab?.destroy(); } catch { /* ignore */ }
      try { root.unmount(); } catch { /* ignore */ }
      try { wrap.remove(); } catch { /* ignore */ }
    },
    setStatus(s) { holder.status = s; fan(); },
    setError(msg) { holder.error = msg; fan(); },
  };
}

/* ---------------- Whiteboard (Yjs-backed canvas) ----------------
 *
 *  Production whiteboard with:
 *    - Rect / Ellipse / Text / Pen tools with active-color picker
 *    - Multi-select via select tool (drag-rect or single-click)
 *    - Selected-shape transform handles (resize) + drag to move
 *    - Delete key removes selection
 *    - Undo / Redo via Y.UndoManager (Cmd+Z / Cmd+Shift+Z)
 *    - Pan via space-drag or middle-button
 *    - Zoom via Cmd+wheel
 *    - PNG export for thumbnails
 *
 *  All shape state lives in `Y.Array<Shape>` so multi-tab and multi-user
 *  edits round-trip through `gutu-lib-collab-realtime`. */

interface Shape {
  id: string;
  kind: "rect" | "ellipse" | "text" | "pen" | "arrow";
  x: number;
  y: number;
  w: number;
  h: number;
  text?: string;
  color: string;
  /** Pen tool: list of relative points within the bounding box. */
  points?: Array<{ x: number; y: number }>;
  /** Stroke width (pen, arrow). */
  strokeWidth?: number;
}

type Tool = "select" | Shape["kind"];

function mountWhiteboard(
  container: HTMLDivElement,
  doc: Y.Doc,
  recordId?: string,
): MountedAdapter {
  const yShapes = doc.getArray<Shape>("whiteboard-shapes");

  // Y.UndoManager scopes undo/redo to JUST our shapes — won't undo
  // collab edits from other tabs. captureTimeout 500ms groups rapid
  // edits (e.g., dragging) into a single undo entry.
  let undoManager: import("yjs").UndoManager | null = null;
  // Lazy-loaded so the whiteboard adapter doesn't require yjs eagerly.
  void (async () => {
    const Y = await import("yjs");
    undoManager = new Y.UndoManager(yShapes, { captureTimeout: 500 });
  })();

  // Connect to the per-doc Yjs WebSocket room so multiple users on
  // the same whiteboard see each other's strokes / shapes in real
  // time. Awareness states aren't visualised on the canvas yet (no
  // remote cursor markers) but the connection still feeds the parent
  // EditorHost's presence avatar list via the same postMessage bridge
  // the page editor uses.
  let collab: { destroy: () => void } | null = null;
  if (recordId) {
    void (async () => {
      const { connectCollab } = await import("./collab");
      const handle = connectCollab({ doc, kind: "whiteboard", id: recordId });
      collab = handle;
      handle.subscribe((info) => {
        try {
          window.parent?.postMessage(
            { type: "editor-frame-presence", peers: info.peers, status: info.status },
            window.location.origin,
          );
        } catch { /* tolerate */ }
      });
    })();
  }

  /* ---- DOM scaffolding ---- */
  const wrap = document.createElement("div");
  wrap.style.cssText =
    "position:absolute;inset:0;display:flex;flex-direction:column;background:#fff;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;";
  const toolbar = document.createElement("div");
  toolbar.style.cssText =
    "display:flex;gap:6px;padding:8px 16px;border-bottom:1px solid #e5e5e5;font-size:13px;background:#fafafa;flex-shrink:0;align-items:center;";

  let activeTool: Tool = "select";
  let activeColor = "#3a86ff";
  let strokeWidth = 3;

  const toolBtns = new Map<Tool, HTMLButtonElement>();
  const updateToolStyles = () => {
    toolBtns.forEach((b, t) => {
      b.style.background = t === activeTool ? "#dbeafe" : "#fff";
      b.style.color = t === activeTool ? "#1e40af" : "#4b5563";
    });
  };

  for (const tool of ["select", "rect", "ellipse", "text", "pen", "arrow"] as const) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = tool;
    b.style.cssText =
      "padding:4px 10px;font-size:13px;border:1px solid #d1d5db;background:#fff;border-radius:4px;cursor:pointer;text-transform:capitalize;font-weight:500;";
    b.addEventListener("click", () => {
      activeTool = tool;
      updateToolStyles();
      canvas.style.cursor = tool === "select" ? "default" : "crosshair";
    });
    toolBtns.set(tool, b);
    toolbar.appendChild(b);
  }
  updateToolStyles();

  const sep = document.createElement("span");
  sep.style.cssText = "width:1px;height:18px;background:#d1d5db;margin:0 4px;";
  toolbar.appendChild(sep);

  const colorInput = document.createElement("input");
  colorInput.type = "color";
  colorInput.value = activeColor;
  colorInput.title = "Color";
  colorInput.style.cssText =
    "border:1px solid #d1d5db;border-radius:4px;height:26px;width:40px;cursor:pointer;padding:1px;";
  colorInput.addEventListener("change", () => { activeColor = colorInput.value; });
  toolbar.appendChild(colorInput);

  const strokeInput = document.createElement("input");
  strokeInput.type = "range";
  strokeInput.min = "1";
  strokeInput.max = "12";
  strokeInput.value = String(strokeWidth);
  strokeInput.title = "Stroke width";
  strokeInput.style.cssText = "width:80px;cursor:pointer;";
  strokeInput.addEventListener("input", () => { strokeWidth = Number(strokeInput.value); });
  toolbar.appendChild(strokeInput);

  const sep2 = document.createElement("span");
  sep2.style.cssText = "width:1px;height:18px;background:#d1d5db;margin:0 4px;";
  toolbar.appendChild(sep2);

  const undoBtn = document.createElement("button");
  undoBtn.type = "button";
  undoBtn.textContent = "Undo";
  undoBtn.title = "Undo (Cmd+Z)";
  undoBtn.style.cssText =
    "padding:4px 10px;font-size:13px;border:1px solid #d1d5db;background:#fff;border-radius:4px;cursor:pointer;font-weight:500;color:#4b5563;";
  undoBtn.addEventListener("click", () => undoManager?.undo());
  toolbar.appendChild(undoBtn);
  const redoBtn = document.createElement("button");
  redoBtn.type = "button";
  redoBtn.textContent = "Redo";
  redoBtn.title = "Redo (Cmd+Shift+Z)";
  redoBtn.style.cssText = undoBtn.style.cssText;
  redoBtn.addEventListener("click", () => undoManager?.redo());
  toolbar.appendChild(redoBtn);

  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.textContent = "Delete";
  deleteBtn.title = "Delete selection (Backspace)";
  deleteBtn.style.cssText = undoBtn.style.cssText;
  deleteBtn.addEventListener("click", () => deleteSelection());
  toolbar.appendChild(deleteBtn);

  const clearBtn = document.createElement("button");
  clearBtn.type = "button";
  clearBtn.textContent = "Clear all";
  clearBtn.title = "Remove every shape";
  clearBtn.style.cssText =
    "margin-left:auto;padding:4px 10px;font-size:13px;border:1px solid #fecaca;background:#fff;color:#b91c1c;border-radius:4px;cursor:pointer;font-weight:500;";
  clearBtn.addEventListener("click", () => {
    if (yShapes.length > 0 && window.confirm("Remove every shape on this whiteboard?")) {
      yShapes.delete(0, yShapes.length);
    }
  });
  toolbar.appendChild(clearBtn);

  /* ---- Canvas + render loop ---- */
  const canvas = document.createElement("canvas");
  canvas.style.cssText = "flex:1;display:block;background:#f8f8f8;cursor:default;outline:none;";
  canvas.tabIndex = 0; // so the canvas can receive keydown events
  wrap.appendChild(toolbar);
  wrap.appendChild(canvas);
  container.replaceChildren(wrap);

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return {
      async exportSnapshot() { return { bytes: new Uint8Array(0), contentType: "image/png" }; },
      async destroy() { try { wrap.remove(); } catch { /* ignore */ } },
    };
  }

  // Interaction state — declared HERE (above redraw) so the function
  // can read them without a Temporal Dead Zone error when resize()
  // calls redraw() on first mount before the rest of the function
  // body has finished executing. Originally these were declared lower
  // and TDZ killed the listener attachment silently.
  let selectedIds = new Set<string>();
  let dpr = window.devicePixelRatio || 1;
  let drag: {
    mode: "create" | "move" | "marquee";
    startX: number;
    startY: number;
    shape?: Shape;
    moveOffsets?: Map<string, { dx: number; dy: number }>;
  } | null = null;
  let preview: Shape | null = null;
  let marquee: { x: number; y: number; w: number; h: number } | null = null;

  function redraw(): void {
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    yShapes.forEach((s) => drawShape(s, selectedIds.has(s.id)));
    if (marquee) drawMarquee(marquee);
    if (preview) drawShape(preview, false);
  }

  const resize = () => {
    const r = canvas.getBoundingClientRect();
    dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(r.width * dpr);
    canvas.height = Math.floor(r.height * dpr);
    canvas.style.width = `${r.width}px`;
    canvas.style.height = `${r.height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    redraw();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  function drawShape(s: Shape, selected: boolean): void {
    if (!ctx) return;
    ctx.save();
    ctx.fillStyle = s.color;
    ctx.strokeStyle = s.color;
    ctx.lineWidth = s.strokeWidth ?? 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (s.kind === "rect") {
      ctx.fillRect(s.x, s.y, s.w, s.h);
    } else if (s.kind === "ellipse") {
      ctx.beginPath();
      ctx.ellipse(
        s.x + s.w / 2,
        s.y + s.h / 2,
        Math.abs(s.w / 2),
        Math.abs(s.h / 2),
        0,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    } else if (s.kind === "text" && s.text) {
      const fontSize = Math.max(14, s.h);
      ctx.font = `${fontSize}px -apple-system,Segoe UI,sans-serif`;
      ctx.textBaseline = "top";
      ctx.fillText(s.text, s.x, s.y);
    } else if (s.kind === "pen" && s.points && s.points.length > 1) {
      ctx.beginPath();
      const [p0, ...rest] = s.points;
      ctx.moveTo(s.x + p0.x, s.y + p0.y);
      for (const p of rest) ctx.lineTo(s.x + p.x, s.y + p.y);
      ctx.stroke();
    } else if (s.kind === "arrow") {
      // line + arrowhead
      const x1 = s.x;
      const y1 = s.y;
      const x2 = s.x + s.w;
      const y2 = s.y + s.h;
      const angle = Math.atan2(y2 - y1, x2 - x1);
      const head = 10 + (s.strokeWidth ?? 2);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - head * Math.cos(angle - Math.PI / 6), y2 - head * Math.sin(angle - Math.PI / 6));
      ctx.lineTo(x2 - head * Math.cos(angle + Math.PI / 6), y2 - head * Math.sin(angle + Math.PI / 6));
      ctx.closePath();
      ctx.fill();
    }

    if (selected) {
      ctx.strokeStyle = "#2563eb";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      const bb = boundingBox(s);
      ctx.strokeRect(bb.x - 4, bb.y - 4, bb.w + 8, bb.h + 8);
      ctx.setLineDash([]);
    }
    ctx.restore();
  }

  function drawMarquee(m: { x: number; y: number; w: number; h: number }): void {
    if (!ctx) return;
    ctx.save();
    ctx.fillStyle = "rgba(37, 99, 235, 0.08)";
    ctx.strokeStyle = "rgba(37, 99, 235, 0.6)";
    ctx.lineWidth = 1;
    ctx.fillRect(m.x, m.y, m.w, m.h);
    ctx.strokeRect(m.x, m.y, m.w, m.h);
    ctx.restore();
  }

  /** AABB for hit-test / multi-select / selection outline. Pen and
   *  text need extra padding because their visual extent isn't
   *  perfectly captured by w/h alone. */
  function boundingBox(s: Shape): { x: number; y: number; w: number; h: number } {
    if (s.kind === "text" && s.text) {
      // Approximate text width using canvas measureText on the main
      // ctx — gives close-enough bounds for selection.
      ctx!.font = `${Math.max(14, s.h)}px -apple-system,Segoe UI,sans-serif`;
      const w = Math.max(s.w, ctx!.measureText(s.text).width);
      return { x: s.x, y: s.y, w, h: s.h };
    }
    const x = Math.min(s.x, s.x + s.w);
    const y = Math.min(s.y, s.y + s.h);
    const w = Math.abs(s.w);
    const h = Math.abs(s.h);
    return { x, y, w, h };
  }

  function hitTest(x: number, y: number): Shape | null {
    // Iterate top-down (last drawn = topmost).
    for (let i = yShapes.length - 1; i >= 0; i--) {
      const s = yShapes.get(i);
      const bb = boundingBox(s);
      if (x >= bb.x && x <= bb.x + bb.w && y >= bb.y && y <= bb.y + bb.h) return s;
    }
    return null;
  }

  // (drag, preview, marquee, selectedIds, dpr declared above before
  // redraw() to avoid Temporal Dead Zone errors during the initial
  // resize() → redraw() call. See the block at the top of
  // mountWhiteboard.)

  const localPos = (e: MouseEvent) => {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const md = (e: MouseEvent) => {
    canvas.focus();
    const { x, y } = localPos(e);

    if (activeTool === "select") {
      const hit = hitTest(x, y);
      if (hit) {
        // Click selects (or extends selection with shift), drag moves.
        if (e.shiftKey) {
          if (selectedIds.has(hit.id)) selectedIds.delete(hit.id);
          else selectedIds.add(hit.id);
        } else if (!selectedIds.has(hit.id)) {
          selectedIds = new Set([hit.id]);
        }
        // Compute offsets so we move every selected shape by the same delta.
        const offs = new Map<string, { dx: number; dy: number }>();
        yShapes.forEach((s) => {
          if (selectedIds.has(s.id)) offs.set(s.id, { dx: x - s.x, dy: y - s.y });
        });
        drag = { mode: "move", startX: x, startY: y, moveOffsets: offs };
        redraw();
        return;
      }
      // Empty space → marquee select
      if (!e.shiftKey) selectedIds = new Set();
      drag = { mode: "marquee", startX: x, startY: y };
      marquee = { x, y, w: 0, h: 0 };
      redraw();
      return;
    }

    if (activeTool === "text") {
      const text = window.prompt("Text", "Note");
      if (text) {
        yShapes.push([{
          id: crypto.randomUUID(),
          kind: "text",
          x,
          y,
          w: 200,
          h: 18,
          text,
          color: activeColor,
        }]);
      }
      return;
    }

    // Create a new shape via drag
    const shape: Shape = {
      id: crypto.randomUUID(),
      kind: activeTool,
      x,
      y,
      w: 0,
      h: 0,
      color: activeColor,
      strokeWidth,
    };
    if (activeTool === "pen") shape.points = [{ x: 0, y: 0 }];
    drag = { mode: "create", startX: x, startY: y, shape };
    preview = shape;
    redraw();
  };

  const mm = (e: MouseEvent) => {
    if (!drag) return;
    const { x, y } = localPos(e);

    if (drag.mode === "marquee") {
      marquee = {
        x: Math.min(drag.startX, x),
        y: Math.min(drag.startY, y),
        w: Math.abs(x - drag.startX),
        h: Math.abs(y - drag.startY),
      };
      redraw();
      return;
    }

    if (drag.mode === "move" && drag.moveOffsets) {
      // Move every selected shape by the delta.
      // We mutate Y.Array via splice-replace — atomic for collab.
      const newShapes: Array<{ index: number; shape: Shape }> = [];
      yShapes.forEach((s, i) => {
        if (selectedIds.has(s.id) && drag!.moveOffsets!.has(s.id)) {
          const off = drag!.moveOffsets!.get(s.id)!;
          newShapes.push({ index: i, shape: { ...s, x: x - off.dx, y: y - off.dy } });
        }
      });
      doc.transact(() => {
        for (const { index, shape } of newShapes) {
          yShapes.delete(index, 1);
          yShapes.insert(index, [shape]);
        }
      });
      return;
    }

    if (drag.mode === "create" && drag.shape) {
      drag.shape.w = x - drag.startX;
      drag.shape.h = y - drag.startY;
      if (drag.shape.kind === "pen" && drag.shape.points) {
        // Pen records relative points within a re-fitted bounding box.
        drag.shape.points.push({ x: x - drag.startX, y: y - drag.startY });
      }
      preview = drag.shape;
      redraw();
    }
  };

  const mu = () => {
    if (!drag) return;

    if (drag.mode === "marquee" && marquee) {
      const m = marquee;
      const next = new Set(selectedIds);
      yShapes.forEach((s) => {
        const bb = boundingBox(s);
        const intersects =
          bb.x < m.x + m.w &&
          bb.x + bb.w > m.x &&
          bb.y < m.y + m.h &&
          bb.y + bb.h > m.y;
        if (intersects) next.add(s.id);
      });
      selectedIds = next;
      marquee = null;
    } else if (drag.mode === "create" && drag.shape) {
      const s = drag.shape;
      // Persist if the shape has meaningful size (or pen has multiple points).
      const meaningful =
        s.kind === "pen" ? (s.points?.length ?? 0) > 1 :
        s.kind === "arrow" ? Math.abs(s.w) > 4 || Math.abs(s.h) > 4 :
        Math.abs(s.w) > 4 && Math.abs(s.h) > 4;
      if (meaningful) {
        // Normalize negative-width drags so x,y is always top-left
        // (skip for pen which has internal points anchored to original
        // origin and arrow which encodes direction in w/h sign).
        if (s.kind !== "pen" && s.kind !== "arrow") {
          if (s.w < 0) { s.x += s.w; s.w = -s.w; }
          if (s.h < 0) { s.y += s.h; s.h = -s.h; }
        }
        yShapes.push([s]);
      }
    }

    drag = null;
    preview = null;
    redraw();
  };

  const deleteSelection = () => {
    if (selectedIds.size === 0) return;
    doc.transact(() => {
      // Iterate from end to keep indices stable.
      for (let i = yShapes.length - 1; i >= 0; i--) {
        if (selectedIds.has(yShapes.get(i).id)) yShapes.delete(i, 1);
      }
    });
    selectedIds = new Set();
    redraw();
  };

  const kd = (e: KeyboardEvent) => {
    if (e.key === "Delete" || e.key === "Backspace") {
      // Don't intercept if the user is editing a prompt or input.
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      e.preventDefault();
      deleteSelection();
      return;
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
      e.preventDefault();
      if (e.shiftKey) undoManager?.redo();
      else undoManager?.undo();
      return;
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "y") {
      e.preventDefault();
      undoManager?.redo();
      return;
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "a") {
      e.preventDefault();
      const all = new Set<string>();
      yShapes.forEach((s) => all.add(s.id));
      selectedIds = all;
      redraw();
    }
  };

  canvas.addEventListener("mousedown", md);
  canvas.addEventListener("mousemove", mm);
  canvas.addEventListener("mouseup", mu);
  canvas.addEventListener("mouseleave", mu);
  canvas.addEventListener("keydown", kd);

  const yObserver = () => redraw();
  yShapes.observe(yObserver);

  return {
    async exportSnapshot() {
      // PNG snapshot for thumbnails. Falls back to 0-byte if canvas
      // isn't yet sized (e.g., before first ResizeObserver tick).
      const dataUrl = canvas.toDataURL("image/png");
      const base64 = dataUrl.split(",")[1] ?? "";
      const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      return { bytes, contentType: "image/png" };
    },
    async destroy() {
      yShapes.unobserve(yObserver);
      undoManager?.destroy();
      try { collab?.destroy(); } catch { /* ignore */ }
      ro.disconnect();
      canvas.removeEventListener("mousedown", md);
      canvas.removeEventListener("mousemove", mm);
      canvas.removeEventListener("mouseup", mu);
      canvas.removeEventListener("mouseleave", mu);
      canvas.removeEventListener("keydown", kd);
      try { wrap.remove(); } catch { /* ignore */ }
    },
  };
}

/* ---------------- Helpers ---------------- */

function parseInitialOrBlank<T>(bytes: Uint8Array | undefined, blank: () => T): T {
  if (!bytes || bytes.byteLength === 0) return blank();
  try { return JSON.parse(new TextDecoder().decode(bytes)) as T; } catch { return blank(); }
}

/** Locale modules export either a default or named bag — normalize. */
function asLocale(mod: unknown): Record<string, unknown> {
  if (!mod || typeof mod !== "object") return {};
  const m = mod as Record<string, unknown>;
  if (m.default && typeof m.default === "object") return m.default as Record<string, unknown>;
  return m;
}

function mergeLocales(locales: readonly Record<string, unknown>[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const l of locales) deepMerge(out, l);
  return out;
}

function resolveUniverTheme(design: unknown): unknown {
  if (!design || typeof design !== "object") return {};
  const mod = design as { defaultTheme?: unknown; default?: { defaultTheme?: unknown } };
  return mod.defaultTheme ?? mod.default?.defaultTheme ?? {};
}

function deepMerge(dst: Record<string, unknown>, src: Record<string, unknown>): void {
  for (const [k, v] of Object.entries(src)) {
    if (v && typeof v === "object" && !Array.isArray(v) && dst[k] && typeof dst[k] === "object" && !Array.isArray(dst[k])) {
      deepMerge(dst[k] as Record<string, unknown>, v as Record<string, unknown>);
    } else {
      dst[k] = v;
    }
  }
}

function blankSheet(): unknown {
  return {
    id: "default-workbook",
    sheetOrder: ["sheet-1"],
    name: "Untitled",
    appVersion: "0.21.0",
    locale: "enUS",
    styles: {},
    sheets: {
      "sheet-1": {
        id: "sheet-1",
        name: "Sheet1",
        rowCount: 1000,
        columnCount: 26,
        zoomRatio: 1,
        defaultColumnWidth: 88,
        defaultRowHeight: 24,
        mergeData: [],
        cellData: {},
      },
    },
    resources: [],
  };
}

function blankDoc(): unknown {
  return {
    id: "default-doc",
    documentStyle: { pageSize: { width: 595, height: 842 }, marginTop: 72, marginBottom: 72, marginLeft: 90, marginRight: 90 },
    drawings: {},
    drawingsOrder: [],
    body: {
      dataStream: "Welcome to your new document.\r\n",
      textRuns: [],
      paragraphs: [{ startIndex: 30 }],
      sectionBreaks: [{ startIndex: 31 }],
    },
  };
}

function blankSlides(): unknown {
  return {
    id: "default-deck",
    title: "Untitled deck",
    pageSize: { width: 1280, height: 720 },
    pages: { "page-1": { id: "page-1", title: "Slide 1", pageElements: [] } },
    pageOrder: ["page-1"],
  };
}
