import { apiFetch } from "./auth";
/** HTTP ResourceAdapter — one class, hits the backend for every call.
 *  Mirrors the MockBackend shape so the ResourceClient stays unchanged. */
export class RestAdapter {
    toParams(query) {
        const p = new URLSearchParams();
        if (query.page != null)
            p.set("page", String(query.page));
        if (query.pageSize != null)
            p.set("pageSize", String(query.pageSize));
        if (query.sort) {
            p.set("sort", query.sort.field);
            p.set("dir", query.sort.dir);
        }
        if (query.search)
            p.set("search", query.search);
        for (const [k, v] of Object.entries(query.filters ?? {})) {
            if (v === undefined || v === null || v === "")
                continue;
            // Special control flags — promote to top-level query params
            // rather than `filter[__x]` so the backend reads them as
            // ?includeDeleted=1 / ?deletedOnly=1.
            if (k === "__includeDeleted" && (v === "1" || v === true)) {
                p.set("includeDeleted", "1");
                continue;
            }
            if (k === "__deletedOnly" && (v === "1" || v === true)) {
                p.set("deletedOnly", "1");
                continue;
            }
            if (Array.isArray(v)) {
                if (v.length === 0)
                    continue;
                p.set(`filter[${k}]`, String(v[0])); // first value — backend supports single-value filters
                continue;
            }
            if (typeof v === "object" && "from" in v) {
                const { from, to } = v;
                if (from)
                    p.set(`filter[${k}__gte]`, from);
                if (to)
                    p.set(`filter[${k}__lte]`, to);
                continue;
            }
            p.set(`filter[${k}]`, String(v));
        }
        const s = p.toString();
        return s ? `?${s}` : "";
    }
    async list(resource, query) {
        return apiFetch(`/resources/${encodeURIComponent(resource)}${this.toParams(query)}`);
    }
    async get(resource, id) {
        try {
            return await apiFetch(`/resources/${encodeURIComponent(resource)}/${encodeURIComponent(id)}`);
        }
        catch (err) {
            if (err.status === 404)
                return null;
            throw err;
        }
    }
    create(resource, data) {
        return apiFetch(`/resources/${encodeURIComponent(resource)}`, { method: "POST", body: JSON.stringify(data) });
    }
    update(resource, id, data) {
        return apiFetch(`/resources/${encodeURIComponent(resource)}/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(data) });
    }
    async delete(resource, id) {
        await apiFetch(`/resources/${encodeURIComponent(resource)}/${encodeURIComponent(id)}`, { method: "DELETE" });
    }
}
