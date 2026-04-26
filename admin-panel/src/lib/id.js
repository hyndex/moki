let _id = 0;
/** Monotonic, collision-safe id for client-only primitives. */
export function nextId(prefix = "gutu") {
    _id += 1;
    return `${prefix}-${_id}`;
}
/** RFC4122-ish v4 — adequate for mock/demo resources; never used for auth. */
export function uuid() {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
        return crypto.randomUUID();
    }
    const rnd = () => Math.floor(Math.random() * 0xffff).toString(16).padStart(4, "0");
    return `${rnd()}${rnd()}-${rnd()}-${rnd()}-${rnd()}-${rnd()}${rnd()}${rnd()}`;
}
