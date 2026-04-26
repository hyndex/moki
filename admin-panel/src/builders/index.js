/** Fluent view/resource builders.
 *  Intentionally thin: `defineX` is an `identity + validation` pass.
 *  The payoff is inference — plugins get strict types without extra generics.
 *
 *  For plugin authoring, import `definePlugin` from `@/contracts/plugin-v2`.
 *  This module no longer exports a legacy `Plugin` shape — v2 is the only
 *  supported contract. */
export function defineListView(view) {
    return { ...view, type: "list" };
}
export function defineFormView(view) {
    return { ...view, type: "form" };
}
export function defineDetailView(view) {
    return { ...view, type: "detail" };
}
export function defineDashboard(view) {
    return { ...view, type: "dashboard" };
}
export function defineCustomView(view) {
    return { ...view, type: "custom" };
}
export function defineKanbanView(view) {
    return { ...view, type: "kanban" };
}
export function defineResource(resource) {
    validateResource(resource);
    return resource;
}
/* ---- Validation ---------------------------------------------------------- */
function validateResource(r) {
    if (!r.id || typeof r.id !== "string") {
        throw new Error(`[defineResource] resource.id is required`);
    }
    if (!r.schema || typeof r.schema.parse !== "function") {
        throw new Error(`[defineResource] resource "${r.id}" missing zod schema`);
    }
}
