import * as React from "react";
import {
  ArrowUpRight,
  Download,
  Plus,
  Trophy,
  Target,
  TrendingUp,
  Clock,
  Filter,
  Search,
  Flame,
} from "lucide-react";
import { defineCustomView } from "@/builders";
import { PageHeader } from "@/admin-primitives/PageHeader";
import { DetailHeader } from "@/admin-primitives/DetailHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/admin-primitives/Card";
import {
  PageGrid,
  Col,
  Section,
  Inline,
  Stack,
} from "@/admin-primitives/PageLayout";
import { StatCard } from "@/admin-primitives/StatCard";
import { PropertyList } from "@/admin-primitives/PropertyList";
import { TabBar } from "@/admin-primitives/TabBar";
import { QuickFilterBar } from "@/admin-primitives/QuickFilter";
import { Popover, PopoverTrigger, PopoverContent } from "@/primitives/Popover";
import { Checkbox } from "@/primitives/Checkbox";
import { LiveDnDKanban } from "@/admin-primitives/LiveDnDKanban";
import { Timeline } from "@/admin-primitives/Timeline";
import { EmptyState } from "@/admin-primitives/EmptyState";
import { BarChart } from "@/admin-primitives/charts/BarChart";
import { LineChart } from "@/admin-primitives/charts/LineChart";
import { Donut } from "@/admin-primitives/charts/Donut";
import { Funnel } from "@/admin-primitives/charts/Funnel";
import { Sparkline } from "@/admin-primitives/charts/Sparkline";
import { Avatar } from "@/primitives/Avatar";
import { AvatarGroup } from "@/primitives/AvatarGroup";
import { Badge } from "@/primitives/Badge";
import { Button } from "@/primitives/Button";
import { Input } from "@/primitives/Input";
import { ProgressBar } from "@/primitives/ProgressBar";
import { cn } from "@/lib/cn";
import { formatCurrency, formatRelative } from "@/lib/format";
import {
  DEAL_STAGES,
  dealStageIntent,
  dealStageLabel,
  type Deal,
} from "./data";
import {
  useActivities,
  useContacts,
  useDeals,
  useQuotes,
} from "./data-hooks";
import {
  useDealEvents,
  useDealLineItems,
  useLostReasons,
  usePlatformConfig,
  useSalesReps,
  useStageVelocity,
} from "./live-data-hooks";
import { Spinner } from "@/primitives/Spinner";
import { navigateTo } from "@/views/useRoute";

/* ------------------------------------------------------------------------ */

export const salesOverviewView = defineCustomView({
  id: "sales.overview.view",
  title: "Sales overview",
  description: "Pipeline + performance in one view.",
  resource: "sales.deal",
  render: () => <SalesOverviewPage />,
});

