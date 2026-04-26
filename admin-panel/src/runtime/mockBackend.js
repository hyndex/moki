import { uuid } from "@/lib/id";
/** In-memory mock — production adapters (REST/GraphQL) implement the same
 *  ResourceAdapter contract. Seed data is plugin-provided at registration. */
export class MockBackend {
    stores = new Map();
    /** Artificial latency in ms — simulates real networks for UX testing. */
    latency = 120;
    seed(resource, rows) {
        const m = this.ensure(resource);
        for (const row of rows) {
            const id = String(row.id ?? uuid());
            m.set(id, { ...row, id });
        }
    }
    ensure(resource) {
        let m = this.stores.get(resource);
        if (!m) {
            m = new Map();
            this.stores.set(resource, m);
        }
        return m;
    }
    async list(resource, query) {
        await sleep(this.latency);
        const all = Array.from(this.ensure(resource).values());
        let rows = all;
        if (query.search) {
            const needle = query.search.toLowerCase();
            rows = rows.filter((r) => Object.values(r).some((v) => typeof v === "string" && v.toLowerCase().includes(needle)));
        }
        if (query.filters) {
            for (const [field, value] of Object.entries(query.filters)) {
                if (value === undefined || value === null || value === "")
                    continue;
                if (Array.isArray(value)) {
                    if (value.length > 0)
                        rows = rows.filter((r) => value.includes(r[field]));
                    continue;
                }
                if (typeof value === "object" && "from" in value) {
                    const { from, to } = value;
                    rows = rows.filter((r) => {
                        const v = r[field];
                        if (!v)
                            return false;
                        if (from && v < from)
                            return false;
                        if (to && v > to)
                            return false;
                        return true;
                    });
                    continue;
                }
                rows = rows.filter((r) => r[field] === value);
            }
        }
        if (query.sort) {
            const { field, dir } = query.sort;
            rows = [...rows].sort((a, b) => {
                const av = a[field];
                const bv = b[field];
                if (av == null && bv == null)
                    return 0;
                if (av == null)
                    return dir === "asc" ? -1 : 1;
                if (bv == null)
                    return dir === "asc" ? 1 : -1;
                if (av < bv)
                    return dir === "asc" ? -1 : 1;
                if (av > bv)
                    return dir === "asc" ? 1 : -1;
                return 0;
            });
        }
        const total = rows.length;
        const page = Math.max(1, query.page ?? 1);
        const pageSize = Math.max(1, query.pageSize ?? 25);
        const start = (page - 1) * pageSize;
        return { rows: rows.slice(start, start + pageSize), total, page, pageSize };
    }
    async get(resource, id) {
        await sleep(this.latency);
        return this.ensure(resource).get(id) ?? null;
    }
    async create(resource, data) {
        await sleep(this.latency);
        const id = String(data.id ?? uuid());
        const row = { ...data, id, createdAt: new Date().toISOString() };
        this.ensure(resource).set(id, row);
        return row;
    }
    async update(resource, id, data) {
        await sleep(this.latency);
        const store = this.ensure(resource);
        const existing = store.get(id);
        if (!existing)
            throw new Error(`[mock] ${resource}/${id} not found`);
        const next = { ...existing, ...data, id, updatedAt: new Date().toISOString() };
        store.set(id, next);
        return next;
    }
    async delete(resource, id) {
        await sleep(this.latency);
        const store = this.ensure(resource);
        if (!store.delete(id))
            throw new Error(`[mock] ${resource}/${id} not found`);
    }
}
function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}
