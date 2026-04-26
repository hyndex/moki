import { jsx as _jsx } from "react/jsx-runtime";
/** Editor iframe entrypoint.
 *
 *  Loaded as `/editor-frame.html?kind=…&id=…` by the parent shell. Owns its
 *  own React root WITHOUT StrictMode so the embedded editor (Univer or
 *  BlockSuite) isn't subject to React 19's double-render lifecycle which
 *  surfaces upstream setState-in-mount bugs.
 *
 *  Contract with parent:
 *    - URL params: `kind`, `id`  — both required.
 *    - postMessage("editor-frame-ready", { kind, id }) on mount.
 *    - postMessage("editor-frame-status", { status }) on save state changes.
 *    - The frame shares cookies + localStorage with the parent so the
 *      authStore token is available without explicit hand-off.
 *
 *  Same-origin only — referrer/CSP locked to same-origin in editor-frame.html. */
import { createRoot } from "react-dom/client";
import { FrameEditor } from "./FrameEditor";
// Forward iframe console errors and uncaught exceptions to the parent shell
// so the EditorErrorBoundary surfaces them and so the production telemetry
// pipeline (postMessage → window.gutuTelemetry) sees them.
const origError = console.error.bind(console);
console.error = (...args) => {
    origError(...args);
    try {
        window.parent?.postMessage({ type: "editor-frame-console", level: "error", args: args.map(String) }, window.location.origin);
    }
    catch { /* swallow cross-origin errors */ }
};
window.addEventListener("error", (e) => {
    window.parent?.postMessage({
        type: "editor-frame-console",
        level: "error",
        args: [e.message, e.error?.stack].filter(Boolean).map(String),
    }, window.location.origin);
});
window.addEventListener("unhandledrejection", (e) => {
    window.parent?.postMessage({
        type: "editor-frame-console",
        level: "error",
        args: ["unhandledrejection: " + String(e.reason?.stack ?? e.reason)],
    }, window.location.origin);
});
const params = new URLSearchParams(window.location.search);
const kind = params.get("kind") ?? "";
const id = params.get("id") ?? "";
const el = document.getElementById("root");
if (!el)
    throw new Error("#root missing");
if (!kind || !id) {
    el.innerHTML = `<div style="padding:32px;color:#900">Missing kind or id query parameter.</div>`;
}
else {
    createRoot(el).render(_jsx(FrameEditor, { kind: kind, id: id }));
}
