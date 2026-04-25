import { apiFetch } from "@/runtime/auth";
import type {
  AnalyticsExplore,
  AnalyticsSpace,
  DashboardContent,
  DeliveryRun,
  MetricQuery,
  QueryResult,
  SavedChart,
  ScheduledDelivery,
  ShareUrl,
  ValidationResult,
} from "../../../../libraries/gutu-lib-analytics/framework/libraries/analytics/src/index";

export type {
  AnalyticsExplore,
  AnalyticsSpace,
  DashboardContent,
  DeliveryRun,
  MetricQuery,
  QueryResult,
  SavedChart,
  ScheduledDelivery,
  ShareUrl,
  ValidationResult,
};

export interface BiCatalog {
  explores: AnalyticsExplore[];
  spaces: AnalyticsSpace[];
  charts: SavedChart[];
  dashboards: DashboardContent[];
  schedules: ScheduledDelivery[];
  deliveryRuns: DeliveryRun[];
  shares: ShareUrl[];
  validation: ValidationResult[];
}

type Rows<T> = { rows: T[] };

export async function fetchBiCatalog(): Promise<BiCatalog> {
  const [
    explores,
    spaces,
    charts,
    dashboards,
    schedules,
    deliveryRuns,
    shares,
    validation,
  ] = await Promise.all([
    apiFetch<Rows<AnalyticsExplore>>("/analytics-bi/explores"),
    apiFetch<Rows<AnalyticsSpace>>("/analytics-bi/spaces"),
    apiFetch<Rows<SavedChart>>("/analytics-bi/charts"),
    apiFetch<Rows<DashboardContent>>("/analytics-bi/dashboards"),
    apiFetch<Rows<ScheduledDelivery>>("/analytics-bi/schedules"),
    apiFetch<Rows<DeliveryRun>>("/analytics-bi/delivery-runs"),
    apiFetch<Rows<ShareUrl>>("/analytics-bi/shares"),
    apiFetch<Rows<ValidationResult>>("/analytics-bi/validation"),
  ]);
  return {
    explores: explores.rows,
    spaces: spaces.rows,
    charts: charts.rows,
    dashboards: dashboards.rows,
    schedules: schedules.rows,
    deliveryRuns: deliveryRuns.rows,
    shares: shares.rows,
    validation: validation.rows,
  };
}

export function runBiQuery(query: MetricQuery): Promise<QueryResult> {
  return apiFetch<QueryResult>("/analytics-bi/query/run", {
    method: "POST",
    body: JSON.stringify({ query }),
  });
}

export function compileBiQuery(query: MetricQuery): Promise<{ sql: string; warnings: string[] }> {
  return apiFetch<{ sql: string; warnings: string[] }>("/analytics-bi/query/compile", {
    method: "POST",
    body: JSON.stringify({ query }),
  });
}

export function drillDownBiQuery(
  query: MetricQuery,
  dimensionValues?: Record<string, unknown>,
): Promise<{ rows: Record<string, unknown>[] }> {
  return apiFetch<{ rows: Record<string, unknown>[] }>("/analytics-bi/query/drilldown", {
    method: "POST",
    body: JSON.stringify({ query, dimensionValues }),
  });
}

export function createBiChart(input: Partial<SavedChart>): Promise<SavedChart> {
  return apiFetch<SavedChart>("/analytics-bi/charts", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateBiChart(id: string, input: Partial<SavedChart>): Promise<SavedChart> {
  return apiFetch<SavedChart>(`/analytics-bi/charts/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function rollbackBiChart(id: string, version: number): Promise<SavedChart> {
  return apiFetch<SavedChart>(`/analytics-bi/charts/${encodeURIComponent(id)}/rollback`, {
    method: "POST",
    body: JSON.stringify({ version }),
  });
}

export function fetchChartHistory(id: string) {
  return apiFetch<Rows<{ id: string; version: number; createdAt: string; reason?: string }>>(
    `/analytics-bi/charts/${encodeURIComponent(id)}/history`,
  );
}

export function createBiDashboard(input: Partial<DashboardContent>): Promise<DashboardContent> {
  return apiFetch<DashboardContent>("/analytics-bi/dashboards", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateBiDashboard(
  id: string,
  input: Partial<DashboardContent>,
): Promise<DashboardContent> {
  return apiFetch<DashboardContent>(`/analytics-bi/dashboards/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function rollbackBiDashboard(id: string, version: number): Promise<DashboardContent> {
  return apiFetch<DashboardContent>(
    `/analytics-bi/dashboards/${encodeURIComponent(id)}/rollback`,
    { method: "POST", body: JSON.stringify({ version }) },
  );
}

export function fetchDashboardHistory(id: string) {
  return apiFetch<Rows<{ id: string; version: number; createdAt: string; reason?: string }>>(
    `/analytics-bi/dashboards/${encodeURIComponent(id)}/history`,
  );
}

export function createBiSpace(input: Partial<AnalyticsSpace>): Promise<AnalyticsSpace> {
  return apiFetch<AnalyticsSpace>("/analytics-bi/spaces", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateBiSpace(id: string, input: Partial<AnalyticsSpace>): Promise<AnalyticsSpace> {
  return apiFetch<AnalyticsSpace>(`/analytics-bi/spaces/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function createBiShare(input: Partial<ShareUrl>): Promise<ShareUrl> {
  return apiFetch<ShareUrl>("/analytics-bi/shares", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function createBiSchedule(input: Partial<ScheduledDelivery>): Promise<ScheduledDelivery> {
  return apiFetch<ScheduledDelivery>("/analytics-bi/schedules", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function runBiSchedule(id: string): Promise<DeliveryRun> {
  return apiFetch<DeliveryRun>(`/analytics-bi/schedules/${encodeURIComponent(id)}/run`, {
    method: "POST",
  });
}
