/** Typed pub/sub — used by the runtime resource client + command bus. */
export class Emitter {
    listeners = new Map();
    on(event, fn) {
        const set = this.listeners.get(event) ?? new Set();
        set.add(fn);
        this.listeners.set(event, set);
        return () => set.delete(fn);
    }
    emit(event, payload) {
        const set = this.listeners.get(event);
        if (!set)
            return;
        for (const fn of set) {
            try {
                fn(payload);
            }
            catch (err) {
                console.error(`[emitter] listener for "${String(event)}" threw`, err);
            }
        }
    }
    clear() {
        this.listeners.clear();
    }
}
