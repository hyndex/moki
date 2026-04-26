import { Emitter } from "@/lib/emitter";
const EMPTY_STATE = Object.freeze({
    status: "idle",
    updatedAt: 0,
});
export class QueryCache {
    entries = new Map();
    emitter = new Emitter();
    serialize(key) {
        if (typeof key === "string")
            return key;
        return JSON.stringify(key);
    }
    /** Returns a STABLE reference — required by useSyncExternalStore.
     *  Never construct a new object inline here, or React will loop. */
    get(key) {
        const k = this.serialize(key);
        const entry = this.entries.get(k);
        if (entry)
            return entry.state;
        return EMPTY_STATE;
    }
    subscribe(key, fn) {
        const k = this.serialize(key);
        return this.emitter.on("change", (p) => {
            if (p.key === k)
                fn();
        });
    }
    subscribeAll(fn) {
        return this.emitter.on("change", (p) => fn(p.key));
    }
    async fetch(key, fetcher, force = false) {
        const k = this.serialize(key);
        const entry = this.entries.get(k) ??
            { state: { status: "idle", updatedAt: 0 } };
        if (!force && entry.inflight)
            return entry.inflight;
        if (!force &&
            entry.state.status === "success" &&
            Date.now() - entry.state.updatedAt < 500) {
            return entry.state.data;
        }
        entry.state = { ...entry.state, status: "loading" };
        this.entries.set(k, entry);
        this.emitter.emit("change", { key: k });
        const promise = fetcher()
            .then((data) => {
            entry.state = { data, status: "success", updatedAt: Date.now() };
            entry.inflight = undefined;
            this.emitter.emit("change", { key: k });
            return data;
        })
            .catch((error) => {
            entry.state = { ...entry.state, status: "error", error };
            entry.inflight = undefined;
            this.emitter.emit("change", { key: k });
            throw error;
        });
        entry.inflight = promise;
        return promise;
    }
    invalidate(predicate) {
        const match = typeof predicate === "string"
            ? (k) => k === predicate || k.startsWith(`${predicate}:`)
            : predicate;
        for (const k of Array.from(this.entries.keys())) {
            if (match(k)) {
                this.entries.delete(k);
                this.emitter.emit("change", { key: k });
            }
        }
    }
    invalidateResource(resource) {
        this.invalidate((k) => k.includes(`"resource":"${resource}"`));
    }
    clear() {
        this.entries.clear();
        this.emitter.clear();
    }
}
