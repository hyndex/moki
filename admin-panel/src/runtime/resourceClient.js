import { QueryCache } from "./queryCache";
/** The façade plugins + views talk to. Wraps adapter calls with cache +
 *  invalidation. Plugin code should never touch the adapter directly. */
export class ResourceClient {
    adapter;
    cache = new QueryCache();
    constructor(adapter) {
        this.adapter = adapter;
    }
    key(resource, op, params) {
        return ["resource", resource, op, params];
    }
    list(resource, query = {}) {
        return this.cache.fetch(JSON.stringify({ resource, op: "list", query }), () => this.adapter.list(resource, query));
    }
    get(resource, id) {
        return this.cache.fetch(JSON.stringify({ resource, op: "get", id }), () => this.adapter.get(resource, id));
    }
    async create(resource, data) {
        const row = await this.adapter.create(resource, data);
        this.cache.invalidateResource(resource);
        return row;
    }
    async update(resource, id, data) {
        const row = await this.adapter.update(resource, id, data);
        this.cache.invalidateResource(resource);
        return row;
    }
    async delete(resource, id) {
        await this.adapter.delete(resource, id);
        this.cache.invalidateResource(resource);
    }
    /** Force refresh of all cached queries for a resource. */
    refresh(resource) {
        if (resource)
            this.cache.invalidateResource(resource);
        else
            this.cache.clear();
    }
}
