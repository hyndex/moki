/** Generic list/launchpad page for any editor kind.
 *
 *  Renders the rows from `/api/editors/<kind>`, lets the user create a new
 *  one with a title prompt, and switches into `<EditorHost>` mounted in a
 *  full-viewport overlay. */

import React, { useCallback, useEffect, useState } from "react";
import { EditorHost } from "./EditorHost";
import {
  createEditorRecord,
  deleteEditorRecord,
  listEditorRecords,
} from "./api";
import type { EditorKind, EditorRecord } from "./types";

interface EditorListProps {
  kind: EditorKind;
  title: string;
  newButtonLabel?: string;
}

export function EditorList({ kind, title, newButtonLabel }: EditorListProps): React.JSX.Element {
  const [rows, setRows] = useState<EditorRecord[] | null>(null);
  const [open, setOpen] = useState<EditorRecord | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const r = await listEditorRecords(kind);
      setRows(r);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [kind]);

  useEffect(() => { void reload(); }, [reload]);

  const handleNew = useCallback(async () => {
    const titlePrompt = typeof window !== "undefined"
      ? window.prompt(`Title for new ${kind}?`, "Untitled")
      : "Untitled";
    if (!titlePrompt) return;
    try {
      const created = await createEditorRecord(kind, { title: titlePrompt });
      await reload();
      setOpen(created);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [kind, reload]);

  const handleDelete = useCallback(async (id: string) => {
    if (typeof window !== "undefined" && !window.confirm("Delete this item?")) return;
    try {
      await deleteEditorRecord(kind, id);
      await reload();
    } catch (err) {
      setError((err as Error).message);
    }
  }, [kind, reload]);

  if (open) {
    return <EditorHost kind={kind} record={open} onClose={() => { setOpen(null); void reload(); }} />;
  }

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <header style={{ display: "flex", alignItems: "center", marginBottom: 16 }}>
        <h1 style={{ flex: 1, fontSize: 22 }}>{title}</h1>
        <button onClick={handleNew} type="button" style={{ padding: "8px 12px", fontSize: 14 }}>
          {newButtonLabel ?? "New"}
        </button>
      </header>
      {error && (
        <div style={{ background: "#fee", color: "#900", padding: 8, borderRadius: 6, marginBottom: 12 }}>
          {error}
        </div>
      )}
      {rows === null ? (
        <div>Loading…</div>
      ) : rows.length === 0 ? (
        <div style={{ padding: 32, textAlign: "center", color: "#666" }}>
          No items yet. Click <strong>{newButtonLabel ?? "New"}</strong> to create one.
        </div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #e5e5e5", textAlign: "left" }}>
              <th style={{ padding: 8 }}>Title</th>
              <th style={{ padding: 8 }}>Author</th>
              <th style={{ padding: 8 }}>Updated</th>
              <th style={{ padding: 8 }} />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
                <td style={{ padding: 8 }}>
                  <button onClick={() => setOpen(r)} style={{ background: "none", border: 0, color: "#06c", cursor: "pointer", padding: 0 }}>
                    {r.title}
                  </button>
                </td>
                <td style={{ padding: 8, color: "#555" }}>{r.createdBy}</td>
                <td style={{ padding: 8, color: "#777" }}>
                  {new Date(r.updatedAt).toLocaleString()}
                </td>
                <td style={{ padding: 8, textAlign: "right" }}>
                  <button onClick={() => void handleDelete(r.id)} style={{ color: "#a00", background: "none", border: 0, cursor: "pointer" }}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
