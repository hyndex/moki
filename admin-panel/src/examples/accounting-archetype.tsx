/** Reference Intelligent Dashboard for Accounting using the new
 *  `@/admin-archetypes` runtime. Pairs with `accounting.ts` via extraViews. */

import * as React from "react";
import { Plus, RefreshCw, Download } from "lucide-react";
import { Button } from "@/primitives/Button";
import { defineCustomView } from "@/builders";
import {
  IntelligentDashboard,
  KpiTile,
  AnomalyTile,
  ForecastTile,
  AttentionQueue,
  PeriodSelector,
  type PeriodKey,
  RailNextActions,
  RailRiskFlags,
  RailRecordHealth,
  CommandHints,
  WidgetShell,
  useUrlState,
  useArchetypeKeyboard,
  useSwr,
  type DriftPoint,
  type DrillTarget,
} from "@/admin-archetypes";

const HINTS = [
  { keys: "R", label: "Refresh" },
  { keys: "?", label: "Help" },
];

interface Kpis {
  cashOnHand: { value: number; deltaPct: number; series: DriftPoint[] };
  netPeriod: { value: number; deltaPct: number; series: DriftPoint[] };
  burnRunwayDays: { p10: number; p50: number; p90: number };
  arOpen: { value: number; deltaPct: number };
  apDue7d: { value: number };
  glAnomalyCount: number;
}

function mockSeries(base: number, amp: number, n: number): DriftPoint[] {
  return Array.from({ length: n }, (_, i) => ({
    x: i,
    y: Math.round(base + Math.sin((i / n) * Math.PI * 2) * amp),
  }));
}

async function fetchKpis(period: string): Promise<Kpis> {
  try {
    const res = await fetch(`/api/accounting/dashboard/kpis?period=${period}`);
    if (res.ok) return (await res.json()) as Kpis;
  } catch {/* fall through */}
  const scale = period === "7d" ? 0.25 : period === "30d" ? 1 : period === "qtd" ? 3 : 12;
  return {
    cashOnHand: {
      value: Math.round(842_000 * scale * 0.05) + 842_000,
      deltaPct: 4.1,
      series: mockSeries(820_000, 18_000, 14),
    },
    netPeriod: {
      value: Math.round(128_000 * scale),
      deltaPct: 12.8,
      series: mockSeries(110_000, 14_000, 14),
    },
    burnRunwayDays: { p10: 230, p50: 312, p90: 420 },
    arOpen: { value: 184_000, deltaPct: 6.2 },
    apDue7d: { value: 64_000 },
    glAnomalyCount: 3,
  };
}

interface Attention {
  items: Array<{
    id: string;
    icon?: string;
    severity?: "info" | "warning" | "danger" | "success";
    title: string;
    description?: string;
    drillTo?: DrillTarget;
  }>;
}

async function fetchAttention(): Promise<Attention> {
  try {
    const res = await fetch("/api/accounting/dashboard/attention");
    if (res.ok) return (await res.json()) as Attention;
  } catch {/* fall through */}
  return {
    items: [
      {
        id: "overdue",
        icon: "Clock",
        severity: "danger",
        title: "12 invoices overdue 30+ days",
        description: "Total exposure $84,200",
        drillTo: { kind: "hash", hash: "/accounting/ar?filter=overdue:eq:30+" },
      },
      {
        id: "approval",
        icon: "ShieldAlert",
        severity: "warning",
        title: "Approval queue: 4 bills > $5k",
        description: "Awaiting approver since 3d",
        drillTo: { kind: "hash", hash: "/accounting/ap?filter=pending-approval:eq:true" },
      },
      {
        id: "close",
        icon: "CalendarCheck",
        severity: "info",
        title: "Period close blocked: 3 reconciliations open",
        description: "2026-04 close in 2 days",
        drillTo: { kind: "hash", hash: "/accounting/close" },
      },
    ],
  };
}

