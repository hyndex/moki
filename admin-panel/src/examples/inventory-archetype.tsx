/** Reference Inventory pages: Intelligent Dashboard + SKU Smart List. */

import * as React from "react";
import { Plus, RefreshCw, Download, Package } from "lucide-react";
import { Button } from "@/primitives/Button";
import { Input } from "@/primitives/Input";
import { Badge } from "@/primitives/Badge";
import { defineCustomView } from "@/builders";
import {
  IntelligentDashboard,
  SmartList,
  KpiTile,
  AnomalyTile,
  ForecastTile,
  AttentionQueue,
  PeriodSelector,
  type PeriodKey,
  RailNextActions,
  RailRiskFlags,
  RailRecordHealth,
  FilterChipBar,
  DensityToggle,
  CommandHints,
  WidgetShell,
  useUrlState,
  useArchetypeKeyboard,
  useFilterChips,
  useSelection,
  useSwr,
  type LoadState,
  type DriftPoint,
  type BulkAction,
} from "@/admin-archetypes";
import { useAllRecords } from "@/runtime/hooks";

const HINTS = [
  { keys: "R", label: "Refresh" },
  { keys: "/", label: "Search" },
];

interface InventoryKpis {
  onHandValue: { value: number; deltaPct: number; series: DriftPoint[] };
  available: { value: number };
  stockOuts: { value: number; reason: string };
  reorderDue: { value: number };
  slowMovers: { value: number };
  turns: { value: number; deltaPct: number };
}

function mockSeries(base: number, amp: number, n: number): DriftPoint[] {
  return Array.from({ length: n }, (_, i) => ({
    x: i,
    y: Math.round(base + Math.sin((i / n) * Math.PI * 2) * amp),
  }));
}

function mockKpis(): InventoryKpis {
  return {
    onHandValue: { value: 1_240_000, deltaPct: 3.2, series: mockSeries(1_200_000, 28_000, 14) },
    available: { value: 1_018_000 },
    stockOuts: { value: 7, reason: "SKU-481 movement -37% w/w" },
    reorderDue: { value: 24 },
    slowMovers: { value: 18 },
    turns: { value: 6.4, deltaPct: 0.8 },
  };
}

interface InventoryAttention {
  items: Array<{ id: string; icon?: string; severity?: "danger" | "warning" | "info"; title: string; description?: string }>;
}

function mockAttention(): InventoryAttention {
  return {
    items: [
      { id: "low", icon: "AlertTriangle", severity: "danger", title: "12 SKUs at or below safety stock", description: "Top: SKU-481, SKU-204" },
      { id: "expire", icon: "Clock", severity: "warning", title: "8 lots expire within 30 days", description: "Quarantine recommended" },
      { id: "dead", icon: "Archive", severity: "info", title: "18 dead-stock SKUs (>180d)", description: "$84k tied up" },
    ],
  };
}

interface InventoryItemRow {
  id: string;
  sku?: string;
  name?: string;
  onHand?: number;
  inventoryValue?: number;
  reorderPoint?: number;
  belowReorder?: boolean;
  active?: boolean;
}

