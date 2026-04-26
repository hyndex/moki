/** Reference AI usage dashboard (Intelligent Dashboard archetype). */

import * as React from "react";
import { Plus, RefreshCw } from "lucide-react";
import { Button } from "@/primitives/Button";
import { defineCustomView } from "@/builders";
import {
  IntelligentDashboard,
  KpiTile,
  KpiRing,
  AnomalyTile,
  AttentionQueue,
  PeriodSelector,
  type PeriodKey,
  RailNextActions,
  RailRiskFlags,
  RailRecordHealth,
  WidgetShell,
  useArchetypeKeyboard,
  useUrlState,
  useSwr,
  type DriftPoint,
} from "@/admin-archetypes";

interface AiKpis {
  tokens: { value: number; deltaPct: number; series: DriftPoint[] };
  cost: { value: number; deltaPct: number };
  p50LatencyMs: { value: number; deltaPct: number };
  evalPassRate: { current: number; target: number };
  failedRuns: { value: number };
  acceptanceRate: { value: number };
}

function mockSeries(base: number, amp: number, n: number): DriftPoint[] {
  return Array.from({ length: n }, (_, i) => ({
    x: i,
    y: Math.round(base + Math.sin((i / n) * Math.PI * 2) * amp),
  }));
}

async function fetchKpis(): Promise<AiKpis> {
  try {
    const res = await fetch("/api/ai/dashboard/kpis");
    if (res.ok) return (await res.json()) as AiKpis;
  } catch {/* fall through */}
  return {
    tokens: { value: 4_280_000, deltaPct: 14.2, series: mockSeries(3_900_000, 220_000, 14) },
    cost: { value: 412, deltaPct: 8.4 },
    p50LatencyMs: { value: 460, deltaPct: -3.1 },
    evalPassRate: { current: 0.92, target: 0.95 },
    failedRuns: { value: 7 },
    acceptanceRate: { value: 0.71 },
  };
}

export function AiAssistArchetypeDashboard() {
  const [params, setParams] = useUrlState(["period"] as const);
  const period = (params.period as PeriodKey | undefined) ?? "30d";
  const data = useSwr<AiKpis>(`ai.kpis?period=${period}`, fetchKpis, { ttlMs: 30_000 });

  useArchetypeKeyboard([{ label: "Refresh", combo: "r", run: () => { void data.refetch(); } }]);

  const fmtCurrency = (n: number) =>
    new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(n);

  return (
    <IntelligentDashboard
      id="ai.dashboard"
      title="AI usage"
      subtitle="Tokens, cost, latency, evals — across every plugin."
      actions={
        <>
          <PeriodSelector value={period} onChange={(p) => setParams({ period: p })} />
          <Button variant="outline" size="sm" onClick={() => data.refetch()}>
            <RefreshCw className="h-4 w-4 mr-1" aria-hidden /> Refresh
          </Button>
          <Button size="sm">
            <Plus className="h-4 w-4 mr-1" aria-hidden /> New skill
          </Button>
        </>
      }
      kpis={
        <>
          <WidgetShell label="Tokens" state={data.state} skeleton="kpi" onRetry={data.refetch}>
            <KpiTile label="Tokens" value={Intl.NumberFormat().format(data.data?.tokens.value ?? 0)} period={period}
              trend={{ deltaPct: data.data?.tokens.deltaPct, series: data.data?.tokens.series, positiveIsGood: false }}
              drillTo={{ kind: "hash", hash: "/ai/usage" }} />
          </WidgetShell>
          <WidgetShell label="Cost" state={data.state} skeleton="kpi" onRetry={data.refetch}>
            <KpiTile label="Cost" value={fmtCurrency(data.data?.cost.value ?? 0)} period={period}
              trend={{ deltaPct: data.data?.cost.deltaPct, positiveIsGood: false }}
              drillTo={{ kind: "hash", hash: "/ai/budgets" }} />
          </WidgetShell>
          <WidgetShell label="Latency" state={data.state} skeleton="kpi" onRetry={data.refetch}>
            <KpiTile label="p50 latency" value={`${data.data?.p50LatencyMs.value ?? 0}ms`}
              trend={{ deltaPct: data.data?.p50LatencyMs.deltaPct, positiveIsGood: false }} />
          </WidgetShell>
          <WidgetShell label="Eval pass" state={data.state} skeleton="kpi" onRetry={data.refetch}>
            <KpiRing label="Eval pass rate"
              current={data.data?.evalPassRate.current ?? 0}
              target={data.data?.evalPassRate.target ?? 1}
              format={(n) => `${(n * 100).toFixed(0)}%`} />
          </WidgetShell>
          <WidgetShell label="Failed runs" state={data.state} skeleton="kpi" onRetry={data.refetch}>
            <AnomalyTile label="Failed runs"
              value={data.data?.failedRuns.value ?? 0}
              anomaly={{ score: 0.7, reason: "Provider timeout cluster on skill X", since: new Date().toISOString() }}
              drillTo={{ kind: "hash", hash: "/ai/runs?filter=status:eq:failed" }} />
          </WidgetShell>
          <WidgetShell label="Acceptance" state={data.state} skeleton="kpi" onRetry={data.refetch}>
            <KpiTile label="Acceptance rate" value={`${((data.data?.acceptanceRate.value ?? 0) * 100).toFixed(0)}%`} />
          </WidgetShell>
        </>
      }
      main={
        <WidgetShell label="Attention" state={data.state} skeleton="list" onRetry={data.refetch}>
          <AttentionQueue
            title="Needs attention"
            items={[
              { id: "regression", icon: "AlertOctagon", severity: "danger", title: "Regression detected on skill 'classify'", description: "Pass rate dropped 8% w/w" },
              { id: "budget", icon: "TrendingUp", severity: "warning", title: "Budget at 78% with 12 days left", description: "Projected to overrun by 9%" },
              { id: "model-drift", icon: "Activity", severity: "info", title: "Model X p99 latency tripled", description: "Consider failover" },
            ]}
          />
        </WidgetShell>
      }
      rail={
        <>
          <RailRecordHealth score={{ score: 88, tier: "success", factors: [
            { label: "Pass rate", weight: 18 },
            { label: "Cost trend", weight: -6 },
            { label: "Acceptance", weight: 12 },
          ] }} />
          <RailNextActions actions={[
            { id: "rerun-evals", label: "Re-run regressed evals", source: "ai" },
            { id: "rotate-keys", label: "Rotate provider key (60d old)", source: "rule" },
          ]} />
          <RailRiskFlags flags={[
            { id: "throttle", label: "Provider throttled at 14:00", detail: "31 retries", severity: "warning" },
          ]} />
        </>
      }
    />
  );
}

export const aiAssistArchetypeDashboardView = defineCustomView({
  id: "ai-assist.archetype-dashboard.view",
  title: "AI usage (archetype)",
  description: "Reference AI Intelligent Dashboard.",
  resource: "ai.run",
  archetype: "dashboard",
  density: "comfortable",
  render: () => <AiAssistArchetypeDashboard />,
});

export const aiAssistArchetypeNav = [
  {
    id: "ai-assist.archetype-dashboard",
    label: "AI usage (new)",
    icon: "Sparkles",
    path: "/ai/archetype-dashboard",
    view: "ai-assist.archetype-dashboard.view",
    section: "ai",
    order: 0.5,
  },
];
