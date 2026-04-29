/** Reference HR & Payroll dashboard (Intelligent Dashboard archetype). */

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
  RailRecordHealth,
  RailRiskFlags,
  WidgetShell,
  useArchetypeKeyboard,
  useUrlState,
  type DriftPoint,
  type LoadState,
} from "@/admin-archetypes";
import { useAllRecords } from "@/runtime/hooks";

interface HrKpis {
  headcount: { value: number; deltaPct: number; series: DriftPoint[] };
  openReqs: number;
  turnover90: { current: number; target: number };
  avgTenureMonths: number;
  engagement: { value: number };
  flightRiskCount: number;
}

function mockSeries(base: number, amp: number, n: number): DriftPoint[] {
  return Array.from({ length: n }, (_, i) => ({
    x: i,
    y: Math.round(base + Math.sin((i / n) * Math.PI * 2) * amp),
  }));
}

function mockKpis(): HrKpis {
  return {
    headcount: { value: 248, deltaPct: 2.1, series: mockSeries(240, 6, 14) },
    openReqs: 14,
    turnover90: { current: 0.052, target: 0.08 },
    avgTenureMonths: 32,
    engagement: { value: 4.1 },
    flightRiskCount: 6,
  };
}

interface EmployeeRow {
  id: string;
  status?: "active" | "leave" | "terminated";
  startDate?: string;
  hireDate?: string;
  endDate?: string;
  flightRisk?: boolean;
  engagementScore?: number;
}