export function InventoryArchetypeDashboard() {
  const [params, setParams] = useUrlState(["period"] as const);
  const period = (params.period as PeriodKey | undefined) ?? "30d";
  // Real backend reads via the resource client.
  const items = useAllRecords<InventoryItemRow>("inventory.item");
  const kpisData = React.useMemo<InventoryKpis>(() => {
    if (!items.data.length) return mockKpis();
    const onHandValue = items.data.reduce((s, i) => s + (i.inventoryValue ?? 0), 0);
    const available = items.data.reduce((s, i) => s + (i.onHand ?? 0), 0);
    const stockOuts = items.data.filter((i) => (i.onHand ?? 0) === 0 && i.active !== false).length;
    const reorderDue = items.data.filter((i) => i.belowReorder).length;
    const slowMovers = Math.max(0, items.data.length - reorderDue - stockOuts - 5);
    return {
      onHandValue: { value: onHandValue, deltaPct: 0, series: mockKpis().onHandValue.series },
      available: { value: available },
      stockOuts: {
        value: stockOuts,
        reason:
          stockOuts === 0
            ? "All SKUs in stock"
            : `${stockOuts} SKU${stockOuts === 1 ? "" : "s"} at zero inventory`,
      },
      reorderDue: { value: reorderDue },
      slowMovers: { value: slowMovers },
      turns: mockKpis().turns,
    };
  }, [items.data]);
  const kpisState: LoadState = items.error
    ? { status: "error", error: items.error }
    : items.loading && items.data.length === 0
      ? { status: "loading" }
      : { status: "ready" };
  const kpis = { data: kpisData, state: kpisState, refetch: items.refetch };
  const attentionData = React.useMemo<InventoryAttention>(() => {
    if (!items.data.length) return mockAttention();
    const out: InventoryAttention["items"] = [];
    const lowStock = items.data.filter((i) => i.belowReorder).slice(0, 12);
    if (lowStock.length > 0) {
      out.push({
        id: "low",
        icon: "AlertTriangle",
        severity: "danger",
        title: `${lowStock.length} SKU${lowStock.length === 1 ? "" : "s"} at or below reorder point`,
        description: lowStock
          .slice(0, 3)
          .map((i) => i.sku ?? i.id)
          .join(", "),
      });
    }
    const outs = items.data.filter((i) => (i.onHand ?? 0) === 0 && i.active !== false).slice(0, 8);
    if (outs.length > 0) {
      out.push({
        id: "out",
        icon: "Archive",
        severity: "warning",
        title: `${outs.length} SKU${outs.length === 1 ? "" : "s"} at zero stock`,
      });
    }
    if (out.length === 0) return mockAttention();
    return { items: out };
  }, [items.data]);
  const attention = { data: attentionData, state: kpisState, refetch: items.refetch };

  const refresh = React.useCallback(() => {
    void kpis.refetch();
    void attention.refetch();
  }, [kpis, attention]);

  useArchetypeKeyboard([{ label: "Refresh", combo: "r", run: refresh }]);

  const fmt = (n: number) =>
    new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(n);

  return (
    <IntelligentDashboard
      id="inventory.archetype-dashboard"
      title="Inventory"
      subtitle="Stock, demand, and reorder pulse."
      actions={
        <>
          <PeriodSelector value={period} onChange={(p) => setParams({ period: p })} />
          <Button variant="outline" size="sm" onClick={refresh}>
            <RefreshCw className="h-4 w-4 mr-1" aria-hidden /> Refresh
          </Button>
          <Button size="sm">
            <Plus className="h-4 w-4 mr-1" aria-hidden /> New SKU
          </Button>
        </>
      }
      kpis={
        <>
          <WidgetShell label="On-hand value" state={kpis.state} skeleton="kpi" onRetry={kpis.refetch}>
            <KpiTile label="On-hand value" value={fmt(kpis.data?.onHandValue.value ?? 0)} period={period}
              trend={{ deltaPct: kpis.data?.onHandValue.deltaPct, series: kpis.data?.onHandValue.series, positiveIsGood: true }}
              drillTo={{ kind: "hash", hash: "/inventory/items" }} />
          </WidgetShell>
          <WidgetShell label="Available" state={kpis.state} skeleton="kpi" onRetry={kpis.refetch}>
            <KpiTile label="Available" value={fmt(kpis.data?.available.value ?? 0)} period={period}
              drillTo={{ kind: "hash", hash: "/inventory/stock" }} />
          </WidgetShell>
          <WidgetShell label="Stock-outs" state={kpis.state} skeleton="kpi" onRetry={kpis.refetch}>
            <AnomalyTile label="Stock-outs (24h)" value={kpis.data?.stockOuts.value ?? 0}
              anomaly={{ score: 0.85, reason: kpis.data?.stockOuts.reason ?? "", since: new Date().toISOString() }}
              drillTo={{ kind: "hash", hash: "/inventory/items?filter=below_safety:eq:true" }} />
          </WidgetShell>
          <WidgetShell label="Reorder due" state={kpis.state} skeleton="kpi" onRetry={kpis.refetch}>
            <KpiTile label="Reorder due" value={kpis.data?.reorderDue.value ?? 0}
              drillTo={{ kind: "hash", hash: "/inventory/reorder" }} />
          </WidgetShell>
          <WidgetShell label="Slow movers" state={kpis.state} skeleton="kpi" onRetry={kpis.refetch}>
            <KpiTile label="Slow movers (90d)" value={kpis.data?.slowMovers.value ?? 0}
              drillTo={{ kind: "hash", hash: "/inventory/abc" }} />
          </WidgetShell>
          <WidgetShell label="Turns" state={kpis.state} skeleton="kpi" onRetry={kpis.refetch}>
            <KpiTile label="Inv. turns" value={`${kpis.data?.turns.value.toFixed(1) ?? 0}×`} period="annualised"
              trend={{ deltaPct: kpis.data?.turns.deltaPct, positiveIsGood: true }} />
          </WidgetShell>
        </>
      }
      main={
        <>
          <WidgetShell label="Attention" state={attention.state} skeleton="list" onRetry={attention.refetch}>
            <AttentionQueue items={attention.data?.items ?? []} title="Needs attention" />
          </WidgetShell>
          <CommandHints hints={HINTS} className="pt-1" />
        </>
      }
      rail={
        <>
          <RailRecordHealth score={{ score: 78, tier: "info", factors: [
            { label: "Coverage", weight: 20 },
            { label: "Forecast accuracy", weight: 15 },
            { label: "Stock-outs", weight: -12 },
            { label: "Dead stock", weight: -8 },
          ] }} />
          <RailNextActions actions={[
            { id: "reorder", label: "Run reorder for 24 SKUs", source: "rule", drillTo: { kind: "hash", hash: "/inventory/reorder" } },
            { id: "cycle", label: "Schedule cycle counts (3 zones)", source: "ai" },
          ]} />
          <RailRiskFlags flags={[
            { id: "exp", label: "8 lots expiring 30d", detail: "Quarantine recommended", severity: "warning" },
            { id: "ship", label: "2 transfers stuck >7d", detail: "Carrier delay", severity: "danger" },
          ]} />
        </>
      }
    />
  );
}

