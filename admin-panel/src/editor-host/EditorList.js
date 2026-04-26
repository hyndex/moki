import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/** Generic list/launchpad page for any editor kind.
 *
 *  Renders the rows from `/api/editors/<kind>`, lets the user create a new
 *  one with a title prompt, and switches into `<EditorHost>` mounted in a
 *  full-viewport overlay. */
import { useCallback, useEffect, useState } from "react";
import { EditorHost } from "./EditorHost";
import { createEditorRecord, deleteEditorRecord, listEditorRecords, } from "./api";
export function EditorList({ kind, title, newButtonLabel }) {
    const [rows, setRows] = useState(null);
    const [open, setOpen] = useState(null);
    const [error, setError] = useState(null);
    const reload = useCallback(async () => {
        try {
            const r = await listEditorRecords(kind);
            setRows(r);
        }
        catch (err) {
            setError(err.message);
        }
    }, [kind]);
    useEffect(() => { void reload(); }, [reload]);
    const handleNew = useCallback(async () => {
        const titlePrompt = typeof window !== "undefined"
            ? window.prompt(`Title for new ${kind}?`, "Untitled")
            : "Untitled";
        if (!titlePrompt)
            return;
        try {
            const created = await createEditorRecord(kind, { title: titlePrompt });
            await reload();
            setOpen(created);
        }
        catch (err) {
            setError(err.message);
        }
    }, [kind, reload]);
    const handleDelete = useCallback(async (id) => {
        if (typeof window !== "undefined" && !window.confirm("Delete this item?"))
            return;
        try {
            await deleteEditorRecord(kind, id);
            await reload();
        }
        catch (err) {
            setError(err.message);
        }
    }, [kind, reload]);
    if (open) {
        return _jsx(EditorHost, { kind: kind, record: open, onClose: () => { setOpen(null); void reload(); } });
    }
    return (_jsxs("div", { style: { padding: 24, maxWidth: 1100, margin: "0 auto" }, children: [_jsxs("header", { style: { display: "flex", alignItems: "center", marginBottom: 16 }, children: [_jsx("h1", { style: { flex: 1, fontSize: 22 }, children: title }), _jsx("button", { onClick: handleNew, type: "button", style: { padding: "8px 12px", fontSize: 14 }, children: newButtonLabel ?? "New" })] }), error && (_jsx("div", { style: { background: "#fee", color: "#900", padding: 8, borderRadius: 6, marginBottom: 12 }, children: error })), rows === null ? (_jsx("div", { children: "Loading\u2026" })) : rows.length === 0 ? (_jsxs("div", { style: { padding: 32, textAlign: "center", color: "#666" }, children: ["No items yet. Click ", _jsx("strong", { children: newButtonLabel ?? "New" }), " to create one."] })) : (_jsxs("table", { style: { width: "100%", borderCollapse: "collapse", fontSize: 14 }, children: [_jsx("thead", { children: _jsxs("tr", { style: { borderBottom: "1px solid #e5e5e5", textAlign: "left" }, children: [_jsx("th", { style: { padding: 8 }, children: "Title" }), _jsx("th", { style: { padding: 8 }, children: "Author" }), _jsx("th", { style: { padding: 8 }, children: "Updated" }), _jsx("th", { style: { padding: 8 } })] }) }), _jsx("tbody", { children: rows.map((r) => (_jsxs("tr", { style: { borderBottom: "1px solid #f0f0f0" }, children: [_jsx("td", { style: { padding: 8 }, children: _jsx("button", { onClick: () => setOpen(r), style: { background: "none", border: 0, color: "#06c", cursor: "pointer", padding: 0 }, children: r.title }) }), _jsx("td", { style: { padding: 8, color: "#555" }, children: r.createdBy }), _jsx("td", { style: { padding: 8, color: "#777" }, children: new Date(r.updatedAt).toLocaleString() }), _jsx("td", { style: { padding: 8, textAlign: "right" }, children: _jsx("button", { onClick: () => void handleDelete(r.id), style: { color: "#a00", background: "none", border: 0, cursor: "pointer" }, children: "Delete" }) })] }, r.id))) })] }))] }));
}
