import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import * as React from "react";
import { AlertTriangle, BarChart3, CheckCircle2, Clock, Copy, Database, FileClock, Filter, FolderTree, Gauge, GripVertical, History, Link2, ListFilter, MapPin, Maximize2, Minimize2, Plus, RotateCcw, Save, Search, Share2, Trash2, Type, } from "lucide-react";
import { defineCustomView } from "@/builders";
import { PageHeader } from "@/admin-primitives/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/admin-primitives/Card";
import { EmptyStateFramework } from "@/admin-primitives/EmptyStateFramework";
import { BarChart } from "@/admin-primitives/charts/BarChart";
import { LineChart } from "@/admin-primitives/charts/LineChart";
import { Donut } from "@/admin-primitives/charts/Donut";
import { Funnel } from "@/admin-primitives/charts/Funnel";
import { Button } from "@/primitives/Button";
import { Badge } from "@/primitives/Badge";
import { Input } from "@/primitives/Input";
import { Textarea } from "@/primitives/Textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from "@/primitives/Select";
import { Spinner } from "@/primitives/Spinner";
import { navigateTo, useHash } from "@/views/useRoute";
import { cn } from "@/lib/cn";
import { compileBiQuery, createBiChart, createBiDashboard, createBiSchedule, createBiShare, createBiSpace, drillDownBiQuery, fetchBiCatalog, fetchChartHistory, fetchDashboardHistory, rollbackBiChart, rollbackBiDashboard, runBiQuery, runBiSchedule, updateBiChart, updateBiDashboard, } from "./api";
import { defaultQuery, explorePathForQuery, matchesSearch, queryFromHash, toggleDimension, toggleMetric, } from "./model";
const CHART_KIND_OPTIONS = [
    "table",
    "bar",
    "line",
    "area",
    "donut",
    "funnel",
    "big_number",
    "gauge",
    "treemap",
    "map",
];
export const analyticsExploreView = defineCustomView({
    id: "analytics-bi.explore.view",
    title: "BI Explorer",
    resource: "analytics-bi.explore",
    render: () => _jsx(BiWorkbench, { kind: "explore" }),
});
export const analyticsChartsView = defineCustomView({
    id: "analytics-bi.charts.view",
    title: "Charts",
    resource: "analytics-bi.chart",
    render: () => _jsx(BiWorkbench, { kind: "charts" }),
});
export const analyticsDashboardsView = defineCustomView({
    id: "analytics-bi.dashboards.view",
    title: "Dashboards",
    resource: "analytics-bi.dashboard-content",
    render: () => _jsx(BiWorkbench, { kind: "dashboards" }),
});
export const analyticsSpacesView = defineCustomView({
    id: "analytics-bi.spaces.view",
    title: "Spaces",
    resource: "analytics-bi.space",
    render: () => _jsx(BiWorkbench, { kind: "spaces" }),
});
export const analyticsMetricsView = defineCustomView({
    id: "analytics-bi.metrics.view",
    title: "Metrics",
    resource: "analytics-bi.explore",
    render: () => _jsx(BiWorkbench, { kind: "metrics" }),
});
export const analyticsSqlRunnerView = defineCustomView({
    id: "analytics-bi.sql-runner.view",
    title: "SQL Runner",
    resource: "analytics-bi.explore",
    render: () => _jsx(BiWorkbench, { kind: "sql" }),
});
export const analyticsSchedulesView = defineCustomView({
    id: "analytics-bi.schedules.view",
    title: "Schedules",
    resource: "analytics-bi.schedule",
    render: () => _jsx(BiWorkbench, { kind: "schedules" }),
});
export const analyticsValidationView = defineCustomView({
    id: "analytics-bi.validation.view",
    title: "Validation",
    resource: "analytics-bi.validation-result",
    render: () => _jsx(BiWorkbench, { kind: "validation" }),
});
export const analyticsShareView = defineCustomView({
    id: "analytics-bi.share.view",
    title: "Shared BI",
    resource: "analytics-bi.share-url",
    render: () => _jsx(BiWorkbench, { kind: "share" }),
});
export const analyticsBiProductViews = [
    analyticsExploreView,
    analyticsChartsView,
    analyticsDashboardsView,
    analyticsSpacesView,
    analyticsMetricsView,
    analyticsSqlRunnerView,
    analyticsSchedulesView,
    analyticsValidationView,
    analyticsShareView,
];
function BiWorkbench({ kind }) {
    const state = useBiCatalog();
    if (state.loading) {
        return (_jsxs("div", { className: "flex items-center justify-center py-20 gap-2 text-sm text-text-muted", children: [_jsx(Spinner, { size: 14 }), " Loading BI workspace"] }));
    }
    if (state.error || !state.catalog) {
        return (_jsx(EmptyStateFramework, { kind: "error", title: "BI workspace unavailable", description: state.error?.message ?? "The analytics catalog could not be loaded.", primary: { label: "Retry", onClick: state.refresh } }));
    }
    return _jsx(BiRoutes, { kind: kind, state: state });
}
function BiRoutes({ kind, state }) {
    const hash = useHash();
    const pathOnly = hash.split("?")[0] ?? hash;
    const parts = pathOnly.replace(/^\/+/, "").split("/");
    const id = parts[2];
    const sub = parts[3];
    const catalog = state.catalog;
    if (kind === "charts" && id) {
        return _jsx(ChartDetail, { chartId: id, tab: sub, state: state });
    }
    if (kind === "dashboards" && id) {
        return _jsx(DashboardDetail, { dashboardId: id, tab: sub, state: state });
    }
    if (kind === "share") {
        return _jsx(ShareLibrary, { catalog: catalog });
    }
    if (kind === "explore")
        return _jsx(ExplorePage, { state: state });
    if (kind === "charts")
        return _jsx(ChartsLibrary, { state: state });
    if (kind === "dashboards")
        return _jsx(DashboardsLibrary, { state: state });
    if (kind === "spaces")
        return _jsx(SpacesPage, { state: state });
    if (kind === "metrics")
        return _jsx(MetricsCatalog, { catalog: catalog });
    if (kind === "sql")
        return _jsx(SqlRunner, { state: state });
    if (kind === "schedules")
        return _jsx(SchedulesPage, { state: state });
    return _jsx(ValidationCenter, { state: state });
}
function useBiCatalog() {
    const [catalog, setCatalog] = React.useState(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState(null);
    const refresh = React.useCallback(async () => {
        setLoading(true);
        try {
            setCatalog(await fetchBiCatalog());
            setError(null);
        }
        catch (err) {
            setError(err instanceof Error ? err : new Error(String(err)));
        }
        finally {
            setLoading(false);
        }
    }, []);
    React.useEffect(() => {
        void refresh();
    }, [refresh]);
    return { catalog, loading, error, refresh };
}
function ExplorePage({ state }) {
    const catalog = state.catalog;
    const hash = useHash();
    const [fieldSearch, setFieldSearch] = React.useState("");
    const [query, setQuery] = React.useState(() => queryFromHash(hash, catalog.explores) ?? defaultQuery(catalog.explores[0]));
    const explore = catalog.explores.find((item) => item.id === query.exploreId) ?? catalog.explores[0];
    const [result, setResult] = React.useState(null);
    const [drillRows, setDrillRows] = React.useState([]);
    const [running, setRunning] = React.useState(false);
    const [saveName, setSaveName] = React.useState("");
    const [error, setError] = React.useState(null);
    React.useEffect(() => {
        const restored = queryFromHash(hash, catalog.explores);
        if (!restored || JSON.stringify(restored) === JSON.stringify(query))
            return;
        setQuery(restored);
        setResult(null);
        setDrillRows([]);
    }, [catalog.explores, hash, query]);
    React.useEffect(() => {
        if (!query.exploreId || typeof window === "undefined")
            return;
        const path = explorePathForQuery(query);
        if (window.location.hash.slice(1) !== path) {
            window.history.replaceState(null, "", `#${path}`);
        }
    }, [query]);
    const run = React.useCallback(async () => {
        if (!explore)
            return;
        setRunning(true);
        try {
            const next = await runBiQuery(query);
            setResult(next);
            setError(null);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        }
        finally {
            setRunning(false);
        }
    }, [explore, query]);
    React.useEffect(() => {
        void run();
    }, [run]);
    const saveChart = async () => {
        if (!explore || !result)
            return;
        const metric = query.metrics[0] ?? result.columns.find((c) => c.role === "metric")?.fieldId;
        await createBiChart({
            name: saveName.trim() || `${explore.label} chart`,
            exploreId: explore.id,
            query,
            config: {
                kind: query.dimensions.length > 0 ? "bar" : "big_number",
                xField: query.dimensions[0],
                yFields: metric ? [metric] : [],
                valueField: metric,
                showValues: true,
            },
            spaceId: catalog.spaces[0]?.id,
        });
        setSaveName("");
        await state.refresh();
    };
    const drill = async (row) => {
        const dimensionValues = Object.fromEntries(query.dimensions.map((id) => [id, row[id]]));
        const res = await drillDownBiQuery(query, dimensionValues);
        setDrillRows(res.rows);
    };
    if (!explore) {
        return _jsx(EmptyStateFramework, { kind: "no-results", title: "No explores found", description: "Seed or publish an analytics explore before opening the BI explorer." });
    }
    const visibleDimensions = explore.dimensions.filter((field) => matchesSearch(field.label, fieldSearch));
    const visibleMetrics = explore.metrics.filter((field) => matchesSearch(field.label, fieldSearch));
    return (_jsxs("div", { className: "flex flex-col gap-4", children: [_jsx(PageHeader, { title: "BI Explorer", description: "Select metrics and dimensions, run a governed local-record query, inspect SQL, and save reusable charts.", actions: _jsxs(_Fragment, { children: [_jsx(Button, { variant: "ghost", size: "sm", iconLeft: _jsx(ListFilter, { className: "h-4 w-4" }), onClick: () => navigateTo("/analytics/charts"), children: "Charts" }), _jsx(Button, { variant: "primary", size: "sm", iconLeft: _jsx(Save, { className: "h-4 w-4" }), onClick: saveChart, disabled: !result, children: "Save chart" })] }) }), _jsxs("div", { className: "grid grid-cols-1 xl:grid-cols-[300px_minmax(0,1fr)] gap-4", children: [_jsxs(Card, { className: "xl:sticky xl:top-0 xl:self-start", children: [_jsx(CardHeader, { children: _jsx(CardTitle, { children: "Fields" }) }), _jsxs(CardContent, { className: "flex flex-col gap-4", children: [_jsxs(Select, { value: explore.id, onValueChange: (nextExploreId) => {
                                            const nextExplore = catalog.explores.find((item) => item.id === nextExploreId);
                                            setQuery(defaultQuery(nextExplore));
                                            setResult(null);
                                            setDrillRows([]);
                                        }, children: [_jsx(SelectTrigger, { children: _jsx(SelectValue, {}) }), _jsx(SelectContent, { children: catalog.explores.map((item) => (_jsx(SelectItem, { value: item.id, children: item.label }, item.id))) })] }), _jsx(Input, { value: fieldSearch, onChange: (e) => setFieldSearch(e.target.value), prefix: _jsx(Search, { className: "h-3.5 w-3.5" }), placeholder: "Search metrics and dimensions" }), _jsx(FieldSection, { title: "Dimensions", fields: visibleDimensions, selected: query.dimensions, onToggle: (id) => setQuery((prev) => toggleDimension(prev, id)) }), _jsx(FieldSection, { title: "Metrics", fields: visibleMetrics, selected: query.metrics, onToggle: (id) => setQuery((prev) => toggleMetric(prev, id)) })] })] }), _jsxs("div", { className: "flex flex-col gap-4 min-w-0", children: [_jsx(QueryControls, { explore: explore, query: query, setQuery: setQuery, running: running, run: run, saveName: saveName, setSaveName: setSaveName }), error && (_jsx(Card, { className: "border-intent-danger/40", children: _jsx(CardContent, { className: "text-sm text-intent-danger", children: error }) })), _jsx(ResultVisualization, { result: result, chartKind: query.dimensions.length > 0 ? "bar" : "big_number" }), _jsx(ResultTable, { result: result, onDrill: drill }), _jsx(SqlPreview, { result: result }), drillRows.length > 0 && _jsx(RawRows, { rows: drillRows, title: "Underlying records" })] })] })] }));
}
function QueryControls({ explore, query, setQuery, running, run, saveName, setSaveName, }) {
    const filter = query.filters?.[0];
    return (_jsx(Card, { children: _jsxs(CardContent, { className: "grid grid-cols-1 lg:grid-cols-[1fr_1fr_120px_auto] gap-3 items-end", children: [_jsxs("div", { children: [_jsx(Label, { children: "Filter dimension" }), _jsxs(Select, { value: filter?.fieldId ?? "none", onValueChange: (value) => setQuery((prev) => ({
                                ...prev,
                                filters: value === "none" ? [] : [{ fieldId: value, operator: "contains", value: "" }],
                            })), children: [_jsx(SelectTrigger, { children: _jsx(SelectValue, { placeholder: "No filter" }) }), _jsxs(SelectContent, { children: [_jsx(SelectItem, { value: "none", children: "No filter" }), explore.dimensions.map((dimension) => (_jsx(SelectItem, { value: dimension.id, children: dimension.label }, dimension.id)))] })] })] }), _jsxs("div", { children: [_jsx(Label, { children: "Filter value" }), _jsx(Input, { value: String(filter?.value ?? ""), disabled: !filter, onChange: (e) => setQuery((prev) => ({
                                ...prev,
                                filters: prev.filters?.length
                                    ? [{ ...prev.filters[0], value: e.target.value }]
                                    : [],
                            })), prefix: _jsx(Filter, { className: "h-3.5 w-3.5" }), placeholder: "Contains..." })] }), _jsxs("div", { children: [_jsx(Label, { children: "Limit" }), _jsx(Input, { type: "number", min: 1, max: 1000, value: query.limit ?? 100, onChange: (e) => setQuery((prev) => ({ ...prev, limit: Number(e.target.value) })) })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Input, { value: saveName, onChange: (e) => setSaveName(e.target.value), placeholder: "Chart name" }), _jsx(Button, { variant: "primary", onClick: run, loading: running, iconLeft: _jsx(RotateCcw, { className: "h-4 w-4" }), children: "Run" })] })] }) }));
}
function ChartsLibrary({ state }) {
    const catalog = state.catalog;
    return (_jsxs("div", { className: "flex flex-col gap-4", children: [_jsx(PageHeader, { title: "Saved charts", description: "Versioned BI content with direct links, dashboard insertion, sharing, scheduling, and validation.", actions: _jsx(Button, { variant: "primary", size: "sm", iconLeft: _jsx(Plus, { className: "h-4 w-4" }), onClick: () => navigateTo("/analytics/explore"), children: "New chart" }) }), _jsx("div", { className: "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4", children: catalog.charts.map((chart) => (_jsxs(Card, { className: "hover:border-accent/50", children: [_jsxs(CardHeader, { children: [_jsxs("div", { className: "min-w-0", children: [_jsx(CardTitle, { className: "truncate", children: chart.name }), _jsx("p", { className: "text-xs text-text-muted mt-1 truncate", children: chart.description })] }), _jsxs(Badge, { intent: chart.pinned ? "accent" : "neutral", children: ["v", chart.version] })] }), _jsxs(CardContent, { className: "flex flex-col gap-3", children: [_jsx(MiniChart, { chart: chart, catalog: catalog }), _jsxs("div", { className: "flex items-center justify-between gap-2", children: [_jsx("span", { className: "text-xs text-text-muted", children: spaceName(catalog.spaces, chart.spaceId) }), _jsx(Button, { size: "xs", variant: "secondary", onClick: () => navigateTo(`/analytics/charts/${chart.id}`), children: "Open" })] })] })] }, chart.id))) })] }));
}
function ChartDetail({ chartId, tab, state }) {
    const catalog = state.catalog;
    const chart = catalog.charts.find((item) => item.id === chartId);
    const [result, setResult] = React.useState(null);
    const [history, setHistory] = React.useState([]);
    const [name, setName] = React.useState(chart?.name ?? "");
    const [chartKind, setChartKind] = React.useState(chart?.config.kind ?? "bar");
    const [spaceId, setSpaceId] = React.useState(chart?.spaceId ?? catalog.spaces[0]?.id ?? "");
    const [message, setMessage] = React.useState("");
    React.useEffect(() => setName(chart?.name ?? ""), [chart?.id, chart?.name]);
    React.useEffect(() => setChartKind(chart?.config.kind ?? "bar"), [chart?.id, chart?.config.kind]);
    React.useEffect(() => setSpaceId(chart?.spaceId ?? catalog.spaces[0]?.id ?? ""), [chart?.id, chart?.spaceId, catalog.spaces]);
    React.useEffect(() => {
        if (!chart)
            return;
        void runBiQuery(chart.query).then(setResult);
        void fetchChartHistory(chart.id).then((res) => setHistory(res.rows));
    }, [chart?.id, chart?.version]);
    if (!chart)
        return _jsx(EmptyStateFramework, { kind: "no-results", title: "Chart not found", description: "The saved chart link points to missing content." });
    const share = async () => {
        const created = await createBiShare({ targetKind: "chart", targetId: chart.id });
        setMessage(`Share link ready: #/analytics/share/${created.token}`);
        await state.refresh();
    };
    const schedule = async () => {
        await createBiSchedule({
            name: `${chart.name} weekly delivery`,
            targetKind: "chart",
            targetId: chart.id,
            cron: "every 1w",
            timezone: "UTC",
            format: "pdf",
            enabled: true,
            includeLinks: true,
            targets: [{ kind: "email", address: "analytics@gutu.dev" }],
        });
        setMessage("Schedule created.");
        await state.refresh();
    };
    const save = async () => {
        await updateBiChart(chart.id, {
            name,
            config: { ...chart.config, kind: chartKind },
            spaceId,
            expectedVersion: chart.version,
        });
        setMessage("Chart saved as a new version.");
        await state.refresh();
    };
    const rollback = async (version) => {
        await rollbackBiChart(chart.id, version);
        setMessage(`Rolled back to v${version} as a new version.`);
        await state.refresh();
    };
    const historyMode = tab === "history";
    return (_jsxs("div", { className: "flex flex-col gap-4", children: [_jsx(PageHeader, { title: chart.name, description: chart.description, actions: _jsxs(_Fragment, { children: [_jsx(Button, { size: "sm", variant: "ghost", iconLeft: _jsx(History, { className: "h-4 w-4" }), onClick: () => navigateTo(`/analytics/charts/${chart.id}/history`), children: "History" }), _jsx(Button, { size: "sm", variant: "ghost", iconLeft: _jsx(Share2, { className: "h-4 w-4" }), onClick: share, children: "Share" }), _jsx(Button, { size: "sm", variant: "ghost", iconLeft: _jsx(Clock, { className: "h-4 w-4" }), onClick: schedule, children: "Schedule" }), _jsx(Button, { size: "sm", variant: "primary", iconLeft: _jsx(Save, { className: "h-4 w-4" }), onClick: save, children: "Save" })] }) }), message && _jsx(StatusNote, { children: message }), historyMode ? (_jsx(HistoryPanel, { rows: history, onRollback: rollback })) : (_jsxs("div", { className: "grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-4", children: [_jsxs("div", { className: "flex flex-col gap-4 min-w-0", children: [_jsx(ResultVisualization, { result: result, chartKind: chartKind, chart: { ...chart, config: { ...chart.config, kind: chartKind } } }), _jsx(ResultTable, { result: result }), _jsx(SqlPreview, { result: result })] }), _jsxs(Card, { children: [_jsx(CardHeader, { children: _jsx(CardTitle, { children: "Chart settings" }) }), _jsxs(CardContent, { className: "flex flex-col gap-3", children: [_jsx(Label, { children: "Name" }), _jsx(Input, { value: name, onChange: (e) => setName(e.target.value) }), _jsx(Label, { children: "Visualization" }), _jsxs(Select, { value: chartKind, onValueChange: setChartKind, children: [_jsx(SelectTrigger, { children: _jsx(SelectValue, {}) }), _jsx(SelectContent, { children: CHART_KIND_OPTIONS.map((kind) => _jsx(SelectItem, { value: kind, children: kind.replace("_", " ") }, kind)) })] }), _jsx(Label, { children: "Space" }), _jsxs(Select, { value: spaceId, onValueChange: setSpaceId, children: [_jsx(SelectTrigger, { children: _jsx(SelectValue, {}) }), _jsx(SelectContent, { children: catalog.spaces.map((space) => _jsx(SelectItem, { value: space.id, children: space.name }, space.id)) })] }), _jsx(Meta, { label: "Explore", value: exploreLabel(catalog.explores, chart.exploreId) }), _jsx(Meta, { label: "Version", value: `v${chart.version}` }), _jsx(Button, { variant: "secondary", onClick: () => addChartToFirstDashboard(chart, catalog, state), children: "Add to dashboard" })] })] })] }))] }));
}
function DashboardsLibrary({ state }) {
    const catalog = state.catalog;
    const create = async () => {
        const dashboard = await createBiDashboard({
            name: "Untitled BI dashboard",
            spaceId: catalog.spaces[0]?.id,
            tabs: [{ id: "main", label: "Main", order: 0 }],
            tiles: [],
            filters: [],
        });
        await state.refresh();
        navigateTo(`/analytics/dashboards/${dashboard.id}/edit`);
    };
    return (_jsxs("div", { className: "flex flex-col gap-4", children: [_jsx(PageHeader, { title: "Dashboards", description: "Editable BI canvases with tiles, tabs, versions, and direct links.", actions: _jsx(Button, { variant: "primary", size: "sm", iconLeft: _jsx(Plus, { className: "h-4 w-4" }), onClick: create, children: "New dashboard" }) }), _jsx("div", { className: "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4", children: catalog.dashboards.map((dashboard) => (_jsxs(Card, { children: [_jsxs(CardHeader, { children: [_jsxs("div", { children: [_jsx(CardTitle, { children: dashboard.name }), _jsxs("p", { className: "text-xs text-text-muted mt-1", children: [dashboard.tiles.length, " tiles, ", dashboard.tabs.length, " tabs"] })] }), _jsxs(Badge, { intent: dashboard.pinned ? "accent" : "neutral", children: ["v", dashboard.version] })] }), _jsxs(CardContent, { className: "flex items-center justify-between", children: [_jsx("span", { className: "text-xs text-text-muted", children: spaceName(catalog.spaces, dashboard.spaceId) }), _jsx(Button, { size: "xs", onClick: () => navigateTo(`/analytics/dashboards/${dashboard.id}`), children: "Open" })] })] }, dashboard.id))) })] }));
}
function DashboardDetail({ dashboardId, tab, state }) {
    const catalog = state.catalog;
    const dashboard = catalog.dashboards.find((item) => item.id === dashboardId);
    const [history, setHistory] = React.useState([]);
    const [activeTab, setActiveTab] = React.useState("main");
    const [name, setName] = React.useState(dashboard?.name ?? "");
    const [message, setMessage] = React.useState("");
    const editMode = tab === "edit";
    const historyMode = tab === "history";
    React.useEffect(() => {
        if (dashboard)
            void fetchDashboardHistory(dashboard.id).then((res) => setHistory(res.rows));
    }, [dashboard?.id, dashboard?.version]);
    React.useEffect(() => setName(dashboard?.name ?? ""), [dashboard?.id, dashboard?.name]);
    if (!dashboard)
        return _jsx(EmptyStateFramework, { kind: "no-results", title: "Dashboard not found", description: "The dashboard link points to missing content." });
    const save = async (patch) => {
        await updateBiDashboard(dashboard.id, { ...patch, expectedVersion: dashboard.version });
        await state.refresh();
    };
    const share = async () => {
        const created = await createBiShare({ targetKind: "dashboard", targetId: dashboard.id });
        setMessage(`Share link ready: #/analytics/share/${created.token}`);
        await state.refresh();
    };
    const schedule = async () => {
        await createBiSchedule({
            name: `${dashboard.name} weekly delivery`,
            targetKind: "dashboard",
            targetId: dashboard.id,
            cron: "every 1w",
            timezone: "UTC",
            format: "pdf",
            enabled: true,
            includeLinks: true,
            targets: [{ kind: "email", address: "analytics@gutu.dev" }],
        });
        setMessage("Schedule created.");
        await state.refresh();
    };
    const addTile = async (chartId) => {
        const visibleTiles = dashboard.tiles.filter((tile) => (tile.tabId ?? "main") === activeTab);
        const next = [
            ...dashboard.tiles,
            { id: `tile_${Date.now()}`, kind: "chart", chartId, x: 0, y: visibleTiles.length * 4, w: 6, h: 4, tabId: activeTab },
        ];
        await save({ tiles: next });
    };
    const addMarkdownTile = async () => {
        const visibleTiles = dashboard.tiles.filter((tile) => (tile.tabId ?? "main") === activeTab);
        await save({
            tiles: [
                ...dashboard.tiles,
                {
                    id: `tile_${Date.now()}`,
                    kind: "markdown",
                    title: "Dashboard note",
                    markdown: "Add context for this tab.",
                    x: 0,
                    y: visibleTiles.length * 4,
                    w: 12,
                    h: 2,
                    tabId: activeTab,
                },
            ],
        });
    };
    const addFilter = async () => {
        const chart = catalog.charts.find((item) => dashboard.tiles.some((tile) => tile.chartId === item.id));
        const explore = chart ? catalog.explores.find((item) => item.id === chart.exploreId) : catalog.explores[0];
        const field = explore?.dimensions[0];
        if (!field)
            return;
        await save({
            filters: [
                ...dashboard.filters,
                { id: `filter_${Date.now()}`, label: field.label, fieldId: field.id, defaultValue: "" },
            ],
        });
    };
    const rollback = async (version) => {
        await rollbackBiDashboard(dashboard.id, version);
        await state.refresh();
    };
    return (_jsxs("div", { className: "flex flex-col gap-4", children: [_jsx(PageHeader, { title: dashboard.name, description: dashboard.description, actions: _jsxs(_Fragment, { children: [_jsx(Button, { size: "sm", variant: "ghost", iconLeft: _jsx(History, { className: "h-4 w-4" }), onClick: () => navigateTo(`/analytics/dashboards/${dashboard.id}/history`), children: "History" }), _jsx(Button, { size: "sm", variant: "ghost", iconLeft: _jsx(Share2, { className: "h-4 w-4" }), onClick: share, children: "Share" }), _jsx(Button, { size: "sm", variant: "ghost", iconLeft: _jsx(Clock, { className: "h-4 w-4" }), onClick: schedule, children: "Schedule" }), editMode && _jsx(Button, { size: "sm", variant: "ghost", iconLeft: _jsx(Save, { className: "h-4 w-4" }), onClick: () => save({ name, tiles: dashboard.tiles, tabs: dashboard.tabs, filters: dashboard.filters }), children: "Save version" }), _jsx(Button, { size: "sm", variant: editMode ? "primary" : "secondary", onClick: () => navigateTo(editMode ? `/analytics/dashboards/${dashboard.id}` : `/analytics/dashboards/${dashboard.id}/edit`), children: editMode ? "View" : "Edit" })] }) }), message && _jsx(StatusNote, { children: message }), historyMode ? (_jsx(HistoryPanel, { rows: history, onRollback: rollback })) : (_jsxs(_Fragment, { children: [editMode && (_jsx(Card, { children: _jsxs(CardContent, { className: "grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_220px] gap-3 items-end", children: [_jsxs("div", { children: [_jsx(Label, { children: "Dashboard name" }), _jsx(Input, { value: name, onChange: (event) => setName(event.target.value) })] }), _jsx(Button, { variant: "secondary", iconLeft: _jsx(Save, { className: "h-4 w-4" }), onClick: () => save({ name }), children: "Save title" })] }) })), _jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [dashboard.tabs.map((item) => (_jsx(Button, { size: "xs", variant: activeTab === item.id ? "primary" : "secondary", onClick: () => setActiveTab(item.id), children: item.label }, item.id))), editMode && _jsx(Button, { size: "xs", variant: "ghost", iconLeft: _jsx(Plus, { className: "h-3 w-3" }), onClick: () => save({ tabs: [...dashboard.tabs, { id: `tab_${Date.now()}`, label: `Tab ${dashboard.tabs.length + 1}`, order: dashboard.tabs.length }] }), children: "Tab" })] }), editMode && (_jsx(Card, { children: _jsxs(CardContent, { className: "flex flex-col gap-3", children: [_jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsx(Button, { size: "xs", variant: "secondary", iconLeft: _jsx(Type, { className: "h-3 w-3" }), onClick: addMarkdownTile, children: "Markdown tile" }), _jsx(Button, { size: "xs", variant: "secondary", iconLeft: _jsx(Filter, { className: "h-3 w-3" }), onClick: addFilter, children: "Dashboard filter" }), catalog.charts.map((chart) => (_jsx(Button, { size: "xs", variant: "secondary", iconLeft: _jsx(Plus, { className: "h-3 w-3" }), onClick: () => addTile(chart.id), children: chart.name }, chart.id)))] }), dashboard.filters.length > 0 && (_jsx("div", { className: "flex flex-wrap gap-2", children: dashboard.filters.map((filter) => (_jsxs(Badge, { intent: "info", children: [filter.label, ": ", filter.fieldId] }, filter.id))) }))] }) })), _jsx(DashboardCanvas, { dashboard: dashboard, catalog: catalog, activeTab: activeTab, editMode: editMode, onSave: save })] }))] }));
}
function DashboardCanvas({ dashboard, catalog, activeTab, editMode, onSave, }) {
    const [draggingTileId, setDraggingTileId] = React.useState(null);
    const tiles = dashboard.tiles
        .filter((tile) => (tile.tabId ?? "main") === activeTab)
        .slice()
        .sort((left, right) => left.y - right.y || left.x - right.x);
    if (tiles.length === 0) {
        return _jsx(EmptyStateFramework, { kind: "no-results", title: "No tiles on this tab", description: "Add saved charts or markdown tiles to build the dashboard." });
    }
    const writeVisibleOrder = async (ordered) => {
        const packed = packDashboardTiles(ordered);
        const packedById = new Map(packed.map((tile) => [tile.id, tile]));
        const next = dashboard.tiles.map((tile) => packedById.get(tile.id) ?? tile);
        await onSave({ tiles: next });
    };
    const moveTile = async (tileId, dir) => {
        const idx = tiles.findIndex((tile) => tile.id === tileId);
        const nextIdx = idx + dir;
        if (idx < 0 || nextIdx < 0 || nextIdx >= tiles.length)
            return;
        const next = [...tiles];
        const [tile] = next.splice(idx, 1);
        if (!tile)
            return;
        next.splice(nextIdx, 0, tile);
        await writeVisibleOrder(next);
    };
    const dropTile = async (targetTileId) => {
        if (!draggingTileId || draggingTileId === targetTileId)
            return;
        const next = [...tiles];
        const from = next.findIndex((tile) => tile.id === draggingTileId);
        const to = next.findIndex((tile) => tile.id === targetTileId);
        if (from < 0 || to < 0)
            return;
        const [tile] = next.splice(from, 1);
        if (!tile)
            return;
        next.splice(to, 0, tile);
        setDraggingTileId(null);
        await writeVisibleOrder(next);
    };
    const updateTile = async (tileId, patch) => {
        await writeVisibleOrder(tiles.map((tile) => (tile.id === tileId ? { ...tile, ...patch } : tile)));
    };
    const removeTile = async (tileId) => {
        const visible = tiles.filter((tile) => tile.id !== tileId);
        const otherTabs = dashboard.tiles.filter((tile) => (tile.tabId ?? "main") !== activeTab);
        await onSave({ tiles: [...otherTabs, ...packDashboardTiles(visible)] });
    };
    const duplicateTile = async (tileId) => {
        const source = dashboard.tiles.find((tile) => tile.id === tileId);
        if (!source)
            return;
        const visible = [...tiles, { ...source, id: `tile_${Date.now()}` }];
        const otherTabs = dashboard.tiles.filter((tile) => (tile.tabId ?? "main") !== activeTab);
        await onSave({ tiles: [...otherTabs, ...packDashboardTiles(visible)] });
    };
    return (_jsx("div", { className: "grid grid-cols-1 xl:grid-cols-12 gap-4", children: tiles.map((tile) => {
            const chart = catalog.charts.find((item) => item.id === tile.chartId);
            return (_jsxs(Card, { className: cn("xl:col-span-6", tile.w <= 4 && "xl:col-span-4", tile.w >= 12 && "xl:col-span-12", draggingTileId === tile.id && "opacity-60"), draggable: editMode, onDragStart: () => setDraggingTileId(tile.id), onDragOver: (event) => { if (editMode)
                    event.preventDefault(); }, onDrop: () => { if (editMode)
                    void dropTile(tile.id); }, children: [_jsxs(CardHeader, { children: [_jsxs(CardTitle, { className: "flex items-center gap-2", children: [editMode && _jsx(GripVertical, { className: "h-4 w-4 text-text-muted" }), tile.title ?? chart?.name ?? "Tile"] }), editMode && (_jsxs("div", { className: "flex flex-wrap items-center gap-1", children: [_jsx(Button, { size: "xs", variant: "ghost", iconLeft: _jsx(Minimize2, { className: "h-3 w-3" }), onClick: () => updateTile(tile.id, { w: Math.max(4, tile.w - 2) }), children: "Narrow" }), _jsx(Button, { size: "xs", variant: "ghost", iconLeft: _jsx(Maximize2, { className: "h-3 w-3" }), onClick: () => updateTile(tile.id, { w: Math.min(12, tile.w + 2) }), children: "Wide" }), _jsx(Button, { size: "xs", variant: "ghost", onClick: () => moveTile(tile.id, -1), children: "Up" }), _jsx(Button, { size: "xs", variant: "ghost", onClick: () => moveTile(tile.id, 1), children: "Down" }), _jsx(Button, { size: "xs", variant: "ghost", iconLeft: _jsx(Copy, { className: "h-3 w-3" }), onClick: () => duplicateTile(tile.id), children: "Copy" }), _jsx(Button, { size: "xs", variant: "ghost", iconLeft: _jsx(Trash2, { className: "h-3 w-3" }), onClick: () => removeTile(tile.id), children: "Remove" })] }))] }), _jsx(CardContent, { children: tile.kind === "markdown" || tile.kind === "heading" ? (editMode ? (_jsx(Textarea, { value: tile.markdown ?? tile.title ?? "", onChange: (event) => updateTile(tile.id, { markdown: event.target.value }), className: "min-h-28" })) : (_jsx("p", { className: cn("text-sm text-text-secondary whitespace-pre-wrap", tile.kind === "heading" && "text-lg font-semibold text-text"), children: tile.markdown ?? tile.title }))) : chart ? (_jsx(MiniChart, { chart: chart, catalog: catalog, large: true })) : (_jsx(EmptyStateFramework, { kind: "no-results", title: "Missing chart", description: "This tile references a chart that no longer exists." })) })] }, tile.id));
        }) }));
}
function packDashboardTiles(tiles) {
    let cursorX = 0;
    let cursorY = 0;
    let rowHeight = 0;
    return tiles.map((tile) => {
        const width = Math.min(12, Math.max(4, Math.round(tile.w || 6)));
        const height = Math.max(1, Math.round(tile.h || 4));
        if (cursorX > 0 && cursorX + width > 12) {
            cursorX = 0;
            cursorY += rowHeight || height;
            rowHeight = 0;
        }
        const packed = { ...tile, x: cursorX, y: cursorY, w: width, h: height };
        cursorX += width;
        rowHeight = Math.max(rowHeight, height);
        if (cursorX >= 12) {
            cursorX = 0;
            cursorY += rowHeight;
            rowHeight = 0;
        }
        return packed;
    });
}
function SpacesPage({ state }) {
    const catalog = state.catalog;
    const [name, setName] = React.useState("");
    const create = async () => {
        if (!name.trim())
            return;
        await createBiSpace({ name, access: "team" });
        setName("");
        await state.refresh();
    };
    return (_jsxs("div", { className: "flex flex-col gap-4", children: [_jsx(PageHeader, { title: "Spaces", description: "Nested BI content libraries for charts, dashboards, and governed access." }), _jsx(Card, { children: _jsxs(CardContent, { className: "flex gap-2", children: [_jsx(Input, { value: name, onChange: (e) => setName(e.target.value), placeholder: "New space name" }), _jsx(Button, { onClick: create, iconLeft: _jsx(Plus, { className: "h-4 w-4" }), children: "Create" })] }) }), _jsx("div", { className: "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4", children: catalog.spaces.map((space) => (_jsxs(Card, { children: [_jsxs(CardHeader, { children: [_jsxs(CardTitle, { className: "flex items-center gap-2", children: [_jsx(FolderTree, { className: "h-4 w-4" }), " ", space.name] }), _jsx(Badge, { children: space.access })] }), _jsxs(CardContent, { className: "text-sm text-text-secondary", children: [_jsx("p", { children: space.description }), _jsxs("p", { className: "mt-3 text-xs text-text-muted", children: [catalog.charts.filter((c) => c.spaceId === space.id).length, " charts, ", catalog.dashboards.filter((d) => d.spaceId === space.id).length, " dashboards"] })] })] }, space.id))) })] }));
}
function MetricsCatalog({ catalog }) {
    return (_jsxs("div", { className: "flex flex-col gap-4", children: [_jsx(PageHeader, { title: "Metrics catalog", description: "Discover governed dimensions and metrics exposed by BI explores." }), _jsx("div", { className: "grid grid-cols-1 xl:grid-cols-2 gap-4", children: catalog.explores.map((explore) => (_jsxs(Card, { children: [_jsxs(CardHeader, { children: [_jsxs("div", { children: [_jsx(CardTitle, { children: explore.label }), _jsx("p", { className: "text-xs text-text-muted mt-1", children: explore.resource })] }), _jsxs(Badge, { children: [explore.metrics.length, " metrics"] })] }), _jsxs(CardContent, { className: "grid grid-cols-1 md:grid-cols-2 gap-3", children: [_jsx(FieldList, { title: "Metrics", items: explore.metrics.map((metric) => `${metric.label} (${metric.aggregation})`) }), _jsx(FieldList, { title: "Dimensions", items: explore.dimensions.map((dimension) => `${dimension.label} (${dimension.type})`) })] })] }, explore.id))) })] }));
}
function SqlRunner({ state }) {
    const catalog = state.catalog;
    const [exploreId, setExploreId] = React.useState(catalog.explores[0]?.id ?? "");
    const explore = catalog.explores.find((item) => item.id === exploreId) ?? catalog.explores[0];
    const [sql, setSql] = React.useState("");
    const [result, setResult] = React.useState(null);
    const query = defaultQuery(explore);
    const run = async () => {
        if (!explore)
            return;
        const compiled = await compileBiQuery(query);
        setSql(compiled.sql);
        setResult(await runBiQuery(query));
    };
    React.useEffect(() => {
        void run();
    }, [exploreId]);
    return (_jsxs("div", { className: "flex flex-col gap-4", children: [_jsx(PageHeader, { title: "SQL runner", description: "Inspect compiled local-record SQL and run governed queries from semantic explores.", actions: _jsx(Button, { onClick: run, iconLeft: _jsx(Database, { className: "h-4 w-4" }), children: "Run" }) }), _jsx(Card, { children: _jsx(CardContent, { className: "max-w-md", children: _jsxs(Select, { value: exploreId, onValueChange: setExploreId, children: [_jsx(SelectTrigger, { children: _jsx(SelectValue, {}) }), _jsx(SelectContent, { children: catalog.explores.map((item) => _jsx(SelectItem, { value: item.id, children: item.label }, item.id)) })] }) }) }), _jsxs(Card, { children: [_jsx(CardHeader, { children: _jsx(CardTitle, { children: "Compiled SQL" }) }), _jsx(CardContent, { children: _jsx("pre", { className: "overflow-auto rounded-md bg-surface-2 p-3 text-xs text-text-secondary", children: sql }) })] }), _jsx(ResultTable, { result: result })] }));
}
function SchedulesPage({ state }) {
    const catalog = state.catalog;
    const [message, setMessage] = React.useState("");
    const run = async (schedule) => {
        const delivery = await runBiSchedule(schedule.id);
        setMessage(`${schedule.name}: ${delivery.status}`);
        await state.refresh();
    };
    return (_jsxs("div", { className: "flex flex-col gap-4", children: [_jsx(PageHeader, { title: "Scheduled deliveries", description: "Recurring chart and dashboard delivery definitions with delivery-run logs." }), message && _jsx(StatusNote, { children: message }), _jsxs("div", { className: "grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-4", children: [_jsx("div", { className: "flex flex-col gap-3", children: catalog.schedules.map((schedule) => (_jsx(Card, { children: _jsxs(CardContent, { className: "flex items-center justify-between gap-3", children: [_jsxs("div", { children: [_jsx("div", { className: "font-medium text-sm", children: schedule.name }), _jsxs("div", { className: "text-xs text-text-muted", children: [schedule.cron, " / ", schedule.timezone, " / ", schedule.format] })] }), _jsx(Button, { size: "xs", onClick: () => run(schedule), children: "Run now" })] }) }, schedule.id))) }), _jsxs(Card, { children: [_jsx(CardHeader, { children: _jsx(CardTitle, { children: "Delivery runs" }) }), _jsx(CardContent, { className: "flex flex-col gap-2", children: catalog.deliveryRuns.map((run) => (_jsxs("div", { className: "rounded-md border border-border p-2 text-xs", children: [_jsx("div", { className: "font-medium", children: run.status }), _jsx("div", { className: "text-text-muted", children: run.message })] }, run.id))) })] })] })] }));
}
function ValidationCenter({ state }) {
    const rows = state.catalog.validation;
    const errorCount = rows.filter((row) => row.severity === "error").length;
    return (_jsxs("div", { className: "flex flex-col gap-4", children: [_jsx(PageHeader, { title: "BI validation", description: "Content health for explores, saved charts, dashboards, schedules, and shares.", actions: _jsx(Button, { size: "sm", onClick: state.refresh, iconLeft: _jsx(RotateCcw, { className: "h-4 w-4" }), children: "Refresh" }) }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-3", children: [_jsx(Stat, { label: "Errors", value: errorCount, intent: errorCount > 0 ? "danger" : "success" }), _jsx(Stat, { label: "Warnings", value: rows.filter((row) => row.severity === "warning").length, intent: "warning" }), _jsx(Stat, { label: "Checks", value: rows.length, intent: "info" })] }), _jsx(Card, { children: _jsx(CardContent, { className: "p-0 overflow-auto", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { className: "bg-surface-1 text-text-muted", children: _jsxs("tr", { children: [_jsx("th", { className: "text-left px-3 py-2", children: "Severity" }), _jsx("th", { className: "text-left px-3 py-2", children: "Target" }), _jsx("th", { className: "text-left px-3 py-2", children: "Code" }), _jsx("th", { className: "text-left px-3 py-2", children: "Message" })] }) }), _jsx("tbody", { children: rows.map((row) => (_jsxs("tr", { className: "border-t border-border-subtle", children: [_jsx("td", { className: "px-3 py-2", children: _jsx(Badge, { intent: row.severity === "error" ? "danger" : row.severity === "warning" ? "warning" : "info", children: row.severity }) }), _jsxs("td", { className: "px-3 py-2", children: [row.targetKind, ":", row.targetId] }), _jsx("td", { className: "px-3 py-2 text-text-muted", children: row.code }), _jsx("td", { className: "px-3 py-2", children: row.message })] }, row.id))) })] }) }) })] }));
}
function ShareLibrary({ catalog }) {
    return (_jsxs("div", { className: "flex flex-col gap-4", children: [_jsx(PageHeader, { title: "Shared BI links", description: "Share URLs are durable content records backed by the BI API." }), _jsx("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: catalog.shares.map((share) => (_jsxs(Card, { children: [_jsxs(CardHeader, { children: [_jsxs(CardTitle, { className: "flex items-center gap-2", children: [_jsx(Link2, { className: "h-4 w-4" }), " ", share.targetKind, ":", share.targetId] }), _jsx(Badge, { children: share.token })] }), _jsx(CardContent, { className: "text-sm text-text-secondary", children: _jsxs("code", { className: "rounded bg-surface-2 px-2 py-1 text-xs", children: ["/api/analytics-bi/public/", share.token] }) })] }, share.id))) })] }));
}
function ResultVisualization({ result, chartKind, chart, embedded }) {
    if (!result) {
        return embedded
            ? _jsxs("div", { className: "h-36 flex items-center justify-center text-xs text-text-muted", children: [_jsx(Spinner, { size: 12 }), " Running query"] })
            : _jsx(SkeletonCard, { title: "Visualization" });
    }
    const metric = chart?.config.valueField ?? chart?.config.yFields?.[0] ?? result.columns.find((c) => c.role === "metric")?.fieldId;
    const dimension = chart?.config.labelField ?? chart?.config.xField ?? result.columns.find((c) => c.role === "dimension")?.fieldId;
    if (!metric) {
        return embedded
            ? _jsx("div", { className: "rounded-md border border-border-subtle p-4 text-sm text-text-muted", children: "No metric selected." })
            : _jsx(EmptyStateFramework, { kind: "no-results", title: "No metric selected", description: "Choose at least one metric to visualize results." });
    }
    const data = result.rows.map((row, i) => ({
        label: String((dimension ? row[dimension] : `Row ${i + 1}`) ?? `Row ${i + 1}`),
        value: Number(row[metric] ?? 0),
    }));
    if (chartKind === "big_number") {
        const value = data.reduce((total, row) => total + row.value, 0);
        return _jsx(Stat, { label: result.columns.find((c) => c.fieldId === metric)?.label ?? metric, value: formatNumber(value), intent: "accent", large: true, embedded: embedded });
    }
    const chartBody = (_jsx(_Fragment, { children: chartKind === "donut" ? (_jsx(Donut, { data: data })) : chartKind === "funnel" ? (_jsx(Funnel, { data: data })) : chartKind === "line" || chartKind === "area" ? (_jsx(LineChart, { xLabels: data.map((d) => d.label), series: [{ label: metric, data: data.map((d) => d.value) }], area: chartKind === "area" })) : chartKind === "table" ? (_jsx(ResultTable, { result: result, compact: true, embedded: embedded })) : chartKind === "gauge" ? (_jsx(GaugeChart, { data: data, metricLabel: result.columns.find((c) => c.fieldId === metric)?.label ?? metric })) : chartKind === "treemap" ? (_jsx(TreemapChart, { data: data })) : chartKind === "map" ? (_jsx(MapReadyChart, { data: data })) : (_jsx(BarChart, { data: data })) }));
    if (embedded) {
        return _jsx("div", { className: "min-h-36", children: chartBody });
    }
    return (_jsxs(Card, { children: [_jsx(CardHeader, { children: _jsx(CardTitle, { children: "Visualization" }) }), _jsx(CardContent, { children: chartBody })] }));
}
function MiniChart({ chart, catalog, large }) {
    const [result, setResult] = React.useState(null);
    React.useEffect(() => {
        void runBiQuery(chart.query).then(setResult).catch(() => setResult(null));
    }, [chart.id, chart.version]);
    if (!result)
        return _jsxs("div", { className: "h-36 flex items-center justify-center text-xs text-text-muted", children: [_jsx(Spinner, { size: 12 }), " Running"] });
    return _jsx("div", { className: large ? "min-h-56" : "min-h-36", children: _jsx(ResultVisualization, { result: result, chartKind: chart.config.kind, chart: chart, embedded: true }) });
}
function ResultTable({ result, onDrill, compact, embedded }) {
    if (!result) {
        return embedded
            ? _jsxs("div", { className: "h-28 flex items-center justify-center text-xs text-text-muted", children: [_jsx(Spinner, { size: 12 }), " Running query"] })
            : _jsx(SkeletonCard, { title: "Results" });
    }
    const table = (_jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { className: "bg-surface-1 text-text-muted", children: _jsxs("tr", { children: [result.columns.map((column) => (_jsx("th", { className: "text-left px-3 py-2 whitespace-nowrap", children: column.label }, column.fieldId))), onDrill && _jsx("th", { className: "px-3 py-2" })] }) }), _jsx("tbody", { children: result.rows.map((row, idx) => (_jsxs("tr", { className: "border-t border-border-subtle", children: [result.columns.map((column) => (_jsx("td", { className: "px-3 py-2 whitespace-nowrap", children: formatCell(row[column.fieldId]) }, column.fieldId))), onDrill && _jsx("td", { className: "px-3 py-2 text-right", children: _jsx(Button, { size: "xs", variant: "ghost", onClick: () => onDrill(row), children: "Drill" }) })] }, idx))) })] }));
    if (embedded) {
        return _jsx("div", { className: "overflow-auto rounded-md border border-border-subtle", children: table });
    }
    return (_jsxs(Card, { children: [!compact && _jsx(CardHeader, { children: _jsxs(CardTitle, { children: ["Results (", result.totalRows, ")"] }) }), _jsx(CardContent, { className: "p-0 overflow-auto", children: table })] }));
}
function SqlPreview({ result }) {
    if (!result)
        return null;
    return (_jsxs(Card, { children: [_jsx(CardHeader, { children: _jsx(CardTitle, { children: "Compiled SQL preview" }) }), _jsx(CardContent, { children: _jsx("pre", { className: "overflow-auto rounded-md bg-surface-2 p-3 text-xs text-text-secondary", children: result.compiledSql }) })] }));
}
function RawRows({ rows, title }) {
    const columns = Object.keys(rows[0] ?? {}).slice(0, 8);
    return (_jsxs(Card, { children: [_jsx(CardHeader, { children: _jsx(CardTitle, { children: title }) }), _jsx(CardContent, { className: "p-0 overflow-auto", children: _jsxs("table", { className: "w-full text-xs", children: [_jsx("thead", { className: "bg-surface-1 text-text-muted", children: _jsx("tr", { children: columns.map((c) => _jsx("th", { className: "text-left px-3 py-2", children: c }, c)) }) }), _jsx("tbody", { children: rows.map((row, idx) => _jsx("tr", { className: "border-t border-border-subtle", children: columns.map((c) => _jsx("td", { className: "px-3 py-2", children: formatCell(row[c]) }, c)) }, idx)) })] }) })] }));
}
function FieldSection({ title, fields, selected, onToggle }) {
    return (_jsxs("section", { className: "flex flex-col gap-2", children: [_jsx("div", { className: "text-xs font-semibold text-text-muted uppercase tracking-wide", children: title }), _jsx("div", { className: "flex flex-col gap-1 max-h-64 overflow-auto pr-1", children: fields.map((field) => (_jsxs("button", { type: "button", onClick: () => onToggle(field.id), className: cn("text-left rounded-md border px-2 py-2 text-sm", selected.includes(field.id) ? "border-accent bg-accent-subtle text-accent" : "border-border hover:bg-surface-1"), children: [_jsx("span", { className: "font-medium", children: field.label }), field.description && _jsx("span", { className: "block text-xs text-text-muted", children: field.description })] }, field.id))) })] }));
}
function HistoryPanel({ rows, onRollback }) {
    return (_jsxs(Card, { children: [_jsx(CardHeader, { children: _jsx(CardTitle, { children: "Version history" }) }), _jsx(CardContent, { className: "flex flex-col gap-2", children: rows.sort((a, b) => b.version - a.version).map((row) => (_jsxs("div", { className: "flex items-center justify-between gap-3 rounded-md border border-border p-3", children: [_jsxs("div", { children: [_jsxs("div", { className: "text-sm font-medium", children: ["Version ", row.version] }), _jsxs("div", { className: "text-xs text-text-muted", children: [formatDate(row.createdAt), " ", row.reason ? `/${row.reason}` : ""] })] }), _jsx(Button, { size: "xs", variant: "secondary", onClick: () => onRollback(row.version), children: "Rollback" })] }, row.id))) })] }));
}
function FieldList({ title, items }) {
    return (_jsxs("div", { children: [_jsx("div", { className: "text-xs font-semibold text-text-muted uppercase mb-2", children: title }), _jsx("div", { className: "flex flex-wrap gap-1", children: items.map((item) => _jsx(Badge, { children: item }, item)) })] }));
}
function Stat({ label, value, intent, large, embedded }) {
    const content = (_jsxs(_Fragment, { children: [_jsxs("div", { className: "flex items-center gap-2 text-xs text-text-muted", children: [intentIcon(intent), " ", label] }), _jsx("div", { className: cn("font-semibold tabular-nums mt-1", large ? "text-3xl" : "text-2xl"), children: value })] }));
    if (embedded) {
        return _jsx("div", { className: "rounded-md border border-border-subtle bg-surface-1 p-4", children: content });
    }
    return (_jsx(Card, { children: _jsx(CardContent, { children: content }) }));
}
function SkeletonCard({ title }) {
    return (_jsxs(Card, { children: [_jsx(CardHeader, { children: _jsx(CardTitle, { children: title }) }), _jsxs(CardContent, { className: "h-40 flex items-center justify-center text-sm text-text-muted", children: [_jsx(Spinner, { size: 14 }), " Running query"] })] }));
}
function UnsupportedChart({ kind }) {
    return (_jsxs("div", { className: "rounded-md border border-dashed border-border p-8 text-center", children: [_jsx(Gauge, { className: "h-8 w-8 mx-auto text-text-muted" }), _jsx("div", { className: "mt-2 text-sm font-medium", children: "Chart config saved" }), _jsxs("div", { className: "text-xs text-text-muted", children: [kind, " rendering is not enabled yet; the saved config remains portable."] })] }));
}
function GaugeChart({ data, metricLabel }) {
    const value = Math.max(0, data[0]?.value ?? 0);
    const max = Math.max(value, ...data.map((row) => row.value), 1);
    const pct = Math.min(100, Math.round((value / max) * 100));
    const circumference = 157;
    return (_jsxs("div", { className: "flex flex-col items-center justify-center gap-3 min-h-48", children: [_jsxs("svg", { viewBox: "0 0 120 70", className: "w-full max-w-xs", role: "img", "aria-label": `${metricLabel} gauge ${pct}%`, children: [_jsx("path", { d: "M 15 60 A 45 45 0 0 1 105 60", fill: "none", stroke: "var(--border)", strokeWidth: "12", strokeLinecap: "round" }), _jsx("path", { d: "M 15 60 A 45 45 0 0 1 105 60", fill: "none", stroke: "var(--accent)", strokeWidth: "12", strokeDasharray: `${(pct / 100) * circumference} ${circumference}`, strokeLinecap: "round" })] }), _jsxs("div", { className: "text-center", children: [_jsx("div", { className: "text-3xl font-semibold tabular-nums", children: formatNumber(value) }), _jsxs("div", { className: "text-xs text-text-muted", children: [metricLabel, " / ", pct, "% of visible maximum"] })] })] }));
}
function TreemapChart({ data }) {
    const total = data.reduce((sum, row) => sum + Math.max(0, row.value), 0) || 1;
    return (_jsx("div", { className: "grid grid-cols-2 md:grid-cols-3 gap-2 min-h-48", children: data.slice(0, 9).map((row, index) => {
            const weight = Math.max(0.2, Math.max(0, row.value) / total);
            return (_jsxs("div", { className: "rounded-md border border-border-subtle bg-accent-subtle p-3 overflow-hidden", style: { minHeight: `${Math.max(72, weight * 260)}px` }, children: [_jsx("div", { className: "text-sm font-medium truncate", children: row.label }), _jsx("div", { className: "mt-1 text-2xl font-semibold tabular-nums", children: formatNumber(row.value) })] }, `${row.label}-${index}`));
        }) }));
}
function MapReadyChart({ data }) {
    const max = Math.max(...data.map((row) => row.value), 1);
    return (_jsx("div", { className: "flex flex-col gap-2 min-h-48", children: data.slice(0, 10).map((row, index) => {
            const pct = Math.max(4, Math.round((row.value / max) * 100));
            return (_jsxs("div", { className: "grid grid-cols-[minmax(120px,180px)_1fr_auto] items-center gap-3 text-sm", children: [_jsxs("div", { className: "flex items-center gap-2 min-w-0", children: [_jsx(MapPin, { className: "h-4 w-4 text-accent" }), _jsx("span", { className: "truncate", children: row.label })] }), _jsx("div", { className: "h-3 overflow-hidden rounded-full bg-surface-2", children: _jsx("div", { className: "h-full rounded-full bg-accent", style: { width: `${pct}%` } }) }), _jsx("span", { className: "tabular-nums text-text-muted", children: formatNumber(row.value) })] }, `${row.label}-${index}`));
        }) }));
}
function StatusNote({ children }) {
    return (_jsx("div", { className: "rounded-md border border-intent-success/30 bg-intent-success-bg px-3 py-2 text-sm text-intent-success", children: children }));
}
function Label({ children }) {
    return _jsx("div", { className: "text-xs font-medium text-text-muted mb-1", children: children });
}
function Meta({ label, value }) {
    return _jsxs("div", { className: "flex items-center justify-between gap-4 text-sm", children: [_jsx("span", { className: "text-text-muted", children: label }), _jsx("span", { className: "font-medium text-right", children: value })] });
}
function formatCell(value) {
    if (typeof value === "number")
        return formatNumber(value);
    if (value == null)
        return "";
    return String(value);
}
function formatNumber(value) {
    return Math.abs(value) >= 1000 ? Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(value) : Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value);
}
function formatDate(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}
function exploreLabel(explores, id) {
    return explores.find((explore) => explore.id === id)?.label ?? id;
}
function spaceName(spaces, id) {
    return spaces.find((space) => space.id === id)?.name ?? "Personal";
}
async function addChartToFirstDashboard(chart, catalog, state) {
    const dashboard = catalog.dashboards[0];
    if (!dashboard)
        return;
    await updateBiDashboard(dashboard.id, {
        expectedVersion: dashboard.version,
        tiles: [
            ...dashboard.tiles,
            { id: `tile_${Date.now()}`, kind: "chart", chartId: chart.id, x: 0, y: dashboard.tiles.length * 4, w: 6, h: 4, tabId: dashboard.tabs[0]?.id ?? "main" },
        ],
    });
    await state.refresh();
}
function intentIcon(intent) {
    if (intent === "success")
        return _jsx(CheckCircle2, { className: "h-4 w-4 text-intent-success" });
    if (intent === "warning")
        return _jsx(AlertTriangle, { className: "h-4 w-4 text-intent-warning" });
    if (intent === "danger")
        return _jsx(AlertTriangle, { className: "h-4 w-4 text-intent-danger" });
    if (intent === "info")
        return _jsx(FileClock, { className: "h-4 w-4 text-intent-info" });
    return _jsx(BarChart3, { className: "h-4 w-4 text-accent" });
}
