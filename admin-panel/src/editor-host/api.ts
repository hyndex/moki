/** REST client for `/api/editors/<resource>/...`.
 *
 *  Hardened with:
 *    - `Idempotency-Key` on every create
 *    - `If-Match` on snapshot writes (optimistic locking)
 *    - cooperative cancel via AbortSignal
 *    - structured error parsing — server returns `{error, code, ...}` */

import type { EditorKind, EditorRecord } from "./types";

const RESOURCE_FOR: Record<EditorKind, string> = {
  spreadsheet: "spreadsheet",
  document: "document",
  slides: "slides",
  page: "page",
  whiteboard: "whiteboard",
};

function getAuthHeader(): Record<string, string> {
  const token = typeof localStorage !== "undefined" ? localStorage.getItem("auth-token") : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function apiBase(): string {
  const base =
    (typeof import.meta !== "undefined" ? import.meta.env?.VITE_API_BASE : undefined) ?? "/api";
  return base.toString().replace(/\/+$/, "");
}

function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Parse `{error, code, ...}` from a non-OK response. */
async function readErr(res: Response): Promise<Error> {
  let body: { error?: string; code?: string } | null = null;
  try { body = (await res.json()) as { error?: string; code?: string }; } catch { /* tolerate */ }
  const msg = body?.error ?? `HTTP ${res.status}`;
  const code = body?.code ?? "http-error";
  const err = new Error(msg) as Error & { code?: string; status?: number };
  err.code = code;
  err.status = res.status;
  return err;
}

export async function listEditorRecords(
  kind: EditorKind,
  signal?: AbortSignal,
): Promise<EditorRecord[]> {
  const res = await fetch(`${apiBase()}/editors/${RESOURCE_FOR[kind]}`, {
    headers: getAuthHeader(),
    credentials: "include",
    ...(signal && { signal }),
  });
  if (!res.ok) throw await readErr(res);
  const body = (await res.json()) as { rows: EditorRecord[] };
  return body.rows;
}

export async function createEditorRecord(
  kind: EditorKind,
  payload: { title: string; folder?: string; slug?: string; parentId?: string },
  signal?: AbortSignal,
): Promise<EditorRecord> {
  const res = await fetch(`${apiBase()}/editors/${RESOURCE_FOR[kind]}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": newIdempotencyKey(),
      ...getAuthHeader(),
    },
    credentials: "include",
    body: JSON.stringify(payload),
    ...(signal && { signal }),
  });
  if (!res.ok) throw await readErr(res);
  return (await res.json()) as EditorRecord;
}

export async function updateEditorRecord(
  kind: EditorKind,
  id: string,
  patch: Partial<EditorRecord>,
  signal?: AbortSignal,
): Promise<EditorRecord> {
  const res = await fetch(`${apiBase()}/editors/${RESOURCE_FOR[kind]}/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...getAuthHeader() },
    credentials: "include",
    body: JSON.stringify(patch),
    ...(signal && { signal }),
  });
  if (!res.ok) throw await readErr(res);
  return (await res.json()) as EditorRecord;
}

export async function deleteEditorRecord(
  kind: EditorKind,
  id: string,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch(`${apiBase()}/editors/${RESOURCE_FOR[kind]}/${id}`, {
    method: "DELETE",
    headers: getAuthHeader(),
    credentials: "include",
    ...(signal && { signal }),
  });
  if (!res.ok) throw await readErr(res);
}

export async function fetchEditorRecord(
  kind: EditorKind,
  id: string,
  signal?: AbortSignal,
): Promise<EditorRecord> {
  const res = await fetch(`${apiBase()}/editors/${RESOURCE_FOR[kind]}/${id}`, {
    headers: getAuthHeader(),
    credentials: "include",
    ...(signal && { signal }),
  });
  if (!res.ok) throw await readErr(res);
  return (await res.json()) as EditorRecord;
}

export async function fetchSnapshot(
  kind: EditorKind,
  id: string,
  which: "yjs" | "export",
  signal?: AbortSignal,
): Promise<{ bytes: Uint8Array; contentType: string; etag: string | null } | null> {
  const res = await fetch(
    `${apiBase()}/editors/${RESOURCE_FOR[kind]}/${id}/snapshot/${which}`,
    {
      headers: getAuthHeader(),
      credentials: "include",
      ...(signal && { signal }),
    },
  );
  if (res.status === 204) return null;
  if (!res.ok) throw await readErr(res);
  const buf = new Uint8Array(await res.arrayBuffer());
  return {
    bytes: buf,
    contentType: res.headers.get("content-type") ?? "application/octet-stream",
    etag: res.headers.get("etag"),
  };
}

export async function postSnapshot(
  kind: EditorKind,
  id: string,
  which: "yjs" | "export",
  bytes: Uint8Array,
  contentType: string,
  opts: { ifMatch?: string; signal?: AbortSignal } = {},
): Promise<{ size: number; etag: string }> {
  const headers: Record<string, string> = {
    "Content-Type": contentType,
    "Content-Length": String(bytes.byteLength),
    ...getAuthHeader(),
  };
  if (opts.ifMatch) headers["If-Match"] = opts.ifMatch;
  const res = await fetch(
    `${apiBase()}/editors/${RESOURCE_FOR[kind]}/${id}/snapshot/${which}`,
    {
      method: "POST",
      headers,
      credentials: "include",
      body: bytes as BodyInit,
      ...(opts.signal && { signal: opts.signal }),
    },
  );
  if (!res.ok) throw await readErr(res);
  return (await res.json()) as { size: number; etag: string };
}
