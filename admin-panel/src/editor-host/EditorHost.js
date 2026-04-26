import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/** Editor host — frames every editor into a same-origin iframe.
 *
 *  Mounts `/editor-frame.html?kind=…&id=…` in a sandboxed iframe so the
 *  embedded runtime (Univer or BlockSuite) doesn't run inside the shell's
 *  StrictMode. Same-origin → cookies + localStorage are shared → the
 *  iframe's `fetch()` calls are auth'd via the same `authStore` token.
 *
 *  The host listens on postMessage for save-status events from the iframe
 *  and forwards them into the visible header. Saves themselves are
 *  performed inside the iframe (it owns the Y.Doc), so the host never
 *  touches the editor's bytes — it just renders the frame and proxies
 *  status. */
import { useCallback, useEffect, useRef, useState } from "react";
import { EditorErrorBoundary } from "./EditorErrorBoundary";
import { PresenceAvatars } from "./PresenceAvatars";
import { ShareDialog } from "./ShareDialog";
function EditorHostInner({ kind, record, onClose }) {
    const iframeRef = useRef(null);
    const [status, setStatus] = useState("loading");
    const [errorMsg, setErrorMsg] = useState(null);
    const [peers, setPeers] = useState([]);
    const [wsStatus, setWsStatus] = useState("connecting");
    const [shareOpen, setShareOpen] = useState(false);
    useEffect(() => {
        const handler = (e) => {
            if (e.origin !== window.location.origin)
                return;
            const data = e.data;
            if (!data || typeof data !== "object")
                return;
            switch (data.type) {
                case "editor-frame-ready":
                    setStatus("ready");
                    setErrorMsg(null);
                    break;
                case "editor-frame-status":
                    if (isSaveStatus(data.status))
                        setStatus(data.status);
                    if (data.status === "error" && data.error)
                        setErrorMsg(data.error);
                    if (data.status === "saved")
                        setErrorMsg(null);
                    break;
                case "editor-frame-presence":
                    if (Array.isArray(data.peers))
                        setPeers(data.peers);
                    if (data.status === "connecting" || data.status === "connected" || data.status === "disconnected") {
                        setWsStatus(data.status);
                    }
                    break;
            }
        };
        window.addEventListener("message", handler);
        return () => window.removeEventListener("message", handler);
    }, []);
    const triggerSave = useCallback(() => {
        iframeRef.current?.contentWindow?.postMessage({ type: "editor-frame-save-now" }, window.location.origin);
    }, []);
    const src = `/editor-frame.html?kind=${encodeURIComponent(kind)}&id=${encodeURIComponent(record.id)}`;
    return (_jsxs("div", { style: { display: "flex", flexDirection: "column", height: "100vh" }, children: [_jsxs("header", { style: {
                    display: "flex",
                    alignItems: "center",
                    padding: "8px 16px",
                    borderBottom: "1px solid #e5e5e5",
                    fontSize: 14,
                    background: "#fafafa",
                    flexShrink: 0,
                }, children: [_jsx("strong", { style: { flex: 1 }, children: record.title }), _jsx(PresenceAvatars, { peers: peers, status: wsStatus }), _jsx("span", { "aria-live": "polite", role: "status", style: { marginRight: 12, color: statusColor(status), minWidth: 84, textAlign: "right" }, children: statusLabel(status) }), _jsx("button", { type: "button", onClick: () => setShareOpen(true), style: {
                            marginRight: 8,
                            padding: "4px 12px",
                            fontSize: 13,
                            background: "#2563eb",
                            color: "#fff",
                            border: 0,
                            borderRadius: 4,
                            cursor: "pointer",
                            fontWeight: 500,
                        }, children: "Share" }), _jsx("button", { type: "button", onClick: triggerSave, disabled: status === "saving" || status === "retrying", style: { marginRight: 8, padding: "4px 10px", fontSize: 13 }, children: "Save now" }), onClose && (_jsx("button", { onClick: onClose, type: "button", style: { padding: "4px 10px", fontSize: 13 }, children: "Close" }))] }), _jsx(ShareDialog, { kind: kind, id: record.id, title: record.title, open: shareOpen, onOpenChange: setShareOpen }), _jsx("iframe", { ref: iframeRef, title: `${kind} editor`, src: src, sandbox: "allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads", style: { flex: 1, border: 0, width: "100%", minHeight: 0, background: "#fff" } }), errorMsg && (_jsx("div", { role: "alert", style: {
                    padding: 8,
                    background: "#fee",
                    color: "#900",
                    fontSize: 13,
                    borderTop: "1px solid #f3c2c2",
                }, children: errorMsg }))] }));
}
export function EditorHost(props) {
    return (_jsx(EditorErrorBoundary, { kind: props.kind, recordId: props.record.id, children: _jsx(EditorHostInner, { ...props }) }));
}
function statusColor(s) {
    switch (s) {
        case "saved": return "#3a9b3a";
        case "saving": return "#b58900";
        case "retrying": return "#d97706";
        case "error": return "#b00020";
        case "ready": return "#555";
        default: return "#999";
    }
}
function isSaveStatus(status) {
    return status === "loading" ||
        status === "ready" ||
        status === "saving" ||
        status === "saved" ||
        status === "retrying" ||
        status === "error";
}
function statusLabel(s) {
    switch (s) {
        case "loading": return "Loading…";
        case "ready": return "Ready";
        case "saving": return "Saving…";
        case "retrying": return "Retrying…";
        case "saved": return "Saved";
        case "error": return "Error";
        default: return s;
    }
}
