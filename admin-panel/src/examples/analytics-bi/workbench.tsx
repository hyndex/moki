import * as React from "react";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Clock,
  Copy,
  Database,
  FileClock,
  Filter,
  FolderTree,
  Gauge,
  GripVertical,
  History,
  LayoutDashboard,
  Link2,
  ListFilter,
  MapPin,
  Maximize2,
  Minimize2,
  Plus,
  RotateCcw,
  Save,
  Search,
  Share2,
  Table2,
  Trash2,
  Type,
} from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/primitives/Select";
import { Spinner } from "@/primitives/Spinner";
import { navigateTo, useHash } from "@/views/useRoute";
import { cn } from "@/lib/cn";
import {
  compileBiQuery,
  createBiChart,
  createBiDashboard,
  createBiSchedule,
  createBiShare,
  createBiSpace,
  drillDownBiQuery,
  fetchBiCatalog,
  fetchChartHistory,
  fetchDashboardHistory,
  rollbackBiChart,
  rollbackBiDashboard,
  runBiQuery,
  runBiSchedule,
  updateBiChart,
  updateBiDashboard,
  type AnalyticsExplore,
  type AnalyticsSpace,
  type BiCatalog,
  type DashboardContent,
  type DeliveryRun,
  type MetricQuery,
  type QueryResult,
  type SavedChart,
  type ScheduledDelivery,
  type ShareUrl,
  type ValidationResult,
} from "./api";
import {
  defaultQuery,
  explorePathForQuery,
  matchesSearch,
  queryFromHash,
  toggleDimension,
  toggleMetric,
} from "./model";

type ViewKind =
  | "explore"
  | "charts"
  | "dashboards"
  | "spaces"
  | "metrics"
  | "sql"
  | "schedules"
  | "validation"
  | "share";

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
] as const;