function SalesOverviewPage() {
  const { data: DEALS, loading } = useDeals();
  const { data: REPS } = useSalesReps();
  const { value: fiscal } = usePlatformConfig("fiscal");
  const { value: targets } = usePlatformConfig("sales-targets");
  if (loading && DEALS.length === 0) return <LoadingShell />;
  const fiscalQuarter = (fiscal as { quarter?: string } | undefined)?.quarter ?? "This quarter";
  const repQuota = (targets as { repQuotaQuarter?: number } | undefined)?.repQuotaQuarter ?? 120_000;
  const open = DEALS.filter((d) => d.stage !== "won" && d.stage !== "lost");
  const won = DEALS.filter((d) => d.stage === "won");
  const pipelineValue = open.reduce((a, d) => a + d.amount, 0);
  const weighted = open.reduce((a, d) => a + d.amount * d.probability, 0);
  const bookedYtd = won.reduce((a, d) => a + d.amount, 0);
  const closingSoon = open
    .filter(
      (d) =>
        new Date(d.closeAt).getTime() - Date.now() < 14 * 86400_000 &&
        new Date(d.closeAt).getTime() > Date.now(),
    )
    .slice(0, 6);

  const byStage = DEAL_STAGES.filter(
    (s) => s.id !== "won" && s.id !== "lost",
  ).map((s) => ({
    label: s.label,
    value: DEALS.filter((d) => d.stage === s.id).length,
    color:
      s.intent === "neutral"
        ? "rgb(var(--text-muted))"
        : `rgb(var(--intent-${s.intent}))`,
  }));

  const leaderboard = REPS.slice(0, 5)
    .map((rep) => {
      const deals = DEALS.filter((d) => d.owner === rep.name && d.stage === "won");
      const closed = deals.reduce((a, d) => a + d.amount, 0);
      return {
        rep: rep.name,
        closed,
        attainment: Math.min(1.25, closed / (rep.quotaQuarter || repQuota)),
      };
    })
    .sort((a, b) => b.closed - a.closed);

  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const FISCAL_QUARTER = fiscalQuarter;

  return (
    <Stack>
      <PageHeader
        title={`Sales · ${FISCAL_QUARTER}`}
        description="Real-time view of pipeline, bookings, and team performance."
        actions={
          <>
            <Button variant="ghost" size="sm" iconLeft={<Download className="h-3.5 w-3.5" />}>
              Export
            </Button>
            <Button
              variant="primary"
              size="sm"
              iconLeft={<Plus className="h-3.5 w-3.5" />}
              onClick={() => navigateTo("/sales/deals/new")}
            >
              New deal
            </Button>
          </>
        }
      />

      <PageGrid columns={4}>
        <StatCard
          label="Booked YTD"
          value={formatCurrency(bookedYtd)}
          trend={{ value: 22, positive: true, label: "vs last yr" }}
          intent="success"
          icon={<Trophy className="h-3 w-3" />}
        />
        <StatCard
          label="Pipeline"
          value={formatCurrency(pipelineValue)}
          secondary={`${open.length} deals open`}
          intent="accent"
          icon={<TrendingUp className="h-3 w-3" />}
        />
        <StatCard
          label="Weighted"
          value={formatCurrency(weighted)}
          secondary="probability-adjusted"
          intent="info"
          icon={<Target className="h-3 w-3" />}
        />
        <StatCard
          label="Win rate"
          value="32%"
          trend={{ value: 3, positive: true }}
          spark={[26, 28, 29, 30, 28, 31, 32, 33, 32, 33, 34, 32]}
        />
      </PageGrid>

      <PageGrid columns={3}>
        <Col span={2}>
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Pipeline by stage</CardTitle>
                <CardDescription>Deal count, excluding closed.</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <BarChart data={byStage} height={200} />
            </CardContent>
          </Card>
        </Col>
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Revenue mix</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <Donut
              data={[
                { label: "New logos", value: 620 },
                { label: "Expansion", value: 480 },
                { label: "Renewal", value: 340 },
              ]}
              centerLabel={
                <div>
                  <div className="text-lg font-semibold text-text-primary tabular-nums">$1.44M</div>
                  <div className="text-xs text-text-muted">YTD</div>
                </div>
              }
            />
          </CardContent>
        </Card>
      </PageGrid>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Bookings trend</CardTitle>
            <CardDescription>Monthly closed-won revenue vs target.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <LineChart
            xLabels={months}
            series={[
              { label: "Actual", data: [160, 180, 210, 240, 280, 310, 340, 390, 420, 460, 510, 580] },
              {
                label: "Target",
                data: [150, 170, 200, 220, 260, 290, 320, 360, 400, 440, 480, 540],
                color: "rgb(var(--text-muted))",
              },
            ]}
            valueFormatter={(v) => `$${v}K`}
            height={230}
          />
        </CardContent>
      </Card>

      <PageGrid columns={2}>
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Closing soon</CardTitle>
              <CardDescription>Deals with a close date within 14 days.</CardDescription>
            </div>
            <Button
              size="sm"
              variant="ghost"
              iconRight={<ArrowUpRight className="h-3 w-3" />}
              onClick={() => navigateTo("/sales/deals")}
            >
              See all
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {closingSoon.length === 0 ? (
              <EmptyState title="Nothing closing soon" description="Breathe." />
            ) : (
              <ul className="divide-y divide-border-subtle">
                {closingSoon.map((d) => (
                  <li key={d.id}>
                    <button
                      type="button"
                      onClick={() => navigateTo(`/sales/deals/${d.id}`)}
                      className="w-full px-4 py-2.5 flex items-center gap-3 text-left hover:bg-surface-1 transition-colors"
                    >
                      <Avatar name={d.account} size="sm" />
                      <Stack gap="gap-0.5" className="flex-1 min-w-0">
                        <span className="text-sm font-medium text-text-primary truncate">
                          {d.name}
                        </span>
                        <span className="text-xs text-text-muted">
                          {d.owner} · closes {formatRelative(d.closeAt)}
                        </span>
                      </Stack>
                      <Badge intent={dealStageIntent(d.stage)}>{dealStageLabel(d.stage)}</Badge>
                      <div className="w-24 text-right tabular-nums text-sm font-medium">
                        {formatCurrency(d.amount)}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Leaderboard — {FISCAL_QUARTER}</CardTitle>
              <CardDescription>Closed-won vs quota.</CardDescription>
            </div>
            <Button
              size="sm"
              variant="ghost"
              iconRight={<ArrowUpRight className="h-3 w-3" />}
              onClick={() => navigateTo("/sales/leaderboard")}
            >
              Full board
            </Button>
          </CardHeader>
          <CardContent>
            <Stack gap="gap-3">
              {leaderboard.map((rep, i) => (
                <Stack key={rep.rep} gap="gap-1">
                  <Inline gap="gap-2">
                    <span
                      className={cn(
                        "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0",
                        i === 0 && "bg-intent-warning text-white",
                        i === 1 && "bg-text-muted text-white",
                        i === 2 && "bg-accent-subtle text-accent",
                        i >= 3 && "bg-surface-3 text-text-secondary",
                      )}
                    >
                      {i + 1}
                    </span>
                    <Avatar name={rep.rep} size="sm" />
                    <span className="text-sm font-medium text-text-primary flex-1">
                      {rep.rep}
                    </span>
                    <span className="text-sm tabular-nums text-text-secondary">
                      {formatCurrency(rep.closed)}
                    </span>
                  </Inline>
                  <ProgressBar
                    value={rep.attainment * 100}
                    max={125}
                    intent={
                      rep.attainment >= 1
                        ? "success"
                        : rep.attainment >= 0.7
                          ? "accent"
                          : "warning"
                    }
                    size="xs"
                  />
                </Stack>
              ))}
            </Stack>
          </CardContent>
        </Card>
      </PageGrid>
    </Stack>
  );
}

/* ------------------------------------------------------------------------ */

export const salesDealsView = defineCustomView({
  id: "sales.deals.view",
  title: "Deals",
  description: "All deals in one searchable, filterable list.",
  resource: "sales.deal",
  render: () => <DealsList />,
});

function DealsList() {
  const { data: DEALS, loading } = useDeals();
  const [tab, setTab] = React.useState("open");
  const [search, setSearch] = React.useState("");
  // Owner-filter chip set drives the Filters popover. An empty set is
  // "show all owners"; a non-empty set narrows to those owners only.
  const [selectedOwners, setSelectedOwners] = React.useState<Set<string>>(() => new Set());
  const ownerOptions = React.useMemo(
    () => Array.from(new Set(DEALS.map((d) => d.owner).filter(Boolean))).sort(),
    [DEALS],
  );

  if (loading && DEALS.length === 0) return <LoadingShell />;

  const filtered = DEALS.filter((d) => {
    if (tab === "open" && (d.stage === "won" || d.stage === "lost")) return false;
    if (tab === "won" && d.stage !== "won") return false;
    if (tab === "lost" && d.stage !== "lost") return false;
    if (selectedOwners.size > 0 && !selectedOwners.has(d.owner)) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        d.name.toLowerCase().includes(q) ||
        d.account.toLowerCase().includes(q) ||
        d.code.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const tabs = [
    { id: "all", label: "All", count: DEALS.length },
    { id: "open", label: "Open", count: DEALS.filter((d) => d.stage !== "won" && d.stage !== "lost").length },
    { id: "won", label: "Closed won", count: DEALS.filter((d) => d.stage === "won").length },
    { id: "lost", label: "Closed lost", count: DEALS.filter((d) => d.stage === "lost").length },
  ];

  return (
    <Stack>
      <PageHeader
        title="Deals"
        description={`${filtered.length} of ${DEALS.length} deals`}
        actions={
          <Button
            variant="primary"
            size="sm"
            iconLeft={<Plus className="h-3.5 w-3.5" />}
            onClick={() => navigateTo("/sales/deals/new")}
          >
            New deal
          </Button>
        }
      />
      <TabBar tabs={tabs} active={tab} onChange={setTab} />

      <Inline gap="gap-3" wrap>
        <div className="min-w-[220px] flex-1 max-w-sm">
          <Input
            placeholder="Search name, account, or code…"
            prefix={<Search className="h-3.5 w-3.5" />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant={selectedOwners.size > 0 ? "secondary" : "ghost"}
              size="sm"
              iconLeft={<Filter className="h-3.5 w-3.5" />}
            >
              Filters{selectedOwners.size > 0 ? ` · ${selectedOwners.size}` : ""}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-64 p-3">
            <Stack gap="gap-2">
              <span className="text-xs font-medium text-text-muted uppercase tracking-wider">Owner</span>
              <div className="max-h-56 overflow-y-auto flex flex-col gap-1.5">
                {ownerOptions.length === 0 ? (
                  <span className="text-xs text-text-muted">No owners assigned.</span>
                ) : (
                  ownerOptions.map((owner) => {
                    const id = `deals-owner-${owner.replace(/\s+/g, "-")}`;
                    return (
                      <label key={owner} htmlFor={id} className="flex items-center gap-2 text-sm cursor-pointer">
                        <Checkbox
                          id={id}
                          checked={selectedOwners.has(owner)}
                          onCheckedChange={(v) =>
                            setSelectedOwners((prev) => {
                              const next = new Set(prev);
                              if (v) next.add(owner);
                              else next.delete(owner);
                              return next;
                            })
                          }
                        />
                        <span>{owner}</span>
                      </label>
                    );
                  })
                )}
              </div>
              {selectedOwners.size > 0 ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedOwners(new Set())}
                >
                  Clear filters
                </Button>
              ) : null}
            </Stack>
          </PopoverContent>
        </Popover>
      </Inline>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-surface-1 border-b border-border text-xs uppercase tracking-wider text-text-muted">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Deal</th>
                <th className="text-left py-2 font-medium">Stage</th>
                <th className="text-left py-2 font-medium">Owner</th>
                <th className="text-right py-2 font-medium">Probability</th>
                <th className="text-right py-2 font-medium">Amount</th>
                <th className="text-right py-2 font-medium pr-4">Close</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <EmptyState
                      title="No deals match"
                      description="Try a different filter or search."
                    />
                  </td>
                </tr>
              ) : (
                filtered.map((d) => (
                  <tr
                    key={d.id}
                    className="border-b border-border-subtle last:border-b-0 cursor-pointer hover:bg-surface-1 transition-colors"
                    onClick={() => navigateTo(`/sales/deals/${d.id}`)}
                  >
                    <td className="px-4 py-2">
                      <Inline gap="gap-2.5">
                        <Avatar name={d.account} size="sm" />
                        <Stack gap="gap-0.5">
                          <Inline gap="gap-2">
                            <code className="font-mono text-xs text-text-muted">{d.code}</code>
                            <span className="text-sm font-medium text-text-primary">{d.name}</span>
                          </Inline>
                          <span className="text-xs text-text-muted">{d.contact}</span>
                        </Stack>
                      </Inline>
                    </td>
                    <td className="py-2">
                      <Badge intent={dealStageIntent(d.stage)}>
                        {dealStageLabel(d.stage)}
                      </Badge>
                    </td>
                    <td className="py-2">
                      <Inline gap="gap-1.5">
                        <Avatar name={d.owner} size="xs" />
                        <span className="text-xs text-text-secondary">{d.owner}</span>
                      </Inline>
                    </td>
                    <td className="py-2 text-right">
                      <ProgressBar
                        value={d.probability * 100}
                        className="w-20 inline-flex"
                        intent={
                          d.probability >= 0.8
                            ? "success"
                            : d.probability >= 0.4
                              ? "accent"
                              : "neutral"
                        }
                        size="xs"
                      />
                    </td>
                    <td className="py-2 text-right tabular-nums text-text-primary font-medium">
                      {formatCurrency(d.amount)}
                    </td>
                    <td className="py-2 pr-4 text-right text-xs text-text-muted">
                      {formatRelative(d.closeAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </Stack>
  );
}

/* ------------------------------------------------------------------------ */

export const salesPipelineView = defineCustomView({
  id: "sales.pipeline.view",
  title: "Pipeline",
  description: "Every active deal, by stage.",
  resource: "sales.deal",
  render: () => <SalesPipelinePage />,
});

function SalesPipelinePage() {
  const { data: DEALS, loading } = useDeals();
  if (loading && DEALS.length === 0) return <LoadingShell />;
  {
    const columns = DEAL_STAGES.filter(
      (s) => s.id !== "lost",
    ).map((s) => {
      const items = DEALS.filter((d) => d.stage === s.id);
      const total = items.reduce((a, d) => a + d.amount, 0);
      const weighted = items.reduce(
        (a, d) => a + d.amount * d.probability,
        0,
      );
      return {
        id: s.id,
        title: s.label,
        intent: s.intent,
        items,
        total,
        weighted,
      };
    });

    return (
      <Stack>
        <PageHeader
          title="Sales pipeline"
          description="Drag-free board. Click any card for the full deal."
        />

        <PageGrid columns={4}>
          {columns.map((c) => (
            <StatCard
              key={c.id}
              label={c.title}
              value={c.items.length}
              secondary={`${formatCurrency(c.total)} · weighted ${formatCurrency(c.weighted)}`}
              intent={
                c.intent === "success" ? "success" : c.intent === "warning" ? "warning" : c.intent === "info" ? "info" : "neutral"
              }
            />
          ))}
        </PageGrid>

        <LiveDnDKanban<Deal>
          resource="sales.deal"
          statusField="stage"
          columns={columns.map((c) => ({
            id: c.id,
            title: `${c.title} · ${c.items.length}`,
            intent: c.intent,
          }))}
          onCardClick={(d) => navigateTo(`/sales/deals/${d.id}`)}
          renderCard={(d) => (
            <div>
              <Inline gap="gap-2">
                <Avatar name={d.account} size="sm" />
                <Stack gap="gap-0.5" className="flex-1 min-w-0">
                  <code className="text-[10px] font-mono text-text-muted">
                    {d.code}
                  </code>
                  <span className="text-sm font-medium text-text-primary truncate">
                    {d.name}
                  </span>
                </Stack>
              </Inline>
              <Inline gap="gap-2" className="mt-2 justify-between">
                <span className="text-xs text-text-secondary">{d.owner}</span>
                <Badge intent="accent">{formatCurrency(d.amount)}</Badge>
              </Inline>
              <ProgressBar
                value={d.probability * 100}
                intent={
                  d.probability >= 0.8
                    ? "success"
                    : d.probability >= 0.4
                      ? "accent"
                      : "neutral"
                }
                size="xs"
                className="mt-2"
              />
            </div>
          )}
        />
      </Stack>
    );
  }
}

/* ------------------------------------------------------------------------ */

export const salesForecastView = defineCustomView({
  id: "sales.forecast.view",
  title: "Forecast",
  description: "Commit / best case / worst case.",
  resource: "sales.deal",
  render: () => <ForecastPage />,
});

function ForecastPage() {
  const { data: DEALS, loading } = useDeals();
  const { value: fiscal } = usePlatformConfig("fiscal");
  const { value: targets } = usePlatformConfig("sales-targets");
  const [scenario, setScenario] = React.useState<"commit" | "best" | "worst">("commit");
  if (loading && DEALS.length === 0) return <LoadingShell />;
  const FISCAL_QUARTER = (fiscal as { quarter?: string } | undefined)?.quarter ?? "This quarter";
  const target = (targets as { companyQuarter?: number } | undefined)?.companyQuarter ?? 1_800_000;
  const open = DEALS.filter((d) => d.stage !== "won" && d.stage !== "lost");

  const commit = open.filter((d) => d.probability >= 0.65);
  const best = open;
  const worst = open.filter((d) => d.probability >= 0.85);
  const won = DEALS.filter((d) => d.stage === "won");
  const wonTotal = won.reduce((a, d) => a + d.amount, 0);

  const selected = scenario === "commit" ? commit : scenario === "best" ? best : worst;
  const forecastTotal = selected.reduce((a, d) => a + d.amount * d.probability, 0);

  const tabs = [
    { id: "commit", label: "Commit", count: commit.length },
    { id: "best", label: "Best case", count: best.length },
    { id: "worst", label: "Worst case", count: worst.length },
  ];

  return (
    <Stack>
      <PageHeader
        title={`Forecast · ${FISCAL_QUARTER}`}
        description="Projected close, adjusted by probability."
      />

      <PageGrid columns={4}>
        <StatCard label="Booked" value={formatCurrency(wonTotal)} intent="success" />
        <StatCard
          label="Forecast"
          value={formatCurrency(forecastTotal)}
          intent="accent"
        />
        <StatCard
          label="Total expected"
          value={formatCurrency(wonTotal + forecastTotal)}
          trend={{ value: 14, positive: true, label: "vs Q1" }}
        />
        <StatCard
          label="Target"
          value={formatCurrency(target)}
          secondary={`${Math.round(((wonTotal + forecastTotal) / target) * 100)}% to goal`}
          intent="warning"
        />
      </PageGrid>

      <Card>
        <CardContent className="pt-4">
          <Stack gap="gap-2">
            <Inline className="justify-between">
              <span className="text-sm font-medium text-text-primary">
                Progress to {formatCurrency(target)} target
              </span>
              <span className="text-sm text-text-secondary tabular-nums">
                {formatCurrency(wonTotal + forecastTotal)}
              </span>
            </Inline>
            <div className="relative w-full h-3 bg-surface-2 rounded-full overflow-hidden">
              <div
                className="absolute left-0 top-0 h-full bg-intent-success rounded-full"
                style={{ width: `${(wonTotal / target) * 100}%` }}
                title={`Booked: ${formatCurrency(wonTotal)}`}
              />
              <div
                className="absolute top-0 h-full bg-accent rounded-full opacity-70"
                style={{
                  left: `${(wonTotal / target) * 100}%`,
                  width: `${(forecastTotal / target) * 100}%`,
                }}
                title={`Forecast: ${formatCurrency(forecastTotal)}`}
              />
            </div>
            <Inline gap="gap-3" className="text-xs text-text-muted">
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-intent-success" /> Booked
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-accent" /> Forecast
              </span>
            </Inline>
          </Stack>
        </CardContent>
      </Card>

      <TabBar
        tabs={tabs}
        active={scenario}
        onChange={(id) => setScenario(id as typeof scenario)}
      />

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-surface-1 border-b border-border text-xs uppercase tracking-wider text-text-muted">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Deal</th>
                <th className="text-left py-2 font-medium">Stage</th>
                <th className="text-right py-2 font-medium">Prob.</th>
                <th className="text-right py-2 font-medium">Amount</th>
                <th className="text-right py-2 font-medium pr-4">Weighted</th>
              </tr>
            </thead>
            <tbody>
              {selected.map((d) => (
                <tr
                  key={d.id}
                  className="border-b border-border-subtle last:border-b-0 cursor-pointer hover:bg-surface-1 transition-colors"
                  onClick={() => navigateTo(`/sales/deals/${d.id}`)}
                >
                  <td className="px-4 py-2">
                    <Inline gap="gap-2">
                      <Avatar name={d.account} size="sm" />
                      <Stack gap="gap-0.5">
                        <span className="text-sm font-medium text-text-primary">{d.name}</span>
                        <span className="text-xs text-text-muted">{d.owner} · {formatRelative(d.closeAt)}</span>
                      </Stack>
                    </Inline>
                  </td>
                  <td className="py-2">
                    <Badge intent={dealStageIntent(d.stage)}>
                      {dealStageLabel(d.stage)}
                    </Badge>
                  </td>
                  <td className="py-2 text-right tabular-nums text-text-secondary">
                    {Math.round(d.probability * 100)}%
                  </td>
                  <td className="py-2 text-right tabular-nums">
                    {formatCurrency(d.amount)}
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums text-text-primary font-medium">
                    {formatCurrency(d.amount * d.probability)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </Stack>
  );
}

/* ------------------------------------------------------------------------ */

export const salesLeaderboardView = defineCustomView({
  id: "sales.leaderboard.view",
  title: "Leaderboard",
  description: "Reps ranked by closed-won.",
  resource: "sales.deal",
  render: () => <LeaderboardPage />,
});

function LeaderboardPage() {
  const { data: DEALS, loading } = useDeals();
  const { data: REPS } = useSalesReps();
  const { value: fiscal } = usePlatformConfig("fiscal");
  if (loading && DEALS.length === 0) return <LoadingShell />;
  const FISCAL_QUARTER = (fiscal as { quarter?: string } | undefined)?.quarter ?? "This quarter";
  {
    const reps = REPS.map((rep) => {
      const won = DEALS.filter((d) => d.owner === rep.name && d.stage === "won");
      const closed = won.reduce((a, d) => a + d.amount, 0);
      const open = DEALS.filter(
        (d) => d.owner === rep.name && d.stage !== "won" && d.stage !== "lost",
      );
      const openValue = open.reduce((a, d) => a + d.amount, 0);
      const quota = rep.quotaQuarter || 120_000;
      return {
        rep: rep.name,
        closed,
        openValue,
        deals: won.length,
        attainment: closed / quota,
      };
    }).sort((a, b) => b.closed - a.closed);

    return (
      <Stack>
        <PageHeader
          title={`Leaderboard · ${FISCAL_QUARTER}`}
          description="Closed-won, open pipeline, and quota attainment per rep."
        />

        <PageGrid columns={3}>
          {reps.slice(0, 3).map((r, i) => (
            <Card
              key={r.rep}
              className={cn(
                i === 0 && "border-intent-warning/50",
                i === 1 && "border-text-muted/30",
                i === 2 && "border-accent/30",
              )}
            >
              <CardContent className="pt-4">
                <Inline gap="gap-3">
                  <div
                    className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center text-base font-bold shrink-0",
                      i === 0 && "bg-intent-warning text-white",
                      i === 1 && "bg-text-muted text-white",
                      i === 2 && "bg-accent-subtle text-accent",
                    )}
                  >
                    {i === 0 ? <Trophy className="h-5 w-5" /> : i + 1}
                  </div>
                  <Stack gap="gap-0.5" className="flex-1">
                    <div className="text-sm font-semibold text-text-primary">
                      {r.rep}
                    </div>
                    <div className="text-xs text-text-muted">
                      {r.deals} closed · {formatCurrency(r.openValue)} open
                    </div>
                  </Stack>
                  <Avatar name={r.rep} size="lg" />
                </Inline>
                <div className="mt-4">
                  <div className="flex items-baseline justify-between mb-1">
                    <span className="text-2xl font-semibold tabular-nums text-text-primary">
                      {formatCurrency(r.closed)}
                    </span>
                    <span className="text-xs text-text-muted">
                      {Math.round(r.attainment * 100)}% of quota
                    </span>
                  </div>
                  <ProgressBar
                    value={r.attainment * 100}
                    max={125}
                    intent={
                      r.attainment >= 1
                        ? "success"
                        : r.attainment >= 0.7
                          ? "accent"
                          : "warning"
                    }
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </PageGrid>

        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="bg-surface-1 border-b border-border text-xs uppercase tracking-wider text-text-muted">
                <tr>
                  <th className="text-left pl-4 py-2 font-medium w-10">#</th>
                  <th className="text-left py-2 font-medium">Rep</th>
                  <th className="text-right py-2 font-medium">Closed</th>
                  <th className="text-right py-2 font-medium">Open</th>
                  <th className="text-right py-2 font-medium">Deals</th>
                  <th className="text-left py-2 font-medium pr-4">Attainment</th>
                </tr>
              </thead>
              <tbody>
                {reps.map((r, i) => (
                  <tr key={r.rep} className="border-b border-border-subtle last:border-b-0">
                    <td className="pl-4 py-2 text-text-muted tabular-nums">{i + 1}</td>
                    <td className="py-2">
                      <Inline gap="gap-2">
                        <Avatar name={r.rep} size="sm" />
                        <span className="text-text-primary">{r.rep}</span>
                      </Inline>
                    </td>
                    <td className="py-2 text-right tabular-nums font-medium text-text-primary">
                      {formatCurrency(r.closed)}
                    </td>
                    <td className="py-2 text-right tabular-nums text-text-secondary">
                      {formatCurrency(r.openValue)}
                    </td>
                    <td className="py-2 text-right tabular-nums text-text-secondary">
                      {r.deals}
                    </td>
                    <td className="py-2 pr-4 w-60">
                      <ProgressBar
                        value={r.attainment * 100}
                        max={125}
                        showLabel
                        label={`${Math.round(r.attainment * 100)}%`}
                        intent={
                          r.attainment >= 1
                            ? "success"
                            : r.attainment >= 0.7
                              ? "accent"
                              : "warning"
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </Stack>
    );
  }
}

/* ------------------------------------------------------------------------ */

export const salesRevenueView = defineCustomView({
  id: "sales.revenue.view",
  title: "Revenue",
  description: "Closed-won revenue across 12 months.",
  resource: "sales.deal",
  render: () => <SalesRevenuePage />,
});

function SalesRevenuePage() {
  const { data: DEALS, loading } = useDeals();
  const { data: REPS } = useSalesReps();
  if (loading && DEALS.length === 0) return <LoadingShell />;
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const won = DEALS.filter((d) => d.stage === "won");
  const wonTotal = won.reduce((a, d) => a + d.amount, 0);
  const avgDeal =
    won.length > 0 ? Math.round(wonTotal / won.length / 100) * 100 : 0;
  const winRate =
    DEALS.length > 0
      ? Math.round(
          (won.length /
            DEALS.filter((d) => d.stage === "won" || d.stage === "lost").length ||
            1) * 100,
        )
      : 0;

  // Bucket closed-won by calendar month for the trend chart.
  const now = new Date();
  const series: number[] = Array.from({ length: 12 }, () => 0);
  for (const d of won) {
    const t = new Date(d.closeAt);
    const diff = (now.getFullYear() - t.getFullYear()) * 12 + (now.getMonth() - t.getMonth());
    if (diff >= 0 && diff < 12) series[11 - diff] += d.amount / 1000;
  }
  const target = series.map((_, i) => 150 + i * 35);

  // Revenue by owner.
  const byOwner: Record<string, number> = {};
  for (const d of won) byOwner[d.owner] = (byOwner[d.owner] ?? 0) + d.amount;
  const ownerData = REPS.slice(0, 6).map((r) => ({
    label: r.name.split(" ")[0],
    value: Math.round((byOwner[r.name] ?? 0) / 1000),
  }));

  return (
    <Stack>
      <PageHeader
        title="Revenue analytics"
        description="Closed-won bookings over time."
      />
      <PageGrid columns={4}>
        <StatCard
          label="Booked (YTD)"
          value={`$${Math.round(wonTotal / 1000).toLocaleString()}K`}
          intent="success"
        />
        <StatCard
          label="Avg deal size"
          value={`$${Math.round(avgDeal / 1000).toLocaleString()}K`}
        />
        <StatCard
          label="Win rate"
          value={`${winRate}%`}
          trend={{ value: 3, positive: true }}
        />
        <StatCard label="Sales cycle" value="42 d" />
      </PageGrid>
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Revenue (closed-won) vs target</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <LineChart
            xLabels={months}
            series={[
              {
                label: "Actual",
                data: series.map((v) => Math.round(v)),
              },
              {
                label: "Target",
                data: target,
                color: "rgb(var(--text-muted))",
              },
            ]}
            height={240}
            valueFormatter={(v) => `$${v}K`}
          />
        </CardContent>
      </Card>
      <PageGrid columns={2}>
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Revenue by owner — QTD</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <BarChart
              data={ownerData}
              height={180}
              valueFormatter={(v) => `$${v}K`}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Revenue by segment</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <Donut
              data={[
                { label: "Enterprise", value: Math.round(wonTotal * 0.55) / 1000 },
                { label: "Mid-market", value: Math.round(wonTotal * 0.3) / 1000 },
                { label: "SMB", value: Math.round(wonTotal * 0.15) / 1000 },
              ]}
            />
          </CardContent>
        </Card>
      </PageGrid>
    </Stack>
  );
}

/* ------------------------------------------------------------------------ */

export const salesFunnelView = defineCustomView({
  id: "sales.funnel.view",
  title: "Funnel",
  description: "Conversion through deal stages.",
  resource: "sales.deal",
  render: () => <SalesFunnelPage />,
});

function SalesFunnelPage() {
  const { data: DEALS, loading } = useDeals();
  const { data: LOST_REASONS } = useLostReasons();
  const { data: VELOCITY } = useStageVelocity();
  if (loading && DEALS.length === 0) return <LoadingShell />;
  const stages = ["qualify", "proposal", "negotiate", "won"] as const;
  const data = stages.map((stage) => ({
    label: dealStageLabel(stage),
    value: DEALS.filter((d) => d.stage === stage || rank(d.stage) > rank(stage))
      .length,
  }));
  return (
    <Stack>
      <PageHeader
        title="Sales funnel"
        description="Volume of deals at each stage. Shows stage-to-stage conversion."
      />
      <Card>
        <CardContent className="pt-4">
          <Funnel data={data} />
        </CardContent>
      </Card>
      <PageGrid columns={2}>
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Stage velocity</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <BarChart
              data={VELOCITY.map((v) => ({ label: v.stage, value: v.avgDays }))}
              height={180}
              valueFormatter={(v) => `${v} days`}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Lost reasons</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <Donut
              data={LOST_REASONS.map((l) => ({
                label: l.reason,
                value: l.count,
              }))}
            />
          </CardContent>
        </Card>
      </PageGrid>
    </Stack>
  );
}

/* ------------------------------------------------------------------------ */

export const salesQuotesView = defineCustomView({
  id: "sales.quotes.view",
  title: "Quotes",
  description: "All outgoing quotes + their lifecycle.",
  resource: "sales.deal",
  render: () => <SalesQuotesPage />,
});

function SalesQuotesPage() {
  const { data: QUOTES, loading } = useQuotes();
  const [filter, setFilter] = React.useState("all");
  if (loading && QUOTES.length === 0) return <LoadingShell />;
  {
    const filtered = QUOTES.filter((q) => filter === "all" || q.status === filter);
    const quickFilters = [
      { id: "all", label: "All", count: QUOTES.length },
      { id: "draft", label: "Draft", count: QUOTES.filter((q) => q.status === "draft").length },
      { id: "sent", label: "Sent", count: QUOTES.filter((q) => q.status === "sent").length },
      { id: "accepted", label: "Accepted", count: QUOTES.filter((q) => q.status === "accepted").length },
      { id: "expired", label: "Expired", count: QUOTES.filter((q) => q.status === "expired").length },
    ];
    return (
      <Stack>
        <PageHeader
          title="Quotes"
          description="Proposals, sent and in-flight."
          actions={
            <Button
              variant="primary"
              size="sm"
              iconLeft={<Plus className="h-3.5 w-3.5" />}
              onClick={() => navigateTo("/sales/quotes/new")}
            >
              New quote
            </Button>
          }
        />
        <QuickFilterBar
          filters={quickFilters}
          active={filter}
          onChange={setFilter}
        />
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y divide-border-subtle">
              {filtered.map((q) => (
                <li
                  key={q.id}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-surface-1 transition-colors"
                >
                  <Avatar name={q.account} size="md" />
                  <Stack gap="gap-0.5" className="flex-1 min-w-0">
                    <Inline gap="gap-2">
                      <code className="font-mono text-xs text-text-muted">{q.number}</code>
                      <span className="text-sm font-medium text-text-primary truncate">
                        {q.account}
                      </span>
                    </Inline>
                    <span className="text-xs text-text-muted">
                      expires {formatRelative(q.expiresAt)}
                    </span>
                  </Stack>
                  <Badge
                    intent={
                      q.status === "accepted"
                        ? "success"
                        : q.status === "sent"
                          ? "info"
                          : q.status === "draft"
                            ? "neutral"
                            : "danger"
                    }
                  >
                    {q.status}
                  </Badge>
                  <div className="w-24 text-right tabular-nums text-sm font-medium">
                    {formatCurrency(q.amount)}
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </Stack>
    );
  }
}

/* ------------------------------------------------------------------------ */

export const salesDealDetailView = defineCustomView({
  id: "sales.deal-detail.view",
  title: "Deal",
  description: "Complete deal record.",
  resource: "sales.deal",
  render: () => <DealDetailPage />,
});

function DealDetailPage() {
  const { data: DEALS, loading: dealsLoading } = useDeals();
  const { data: CONTACTS } = useContacts();
  const { data: ACTIVITIES } = useActivities();
  const { data: QUOTES } = useQuotes();
  const { data: LINE_ITEMS } = useDealLineItems();
  const { data: DEAL_EVENTS } = useDealEvents();
  const hash = useHash();
  const id = hash.split("/").pop();
  const [tab, setTab] = React.useState("overview");

  if (dealsLoading && DEALS.length === 0) return <LoadingShell />;

  const deal = DEALS.find((d) => d.id === id) ?? DEALS[0];
  if (!deal) {
    return (
      <EmptyState
        title="Deal not found"
        description={`No deal with id "${id}".`}
      />
    );
  }
  const contact =
    CONTACTS.find((c) => c.name === deal.contact) ?? CONTACTS[0] ?? {
      id: "unknown",
      name: deal.contact ?? "Unknown",
      company: deal.account,
      title: "",
    };

  const stageIndex = DEAL_STAGES.findIndex((s) => s.id === deal.stage);

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "activity", label: "Activity", count: 8 },
    { id: "quotes", label: "Quotes", count: 2 },
    { id: "products", label: "Products", count: 4 },
  ];

  const relatedActivity = ACTIVITIES.filter((a) => a.contactId === contact.id).slice(0, 8);

  return (
    <Stack>
      <DetailHeader
        title={
          <span className="inline-flex items-center gap-2">
            <code className="font-mono text-sm text-text-muted">{deal.code}</code>
            {deal.name}
          </span>
        }
        subtitle={deal.account}
        badges={<Badge intent={dealStageIntent(deal.stage)}>{dealStageLabel(deal.stage)}</Badge>}
        avatar={{ name: deal.account }}
        meta={
          <>
            <span className="inline-flex items-center gap-1">
              Contact: <span className="text-text-primary">{deal.contact}</span>
            </span>
            <span className="inline-flex items-center gap-1">
              Owner: <span className="text-text-primary">{deal.owner}</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" /> Closes {formatRelative(deal.closeAt)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Flame className="h-3 w-3" /> {Math.round(deal.probability * 100)}% probability
            </span>
          </>
        }
        actions={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigateTo(`/crm/calls/new?dealId=${deal.id}`)}
            >
              Log call
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={stageIndex >= DEAL_STAGES.length - 1}
              onClick={() => {
                // Demo deal data is read-only; surface intent to the
                // operator so the click is visibly acknowledged.
                const next = DEAL_STAGES[stageIndex + 1];
                if (next) {
                  window.alert(`Demo: would advance "${deal.code}" to "${next.label}". Real implementation requires a server mutation hook.`);
                }
              }}
            >
              Advance stage
            </Button>
          </>
        }
      />

      {/* Stage progress bar */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-2">
            {DEAL_STAGES.map((s, i) => {
              const passed = i <= stageIndex && deal.stage !== "lost";
              const isCurrent = i === stageIndex;
              return (
                <React.Fragment key={s.id}>
                  <div className="flex items-center gap-2 shrink-0">
                    <div
                      className={cn(
                        "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold",
                        passed && !isCurrent && "bg-intent-success text-white",
                        isCurrent && "bg-accent text-accent-fg",
                        !passed && "bg-surface-3 text-text-muted",
                      )}
                    >
                      {i + 1}
                    </div>
                    <span
                      className={cn(
                        "text-xs",
                        isCurrent ? "text-text-primary font-medium" : "text-text-muted",
                      )}
                    >
                      {s.label}
                    </span>
                  </div>
                  {i < DEAL_STAGES.length - 1 && (
                    <div
                      className={cn(
                        "flex-1 h-px",
                        i < stageIndex ? "bg-intent-success" : "bg-border",
                      )}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <TabBar tabs={tabs} active={tab} onChange={setTab} />

      {tab === "overview" && (
        <PageGrid columns={3}>
          <Col span={2}>
            <Stack>
              <Section title="Key details">
                <PropertyList
                  columns={2}
                  items={[
                    { label: "Amount", value: <span className="text-base font-semibold">{formatCurrency(deal.amount)}</span> },
                    { label: "Weighted", value: formatCurrency(deal.amount * deal.probability) },
                    { label: "Account", value: deal.account },
                    { label: "Contact", value: deal.contact },
                    { label: "Stage", value: <Badge intent={dealStageIntent(deal.stage)}>{dealStageLabel(deal.stage)}</Badge> },
                    { label: "Probability", value: `${Math.round(deal.probability * 100)}%` },
                    { label: "Close date", value: formatRelative(deal.closeAt) },
                    { label: "Created", value: formatRelative(deal.createdAt) },
                  ]}
                />
              </Section>
              <Section title="Next steps">
                <ul className="flex flex-col gap-2 text-sm text-text-primary">
                  <li className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full border-2 border-accent shrink-0" />
                    Send security questionnaire to {deal.contact}
                  </li>
                  <li className="flex items-center gap-2 text-text-muted">
                    <span className="w-4 h-4 rounded-full border-2 border-border shrink-0" />
                    Schedule technical deep-dive
                  </li>
                  <li className="flex items-center gap-2 text-text-muted">
                    <span className="w-4 h-4 rounded-full border-2 border-border shrink-0" />
                    Draft redline for legal
                  </li>
                </ul>
              </Section>
            </Stack>
          </Col>
          <Stack>
            <Section title="Team">
              <Stack gap="gap-2">
                <Inline gap="gap-2">
                  <Avatar name={deal.owner} size="sm" />
                  <Stack gap="gap-0.5">
                    <span className="text-sm text-text-primary">{deal.owner}</span>
                    <span className="text-xs text-text-muted">Owner</span>
                  </Stack>
                </Inline>
                <Inline gap="gap-2">
                  <AvatarGroup names={["Taylor Nguyen", "Riley Kim"]} size="sm" />
                  <span className="text-xs text-text-muted">Collaborators</span>
                </Inline>
              </Stack>
            </Section>
            <Section title="Contact">
              <Inline gap="gap-2">
                <Avatar name={contact.name} size="md" />
                <Stack gap="gap-0.5">
                  <a
                    href={`#/contacts/${contact.id}`}
                    className="text-sm font-medium text-text-primary hover:underline"
                  >
                    {contact.name}
                  </a>
                  <span className="text-xs text-text-muted">{contact.title} · {contact.company}</span>
                </Stack>
              </Inline>
            </Section>
            <Section title="Probability sparkline">
              {(() => {
                const events = DEAL_EVENTS.filter((e) => e.dealId === deal.id)
                  .sort((a, b) => (a.occurredAt < b.occurredAt ? -1 : 1));
                const series =
                  events.length > 1
                    ? events.map((e) => e.probability)
                    : [deal.probability];
                const delta =
                  events.length > 1
                    ? Math.round(
                        (events[events.length - 1].probability - events[0].probability) *
                          100,
                      )
                    : 0;
                return (
                  <Stack gap="gap-1">
                    <Sparkline data={series} width={240} height={36} />
                    <span className="text-xs text-text-muted">
                      {events.length > 1
                        ? `Trended ${delta >= 0 ? "up" : "down"} ${Math.abs(delta)} points across ${events.length} stage changes`
                        : "No stage history yet"}
                    </span>
                  </Stack>
                );
              })()}
            </Section>
          </Stack>
        </PageGrid>
      )}

      {tab === "activity" && (
        <Card>
          <CardContent>
            <Timeline
              items={relatedActivity.map((a) => ({
                id: a.id,
                title: a.summary,
                description: a.body,
                occurredAt: a.when,
                intent:
                  a.kind === "call"
                    ? "success"
                    : a.kind === "email"
                      ? "info"
                      : a.kind === "meeting"
                        ? "accent"
                        : "warning",
              }))}
            />
          </CardContent>
        </Card>
      )}

      {tab === "quotes" && (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y divide-border-subtle">
              {QUOTES.slice(0, 2).map((q) => (
                <li key={q.id} className="flex items-center gap-3 px-4 py-3">
                  <Stack gap="gap-0.5" className="flex-1">
                    <code className="font-mono text-xs text-text-muted">{q.number}</code>
                    <span className="text-sm font-medium">{deal.account}</span>
                  </Stack>
                  <Badge
                    intent={
                      q.status === "accepted"
                        ? "success"
                        : q.status === "sent"
                          ? "info"
                          : q.status === "draft"
                            ? "neutral"
                            : "danger"
                    }
                  >
                    {q.status}
                  </Badge>
                  <span className="w-24 text-right tabular-nums text-sm font-medium">
                    {formatCurrency(q.amount)}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {tab === "products" && (
        <Card>
          <CardContent className="p-0">
            {(() => {
              const items = LINE_ITEMS.filter((li) => li.dealId === deal.id);
              if (items.length === 0) {
                return (
                  <EmptyState
                    title="No line items"
                    description="This deal has no product lines attached."
                  />
                );
              }
              const total = items.reduce((a, p) => a + p.total, 0);
              return (
                <table className="w-full text-sm">
                  <thead className="border-b border-border bg-surface-1 text-xs uppercase tracking-wider text-text-muted">
                    <tr>
                      <th className="text-left px-4 py-2 font-medium">Product</th>
                      <th className="text-right py-2 font-medium">Qty</th>
                      <th className="text-right py-2 font-medium">Price</th>
                      <th className="text-right py-2 pr-4 font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((p) => (
                      <tr
                        key={p.id}
                        className="border-b border-border-subtle last:border-b-0"
                      >
                        <td className="px-4 py-2 text-text-primary">{p.name}</td>
                        <td className="py-2 text-right tabular-nums">{p.quantity}</td>
                        <td className="py-2 text-right tabular-nums">
                          {formatCurrency(p.unitPrice)}
                        </td>
                        <td className="py-2 pr-4 text-right tabular-nums font-medium">
                          {formatCurrency(p.total)}
                        </td>
                      </tr>
                    ))}
                    <tr>
                      <td
                        colSpan={3}
                        className="px-4 py-2 text-right font-medium text-text-primary"
                      >
                        Total
                      </td>
                      <td className="py-2 pr-4 text-right font-semibold tabular-nums">
                        {formatCurrency(total)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              );
            })()}
          </CardContent>
        </Card>
      )}
    </Stack>
  );
}

function LoadingShell() {
  return (
    <div className="h-full w-full flex items-center justify-center gap-2 text-sm text-text-muted py-16">
      <Spinner size={14} />
      Loading…
    </div>
  );
}

function rank(stage: string): number {
  return DEAL_STAGES.findIndex((s) => s.id === stage);
}

function useHash() {
  const [hash, setHash] = React.useState(() =>
    typeof window === "undefined" ? "" : window.location.hash.slice(1),
  );
  React.useEffect(() => {
    const on = () => setHash(window.location.hash.slice(1));
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return hash;
}