export function HrPayrollArchetypeDashboard() {
  const [params, setParams] = useUrlState(["period"] as const);
  const period = (params.period as PeriodKey | undefined) ?? "30d";
  // Real backend read.
  const live = useAllRecords<EmployeeRow>("hr-payroll.employee");

  const dataState: LoadState = live.error
    ? { status: "error", error: live.error }
    : live.loading && live.data.length === 0
      ? { status: "loading" }
      : { status: "ready" };

  const kpis = React.useMemo<HrKpis>(() => {
    if (!live.data.length) return mockKpis();
    const active = live.data.filter((e) => e.status !== "terminated");
    const headcount = active.length;
    const now = Date.now();
    const ninety = 90 * 86_400_000;
    const turnoverNumerator = live.data.filter(
      (e) =>
        e.status === "terminated" &&
        e.endDate &&
        now - Date.parse(e.endDate) <= ninety,
    ).length;
    const turnoverDenom = active.length || 1;
    const tenureSum = active.reduce((s, e) => {
      const start = e.startDate ?? e.hireDate;
      if (!start) return s;
      const months = (now - Date.parse(start)) / (30 * 86_400_000);
      return s + Math.max(0, months);
    }, 0);
    const engagementSum = active.reduce(
      (s, e) => s + (e.engagementScore ?? 0),
      0,
    );
    const engagementCount = active.filter((e) => typeof e.engagementScore === "number").length;
    const fallback = mockKpis();
    return {
      headcount: { value: headcount, deltaPct: 0, series: fallback.headcount.series },
      openReqs: fallback.openReqs,
      turnover90: { current: turnoverNumerator / turnoverDenom, target: 0.08 },
      avgTenureMonths: Math.round(tenureSum / Math.max(1, active.length)),
      engagement: { value: engagementCount === 0 ? 0 : engagementSum / engagementCount },
      flightRiskCount: live.data.filter((e) => e.flightRisk).length,
    };
  }, [live.data]);
  const data = { data: kpis, state: dataState, refetch: live.refetch };

  useArchetypeKeyboard([{ label: "Refresh", combo: "r", run: () => data.refetch() }]);

  return (
    <IntelligentDashboard
      id="hr-payroll.dashboard"
      title="People & payroll"
      subtitle="Headcount, retention, engagement, payroll health."
      actions={
        <>
          <PeriodSelector value={period} onChange={(p) => setParams({ period: p })} />
          <Button variant="outline" size="sm" onClick={() => data.refetch()}>
            <RefreshCw className="h-4 w-4 mr-1" aria-hidden /> Refresh
          </Button>
          <Button size="sm" onClick={() => { window.location.hash = "#/hr/employees/new"; }}>
            <Plus className="h-4 w-4 mr-1" aria-hidden /> New hire
          </Button>
        </>
      }
      kpis={
        <>
          <WidgetShell label="Headcount" state={data.state} skeleton="kpi" onRetry={data.refetch}>
            <KpiTile label="Headcount" value={data.data?.headcount.value ?? 0} period={period}
              trend={{ deltaPct: data.data?.headcount.deltaPct, series: data.data?.headcount.series, positiveIsGood: true }}
              drillTo={{ kind: "hash", hash: "/hr/people" }} />
          </WidgetShell>
          <WidgetShell label="Open reqs" state={data.state} skeleton="kpi" onRetry={data.refetch}>
            <KpiTile label="Open reqs" value={data.data?.openReqs ?? 0} drillTo={{ kind: "hash", hash: "/hr/recruiting" }} />
          </WidgetShell>
          <WidgetShell label="Turnover" state={data.state} skeleton="kpi" onRetry={data.refetch}>
            <KpiRing label="Turnover (rolling 90d)"
              current={data.data?.turnover90.current ?? 0}
              target={data.data?.turnover90.target ?? 0.1}
              format={(n) => `${(n * 100).toFixed(1)}%`} />
          </WidgetShell>
          <WidgetShell label="Tenure" state={data.state} skeleton="kpi" onRetry={data.refetch}>
            <KpiTile label="Avg tenure" value={`${data.data?.avgTenureMonths ?? 0}mo`} />
          </WidgetShell>
          <WidgetShell label="Engagement" state={data.state} skeleton="kpi" onRetry={data.refetch}>
            <KpiTile label="Engagement" value={`${data.data?.engagement.value.toFixed(1) ?? 0}/5`} />
          </WidgetShell>
          <WidgetShell label="Flight risk" state={data.state} skeleton="kpi" onRetry={data.refetch}>
            <AnomalyTile label="Flight risk"
              value={data.data?.flightRiskCount ?? 0}
              anomaly={{ score: 0.7, reason: "Engagement dipped + skip-1:1 pattern", since: new Date().toISOString() }}
              drillTo={{ kind: "hash", hash: "/hr/people?filter=flight_risk:eq:true" }} />
          </WidgetShell>
        </>
      }
      main={
        <WidgetShell label="Attention" state={data.state} skeleton="list" onRetry={data.refetch}>
          <AttentionQueue
            title="Needs attention"
            items={[
              { id: "probation", icon: "Hourglass", severity: "warning", title: "3 probation periods end this week", description: "Review with managers", drillTo: { kind: "hash", hash: "/hr/people?filter=probation:eq:true" } },
              { id: "i9", icon: "ShieldAlert", severity: "danger", title: "I-9 missing for 2 new hires", drillTo: { kind: "hash", hash: "/hr/people?filter=i9:eq:missing" } },
              { id: "anniv", icon: "PartyPopper", severity: "info", title: "5 work anniversaries this week", drillTo: { kind: "hash", hash: "/hr/people" } },
              { id: "comp", icon: "FileText", severity: "warning", title: "8 contracts expire in 30d", drillTo: { kind: "hash", hash: "/hr/contracts?filter=expires_in:lte:30d" } },
            ]}
          />
        </WidgetShell>
      }
      rail={
        <>
          <RailRecordHealth score={{ score: 86, tier: "success", factors: [
            { label: "Retention", weight: 18 },
            { label: "Engagement", weight: 12 },
            { label: "Onboarding lag", weight: -7 },
          ] }} />
          <RailNextActions actions={[
            { id: "send-survey", label: "Send pulse survey", source: "rule" },
            { id: "schedule-1on1", label: "Re-schedule skipped 1:1s", source: "ai" },
          ]} />
          <RailRiskFlags flags={[
            { id: "burnout", label: "Engineering team capacity at 92%", detail: "Burnout risk", severity: "warning" },
          ]} />
        </>
      }
    />
  );
}

export const hrPayrollArchetypeDashboardView = defineCustomView({
  id: "hr-payroll.archetype-dashboard.view",
  title: "People (archetype)",
  description: "Reference HR Intelligent Dashboard.",
  resource: "hr.employee",
  archetype: "dashboard",
  density: "comfortable",
  render: () => <HrPayrollArchetypeDashboard />,
});

export const hrPayrollArchetypeNav = [
  {
    id: "hr-payroll.archetype-dashboard",
    label: "People (new)",
    icon: "Users",
    path: "/hr/archetype-dashboard",
    view: "hr-payroll.archetype-dashboard.view",
    section: "people",
    order: 0.5,
  },
];