export const inventoryArchetypeDashboardView = defineCustomView({
  id: "inventory.archetype-dashboard.view",
  title: "Inventory overview (archetype)",
  description: "Reference Intelligent Dashboard for inventory.",
  resource: "inventory.item",
  archetype: "dashboard",
  density: "comfortable",
  render: () => <InventoryArchetypeDashboard />,
});

/* ------------ SKU Smart List (with bulk actions + filter chips) ----------- */

interface Sku {
  id: string;
  sku: string;
  name: string;
  category: string;
  uom: string;
  qty: number;
  available: number;
  reorderPt: number;
  avgCost: number;
  status: "active" | "phaseOut" | "eol";
}

const SAMPLE_SKUS: Sku[] = Array.from({ length: 80 }, (_, i) => ({
  id: `sku-${i}`,
  sku: `SKU-${String(100 + i).padStart(4, "0")}`,
  name: ["Widget", "Sprocket", "Hinge", "Bracket", "Housing", "Coupling"][i % 6] + ` MK${(i % 9) + 1}`,
  category: ["Electrical", "Mechanical", "Fasteners", "Packaging", "Raw"][i % 5],
  uom: ["each", "kg", "m"][i % 3],
  qty: ((i * 13) % 200) + 10,
  available: ((i * 11) % 180) + 5,
  reorderPt: 30 + (i % 50),
  avgCost: 2 + ((i * 7) % 80) / 4,
  status: i % 23 === 0 ? "eol" : i % 11 === 0 ? "phaseOut" : "active",
}));

