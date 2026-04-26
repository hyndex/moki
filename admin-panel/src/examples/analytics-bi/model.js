export function defaultQuery(explore) {
    return {
        exploreId: explore?.id ?? "",
        dimensions: [...(explore?.defaultQuery?.dimensions ?? explore?.dimensions.slice(0, 1).map((d) => d.id) ?? [])],
        metrics: [...(explore?.defaultQuery?.metrics ?? explore?.metrics.slice(0, 1).map((m) => m.id) ?? [])],
        filters: [...(explore?.defaultQuery?.filters ?? [])],
        sorts: [...(explore?.defaultQuery?.sorts ?? [])],
        limit: explore?.defaultQuery?.limit ?? 100,
        tableCalculations: [],
        customMetrics: [],
    };
}
export function toggleDimension(query, id) {
    const dimensions = query.dimensions.includes(id)
        ? query.dimensions.filter((item) => item !== id)
        : [...query.dimensions, id];
    return { ...query, dimensions };
}
export function toggleMetric(query, id) {
    const metrics = query.metrics.includes(id)
        ? query.metrics.filter((item) => item !== id)
        : [...query.metrics, id];
    return { ...query, metrics };
}
export function matchesSearch(label, search) {
    return label.toLowerCase().includes(search.trim().toLowerCase());
}
export function serializeQueryState(query) {
    return encodeURIComponent(JSON.stringify(query));
}
export function parseQueryState(raw) {
    if (!raw)
        return null;
    try {
        const parsed = JSON.parse(decodeURIComponent(raw));
        if (!parsed || typeof parsed.exploreId !== "string")
            return null;
        return {
            exploreId: parsed.exploreId,
            dimensions: Array.isArray(parsed.dimensions) ? parsed.dimensions.filter(isString) : [],
            metrics: Array.isArray(parsed.metrics) ? parsed.metrics.filter(isString) : [],
            filters: Array.isArray(parsed.filters) ? parsed.filters : [],
            sorts: Array.isArray(parsed.sorts) ? parsed.sorts : [],
            limit: typeof parsed.limit === "number" ? parsed.limit : 100,
            tableCalculations: Array.isArray(parsed.tableCalculations) ? parsed.tableCalculations : [],
            customMetrics: Array.isArray(parsed.customMetrics) ? parsed.customMetrics : [],
        };
    }
    catch {
        return null;
    }
}
export function queryFromHash(hash, explores) {
    const queryString = hash.split("?")[1] ?? "";
    const state = new URLSearchParams(queryString).get("q");
    const parsed = parseQueryState(state);
    if (!parsed)
        return null;
    return explores.some((explore) => explore.id === parsed.exploreId) ? parsed : null;
}
export function explorePathForQuery(query) {
    return `/analytics/explore?q=${serializeQueryState(query)}`;
}
function isString(value) {
    return typeof value === "string";
}