interface BiState {
  catalog: BiCatalog | null;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

export const analyticsExploreView = defineCustomView({
  id: "analytics-bi.explore.view",
  title: "BI Explorer",
  resource: "analytics-bi.explore",
  render: () => <BiWorkbench kind="explore" />,
});

export const analyticsChartsView = defineCustomView({
  id: "analytics-bi.charts.view",
  title: "Charts",
  resource: "analytics-bi.chart",
  render: () => <BiWorkbench kind="charts" />,
});

export const analyticsDashboardsView = defineCustomView({
  id: "analytics-bi.dashboards.view",
  title: "Dashboards",
  resource: "analytics-bi.dashboard-content",
  render: () => <BiWorkbench kind="dashboards" />,
});

export const analyticsSpacesView = defineCustomView({
  id: "analytics-bi.spaces.view",
  title: "Spaces",
  resource: "analytics-bi.space",
  render: () => <BiWorkbench kind="spaces" />,
});

export const analyticsMetricsView = defineCustomView({
  id: "analytics-bi.metrics.view",
  title: "Metrics",
  resource: "analytics-bi.explore",
  render: () => <BiWorkbench kind="metrics" />,
});

export const analyticsSqlRunnerView = defineCustomView({
  id: "analytics-bi.sql-runner.view",
  title: "SQL Runner",
  resource: "analytics-bi.explore",
  render: () => <BiWorkbench kind="sql" />,
});

export const analyticsSchedulesView = defineCustomView({
  id: "analytics-bi.schedules.view",
  title: "Schedules",
  resource: "analytics-bi.schedule",
  render: () => <BiWorkbench kind="schedules" />,
});

export const analyticsValidationView = defineCustomView({
  id: "analytics-bi.validation.view",
  title: "Validation",
  resource: "analytics-bi.validation-result",
  render: () => <BiWorkbench kind="validation" />,
});

export const analyticsShareView = defineCustomView({
  id: "analytics-bi.share.view",
  title: "Shared BI",
  resource: "analytics-bi.share-url",
  render: () => <BiWorkbench kind="share" />,
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

function BiWorkbench({ kind }: { kind: ViewKind }) {
  const state = useBiCatalog();
  if (state.loading) {
    return (
      <div className="flex items-center justify-center py-20 gap-2 text-sm text-text-muted">
        <Spinner size={14} /> Loading BI workspace
      </div>
    );
  }
  if (state.error || !state.catalog) {
    return (
      <EmptyStateFramework
        kind="error"
        title="BI workspace unavailable"
        description={state.error?.message ?? "The analytics catalog could not be loaded."}
        primary={{ label: "Retry", onClick: state.refresh }}
      />
    );
  }
  return <BiRoutes kind={kind} state={state} />;
}

function BiRoutes({ kind, state }: { kind: ViewKind; state: BiState }) {
  const hash = useHash();
  const pathOnly = hash.split("?")[0] ?? hash;
  const parts = pathOnly.replace(/^\/+/, "").split("/");
  const id = parts[2];
  const sub = parts[3];
  const catalog = state.catalog!;

  if (kind === "charts" && id) {
    return <ChartDetail chartId={id} tab={sub} state={state} />;
  }
  if (kind === "dashboards" && id) {
    return <DashboardDetail dashboardId={id} tab={sub} state={state} />;
  }
  if (kind === "share") {
    return <ShareLibrary catalog={catalog} />;
  }
  if (kind === "explore") return <ExplorePage state={state} />;
  if (kind === "charts") return <ChartsLibrary state={state} />;
  if (kind === "dashboards") return <DashboardsLibrary state={state} />;
  if (kind === "spaces") return <SpacesPage state={state} />;
  if (kind === "metrics") return <MetricsCatalog catalog={catalog} />;
  if (kind === "sql") return <SqlRunner state={state} />;
  if (kind === "schedules") return <SchedulesPage state={state} />;
  return <ValidationCenter state={state} />;
}

function useBiCatalog(): BiState {
  const [catalog, setCatalog] = React.useState<BiCatalog | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    try {
      setCatalog(await fetchBiCatalog());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  return { catalog, loading, error, refresh };
}

function ExplorePage({ state }: { state: BiState }) {
  const catalog = state.catalog!;
  const hash = useHash();
  const [fieldSearch, setFieldSearch] = React.useState("");
  const [query, setQuery] = React.useState<MetricQuery>(() =>
    queryFromHash(hash, catalog.explores) ?? defaultQuery(catalog.explores[0]),
  );
  const explore = catalog.explores.find((item) => item.id === query.exploreId) ?? catalog.explores[0];
  const [result, setResult] = React.useState<QueryResult | null>(null);
  const [drillRows, setDrillRows] = React.useState<Record<string, unknown>[]>([]);
  const [running, setRunning] = React.useState(false);
  const [saveName, setSaveName] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const restored = queryFromHash(hash, catalog.explores);
    if (!restored || JSON.stringify(restored) === JSON.stringify(query)) return;
    setQuery(restored);
    setResult(null);
    setDrillRows([]);
  }, [catalog.explores, hash, query]);

  React.useEffect(() => {
    if (!query.exploreId || typeof window === "undefined") return;
    const path = explorePathForQuery(query);
    if (window.location.hash.slice(1) !== path) {
      window.history.replaceState(null, "", `#${path}`);
    }
  }, [query]);

  const run = React.useCallback(async () => {
    if (!explore) return;
    setRunning(true);
    try {
      const next = await runBiQuery(query);
      setResult(next);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  }, [explore, query]);

  React.useEffect(() => {
    void run();
  }, [run]);

  const saveChart = async () => {
    if (!explore || !result) return;
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

  const drill = async (row: Record<string, unknown>) => {
    const dimensionValues = Object.fromEntries(query.dimensions.map((id) => [id, row[id]]));
    const res = await drillDownBiQuery(query, dimensionValues);
    setDrillRows(res.rows);
  };

  if (!explore) {
    return <EmptyStateFramework kind="no-results" title="No explores found" description="Seed or publish an analytics explore before opening the BI explorer." />;
  }

  const visibleDimensions = explore.dimensions.filter((field) =>
    matchesSearch(field.label, fieldSearch),
  );
  const visibleMetrics = explore.metrics.filter((field) =>
    matchesSearch(field.label, fieldSearch),
  );

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="BI Explorer"
        description="Select metrics and dimensions, run a governed local-record query, inspect SQL, and save reusable charts."
        actions={
          <>
            <Button variant="ghost" size="sm" iconLeft={<ListFilter className="h-4 w-4" />} onClick={() => navigateTo("/analytics/charts")}>
              Charts
            </Button>
            <Button variant="primary" size="sm" iconLeft={<Save className="h-4 w-4" />} onClick={saveChart} disabled={!result}>
              Save chart
            </Button>
          </>
        }
      />
      <div className="grid grid-cols-1 xl:grid-cols-[300px_minmax(0,1fr)] gap-4">
        <Card className="xl:sticky xl:top-0 xl:self-start">
          <CardHeader>
            <CardTitle>Fields</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Select
              value={explore.id}
              onValueChange={(nextExploreId: string) => {
                const nextExplore = catalog.explores.find((item) => item.id === nextExploreId);
                setQuery(defaultQuery(nextExplore));
                setResult(null);
                setDrillRows([]);
              }}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {catalog.explores.map((item) => (
                  <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input value={fieldSearch} onChange={(e) => setFieldSearch(e.target.value)} prefix={<Search className="h-3.5 w-3.5" />} placeholder="Search metrics and dimensions" />
            <FieldSection
              title="Dimensions"
              fields={visibleDimensions}
              selected={query.dimensions}
              onToggle={(id) => setQuery((prev) => toggleDimension(prev, id))}
            />
            <FieldSection
              title="Metrics"
              fields={visibleMetrics}
              selected={query.metrics}
              onToggle={(id) => setQuery((prev) => toggleMetric(prev, id))}
            />
          </CardContent>
        </Card>
        <div className="flex flex-col gap-4 min-w-0">
          <QueryControls explore={explore} query={query} setQuery={setQuery} running={running} run={run} saveName={saveName} setSaveName={setSaveName} />
          {error && (
            <Card className="border-intent-danger/40">
              <CardContent className="text-sm text-intent-danger">{error}</CardContent>
            </Card>
          )}
          <ResultVisualization result={result} chartKind={query.dimensions.length > 0 ? "bar" : "big_number"} />
          <ResultTable result={result} onDrill={drill} />
          <SqlPreview result={result} />
          {drillRows.length > 0 && <RawRows rows={drillRows} title="Underlying records" />}
        </div>
      </div>
    </div>
  );
}

function QueryControls({
  explore,
  query,
  setQuery,
  running,
  run,
  saveName,
  setSaveName,
}: {
  explore: AnalyticsExplore;
  query: MetricQuery;
  setQuery: React.Dispatch<React.SetStateAction<MetricQuery>>;
  running: boolean;
  run: () => void;
  saveName: string;
  setSaveName: (value: string) => void;
}) {
  const filter = query.filters?.[0];
  return (
    <Card>
      <CardContent className="grid grid-cols-1 lg:grid-cols-[1fr_1fr_120px_auto] gap-3 items-end">
        <div>
          <Label>Filter dimension</Label>
          <Select
            value={filter?.fieldId ?? "none"}
            onValueChange={(value: string) =>
              setQuery((prev) => ({
                ...prev,
                filters: value === "none" ? [] : [{ fieldId: value, operator: "contains", value: "" }],
              }))
            }
          >
            <SelectTrigger><SelectValue placeholder="No filter" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No filter</SelectItem>
              {explore.dimensions.map((dimension) => (
                <SelectItem key={dimension.id} value={dimension.id}>{dimension.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Filter value</Label>
          <Input
            value={String(filter?.value ?? "")}
            disabled={!filter}
            onChange={(e) =>
              setQuery((prev) => ({
                ...prev,
                filters: prev.filters?.length
                  ? [{ ...prev.filters[0], value: e.target.value }]
                  : [],
              }))
            }
            prefix={<Filter className="h-3.5 w-3.5" />}
            placeholder="Contains..."
          />
        </div>
        <div>
          <Label>Limit</Label>
          <Input
            type="number"
            min={1}
            max={1000}
            value={query.limit ?? 100}
            onChange={(e) => setQuery((prev) => ({ ...prev, limit: Number(e.target.value) }))}
          />
        </div>
        <div className="flex items-center gap-2">
          <Input value={saveName} onChange={(e) => setSaveName(e.target.value)} placeholder="Chart name" />
          <Button variant="primary" onClick={run} loading={running} iconLeft={<RotateCcw className="h-4 w-4" />}>
            Run
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ChartsLibrary({ state }: { state: BiState }) {
  const catalog = state.catalog!;
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Saved charts"
        description="Versioned BI content with direct links, dashboard insertion, sharing, scheduling, and validation."
        actions={<Button variant="primary" size="sm" iconLeft={<Plus className="h-4 w-4" />} onClick={() => navigateTo("/analytics/explore")}>New chart</Button>}
      />
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {catalog.charts.map((chart) => (
          <Card key={chart.id} className="hover:border-accent/50">
            <CardHeader>
              <div className="min-w-0">
                <CardTitle className="truncate">{chart.name}</CardTitle>
                <p className="text-xs text-text-muted mt-1 truncate">{chart.description}</p>
              </div>
              <Badge intent={chart.pinned ? "accent" : "neutral"}>v{chart.version}</Badge>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <MiniChart chart={chart} catalog={catalog} />
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-text-muted">{spaceName(catalog.spaces, chart.spaceId)}</span>
                <Button size="xs" variant="secondary" onClick={() => navigateTo(`/analytics/charts/${chart.id}`)}>Open</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function ChartDetail({ chartId, tab, state }: { chartId: string; tab?: string; state: BiState }) {
  const catalog = state.catalog!;
  const chart = catalog.charts.find((item) => item.id === chartId);
  const [result, setResult] = React.useState<QueryResult | null>(null);
  const [history, setHistory] = React.useState<{ id: string; version: number; createdAt: string; reason?: string }[]>([]);
  const [name, setName] = React.useState(chart?.name ?? "");
  const [chartKind, setChartKind] = React.useState<string>(chart?.config.kind ?? "bar");
  const [spaceId, setSpaceId] = React.useState(chart?.spaceId ?? catalog.spaces[0]?.id ?? "");
  const [message, setMessage] = React.useState("");

  React.useEffect(() => setName(chart?.name ?? ""), [chart?.id, chart?.name]);
  React.useEffect(() => setChartKind(chart?.config.kind ?? "bar"), [chart?.id, chart?.config.kind]);
  React.useEffect(() => setSpaceId(chart?.spaceId ?? catalog.spaces[0]?.id ?? ""), [chart?.id, chart?.spaceId, catalog.spaces]);
  React.useEffect(() => {
    if (!chart) return;
    void runBiQuery(chart.query).then(setResult);
    void fetchChartHistory(chart.id).then((res) => setHistory(res.rows));
  }, [chart?.id, chart?.version]);

  if (!chart) return <EmptyStateFramework kind="no-results" title="Chart not found" description="The saved chart link points to missing content." />;

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
      config: { ...chart.config, kind: chartKind as SavedChart["config"]["kind"] },
      spaceId,
      expectedVersion: chart.version,
    } as Partial<SavedChart>);
    setMessage("Chart saved as a new version.");
    await state.refresh();
  };
  const rollback = async (version: number) => {
    await rollbackBiChart(chart.id, version);
    setMessage(`Rolled back to v${version} as a new version.`);
    await state.refresh();
  };

  const historyMode = tab === "history";
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={chart.name}
        description={chart.description}
        actions={
          <>
            <Button size="sm" variant="ghost" iconLeft={<History className="h-4 w-4" />} onClick={() => navigateTo(`/analytics/charts/${chart.id}/history`)}>History</Button>
            <Button size="sm" variant="ghost" iconLeft={<Share2 className="h-4 w-4" />} onClick={share}>Share</Button>
            <Button size="sm" variant="ghost" iconLeft={<Clock className="h-4 w-4" />} onClick={schedule}>Schedule</Button>
            <Button size="sm" variant="primary" iconLeft={<Save className="h-4 w-4" />} onClick={save}>Save</Button>
          </>
        }
      />
      {message && <StatusNote>{message}</StatusNote>}
      {historyMode ? (
        <HistoryPanel rows={history} onRollback={rollback} />
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-4">
          <div className="flex flex-col gap-4 min-w-0">
            <ResultVisualization result={result} chartKind={chartKind} chart={{ ...chart, config: { ...chart.config, kind: chartKind as SavedChart["config"]["kind"] } }} />
            <ResultTable result={result} />
            <SqlPreview result={result} />
          </div>
          <Card>
            <CardHeader><CardTitle>Chart settings</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-3">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
              <Label>Visualization</Label>
              <Select value={chartKind} onValueChange={setChartKind}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CHART_KIND_OPTIONS.map((kind) => <SelectItem key={kind} value={kind}>{kind.replace("_", " ")}</SelectItem>)}
                </SelectContent>
              </Select>
              <Label>Space</Label>
              <Select value={spaceId} onValueChange={setSpaceId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {catalog.spaces.map((space) => <SelectItem key={space.id} value={space.id}>{space.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Meta label="Explore" value={exploreLabel(catalog.explores, chart.exploreId)} />
              <Meta label="Version" value={`v${chart.version}`} />
              <Button variant="secondary" onClick={() => addChartToFirstDashboard(chart, catalog, state)}>Add to dashboard</Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function DashboardsLibrary({ state }: { state: BiState }) {
  const catalog = state.catalog!;
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
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Dashboards" description="Editable BI canvases with tiles, tabs, versions, and direct links." actions={<Button variant="primary" size="sm" iconLeft={<Plus className="h-4 w-4" />} onClick={create}>New dashboard</Button>} />
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {catalog.dashboards.map((dashboard) => (
          <Card key={dashboard.id}>
            <CardHeader>
              <div>
                <CardTitle>{dashboard.name}</CardTitle>
                <p className="text-xs text-text-muted mt-1">{dashboard.tiles.length} tiles, {dashboard.tabs.length} tabs</p>
              </div>
              <Badge intent={dashboard.pinned ? "accent" : "neutral"}>v{dashboard.version}</Badge>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <span className="text-xs text-text-muted">{spaceName(catalog.spaces, dashboard.spaceId)}</span>
              <Button size="xs" onClick={() => navigateTo(`/analytics/dashboards/${dashboard.id}`)}>Open</Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function DashboardDetail({ dashboardId, tab, state }: { dashboardId: string; tab?: string; state: BiState }) {
  const catalog = state.catalog!;
  const dashboard = catalog.dashboards.find((item) => item.id === dashboardId);
  const [history, setHistory] = React.useState<{ id: string; version: number; createdAt: string; reason?: string }[]>([]);
  const [activeTab, setActiveTab] = React.useState("main");
  const [name, setName] = React.useState(dashboard?.name ?? "");
  const [message, setMessage] = React.useState("");
  const editMode = tab === "edit";
  const historyMode = tab === "history";

  React.useEffect(() => {
    if (dashboard) void fetchDashboardHistory(dashboard.id).then((res) => setHistory(res.rows));
  }, [dashboard?.id, dashboard?.version]);
  React.useEffect(() => setName(dashboard?.name ?? ""), [dashboard?.id, dashboard?.name]);

  if (!dashboard) return <EmptyStateFramework kind="no-results" title="Dashboard not found" description="The dashboard link points to missing content." />;

  const save = async (patch: Partial<DashboardContent>) => {
    await updateBiDashboard(dashboard.id, { ...patch, expectedVersion: dashboard.version } as Partial<DashboardContent>);
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
  const addTile = async (chartId: string) => {
    const visibleTiles = dashboard.tiles.filter((tile) => (tile.tabId ?? "main") === activeTab);
    const next = [
      ...dashboard.tiles,
      { id: `tile_${Date.now()}`, kind: "chart" as const, chartId, x: 0, y: visibleTiles.length * 4, w: 6, h: 4, tabId: activeTab },
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
    if (!field) return;
    await save({
      filters: [
        ...dashboard.filters,
        { id: `filter_${Date.now()}`, label: field.label, fieldId: field.id, defaultValue: "" },
      ],
    });
  };
  const rollback = async (version: number) => {
    await rollbackBiDashboard(dashboard.id, version);
    await state.refresh();
  };

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={dashboard.name}
        description={dashboard.description}
        actions={
          <>
            <Button size="sm" variant="ghost" iconLeft={<History className="h-4 w-4" />} onClick={() => navigateTo(`/analytics/dashboards/${dashboard.id}/history`)}>History</Button>
            <Button size="sm" variant="ghost" iconLeft={<Share2 className="h-4 w-4" />} onClick={share}>Share</Button>
            <Button size="sm" variant="ghost" iconLeft={<Clock className="h-4 w-4" />} onClick={schedule}>Schedule</Button>
            {editMode && <Button size="sm" variant="ghost" iconLeft={<Save className="h-4 w-4" />} onClick={() => save({ name, tiles: dashboard.tiles, tabs: dashboard.tabs, filters: dashboard.filters })}>Save version</Button>}
            <Button size="sm" variant={editMode ? "primary" : "secondary"} onClick={() => navigateTo(editMode ? `/analytics/dashboards/${dashboard.id}` : `/analytics/dashboards/${dashboard.id}/edit`)}>{editMode ? "View" : "Edit"}</Button>
          </>
        }
      />
      {message && <StatusNote>{message}</StatusNote>}
      {historyMode ? (
        <HistoryPanel rows={history} onRollback={rollback} />
      ) : (
        <>
          {editMode && (
            <Card>
              <CardContent className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_220px] gap-3 items-end">
                <div>
                  <Label>Dashboard name</Label>
                  <Input value={name} onChange={(event) => setName(event.target.value)} />
                </div>
                <Button variant="secondary" iconLeft={<Save className="h-4 w-4" />} onClick={() => save({ name })}>Save title</Button>
              </CardContent>
            </Card>
          )}
          <div className="flex flex-wrap items-center gap-2">
            {dashboard.tabs.map((item) => (
              <Button key={item.id} size="xs" variant={activeTab === item.id ? "primary" : "secondary"} onClick={() => setActiveTab(item.id)}>{item.label}</Button>
            ))}
            {editMode && <Button size="xs" variant="ghost" iconLeft={<Plus className="h-3 w-3" />} onClick={() => save({ tabs: [...dashboard.tabs, { id: `tab_${Date.now()}`, label: `Tab ${dashboard.tabs.length + 1}`, order: dashboard.tabs.length }] })}>Tab</Button>}
          </div>
          {editMode && (
            <Card>
              <CardContent className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Button size="xs" variant="secondary" iconLeft={<Type className="h-3 w-3" />} onClick={addMarkdownTile}>Markdown tile</Button>
                  <Button size="xs" variant="secondary" iconLeft={<Filter className="h-3 w-3" />} onClick={addFilter}>Dashboard filter</Button>
                  {catalog.charts.map((chart) => (
                    <Button key={chart.id} size="xs" variant="secondary" iconLeft={<Plus className="h-3 w-3" />} onClick={() => addTile(chart.id)}>{chart.name}</Button>
                  ))}
                </div>
                {dashboard.filters.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {dashboard.filters.map((filter) => (
                      <Badge key={filter.id} intent="info">{filter.label}: {filter.fieldId}</Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
          <DashboardCanvas dashboard={dashboard} catalog={catalog} activeTab={activeTab} editMode={editMode} onSave={save} />
        </>
      )}
    </div>
  );
}

function DashboardCanvas({
  dashboard,
  catalog,
  activeTab,
  editMode,
  onSave,
}: {
  dashboard: DashboardContent;
  catalog: BiCatalog;
  activeTab: string;
  editMode: boolean;
  onSave: (patch: Partial<DashboardContent>) => Promise<void>;
}) {
  const [draggingTileId, setDraggingTileId] = React.useState<string | null>(null);
  const tiles = dashboard.tiles
    .filter((tile) => (tile.tabId ?? "main") === activeTab)
    .slice()
    .sort((left, right) => left.y - right.y || left.x - right.x);
  if (tiles.length === 0) {
    return <EmptyStateFramework kind="no-results" title="No tiles on this tab" description="Add saved charts or markdown tiles to build the dashboard." />;
  }
  const writeVisibleOrder = async (ordered: typeof tiles) => {
    const packed = packDashboardTiles(ordered);
    const packedById = new Map(packed.map((tile) => [tile.id, tile]));
    const next = dashboard.tiles.map((tile) => packedById.get(tile.id) ?? tile);
    await onSave({ tiles: next });
  };
  const moveTile = async (tileId: string, dir: -1 | 1) => {
    const idx = tiles.findIndex((tile) => tile.id === tileId);
    const nextIdx = idx + dir;
    if (idx < 0 || nextIdx < 0 || nextIdx >= tiles.length) return;
    const next = [...tiles];
    const [tile] = next.splice(idx, 1);
    if (!tile) return;
    next.splice(nextIdx, 0, tile);
    await writeVisibleOrder(next);
  };
  const dropTile = async (targetTileId: string) => {
    if (!draggingTileId || draggingTileId === targetTileId) return;
    const next = [...tiles];
    const from = next.findIndex((tile) => tile.id === draggingTileId);
    const to = next.findIndex((tile) => tile.id === targetTileId);
    if (from < 0 || to < 0) return;
    const [tile] = next.splice(from, 1);
    if (!tile) return;
    next.splice(to, 0, tile);
    setDraggingTileId(null);
    await writeVisibleOrder(next);
  };
  const updateTile = async (tileId: string, patch: Partial<(typeof tiles)[number]>) => {
    await writeVisibleOrder(tiles.map((tile) => (tile.id === tileId ? { ...tile, ...patch } : tile)));
  };
  const removeTile = async (tileId: string) => {
    const visible = tiles.filter((tile) => tile.id !== tileId);
    const otherTabs = dashboard.tiles.filter((tile) => (tile.tabId ?? "main") !== activeTab);
    await onSave({ tiles: [...otherTabs, ...packDashboardTiles(visible)] });
  };
  const duplicateTile = async (tileId: string) => {
    const source = dashboard.tiles.find((tile) => tile.id === tileId);
    if (!source) return;
    const visible = [...tiles, { ...source, id: `tile_${Date.now()}` }];
    const otherTabs = dashboard.tiles.filter((tile) => (tile.tabId ?? "main") !== activeTab);
    await onSave({ tiles: [...otherTabs, ...packDashboardTiles(visible)] });
  };
  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
      {tiles.map((tile) => {
        const chart = catalog.charts.find((item) => item.id === tile.chartId);
        return (
          <Card
            key={tile.id}
            className={cn("xl:col-span-6", tile.w <= 4 && "xl:col-span-4", tile.w >= 12 && "xl:col-span-12", draggingTileId === tile.id && "opacity-60")}
            draggable={editMode}
            onDragStart={() => setDraggingTileId(tile.id)}
            onDragOver={(event) => { if (editMode) event.preventDefault(); }}
            onDrop={() => { if (editMode) void dropTile(tile.id); }}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {editMode && <GripVertical className="h-4 w-4 text-text-muted" />}
                {tile.title ?? chart?.name ?? "Tile"}
              </CardTitle>
              {editMode && (
                <div className="flex flex-wrap items-center gap-1">
                  <Button size="xs" variant="ghost" iconLeft={<Minimize2 className="h-3 w-3" />} onClick={() => updateTile(tile.id, { w: Math.max(4, tile.w - 2) })}>Narrow</Button>
                  <Button size="xs" variant="ghost" iconLeft={<Maximize2 className="h-3 w-3" />} onClick={() => updateTile(tile.id, { w: Math.min(12, tile.w + 2) })}>Wide</Button>
                  <Button size="xs" variant="ghost" onClick={() => moveTile(tile.id, -1)}>Up</Button>
                  <Button size="xs" variant="ghost" onClick={() => moveTile(tile.id, 1)}>Down</Button>
                  <Button size="xs" variant="ghost" iconLeft={<Copy className="h-3 w-3" />} onClick={() => duplicateTile(tile.id)}>Copy</Button>
                  <Button size="xs" variant="ghost" iconLeft={<Trash2 className="h-3 w-3" />} onClick={() => removeTile(tile.id)}>Remove</Button>
                </div>
              )}
            </CardHeader>
            <CardContent>
              {tile.kind === "markdown" || tile.kind === "heading" ? (
                editMode ? (
                  <Textarea
                    value={tile.markdown ?? tile.title ?? ""}
                    onChange={(event) => updateTile(tile.id, { markdown: event.target.value })}
                    className="min-h-28"
                  />
                ) : (
                  <p className={cn("text-sm text-text-secondary whitespace-pre-wrap", tile.kind === "heading" && "text-lg font-semibold text-text")}>{tile.markdown ?? tile.title}</p>
                )
              ) : chart ? (
                <MiniChart chart={chart} catalog={catalog} large />
              ) : (
                <EmptyStateFramework kind="no-results" title="Missing chart" description="This tile references a chart that no longer exists." />
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function packDashboardTiles<T extends { x: number; y: number; w: number; h: number }>(tiles: readonly T[]): T[] {
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

function SpacesPage({ state }: { state: BiState }) {
  const catalog = state.catalog!;
  const [name, setName] = React.useState("");
  const create = async () => {
    if (!name.trim()) return;
    await createBiSpace({ name, access: "team" });
    setName("");
    await state.refresh();
  };
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Spaces" description="Nested BI content libraries for charts, dashboards, and governed access." />
      <Card>
        <CardContent className="flex gap-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="New space name" />
          <Button onClick={create} iconLeft={<Plus className="h-4 w-4" />}>Create</Button>
        </CardContent>
      </Card>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {catalog.spaces.map((space) => (
          <Card key={space.id}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><FolderTree className="h-4 w-4" /> {space.name}</CardTitle>
              <Badge>{space.access}</Badge>
            </CardHeader>
            <CardContent className="text-sm text-text-secondary">
              <p>{space.description}</p>
              <p className="mt-3 text-xs text-text-muted">{catalog.charts.filter((c) => c.spaceId === space.id).length} charts, {catalog.dashboards.filter((d) => d.spaceId === space.id).length} dashboards</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function MetricsCatalog({ catalog }: { catalog: BiCatalog }) {
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Metrics catalog" description="Discover governed dimensions and metrics exposed by BI explores." />
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {catalog.explores.map((explore) => (
          <Card key={explore.id}>
            <CardHeader>
              <div>
                <CardTitle>{explore.label}</CardTitle>
                <p className="text-xs text-text-muted mt-1">{explore.resource}</p>
              </div>
              <Badge>{explore.metrics.length} metrics</Badge>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <FieldList title="Metrics" items={explore.metrics.map((metric) => `${metric.label} (${metric.aggregation})`)} />
              <FieldList title="Dimensions" items={explore.dimensions.map((dimension) => `${dimension.label} (${dimension.type})`)} />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function SqlRunner({ state }: { state: BiState }) {
  const catalog = state.catalog!;
  const [exploreId, setExploreId] = React.useState(catalog.explores[0]?.id ?? "");
  const explore = catalog.explores.find((item) => item.id === exploreId) ?? catalog.explores[0];
  const [sql, setSql] = React.useState("");
  const [result, setResult] = React.useState<QueryResult | null>(null);
  const query = defaultQuery(explore);
  const run = async () => {
    if (!explore) return;
    const compiled = await compileBiQuery(query);
    setSql(compiled.sql);
    setResult(await runBiQuery(query));
  };
  React.useEffect(() => {
    void run();
  }, [exploreId]);
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="SQL runner" description="Inspect compiled local-record SQL and run governed queries from semantic explores." actions={<Button onClick={run} iconLeft={<Database className="h-4 w-4" />}>Run</Button>} />
      <Card>
        <CardContent className="max-w-md">
          <Select value={exploreId} onValueChange={setExploreId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {catalog.explores.map((item) => <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Compiled SQL</CardTitle></CardHeader>
        <CardContent>
          <pre className="overflow-auto rounded-md bg-surface-2 p-3 text-xs text-text-secondary">{sql}</pre>
        </CardContent>
      </Card>
      <ResultTable result={result} />
    </div>
  );
}

function SchedulesPage({ state }: { state: BiState }) {
  const catalog = state.catalog!;
  const [message, setMessage] = React.useState("");
  const run = async (schedule: ScheduledDelivery) => {
    const delivery = await runBiSchedule(schedule.id);
    setMessage(`${schedule.name}: ${delivery.status}`);
    await state.refresh();
  };
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Scheduled deliveries" description="Recurring chart and dashboard delivery definitions with delivery-run logs." />
      {message && <StatusNote>{message}</StatusNote>}
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-4">
        <div className="flex flex-col gap-3">
          {catalog.schedules.map((schedule) => (
            <Card key={schedule.id}>
              <CardContent className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-medium text-sm">{schedule.name}</div>
                  <div className="text-xs text-text-muted">{schedule.cron} / {schedule.timezone} / {schedule.format}</div>
                </div>
                <Button size="xs" onClick={() => run(schedule)}>Run now</Button>
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardHeader><CardTitle>Delivery runs</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-2">
            {catalog.deliveryRuns.map((run) => (
              <div key={run.id} className="rounded-md border border-border p-2 text-xs">
                <div className="font-medium">{run.status}</div>
                <div className="text-text-muted">{run.message}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ValidationCenter({ state }: { state: BiState }) {
  const rows = state.catalog!.validation;
  const errorCount = rows.filter((row) => row.severity === "error").length;
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="BI validation" description="Content health for explores, saved charts, dashboards, schedules, and shares." actions={<Button size="sm" onClick={state.refresh} iconLeft={<RotateCcw className="h-4 w-4" />}>Refresh</Button>} />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Stat label="Errors" value={errorCount} intent={errorCount > 0 ? "danger" : "success"} />
        <Stat label="Warnings" value={rows.filter((row) => row.severity === "warning").length} intent="warning" />
        <Stat label="Checks" value={rows.length} intent="info" />
      </div>
      <Card>
        <CardContent className="p-0 overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-1 text-text-muted">
              <tr>
                <th className="text-left px-3 py-2">Severity</th>
                <th className="text-left px-3 py-2">Target</th>
                <th className="text-left px-3 py-2">Code</th>
                <th className="text-left px-3 py-2">Message</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-border-subtle">
                  <td className="px-3 py-2"><Badge intent={row.severity === "error" ? "danger" : row.severity === "warning" ? "warning" : "info"}>{row.severity}</Badge></td>
                  <td className="px-3 py-2">{row.targetKind}:{row.targetId}</td>
                  <td className="px-3 py-2 text-text-muted">{row.code}</td>
                  <td className="px-3 py-2">{row.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function ShareLibrary({ catalog }: { catalog: BiCatalog }) {
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Shared BI links" description="Share URLs are durable content records backed by the BI API." />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {catalog.shares.map((share) => (
          <Card key={share.id}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Link2 className="h-4 w-4" /> {share.targetKind}:{share.targetId}</CardTitle>
              <Badge>{share.token}</Badge>
            </CardHeader>
            <CardContent className="text-sm text-text-secondary">
              <code className="rounded bg-surface-2 px-2 py-1 text-xs">/api/analytics-bi/public/{share.token}</code>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function ResultVisualization({ result, chartKind, chart, embedded }: { result: QueryResult | null; chartKind: string; chart?: SavedChart; embedded?: boolean }) {
  if (!result) {
    return embedded
      ? <div className="h-36 flex items-center justify-center text-xs text-text-muted"><Spinner size={12} /> Running query</div>
      : <SkeletonCard title="Visualization" />;
  }
  const metric = chart?.config.valueField ?? chart?.config.yFields?.[0] ?? result.columns.find((c) => c.role === "metric")?.fieldId;
  const dimension = chart?.config.labelField ?? chart?.config.xField ?? result.columns.find((c) => c.role === "dimension")?.fieldId;
  if (!metric) {
    return embedded
      ? <div className="rounded-md border border-border-subtle p-4 text-sm text-text-muted">No metric selected.</div>
      : <EmptyStateFramework kind="no-results" title="No metric selected" description="Choose at least one metric to visualize results." />;
  }
  const data = result.rows.map((row, i) => ({
    label: String((dimension ? row[dimension] : `Row ${i + 1}`) ?? `Row ${i + 1}`),
    value: Number(row[metric] ?? 0),
  }));
  if (chartKind === "big_number") {
    const value = data.reduce((total, row) => total + row.value, 0);
    return <Stat label={result.columns.find((c) => c.fieldId === metric)?.label ?? metric} value={formatNumber(value)} intent="accent" large embedded={embedded} />;
  }
  const chartBody = (
    <>
      {chartKind === "donut" ? (
        <Donut data={data} />
      ) : chartKind === "funnel" ? (
        <Funnel data={data} />
      ) : chartKind === "line" || chartKind === "area" ? (
        <LineChart xLabels={data.map((d) => d.label)} series={[{ label: metric, data: data.map((d) => d.value) }]} area={chartKind === "area"} />
      ) : chartKind === "table" ? (
        <ResultTable result={result} compact embedded={embedded} />
      ) : chartKind === "gauge" ? (
        <GaugeChart data={data} metricLabel={result.columns.find((c) => c.fieldId === metric)?.label ?? metric} />
      ) : chartKind === "treemap" ? (
        <TreemapChart data={data} />
      ) : chartKind === "map" ? (
        <MapReadyChart data={data} />
      ) : (
        <BarChart data={data} />
      )}
    </>
  );
  if (embedded) {
    return <div className="min-h-36">{chartBody}</div>;
  }
  return (
    <Card>
      <CardHeader><CardTitle>Visualization</CardTitle></CardHeader>
      <CardContent>{chartBody}</CardContent>
    </Card>
  );
}

function MiniChart({ chart, catalog, large }: { chart: SavedChart; catalog: BiCatalog; large?: boolean }) {
  const [result, setResult] = React.useState<QueryResult | null>(null);
  React.useEffect(() => {
    void runBiQuery(chart.query).then(setResult).catch(() => setResult(null));
  }, [chart.id, chart.version]);
  if (!result) return <div className="h-36 flex items-center justify-center text-xs text-text-muted"><Spinner size={12} /> Running</div>;
  return <div className={large ? "min-h-56" : "min-h-36"}><ResultVisualization result={result} chartKind={chart.config.kind} chart={chart} embedded /></div>;
}

function ResultTable({ result, onDrill, compact, embedded }: { result: QueryResult | null; onDrill?: (row: Record<string, unknown>) => void; compact?: boolean; embedded?: boolean }) {
  if (!result) {
    return embedded
      ? <div className="h-28 flex items-center justify-center text-xs text-text-muted"><Spinner size={12} /> Running query</div>
      : <SkeletonCard title="Results" />;
  }
  const table = (
    <table className="w-full text-sm">
      <thead className="bg-surface-1 text-text-muted">
        <tr>
          {result.columns.map((column) => (
            <th key={column.fieldId} className="text-left px-3 py-2 whitespace-nowrap">{column.label}</th>
          ))}
          {onDrill && <th className="px-3 py-2" />}
        </tr>
      </thead>
      <tbody>
        {result.rows.map((row, idx) => (
          <tr key={idx} className="border-t border-border-subtle">
            {result.columns.map((column) => (
              <td key={column.fieldId} className="px-3 py-2 whitespace-nowrap">{formatCell(row[column.fieldId])}</td>
            ))}
            {onDrill && <td className="px-3 py-2 text-right"><Button size="xs" variant="ghost" onClick={() => onDrill(row)}>Drill</Button></td>}
          </tr>
        ))}
      </tbody>
    </table>
  );
  if (embedded) {
    return <div className="overflow-auto rounded-md border border-border-subtle">{table}</div>;
  }
  return (
    <Card>
      {!compact && <CardHeader><CardTitle>Results ({result.totalRows})</CardTitle></CardHeader>}
      <CardContent className="p-0 overflow-auto">
        {table}
      </CardContent>
    </Card>
  );
}

function SqlPreview({ result }: { result: QueryResult | null }) {
  if (!result) return null;
  return (
    <Card>
      <CardHeader><CardTitle>Compiled SQL preview</CardTitle></CardHeader>
      <CardContent>
        <pre className="overflow-auto rounded-md bg-surface-2 p-3 text-xs text-text-secondary">{result.compiledSql}</pre>
      </CardContent>
    </Card>
  );
}

function RawRows({ rows, title }: { rows: Record<string, unknown>[]; title: string }) {
  const columns = Object.keys(rows[0] ?? {}).slice(0, 8);
  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent className="p-0 overflow-auto">
        <table className="w-full text-xs">
          <thead className="bg-surface-1 text-text-muted"><tr>{columns.map((c) => <th key={c} className="text-left px-3 py-2">{c}</th>)}</tr></thead>
          <tbody>{rows.map((row, idx) => <tr key={idx} className="border-t border-border-subtle">{columns.map((c) => <td key={c} className="px-3 py-2">{formatCell(row[c])}</td>)}</tr>)}</tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function FieldSection({ title, fields, selected, onToggle }: { title: string; fields: { id: string; label: string; description?: string }[]; selected: string[]; onToggle: (id: string) => void }) {
  return (
    <section className="flex flex-col gap-2">
      <div className="text-xs font-semibold text-text-muted uppercase tracking-wide">{title}</div>
      <div className="flex flex-col gap-1 max-h-64 overflow-auto pr-1">
        {fields.map((field) => (
          <button
            key={field.id}
            type="button"
            onClick={() => onToggle(field.id)}
            className={cn("text-left rounded-md border px-2 py-2 text-sm", selected.includes(field.id) ? "border-accent bg-accent-subtle text-accent" : "border-border hover:bg-surface-1")}
          >
            <span className="font-medium">{field.label}</span>
            {field.description && <span className="block text-xs text-text-muted">{field.description}</span>}
          </button>
        ))}
      </div>
    </section>
  );
}

function HistoryPanel({ rows, onRollback }: { rows: { id: string; version: number; createdAt: string; reason?: string }[]; onRollback: (version: number) => void }) {
  return (
    <Card>
      <CardHeader><CardTitle>Version history</CardTitle></CardHeader>
      <CardContent className="flex flex-col gap-2">
        {rows.sort((a, b) => b.version - a.version).map((row) => (
          <div key={row.id} className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
            <div>
              <div className="text-sm font-medium">Version {row.version}</div>
              <div className="text-xs text-text-muted">{formatDate(row.createdAt)} {row.reason ? `/${row.reason}` : ""}</div>
            </div>
            <Button size="xs" variant="secondary" onClick={() => onRollback(row.version)}>Rollback</Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function FieldList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <div className="text-xs font-semibold text-text-muted uppercase mb-2">{title}</div>
      <div className="flex flex-wrap gap-1">{items.map((item) => <Badge key={item}>{item}</Badge>)}</div>
    </div>
  );
}

function Stat({ label, value, intent, large, embedded }: { label: string; value: React.ReactNode; intent: "accent" | "success" | "warning" | "danger" | "info"; large?: boolean; embedded?: boolean }) {
  const content = (
    <>
      <div className="flex items-center gap-2 text-xs text-text-muted">{intentIcon(intent)} {label}</div>
      <div className={cn("font-semibold tabular-nums mt-1", large ? "text-3xl" : "text-2xl")}>{value}</div>
    </>
  );
  if (embedded) {
    return <div className="rounded-md border border-border-subtle bg-surface-1 p-4">{content}</div>;
  }
  return (
    <Card>
      <CardContent>{content}</CardContent>
    </Card>
  );
}

function SkeletonCard({ title }: { title: string }) {
  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent className="h-40 flex items-center justify-center text-sm text-text-muted"><Spinner size={14} /> Running query</CardContent>
    </Card>
  );
}

function UnsupportedChart({ kind }: { kind: string }) {
  return (
    <div className="rounded-md border border-dashed border-border p-8 text-center">
      <Gauge className="h-8 w-8 mx-auto text-text-muted" />
      <div className="mt-2 text-sm font-medium">Chart config saved</div>
      <div className="text-xs text-text-muted">{kind} rendering is not enabled yet; the saved config remains portable.</div>
    </div>
  );
}

function GaugeChart({ data, metricLabel }: { data: Array<{ label: string; value: number }>; metricLabel: string }) {
  const value = Math.max(0, data[0]?.value ?? 0);
  const max = Math.max(value, ...data.map((row) => row.value), 1);
  const pct = Math.min(100, Math.round((value / max) * 100));
  const circumference = 157;
  return (
    <div className="flex flex-col items-center justify-center gap-3 min-h-48">
      <svg viewBox="0 0 120 70" className="w-full max-w-xs" role="img" aria-label={`${metricLabel} gauge ${pct}%`}>
        <path d="M 15 60 A 45 45 0 0 1 105 60" fill="none" stroke="var(--border)" strokeWidth="12" strokeLinecap="round" />
        <path
          d="M 15 60 A 45 45 0 0 1 105 60"
          fill="none"
          stroke="var(--accent)"
          strokeWidth="12"
          strokeDasharray={`${(pct / 100) * circumference} ${circumference}`}
          strokeLinecap="round"
        />
      </svg>
      <div className="text-center">
        <div className="text-3xl font-semibold tabular-nums">{formatNumber(value)}</div>
        <div className="text-xs text-text-muted">{metricLabel} / {pct}% of visible maximum</div>
      </div>
    </div>
  );
}

function TreemapChart({ data }: { data: Array<{ label: string; value: number }> }) {
  const total = data.reduce((sum, row) => sum + Math.max(0, row.value), 0) || 1;
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 min-h-48">
      {data.slice(0, 9).map((row, index) => {
        const weight = Math.max(0.2, Math.max(0, row.value) / total);
        return (
          <div
            key={`${row.label}-${index}`}
            className="rounded-md border border-border-subtle bg-accent-subtle p-3 overflow-hidden"
            style={{ minHeight: `${Math.max(72, weight * 260)}px` }}
          >
            <div className="text-sm font-medium truncate">{row.label}</div>
            <div className="mt-1 text-2xl font-semibold tabular-nums">{formatNumber(row.value)}</div>
          </div>
        );
      })}
    </div>
  );
}

function MapReadyChart({ data }: { data: Array<{ label: string; value: number }> }) {
  const max = Math.max(...data.map((row) => row.value), 1);
  return (
    <div className="flex flex-col gap-2 min-h-48">
      {data.slice(0, 10).map((row, index) => {
        const pct = Math.max(4, Math.round((row.value / max) * 100));
        return (
          <div key={`${row.label}-${index}`} className="grid grid-cols-[minmax(120px,180px)_1fr_auto] items-center gap-3 text-sm">
            <div className="flex items-center gap-2 min-w-0">
              <MapPin className="h-4 w-4 text-accent" />
              <span className="truncate">{row.label}</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-surface-2">
              <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
            </div>
            <span className="tabular-nums text-text-muted">{formatNumber(row.value)}</span>
          </div>
        );
      })}
    </div>
  );
}

function StatusNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-intent-success/30 bg-intent-success-bg px-3 py-2 text-sm text-intent-success">
      {children}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-xs font-medium text-text-muted mb-1">{children}</div>;
}

function Meta({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="flex items-center justify-between gap-4 text-sm"><span className="text-text-muted">{label}</span><span className="font-medium text-right">{value}</span></div>;
}

function formatCell(value: unknown): string {
  if (typeof value === "number") return formatNumber(value);
  if (value == null) return "";
  return String(value);
}

function formatNumber(value: number): string {
  return Math.abs(value) >= 1000 ? Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(value) : Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value);
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function exploreLabel(explores: AnalyticsExplore[], id: string): string {
  return explores.find((explore) => explore.id === id)?.label ?? id;
}

function spaceName(spaces: AnalyticsSpace[], id?: string): string {
  return spaces.find((space) => space.id === id)?.name ?? "Personal";
}

async function addChartToFirstDashboard(chart: SavedChart, catalog: BiCatalog, state: BiState) {
  const dashboard = catalog.dashboards[0];
  if (!dashboard) return;
  await updateBiDashboard(dashboard.id, {
    expectedVersion: dashboard.version,
    tiles: [
      ...dashboard.tiles,
      { id: `tile_${Date.now()}`, kind: "chart", chartId: chart.id, x: 0, y: dashboard.tiles.length * 4, w: 6, h: 4, tabId: dashboard.tabs[0]?.id ?? "main" },
    ],
  } as Partial<DashboardContent>);
  await state.refresh();
}

function intentIcon(intent: "accent" | "success" | "warning" | "danger" | "info") {
  if (intent === "success") return <CheckCircle2 className="h-4 w-4 text-intent-success" />;
  if (intent === "warning") return <AlertTriangle className="h-4 w-4 text-intent-warning" />;
  if (intent === "danger") return <AlertTriangle className="h-4 w-4 text-intent-danger" />;
  if (intent === "info") return <FileClock className="h-4 w-4 text-intent-info" />;
  return <BarChart3 className="h-4 w-4 text-accent" />;
}
