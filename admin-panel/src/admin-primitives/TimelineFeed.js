import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/** <TimelineFeed /> — per-record activity feed.
 *
 *  Reads `/api/timeline/<resource>/<recordId>` and renders a vertical
 *  timeline. Auto-emitted events on every record CRUD show up here
 *  with diff and actor — same pattern Twenty's TimelineActivity gives
 *  via its `MORPH_RELATION`-style join.
 *
 *  Designed to drop into either:
 *    - a tab on a detail page (full-width)
 *    - a rail module (compact, last 10 events)
 *  Switched via the `compact` prop. */
import * as React from "react";
import { Activity, ArrowDown, Plus, Pencil, Trash2, RotateCcw, Zap } from "lucide-react";
import { authStore } from "@/runtime/auth";
function apiBase() {
    const base = (typeof import.meta !== "undefined" ? import.meta.env?.VITE_API_BASE : undefined) ?? "/api";
    return base.toString().replace(/\/+$/, "");
}
function authHeaders() {
    const headers = {};
    if (authStore.token)
        headers.Authorization = `Bearer ${authStore.token}`;
    if (authStore.activeTenant?.id)
        headers["x-tenant"] = authStore.activeTenant.id;
    return headers;
}
const KIND_ICON = {
    created: Plus,
    updated: Pencil,
    deleted: Trash2,
    restored: RotateCcw,
    destroyed: Trash2,
    workflow: Zap,
    comment: Activity,
};
const KIND_COLOR = {
    created: "#10b981",
    updated: "#3b82f6",
    deleted: "#f59e0b",
    restored: "#8b5cf6",
    destroyed: "#dc2626",
    workflow: "#a855f7",
    comment: "#6b7280",
};
export function TimelineFeed({ resource, recordId, compact, limit = 50 }) {
    const [rows, setRows] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState(null);
    React.useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(null);
        fetch(`${apiBase()}/timeline/${encodeURIComponent(resource)}/${encodeURIComponent(recordId)}?limit=${limit}`, { headers: authHeaders(), credentials: "include" })
            .then(async (res) => {
            if (!res.ok)
                throw new Error(`HTTP ${res.status}`);
            return (await res.json());
        })
            .then((j) => { if (!cancelled)
            setRows(j.rows ?? []); })
            .catch((err) => { if (!cancelled)
            setError(err.message); })
            .finally(() => { if (!cancelled)
            setLoading(false); });
        return () => { cancelled = true; };
    }, [resource, recordId, limit]);
    if (loading) {
        return (_jsx("div", { style: { padding: 12, color: "#9ca3af", fontSize: 13 }, children: "Loading activity\u2026" }));
    }
    if (error) {
        return (_jsxs("div", { style: { padding: 12, color: "#dc2626", fontSize: 13 }, children: ["Couldn't load activity: ", error] }));
    }
    if (rows.length === 0) {
        return (_jsxs("div", { style: {
                padding: compact ? 12 : 24,
                textAlign: "center",
                color: "#9ca3af",
                fontSize: 13,
            }, children: [_jsx(Activity, { size: 24, style: { opacity: 0.4, marginBottom: 8 } }), _jsx("div", { children: "No activity yet." })] }));
    }
    return (_jsx("ol", { style: { listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }, children: rows.slice(0, compact ? 10 : limit).map((r) => {
            const Icon = KIND_ICON[r.kind] ?? Activity;
            const color = KIND_COLOR[r.kind] ?? "#6b7280";
            return (_jsxs("li", { style: {
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 10,
                    padding: 8,
                    borderRadius: 6,
                    fontSize: 12,
                }, children: [_jsx("span", { style: {
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: 24,
                            height: 24,
                            borderRadius: "50%",
                            background: `${color}22`,
                            color,
                            flexShrink: 0,
                        }, children: _jsx(Icon, { size: 12 }) }), _jsxs("div", { style: { flex: 1, minWidth: 0 }, children: [_jsxs("div", { style: { display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" }, children: [_jsx("span", { style: { fontWeight: 500, color: "#111827" }, children: r.actor ?? "system" }), _jsx("span", { style: { color: "#4b5563" }, children: r.message.toLowerCase() })] }), r.diff && Object.keys(r.diff).length > 0 && !compact && (_jsx("ul", { style: {
                                    listStyle: "none",
                                    margin: "4px 0 0",
                                    padding: 0,
                                    fontSize: 11,
                                    color: "#6b7280",
                                }, children: Object.entries(r.diff).slice(0, 6).map(([k, v]) => (_jsxs("li", { style: { display: "flex", gap: 4, alignItems: "baseline" }, children: [_jsxs("span", { style: { fontWeight: 500 }, children: [k, ":"] }), _jsx("span", { style: { color: "#9ca3af", textDecoration: "line-through" }, children: String(v.from ?? "—").slice(0, 40) }), _jsx(ArrowDown, { size: 10, style: { transform: "rotate(-90deg)" } }), _jsx("span", { style: { color: "#111827" }, children: String(v.to ?? "—").slice(0, 40) })] }, k))) })), _jsx("div", { style: { fontSize: 10, color: "#9ca3af", marginTop: 2 }, children: formatRelative(r.occurredAt) })] })] }, r.id));
        }) }));
}
function formatRelative(iso) {
    const t = new Date(iso).getTime();
    const diff = Date.now() - t;
    if (diff < 60_000)
        return "just now";
    if (diff < 3_600_000)
        return `${Math.floor(diff / 60_000)}m ago`;
    if (diff < 86_400_000)
        return `${Math.floor(diff / 3_600_000)}h ago`;
    if (diff < 7 * 86_400_000)
        return `${Math.floor(diff / 86_400_000)}d ago`;
    return new Date(iso).toLocaleDateString();
}
