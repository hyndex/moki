import { authStore } from "./auth";
const FLUSH_INTERVAL_MS = 4000;
const BATCH_MAX = 50;
const SESSION_KEY = "gutu-admin-session-id";
function ensureSessionId() {
    if (typeof window === "undefined")
        return "server";
    try {
        const existing = window.sessionStorage.getItem(SESSION_KEY);
        if (existing)
            return existing;
        const fresh = Math.random().toString(36).slice(2) + Date.now().toString(36);
        window.sessionStorage.setItem(SESSION_KEY, fresh);
        return fresh;
    }
    catch {
        return Math.random().toString(36).slice(2);
    }
}
class AnalyticsEmitterImpl {
    sinks = new Map();
    queue = [];
    meta;
    flushTimer = null;
    constructor(initial = {}) {
        this.meta = {
            route: typeof window !== "undefined" ? window.location.hash.slice(1) || "/" : "/",
            sessionId: ensureSessionId(),
            at: new Date().toISOString(),
            ...initial,
        };
        if (typeof window !== "undefined") {
            this.flushTimer = setInterval(() => void this.flush(), FLUSH_INTERVAL_MS);
            window.addEventListener("beforeunload", () => {
                void this.flush();
            });
        }
    }
    emit(name, props) {
        const event = {
            name,
            meta: { ...this.meta, at: new Date().toISOString() },
            props,
        };
        this.queue.push(event);
        if (this.queue.length >= BATCH_MAX) {
            void this.flush();
        }
    }
    addSink(sink) {
        this.sinks.set(sink.id, sink);
        return () => this.sinks.delete(sink.id);
    }
    async flush() {
        if (this.queue.length === 0)
            return;
        const batch = this.queue;
        this.queue = [];
        await Promise.all(Array.from(this.sinks.values()).map(async (sink) => {
            try {
                await sink.send(batch);
            }
            catch (err) {
                if (typeof console !== "undefined") {
                    console.warn(`[analytics] sink ${sink.id} failed`, err);
                }
            }
        }));
    }
    setMeta(patch) {
        this.meta = { ...this.meta, ...patch };
    }
    dispose() {
        if (this.flushTimer)
            clearInterval(this.flushTimer);
        this.flushTimer = null;
    }
}
export function createAnalytics(initial) {
    return new AnalyticsEmitterImpl(initial);
}
/** Dev sink — pretty-prints to console, grouped by name. */
export const consoleSink = {
    id: "console",
    send(events) {
        if (typeof console === "undefined")
            return;
        const byName = new Map();
        for (const ev of events) {
            const bucket = byName.get(ev.name) ?? [];
            bucket.push(ev);
            byName.set(ev.name, bucket);
        }
        for (const [name, bucket] of byName) {
            console.debug(`[analytics] ${name} (${bucket.length})`, bucket.map((e) => e.props));
        }
    },
};
/** REST sink — POSTs batches to `/api/analytics/events`. Silently degrades. */
export const restSink = {
    id: "rest",
    async send(events) {
        if (typeof fetch === "undefined")
            return;
        try {
            const headers = new Headers({ "content-type": "application/json" });
            if (authStore.token)
                headers.set("authorization", `Bearer ${authStore.token}`);
            const res = await fetch("/api/analytics/events", {
                method: "POST",
                headers,
                body: JSON.stringify({ events }),
                keepalive: true,
            });
            if (!res.ok && res.status !== 404) {
                // 404 means endpoint not implemented server-side yet — silently drop.
                throw new Error(`analytics: ${res.status}`);
            }
        }
        catch {
            /* best-effort */
        }
    },
};
