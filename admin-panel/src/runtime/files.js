import * as React from "react";
import { authStore, ApiError } from "./auth";
const BASE = import.meta.env?.VITE_API_BASE ?? "/api";
export async function uploadFile(file, opts = {}) {
    const form = new FormData();
    form.append("file", file);
    if (opts.resource)
        form.append("resource", opts.resource);
    if (opts.recordId)
        form.append("recordId", opts.recordId);
    const res = await fetch(`${BASE}/files`, {
        method: "POST",
        body: form,
        headers: authStore.token
            ? { Authorization: `Bearer ${authStore.token}` }
            : undefined,
    });
    if (!res.ok) {
        let body;
        try {
            body = await res.json();
        }
        catch {
            /* ignore */
        }
        throw new ApiError(res.status, body, `upload failed (${res.status})`);
    }
    return (await res.json());
}
export function useRecordFiles(resource, recordId) {
    const [state, setState] = React.useState({ data: [], loading: true });
    const reload = React.useCallback(() => {
        if (!recordId) {
            setState({ data: [], loading: false });
            return;
        }
        setState((s) => ({ ...s, loading: true }));
        const q = new URLSearchParams({ resource, recordId });
        fetch(`${BASE}/files?${q}`, {
            headers: authStore.token ? { Authorization: `Bearer ${authStore.token}` } : {},
        })
            .then(async (r) => {
            if (!r.ok)
                throw new Error(`list failed ${r.status}`);
            return (await r.json());
        })
            .then((j) => setState({ data: j.rows, loading: false }))
            .catch((error) => setState({ data: [], loading: false, error }));
    }, [resource, recordId]);
    React.useEffect(() => reload(), [reload]);
    return { ...state, reload };
}
export function humanBytes(bytes) {
    if (bytes < 1024)
        return `${bytes} B`;
    if (bytes < 1024 * 1024)
        return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024)
        return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}
