import type { AnalyticsExplore, MetricQuery } from "./api";

export function defaultQuery(explore?: AnalyticsExplore): MetricQuery {
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

export function toggleDimension(query: MetricQuery, id: string): MetricQuery {
  const dimensions = query.dimensions.includes(id)
    ? query.dimensions.filter((item) => item !== id)
    : [...query.dimensions, id];
  return { ...query, dimensions };
}

export function toggleMetric(query: MetricQuery, id: string): MetricQuery {
  const metrics = query.metrics.includes(id)
    ? query.metrics.filter((item) => item !== id)
    : [...query.metrics, id];
  return { ...query, metrics };
}

export function matchesSearch(label: string, search: string): boolean {
  return label.toLowerCase().includes(search.trim().toLowerCase());
}

export function serializeQueryState(query: MetricQuery): string {
  return encodeURIComponent(JSON.stringify(query));
}

export function parseQueryState(raw: string | null): MetricQuery | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as Partial<MetricQuery>;
    if (!parsed || typeof parsed.exploreId !== "string") return null;
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
  } catch {
    return null;
  }
}

export function queryFromHash(hash: string, explores: readonly AnalyticsExplore[]): MetricQuery | null {
  const queryString = hash.split("?")[1] ?? "";
  const state = new URLSearchParams(queryString).get("q");
  const parsed = parseQueryState(state);
  if (!parsed) return null;
  return explores.some((explore) => explore.id === parsed.exploreId) ? parsed : null;
}

export function explorePathForQuery(query: MetricQuery): string {
  return `/analytics/explore?q=${serializeQueryState(query)}`;
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}
