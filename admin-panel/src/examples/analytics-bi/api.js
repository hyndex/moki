import { apiFetch } from "@/runtime/auth";
export async function fetchBiCatalog() {
    const [explores, spaces, charts, dashboards, schedules, deliveryRuns, shares, validation,] = await Promise.all([
        apiFetch("/analytics-bi/explores"),
        apiFetch("/analytics-bi/spaces"),
        apiFetch("/analytics-bi/charts"),
        apiFetch("/analytics-bi/dashboards"),
        apiFetch("/analytics-bi/schedules"),
        apiFetch("/analytics-bi/delivery-runs"),
        apiFetch("/analytics-bi/shares"),
        apiFetch("/analytics-bi/validation"),
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
export function runBiQuery(query) {
    return apiFetch("/analytics-bi/query/run", {
        method: "POST",
        body: JSON.stringify({ query }),
    });
}
export function compileBiQuery(query) {
    return apiFetch("/analytics-bi/query/compile", {
        method: "POST",
        body: JSON.stringify({ query }),
    });
}
export function drillDownBiQuery(query, dimensionValues) {
    return apiFetch("/analytics-bi/query/drilldown", {
        method: "POST",
        body: JSON.stringify({ query, dimensionValues }),
    });
}
export function createBiChart(input) {
    return apiFetch("/analytics-bi/charts", {
        method: "POST",
        body: JSON.stringify(input),
    });
}
export function updateBiChart(id, input) {
    return apiFetch(`/analytics-bi/charts/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify(input),
    });
}
export function rollbackBiChart(id, version) {
    return apiFetch(`/analytics-bi/charts/${encodeURIComponent(id)}/rollback`, {
        method: "POST",
        body: JSON.stringify({ version }),
    });
}
export function fetchChartHistory(id) {
    return apiFetch(`/analytics-bi/charts/${encodeURIComponent(id)}/history`);
}
export function createBiDashboard(input) {
    return apiFetch("/analytics-bi/dashboards", {
        method: "POST",
        body: JSON.stringify(input),
    });
}
export function updateBiDashboard(id, input) {
    return apiFetch(`/analytics-bi/dashboards/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify(input),
    });
}
export function rollbackBiDashboard(id, version) {
    return apiFetch(`/analytics-bi/dashboards/${encodeURIComponent(id)}/rollback`, { method: "POST", body: JSON.stringify({ version }) });
}
export function fetchDashboardHistory(id) {
    return apiFetch(`/analytics-bi/dashboards/${encodeURIComponent(id)}/history`);
}
export function createBiSpace(input) {
    return apiFetch("/analytics-bi/spaces", {
        method: "POST",
        body: JSON.stringify(input),
    });
}
export function updateBiSpace(id, input) {
    return apiFetch(`/analytics-bi/spaces/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify(input),
    });
}
export function createBiShare(input) {
    return apiFetch("/analytics-bi/shares", {
        method: "POST",
        body: JSON.stringify(input),
    });
}
export function createBiSchedule(input) {
    return apiFetch("/analytics-bi/schedules", {
        method: "POST",
        body: JSON.stringify(input),
    });
}
export function runBiSchedule(id) {
    return apiFetch(`/analytics-bi/schedules/${encodeURIComponent(id)}/run`, {
        method: "POST",
    });
}