export function AccountingArchetypeDashboard() {
  const [params, setParams] = useUrlState(["period"] as const);
  const period = (params.period as PeriodKey | undefined) ?? "30d";

  const kpis = useSwr<Kpis>(
    `accounting.kpis?period=${period}`,
    () => fetchKpis(period),
    { ttlMs: 30_000 },
  );
  const attention = useSwr<Attention>(
    `accounting.attention`,
    fetchAttention,
    { ttlMs: 30_000 },
  );

  const refresh = React.useCallback(() => {
    void kpis.refetch();
    void attention.refetch();
  }, [kpis, attention]);

  useArchetypeKeyboard([
    { label: "Refresh", combo: "r", run: refresh },
  ]);

  const fmtCurrency = (n: number) =>
    new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(n);

  return (
    <IntelligentDashboard
      id="accounting.archetype-dashboard"
      title="Accounting"
      subtitle="Cash, AR, AP and the close — at a glance."
      actions={
        <>
          <PeriodSelector value={period} onChange={(p) => setParams({ period: p })} withCompare />
          <Button variant="outline" size="sm" onClick={refresh}>
            <RefreshCw className="h-4 w-4 mr-1" aria-hidden /> Refresh
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-1" aria-hidden /> Export
          </Button>
          <Button size="sm">
            <Plus className="h-4 w-4 mr-1" aria-hidden /> New journal
          </Button>
        </>
      }
      kpis={
        <>
          <WidgetShell label="Cash on hand" state={kpis.state} skeleton="kpi" onRetry={kpis.refetch}>
            <KpiTile
              label="Cash on hand"
              value={fmtCurrency(kpis.data?.cashOnHand.value ?? 0)}
              period={period}
              trend={{ deltaPct: kpis.data?.cashOnHand.deltaPct, series: kpis.data?.cashOnHand.series, positiveIsGood: true }}
              drillTo={{ kind: "hash", hash: "/accounting/cash" }}
            />
          </WidgetShell>
          <WidgetShell label="Net" state={kpis.state} skeleton="kpi" onRetry={kpis.refetch}>
            <KpiTile
              label="Net (period)"
              value={fmtCurrency(kpis.data?.netPeriod.value ?? 0)}
              period={period}
              trend={{ deltaPct: kpis.data?.netPeriod.deltaPct, series: kpis.data?.netPeriod.series, positiveIsGood: true }}
              drillTo={{ kind: "hash", hash: "/accounting/reports/pl" }}
            />
          </WidgetShell>
          <WidgetShell label="Runway" state={kpis.state} skeleton="kpi" onRetry={kpis.refetch}>
            <ForecastTile
              label="Runway"
              current={`${kpis.data?.burnRunwayDays.p50 ?? 0}d`}
              forecast={{
                p10: kpis.data?.burnRunwayDays.p10 ?? 0,
                p50: kpis.data?.burnRunwayDays.p50 ?? 0,
                p90: kpis.data?.burnRunwayDays.p90 ?? 0,
                horizon: "to zero",
              }}
              format={(n) => `${Math.round(n)}d`}
            />
          </WidgetShell>
          <WidgetShell label="AR open" state={kpis.state} skeleton="kpi" onRetry={kpis.refetch}>
            <KpiTile
              label="AR open"
              value={fmtCurrency(kpis.data?.arOpen.value ?? 0)}
              period={period}
              trend={{ deltaPct: kpis.data?.arOpen.deltaPct, positiveIsGood: false }}
              drillTo={{ kind: "hash", hash: "/accounting/ar" }}
            />
          </WidgetShell>
          <WidgetShell label="AP due 7d" state={kpis.state} skeleton="kpi" onRetry={kpis.refetch}>
            <KpiTile
              label="AP due 7d"
              value={fmtCurrency(kpis.data?.apDue7d.value ?? 0)}
              period="7d"
              drillTo={{ kind: "hash", hash: "/accounting/ap?filter=due:eq:7d" }}
            />
          </WidgetShell>
          <WidgetShell label="GL anomalies" state={kpis.state} skeleton="kpi" onRetry={kpis.refetch}>
            <AnomalyTile
              label="GL anomalies"
              value={kpis.data?.glAnomalyCount ?? 0}
              anomaly={{ score: 0.74, reason: "GL 4100 spike on 2026-04-22 (+180%)", since: new Date().toISOString() }}
              drillTo={{ kind: "hash", hash: "/accounting/anomalies" }}
            />
          </WidgetShell>
        </>
      }
      main={
        <>
          <WidgetShell
            label="Attention queue"
            state={attention.state}
            skeleton="list"
            onRetry={attention.refetch}
            empty={{ title: "All clear", description: "No reconciliations or approvals waiting." }}
          >
            <AttentionQueue items={attention.data?.items ?? []} title="Needs your attention" />
          </WidgetShell>
          <CommandHints hints={HINTS} className="pt-1" />
        </>
      }
      rail={
        <>
          <RailRecordHealth
            score={{
              score: 91,
              tier: "success",
              factors: [
                { label: "AR aging", weight: -6 },
                { label: "Cash velocity", weight: 22 },
                { label: "Approval lag", weight: -8 },
                { label: "Anomalies", weight: -3 },
              ],
            }}
          />
          <RailNextActions
            actions={[
              { id: "reconcile-bank-a", label: "Reconcile Chase ····6411", source: "rule", drillTo: { kind: "hash", hash: "/accounting/cash" } },
              { id: "approve-bills", label: "Approve 4 bills > $5k", source: "rule", drillTo: { kind: "hash", hash: "/accounting/ap?filter=pending:eq:true" } },
              { id: "fx-revalue", label: "Run FX revalue for 2026-04", source: "ai", rationale: "Open balances in EUR/GBP exceed threshold." },
            ]}
          />
          <RailRiskFlags
            flags={[
              { id: "gl-spike", label: "GL 4100 spike +180%", detail: "vs trailing 30d", severity: "warning" },
              { id: "missing-pos", label: "3 bills missing PO match", detail: "Three-way match incomplete", severity: "danger" },
            ]}
          />
        </>
      }
    />
  );
}

export const accountingArchetypeDashboardView = defineCustomView({
  id: "accounting.archetype-dashboard.view",
  title: "Accounting overview (archetype)",
  description: "Reference Intelligent Dashboard built on the design system.",
  resource: "accounting.invoice",
  archetype: "dashboard",
  density: "comfortable",
  render: () => <AccountingArchetypeDashboard />,
});

export const accountingArchetypeNav = {
  id: "accounting.archetype-dashboard",
  label: "Accounting (new)",
  icon: "Activity",
  path: "/accounting/archetype-dashboard",
  view: "accounting.archetype-dashboard.view",
  section: "finance",
  order: 0.5,
};
