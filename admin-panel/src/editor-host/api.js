/** REST client for `/api/editors/<resource>/...`.
 *
 *  Hardened with:
 *    - `Idempotency-Key` on every create
 *    - `If-Match` on snapshot writes (optimistic locking)
 *    - cooperative cancel via AbortSignal
 *    - structured error parsing — server returns `{error, code, ...}`
 *
 *  Auth + tenant headers are sourced from the shared `authStore` so the
 *  editor flows participate in the same session lifecycle as every other
 *  REST call (logout clears the token, tenant switching re-targets, 401
 *  triggers session clear). */
import { authStore } from "@/runtime/auth";
const RESOURCE_FOR = {
    spreadsheet: "spreadsheet",
    document: "document",
    slides: "slides",
    page: "page",
    whiteboard: "whiteboard",
};
function getAuthHeaders() {
    const headers = {};
    if (authStore.token)
        headers.Authorization = `Bearer ${authStore.token}`;
    if (authStore.activeTenant?.id)
        headers["x-tenant"] = authStore.activeTenant.id;
    return headers;
}
function apiBase() {
    const base = (typeof import.meta !== "undefined" ? import.meta.env?.VITE_API_BASE : undefined) ?? "/api";
    return base.toString().replace(/\/+$/, "");
}
function newIdempotencyKey() {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
        return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
/** Parse `{error, code, ...}` from a non-OK response. */
async function readErr(res) {
    let body = null;
    try {
        body = (await res.json());
    }
    catch { /* tolerate */ }
    const msg = body?.error ?? `HTTP ${res.status}`;
    const code = body?.code ?? "http-error";
    const err = new Error(msg);
    err.code = code;
    err.status = res.status;
    return err;
}
export async function listEditorRecords(kind, signal) {
    const res = await fetch(`${apiBase()}/editors/${RESOURCE_FOR[kind]}`, {
        headers: getAuthHeaders(),
        credentials: "include",
        ...(signal && { signal }),
    });
    if (!res.ok)
        throw await readErr(res);
    const body = (await res.json());
    return body.rows;
}
export async function createEditorRecord(kind, payload, signal) {
    const res = await fetch(`${apiBase()}/editors/${RESOURCE_FOR[kind]}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": newIdempotencyKey(),
            ...getAuthHeaders(),
        },
        credentials: "include",
        body: JSON.stringify(payload),
        ...(signal && { signal }),
    });
    if (!res.ok)
        throw await readErr(res);
    return (await res.json());
}
export async function updateEditorRecord(kind, id, patch, signal) {
    const res = await fetch(`${apiBase()}/editors/${RESOURCE_FOR[kind]}/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        credentials: "include",
        body: JSON.stringify(patch),
        ...(signal && { signal }),
    });
    if (!res.ok)
        throw await readErr(res);
    return (await res.json());
}
export async function deleteEditorRecord(kind, id, signal) {
    const res = await fetch(`${apiBase()}/editors/${RESOURCE_FOR[kind]}/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
        credentials: "include",
        ...(signal && { signal }),
    });
    if (!res.ok)
        throw await readErr(res);
}
export async function fetchEditorRecord(kind, id, signal) {
    const res = await fetch(`${apiBase()}/editors/${RESOURCE_FOR[kind]}/${id}`, {
        headers: getAuthHeaders(),
        credentials: "include",
        ...(signal && { signal }),
    });
    if (!res.ok)
        throw await readErr(res);
    return (await res.json());
}
export async function fetchSnapshot(kind, id, which, signal) {
    const res = await fetch(`${apiBase()}/editors/${RESOURCE_FOR[kind]}/${id}/snapshot/${which}`, {
        headers: getAuthHeaders(),
        credentials: "include",
        ...(signal && { signal }),
    });
    if (res.status === 204)
        return null;
    if (!res.ok)
        throw await readErr(res);
    const buf = new Uint8Array(await res.arrayBuffer());
    return {
        bytes: buf,
        contentType: res.headers.get("content-type") ?? "application/octet-stream",
        etag: res.headers.get("etag"),
    };
}
export async function postSnapshot(kind, id, which, bytes, contentType, opts = {}) {
    const headers = {
        "Content-Type": contentType,
        "Content-Length": String(bytes.byteLength),
        ...getAuthHeaders(),
    };
    if (opts.ifMatch)
        headers["If-Match"] = opts.ifMatch;
    const res = await fetch(`${apiBase()}/editors/${RESOURCE_FOR[kind]}/${id}/snapshot/${which}`, {
        method: "POST",
        headers,
        credentials: "include",
        body: bytes,
        ...(opts.signal && { signal: opts.signal }),
    });
    if (!res.ok)
        throw await readErr(res);
    return (await res.json());
}
export async function listAcl(kind, id, signal) {
    const res = await fetch(`${apiBase()}/editors/${RESOURCE_FOR[kind]}/${id}/acl`, {
        headers: getAuthHeaders(),
        credentials: "include",
        ...(signal && { signal }),
    });
    if (!res.ok)
        throw await readErr(res);
    return (await res.json());
}
export async function shareByEmail(kind, id, emails, role, signal) {
    const res = await fetch(`${apiBase()}/editors/${RESOURCE_FOR[kind]}/${id}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        credentials: "include",
        body: JSON.stringify({ emails, role }),
        ...(signal && { signal }),
    });
    if (!res.ok)
        throw await readErr(res);
    return (await res.json());
}
export async function revokeAclEntry(kind, id, subjectKind, subjectId, signal) {
    const res = await fetch(`${apiBase()}/editors/${RESOURCE_FOR[kind]}/${id}/acl/${subjectKind}/${encodeURIComponent(subjectId)}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
        credentials: "include",
        ...(signal && { signal }),
    });
    if (!res.ok)
        throw await readErr(res);
}
export async function createPublicLink(kind, id, role = "viewer", signal) {
    const res = await fetch(`${apiBase()}/editors/${RESOURCE_FOR[kind]}/${id}/public-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        credentials: "include",
        body: JSON.stringify({ role }),
        ...(signal && { signal }),
    });
    if (!res.ok)
        throw await readErr(res);
    return (await res.json());
}
