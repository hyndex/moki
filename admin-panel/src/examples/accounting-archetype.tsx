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
  type DriftPoint,
  type DrillTarget,
  type LoadState,
} from "@/admin-archetypes";
import { useAllRecords } from "@/runtime/hooks";

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

function mockKpis(period: string): Kpis {
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

function mockAttention(): Attention {
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

interface InvoiceRow {
  id: string;
  status?: "draft" | "sent" | "paid" | "overdue" | "void" | "partial";
  amount?: number;
  dueAt?: string;
  issuedAt?: string;
}

interface BillRow {
  id: string;
  status?: "draft" | "approved" | "paid" | "overdue";
  amount?: number;
  dueAt?: string;
}

interface JournalRow {
  id: string;
  status?: "draft" | "posted";
  postedAt?: string;
}

export function AccountingArchetypeDashboard() {
  const [params, setParams] = useUrlState(["period"] as const);
  const period = (params.period as PeriodKey | undefined) ?? "30d";

  // Real backend reads.
  const invoices = useAllRecords<InvoiceRow>("accounting.invoice");
  const bills = useAllRecords<BillRow>("accounting.bill");
  const journals = useAllRecords<JournalRow>("accounting.journal-entry");

  const kpisData = React.useMemo<Kpis>(() => {
    if (!invoices.data.length && !bills.data.length) return mockKpis(period);
    const arOpen = invoices.data
      .filter((i) => i.status !== "paid" && i.status !== "void")
      .reduce((s, i) => s + (i.amount ?? 0), 0);
    const apDue7 = bills.data
      .filter((b) => {
        if (b.status === "paid") return false;
        if (!b.dueAt) return false;
        const d = (Date.parse(b.dueAt) - Date.now()) / 86_400_000;
        return d >= 0 && d <= 7;
      })
      .reduce((s, b) => s + (b.amount ?? 0), 0);
    const draftJournals = journals.data.filter((j) => j.status === "draft").length;
    const periodDays = period === "7d" ? 7 : period === "30d" ? 30 : period === "qtd" ? 90 : 365;
    const since = Date.now() - periodDays * 86_400_000;
    const netPeriod = invoices.data
      .filter((i) => {
        if (i.status !== "paid") return false;
        return i.issuedAt ? Date.parse(i.issuedAt) >= since : false;
      })
      .reduce((s, i) => s + (i.amount ?? 0), 0)
      - bills.data
        .filter((b) => {
          if (b.status !== "paid") return false;
          return b.dueAt ? Date.parse(b.dueAt) >= since : false;
        })
        .reduce((s, b) => s + (b.amount ?? 0), 0);
    const fallback = mockKpis(period);
    return {
      cashOnHand: fallback.cashOnHand,
      netPeriod: { value: netPeriod, deltaPct: 0, series: fallback.netPeriod.series },
      burnRunwayDays: fallback.burnRunwayDays,
      arOpen: { value: arOpen, deltaPct: 0 },
      apDue7d: { value: apDue7 },
      glAnomalyCount: draftJournals,
    };
  }, [invoices.data, bills.data, journals.data, period]);

  const kpisState: LoadState = (invoices.error || bills.error || journals.error)
    ? { status: "error", error: invoices.error ?? bills.error ?? journals.error }
    : (invoices.loading && bills.loading && invoices.data.length === 0)
      ? { status: "loading" }
      : { status: "ready" };

  const kpis = {
    data: kpisData,
    state: kpisState,
    refetch: () => {
      invoices.refetch();
      bills.refetch();
      journals.refetch();
    },
  };

  const attentionData = React.useMemo<Attention>(() => {
    if (!invoices.data.length && !bills.data.length) return mockAttention();
    const items: Attention["items"] = [];
    const now = Date.now();
    const overdueInvoices = invoices.data.filter((i) => {
      if (i.status === "paid" || i.status === "void") return false;
      if (!i.dueAt) return false;
      return Date.parse(i.dueAt) < now;
    });
    if (overdueInvoices.length > 0) {
      const total = overdueInvoices.reduce((s, i) => s + (i.amount ?? 0), 0);
      items.push({
        id: "overdue",
        icon: "Clock",
        severity: "danger",
        title: `${overdueInvoices.length} invoice${overdueInvoices.length === 1 ? "" : "s"} overdue`,
        description: `Total ${new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(total)}`,
        drillTo: { kind: "hash", hash: "/accounting/invoices" },
      });
    }
    const billsDue = bills.data.filter((b) => {
      if (b.status === "paid") return false;
      if (!b.dueAt) return false;
      const d = (Date.parse(b.dueAt) - now) / 86_400_000;
      return d >= 0 && d <= 3;
    });
    if (billsDue.length > 0) {
      items.push({
        id: "bills",
        icon: "ShieldAlert",
        severity: "warning",
        title: `${billsDue.length} bill${billsDue.length === 1 ? "" : "s"} due in 3 days`,
        drillTo: { kind: "hash", hash: "/accounting/bills?filter=status:neq:paid" },
      });
    }
    const draftJournals = journals.data.filter((j) => j.status === "draft").slice(0, 5);
    if (draftJournals.length > 0) {
      items.push({
        id: "journals",
        icon: "AlertTriangle",
        severity: "info",
        title: `${draftJournals.length} journal entr${draftJournals.length === 1 ? "y" : "ies"} pending post`,
        drillTo: { kind: "hash", hash: "/accounting/journal-entries?filter=status:eq:draft" },
      });
    }
    if (items.length === 0) return mockAttention();
    return { items };
  }, [invoices.data, bills.data, journals.data]);

  const attention = { data: attentionData, state: kpisState, refetch: kpis.refetch };

  const refresh = kpis.refetch;

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
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const rows = [
                { period, refreshedAt: new Date().toISOString() },
              ];
              const csv = ["period,refreshedAt", `${period},${rows[0].refreshedAt}`].join("\n");
              const blob = new Blob([csv], { type: "text/csv" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `accounting-${period}-${new Date().toISOString().slice(0, 10)}.csv`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
            }}
          >
            <Download className="h-4 w-4 mr-1" aria-hidden /> Export
          </Button>
          <Button size="sm" onClick={() => { window.location.hash = "#/accounting/journal-entries/new"; }}>
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