const STATUS_TONE: Record<Sku["status"], "success" | "warning" | "neutral"> = {
  active: "success",
  phaseOut: "warning",
  eol: "neutral",
};

export function InventoryArchetypeList() {
  const [params, setParams] = useUrlState(["q"] as const);
  const q = params.q ?? "";
  const { chips, remove, clear, add } = useFilterChips();
  const selection = useSelection<string>();

  // Real backend read.
  const live = useAllRecords<InventoryItemRow & { category?: string; uom?: string; reorderPoint?: number; unitCost?: number; }>("inventory.item");

  const rows = React.useMemo<Sku[]>(() => {
    let result = live.data.map<Sku>((i) => ({
      id: i.id,
      sku: i.sku ?? i.id,
      name: i.name ?? i.sku ?? i.id,
      category: i.category ?? "Uncategorised",
      uom: i.uom ?? "each",
      qty: i.onHand ?? 0,
      available: i.onHand ?? 0,
      reorderPt: i.reorderPoint ?? 0,
      avgCost: i.unitCost ?? 0,
      status: i.active === false ? "phaseOut" : "active",
    }));
    if (result.length === 0) result = SAMPLE_SKUS;
    if (q) {
      const ql = q.toLowerCase();
      result = result.filter((r) =>
        r.sku.toLowerCase().includes(ql) ||
        r.name.toLowerCase().includes(ql) ||
        r.category.toLowerCase().includes(ql),
      );
    }
    for (const c of chips) {
      result = result.filter((r) => {
        const v = (r as unknown as Record<string, unknown>)[c.field];
        if (c.op === "eq") return String(v) === c.value;
        return true;
      });
    }
    return result;
  }, [live.data, q, chips]);

  const dataState: LoadState = live.error
    ? { status: "error", error: live.error }
    : live.loading && live.data.length === 0
      ? { status: "loading" }
      : { status: "ready" };
  const data = { state: dataState, refetch: live.refetch };

  useArchetypeKeyboard([
    { label: "Search", combo: "/", run: () => document.getElementById("inventory-search")?.focus() },
    { label: "Select all", combo: "cmd+a", run: () => {
      if (selection.size === rows.length) selection.clear();
      else selection.setAll(rows.map((r) => r.id));
    }},
    { label: "Clear", combo: "esc", run: () => selection.size > 0 && selection.clear() },
  ]);

  const bulkActions: BulkAction[] = [
    {
      id: "transfer",
      label: "Transfer",
      icon: <Package className="h-3.5 w-3.5 mr-1" aria-hidden />,
      onAction: () => {
        console.info("[inventory] Transfer", Array.from(selection.ids));
        selection.clear();
      },
    },
    {
      id: "export",
      label: "Export",
      icon: <Download className="h-3.5 w-3.5 mr-1" aria-hidden />,
      onAction: () => {
        const subset = rows.filter((r) => selection.has(r.id));
        const blob = new Blob([JSON.stringify(subset, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `inventory-skus-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
      },
    },
    {
      id: "deactivate",
      label: "Deactivate",
      variant: "danger",
      confirm: { title: `Deactivate ${selection.size} SKUs?`, description: "They will be hidden from active picks. You can restore them anytime." },
      onAction: () => {
        console.info("[inventory] Deactivate", Array.from(selection.ids));
        selection.clear();
      },
    },
  ];

  return (
    <SmartList
      id="inventory.items.list"
      title="Items"
      subtitle="Active and tracked SKUs"
      actions={
        <Button size="sm">
          <Plus className="h-4 w-4 mr-1" aria-hidden /> New SKU
        </Button>
      }
      toolbarStart={
        <FilterChipBar
          chips={chips}
          onRemove={remove}
          onClear={clear}
          onAdd={() => add({ field: "status", op: "eq", value: "active" })}
        />
      }
      toolbarEnd={
        <>
          <Input
            id="inventory-search"
            type="search"
            value={q}
            onChange={(e) => setParams({ q: e.target.value }, true)}
            placeholder="Search…"
            className="h-8 w-48"
          />
          <DensityToggle />
        </>
      }
      selected={selection.ids}
      bulkActions={bulkActions}
      onClearSelection={selection.clear}
      keyboardHints={
        <CommandHints hints={[
          { keys: "/", label: "Search" },
          { keys: "⌘A", label: "Select all" },
          { keys: "Esc", label: "Clear" },
        ]} />
      }
    >
      <WidgetShell label="Items" state={data.state} skeleton="table" onRetry={data.refetch}>
        <div className="rounded-lg border border-border overflow-hidden bg-surface-0">
          <table className="w-full text-sm">
            <thead className="bg-surface-1 text-xs text-text-muted uppercase tracking-wide">
              <tr>
                <th className="w-10 px-2 py-2">
                  <input
                    type="checkbox"
                    aria-label="Select all"
                    checked={rows.length > 0 && selection.size === rows.length}
                    onChange={(e) => e.target.checked ? selection.setAll(rows.map(r => r.id)) : selection.clear()}
                  />
                </th>
                <th className="px-2 py-2 text-left font-medium">SKU</th>
                <th className="px-2 py-2 text-left font-medium">Name</th>
                <th className="px-2 py-2 text-left font-medium">Category</th>
                <th className="px-2 py-2 text-right font-medium">Qty</th>
                <th className="px-2 py-2 text-right font-medium">Available</th>
                <th className="px-2 py-2 text-right font-medium">Reorder pt</th>
                <th className="px-2 py-2 text-right font-medium">Avg cost</th>
                <th className="px-2 py-2 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className="border-t border-border-subtle hover:bg-surface-1 cursor-pointer transition-colors duration-fast outline-none focus-visible:bg-surface-1 focus-visible:shadow-[inset_2px_0_0_rgb(var(--accent))]"
                  onClick={(e) => {
                    const tgt = e.target as HTMLElement;
                    if (tgt.closest('input,button,a')) return;
                    window.location.hash = `/inventory/items/${encodeURIComponent(r.id)}`;
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      window.location.hash = `/inventory/items/${encodeURIComponent(r.id)}`;
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  aria-label={`Open ${r.sku}`}
                >
                  <td className="px-2 py-2">
                    <input
                      type="checkbox"
                      aria-label={`Select ${r.sku}`}
                      checked={selection.has(r.id)}
                      onChange={() => selection.toggle(r.id)}
                    />
                  </td>
                  <td className="px-2 py-2 font-mono text-xs">{r.sku}</td>
                  <td className="px-2 py-2 text-text-primary">{r.name}</td>
                  <td className="px-2 py-2 text-text-muted">{r.category}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{r.qty}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{r.available}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-text-muted">{r.reorderPt}</td>
                  <td className="px-2 py-2 text-right tabular-nums">${r.avgCost.toFixed(2)}</td>
                  <td className="px-2 py-2"><Badge intent={STATUS_TONE[r.status]}>{r.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </WidgetShell>
    </SmartList>
  );
}

export const inventoryArchetypeListView = defineCustomView({
  id: "inventory.archetype-list.view",
  title: "Items (archetype)",
  description: "Reference Smart List with filter chips, bulk actions, density.",
  resource: "inventory.item",
  archetype: "smart-list",
  render: () => <InventoryArchetypeList />,
});

export const inventoryArchetypeNav = [
  {
    id: "inventory.archetype-dashboard",
    label: "Inventory (new)",
    icon: "Activity",
    path: "/inventory/archetype-dashboard",
    view: "inventory.archetype-dashboard.view",
    section: "supply-chain",
    order: 0.5,
  },
  {
    id: "inventory.archetype-list",
    label: "Items (new)",
    icon: "Package",
    path: "/inventory/archetype-list",
    view: "inventory.archetype-list.view",
    section: "supply-chain",
    order: 0.6,
  },
];
