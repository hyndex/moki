import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export function PresenceAvatars({ peers, status, max = 5 }) {
    if (!peers || peers.length === 0) {
        // Show just the status dot when no peers (the editor is solo).
        return (_jsx("span", { title: status === "connected" ? "Live: connected" : status === "connecting" ? "Connecting…" : "Offline", style: {
                display: "inline-block",
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: status === "connected" ? "#10b981" :
                    status === "connecting" ? "#f59e0b" :
                        "#9ca3af",
                marginRight: 8,
            } }));
    }
    // Dedupe by user.id (a single user with multiple tabs counts once).
    const seen = new Set();
    const unique = [];
    for (const p of peers) {
        const k = p.user.id ?? `cid:${p.clientId}`;
        if (seen.has(k))
            continue;
        seen.add(k);
        unique.push(p);
    }
    const visible = unique.slice(0, max);
    const overflow = unique.length - visible.length;
    return (_jsxs("span", { style: { display: "inline-flex", alignItems: "center", gap: 0, marginRight: 8 }, children: [visible.map((p, i) => {
                const initial = (p.user.name || p.user.email || "?").trim().charAt(0).toUpperCase();
                return (_jsx("span", { title: p.user.email ? `${p.user.name} <${p.user.email}>` : p.user.name, style: {
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 24,
                        height: 24,
                        borderRadius: "50%",
                        background: p.user.color,
                        color: "#fff",
                        fontSize: 11,
                        fontWeight: 600,
                        border: "2px solid #fafafa",
                        marginLeft: i === 0 ? 0 : -8,
                        userSelect: "none",
                    }, children: initial }, p.clientId));
            }), overflow > 0 && (_jsxs("span", { title: unique
                    .slice(max)
                    .map((p) => p.user.name || p.user.email || "")
                    .join(", "), style: {
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 24,
                    height: 24,
                    borderRadius: "50%",
                    background: "#9ca3af",
                    color: "#fff",
                    fontSize: 10,
                    fontWeight: 600,
                    border: "2px solid #fafafa",
                    marginLeft: -8,
                    userSelect: "none",
                }, children: ["+", overflow] }))] }));
}
