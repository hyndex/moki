import * as React from "react";
export const WorkspaceFilterContext = React.createContext(undefined);
/** Hook — returns the filter tree to apply to the given resource. Widgets
 *  that declare a resource should pass it; widgets that don't should call it
 *  with `undefined` to get the "applies-to-all" bucket only. */
export function useWorkspaceFilter(resource) {
    const state = React.useContext(WorkspaceFilterContext);
    return React.useMemo(() => {
        if (!state)
            return undefined;
        const scoped = resource ? state.byResource[resource] : undefined;
        return mergeFilters(state.all, scoped);
    }, [state, resource]);
}
/** AND-merge two filter trees. Returns undefined only when both are undefined.
 *  Collapses nested `and` groups to keep the shape flat. */
export function mergeFilters(a, b) {
    if (!a)
        return b;
    if (!b)
        return a;
    const aAnd = "and" in a ? a.and : [a];
    const bAnd = "and" in b ? b.and : [b];
    const merged = [...aAnd, ...bAnd];
    if (merged.length === 1)
        return merged[0];
    return { and: merged };
}
/** Build a per-resource filter state from a bag of `{field: value}` entries,
 *  honouring each field's `appliesTo` + `fallbackAll`. */
export function buildFilterState(fields, values) {
    const allLeaves = [];
    const byResourceLeaves = {};
    for (const f of fields) {
        const leaf = toLeaf(f, values[f.field]);
        if (!leaf)
            continue;
        const scoped = f.appliesTo && f.appliesTo.length > 0;
        if (!scoped) {
            allLeaves.push(leaf);
            continue;
        }
        for (const res of f.appliesTo) {
            (byResourceLeaves[res] ??= []).push(leaf);
        }
        if (f.fallbackAll)
            allLeaves.push(leaf);
    }
    const hasAll = allLeaves.length > 0;
    const resources = Object.keys(byResourceLeaves);
    if (!hasAll && resources.length === 0)
        return undefined;
    const all = hasAll ? collapse(allLeaves) : undefined;
    const byResource = {};
    for (const r of resources)
        byResource[r] = collapse(byResourceLeaves[r]);
    return { all, byResource };
}
function collapse(leaves) {
    if (leaves.length === 0)
        return undefined;
    if (leaves.length === 1)
        return leaves[0];
    return { and: leaves };
}
function toLeaf(f, v) {
    if (v === undefined || v === null || v === "")
        return null;
    if (Array.isArray(v) && v.length === 0)
        return null;
    if (f.kind === "text") {
        return { field: f.field, op: "contains", value: String(v) };
    }
    if (f.kind === "enum") {
        return { field: f.field, op: "eq", value: v };
    }
    if (f.kind === "boolean") {
        return { field: f.field, op: "eq", value: v === "true" || v === true };
    }
    if (f.kind === "date-range" && Array.isArray(v) && v.length === 2) {
        const [from, to] = v;
        if (from && to)
            return { field: f.field, op: "between", value: [from, to] };
        if (from)
            return { field: f.field, op: "gte", value: from };
        if (to)
            return { field: f.field, op: "lte", value: to };
    }
    return null;
}
/* ---- legacy shim: older callers expect a single FilterTree ---- */
/** @deprecated Use buildFilterState + useWorkspaceFilter(resource). */
export function buildFilterTree(fields, values) {
    const state = buildFilterState(fields, values);
    if (!state)
        return undefined;
    // For the legacy single-tree callers, only the "all" bucket is meaningful.
    return state.all;
}
