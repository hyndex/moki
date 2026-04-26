/** Archetypes Catalog — author-facing reference page.
 *
 *  One page that shows every archetype + every widget rendered with
 *  realistic data so plugin authors have a "click to copy" reference
 *  without having to dig through plugin folders. Every entry links to
 *  the corresponding source file under examples/ and to the matching
 *  page-design brief in docs/page-design/. */

import * as React from "react";
import { defineCustomView } from "@/builders";
import * as Lucide from "lucide-react";
import {
  Page,
  PageHeaderSlot,
  HeroStrip,
  BodyLayout,
  MainCanvas,
  Rail,
  KpiTile,
  KpiRing,
  AnomalyTile,
  ForecastTile,
  Sparkline,
  AttentionQueue,
  RailEntityCard,
  RailNextActions,
  RailRiskFlags,
  RailRecordHealth,
  RailRelatedEntities,
  PeriodSelector,
  type PeriodKey,
  DensityToggle,
  CommandHints,
  FilterChipBar,
  BulkActionBar,
  type BulkAction,
  WidgetShell,
  ArchetypeEmptyState,
  OfflineChip,
  useUrlState,
  useFilterChips,
  useSelection,
  type DriftPoint,
} from "@/admin-archetypes";
import { Button } from "@/primitives/Button";
import { cn } from "@/lib/cn";

const ARCHETYPES: ReadonlyArray<{
  id: string;
  label: string;
  description: string;
  hash: string;
  source: string;
}> = [
  {
    id: "dashboard",
    label: "Intelligent Dashboard",
    description: "The control tower — KPIs, attention queue, charts, rail.",
    hash: "/crm/archetype-dashboard",
    source: "examples/sales-crm/crm-archetype-dashboard.tsx",
  },
  {
    id: "workspace-hub",
    label: "Workspace Hub",
    description: "Entity 360 — header + tabs + KPIs + main + rich rail.",
    hash: "/crm/archetype-company-hub",
    source: "examples/sales-crm/crm-archetype-company-hub.tsx",
  },
  {
    id: "smart-list",
    label: "Smart List",
    description: "Browse / filter / group / save / bulk-act.",
    hash: "/crm/archetype-list",
    source: "examples/sales-crm/crm-archetype-list.tsx",
  },
  {
    id: "kanban",
    label: "Kanban / Pipeline",
    description: "Stage-driven flow with aging and totals.",
    hash: "/sales/archetype-pipeline",
    source: "examples/sales-archetype.tsx",
  },
  {
    id: "calendar",
    label: "Calendar / Schedule",
    description: "Time-bound resources with capacity heatmap.",
    hash: "/maintenance/archetype-calendar",
    source: "examples/maintenance-archetype.tsx",
  },
  {
    id: "tree",
    label: "Tree Explorer",
    description: "Hierarchical drilldown (BOM, COA, org chart).",
    hash: "/manufacturing/archetype-bom",
    source: "examples/manufacturing-archetype.tsx",
  },
  {
    id: "graph",
    label: "Graph / Network",
    description: "Topology of relations between entities.",
    hash: "/crm/archetype-relations",
    source: "examples/sales-crm/crm-archetype-relations.tsx",
  },
  {
    id: "split-inbox",
    label: "Split Inbox",
    description: "Triage queue + preview + actions.",
    hash: "/inbox/archetype",
    source: "examples/notifications-archetype.tsx",
  },
  {
    id: "timeline",
    label: "Timeline / Log",
    description: "Time-ordered events with chain verification.",
    hash: "/audit/archetype-timeline",
    source: "examples/audit-archetype.tsx",
  },
  {
    id: "map",
    label: "Map / Geo",
    description: "Geographic dispatch and clustering.",
    hash: "/field-service/archetype-map",
    source: "examples/field-service-archetype.tsx",
  },
  {
    id: "editor-canvas",
    label: "Editor Canvas",
    description: "Full-bleed creation surface (chat, doc, slides).",
    hash: "/ai/archetype-chat",
    source: "examples/ai-assist-chat-archetype.tsx",
  },
  {
    id: "detail-rich",
    label: "Detail-Rich Page",
    description: "Wraps the existing RichDetailPage primitive.",
    hash: "#/contacts/p-ada",
    source: "admin-archetypes/archetypes/DetailRichArchetype.tsx",
  },
];

const WIDGET_GROUPS: ReadonlyArray<{
  group: string;
  widgets: { name: string; demo: React.ReactNode }[];
}> = [
  {
    group: "Hero (S2)",
    widgets: [
      { name: "KpiTile", demo: <KpiTileDemo /> },
      { name: "KpiTile (drill)", demo: <KpiTileDrillDemo /> },
      { name: "KpiRing", demo: <KpiRingDemo /> },
      { name: "AnomalyTile", demo: <AnomalyTileDemo /> },
      { name: "ForecastTile", demo: <ForecastTileDemo /> },
    ],
  },
  {
    group: "Rail (S4 + S6)",
    widgets: [
      { name: "RailEntityCard", demo: <RailEntityCardDemo /> },
      { name: "RailRecordHealth", demo: <RailRecordHealthDemo /> },
      { name: "RailRelatedEntities", demo: <RailRelatedEntitiesDemo /> },
      { name: "RailNextActions", demo: <RailNextActionsDemo /> },
      { name: "RailRiskFlags", demo: <RailRiskFlagsDemo /> },
    ],
  },
  {
    group: "Toolbar (S3)",
    widgets: [
      { name: "PeriodSelector", demo: <PeriodSelectorDemo /> },
      { name: "DensityToggle", demo: <DensityToggle /> },
      { name: "FilterChipBar", demo: <FilterChipBarDemo /> },
      { name: "CommandHints", demo: <CommandHintsDemo /> },
      { name: "OfflineChip", demo: <OfflineChip offline={true} queuedWrites={2} /> },
    ],
  },
  {
    group: "Action bar (S7)",
    widgets: [
      { name: "BulkActionBar", demo: <BulkActionBarDemo /> },
    ],
  },
  {
    group: "Surfaces",
    widgets: [
      { name: "AttentionQueue", demo: <AttentionQueueDemo /> },
      { name: "WidgetShell · loading", demo: <WidgetShell label="Loading" state={{ status: "loading" }} skeleton="kpi"><div /></WidgetShell> },
      { name: "WidgetShell · error", demo: <WidgetShell label="Error" state={{ status: "error", error: new Error("Network unreachable") }} onRetry={() => {}}><div /></WidgetShell> },
      { name: "WidgetShell · empty", demo: <WidgetShell label="Empty" state={{ status: "empty" }} empty={{ title: "Nothing yet", description: "Add your first record." }}><div /></WidgetShell> },
      {
        name: "ArchetypeEmptyState",
        demo: (
          <ArchetypeEmptyState
            title="No invoices yet"
            description="Create one or import a CSV."
            action={{ label: "Create", onAction: () => {} }}
          />
        ),
      },
    ],
  },
  {
    group: "Charts",
    widgets: [
      { name: "Sparkline", demo: <SparklineDemo /> },
    ],
  },
];

export function ArchetypesCatalogPage() {
  const [params, setParams] = useUrlState(["section"] as const);
  const section = (params.section as "archetypes" | "widgets" | "live") ?? "archetypes";

  return (
    <Page archetype="dashboard" id="admin.archetypes-catalog" density="comfortable">
      <PageHeaderSlot
        title="Archetypes catalog"
        subtitle="Plugin authors: copy any archetype or widget shown below into your plugin. All paths are clickable to a working live page."
        actions={
          <Button
            size="sm"
            variant="outline"
            onClick={() => window.open("https://github.com/gutula/gutu-docs/blob/main/docs/PAGE-DESIGN-SYSTEM.md", "_blank")}
          >
            <Lucide.ExternalLink className="h-4 w-4 mr-1" aria-hidden /> Design system
          </Button>
        }
        tabs={
          <nav role="tablist" className="flex items-center gap-1 text-sm">
            {(["archetypes", "widgets", "live"] as const).map((id) => (
              <button
                key={id}
                role="tab"
                aria-selected={section === id}
                onClick={() => setParams({ section: id }, true)}
                className={
                  "px-2.5 py-1 rounded-md " +
                  (section === id
                    ? "bg-info-soft/40 text-text-primary"
                    : "text-text-muted hover:text-text-primary hover:bg-surface-1")
                }
              >
                {id === "archetypes" ? "Archetypes" : id === "widgets" ? "Widgets" : "Live preview"}
              </button>
            ))}
          </nav>
        }
      />

      {section === "archetypes" && <ArchetypesGrid />}
      {section === "widgets" && <WidgetsGrid />}
      {section === "live" && <LivePreview />}
    </Page>
  );
}

function ArchetypesGrid() {
  return (
    <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
      {ARCHETYPES.map((a) => (
        <article
          key={a.id}
          className="rounded-lg border border-border bg-surface-0 p-4 flex flex-col gap-2"
        >
          <header className="flex items-start justify-between gap-2">
            <h3 className="text-base font-semibold text-text-primary">{a.label}</h3>
            <code className="text-[10px] text-text-muted font-mono px-1.5 py-0.5 rounded bg-surface-2">
              {a.id}
            </code>
          </header>
          <p className="text-sm text-text-muted flex-1">{a.description}</p>
          <div className="flex items-center gap-2 mt-2">
            <Button
              size="sm"
              onClick={() => {
                window.location.hash = a.hash;
              }}
            >
              <Lucide.ExternalLink className="h-3.5 w-3.5 mr-1" aria-hidden /> Open
            </Button>
            <code className="text-[11px] text-text-muted font-mono truncate" title={a.source}>
              {a.source}
            </code>
          </div>
        </article>
      ))}
    </div>
  );
}

function WidgetsGrid() {
  return (
    <div className="flex flex-col gap-6">
      {WIDGET_GROUPS.map((g) => (
        <section key={g.group}>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-text-muted mb-2">
            {g.group}
          </h2>
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {g.widgets.map((w) => (
              <article
                key={w.name}
                className="rounded-lg border border-border bg-surface-1/30 p-3 flex flex-col gap-2"
              >
                <header className="flex items-center justify-between">
                  <span className="text-sm font-medium text-text-primary">{w.name}</span>
                </header>
                <div className="bg-surface-canvas rounded-md p-2">{w.demo}</div>
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function LivePreview() {
  return (
    <BodyLayout
      main={
        <MainCanvas>
          <HeroStrip>
            <KpiTileDemo />
            <KpiRingDemo />
            <AnomalyTileDemo />
            <ForecastTileDemo />
          </HeroStrip>
          <AttentionQueueDemo />
          <BulkActionBarDemo />
        </MainCanvas>
      }
      rail={
        <Rail>
          <RailEntityCardDemo />
          <RailRecordHealthDemo />
          <RailNextActionsDemo />
          <RailRiskFlagsDemo />
        </Rail>
      }
    />
  );
}

/* ---------- Demo cells ----------------------------------------------------- */

function mockSeries(base: number, amp: number, n: number): DriftPoint[] {
  return Array.from({ length: n }, (_, i) => ({
    x: i,
    y: Math.round(base + Math.sin((i / n) * Math.PI * 2) * amp),
  }));
}

function KpiTileDemo() {
  return (
    <KpiTile
      label="Revenue"
      value="$84,210"
      period="30d"
      trend={{ deltaPct: 8.4, series: mockSeries(800, 80, 14), positiveIsGood: true }}
    />
  );
}

function KpiTileDrillDemo() {
  return (
    <KpiTile
      label="Open invoices"
      value="42"
      period="now"
      trend={{ deltaPct: -3.2, positiveIsGood: false }}
      drillTo={{ kind: "hash", hash: "/accounting/ar" }}
    />
  );
}

function KpiRingDemo() {
  return (
    <KpiRing label="Win rate" current={0.34} target={0.4} format={(n) => `${(n * 100).toFixed(0)}%`} />
  );
}

function AnomalyTileDemo() {
  return (
    <AnomalyTile
      label="Stalled deals"
      value={7}
      anomaly={{ score: 0.78, reason: "Avg dwell 18d in Negotiate stage", since: new Date().toISOString() }}
    />
  );
}

function ForecastTileDemo() {
  return (
    <ForecastTile
      label="Forecast"
      current="$92,000"
      forecast={{ p10: 70_000, p50: 92_000, p90: 124_000, horizon: "30d" }}
      format={(n) => `$${(n / 1000).toFixed(0)}k`}
    />
  );
}

function RailEntityCardDemo() {
  return (
    <RailEntityCard
      title="Acme Corp"
      subtitle="Enterprise · since 2024"
      initials="AC"
      status={{ label: "enterprise", tone: "success" }}
      facts={[
        { label: "Owner", value: "Maya R." },
        { label: "Renewal", value: "2026-09-30" },
        { label: "Plan", value: "Enterprise" },
        { label: "ARR", value: "$84,000" },
      ]}
    />
  );
}

function RailRecordHealthDemo() {
  return (
    <RailRecordHealth
      score={{
        score: 84,
        tier: "success",
        factors: [
          { label: "Velocity", weight: 22 },
          { label: "Coverage", weight: 18 },
          { label: "Forecast confidence", weight: 14 },
          { label: "Stalled deals", weight: -10 },
        ],
      }}
    />
  );
}

function RailRelatedEntitiesDemo() {
  return (
    <RailRelatedEntities
      groups={[
        { label: "Contacts", count: 8, summary: 8, icon: "Users" },
        { label: "Open deals", count: 3, summary: "$120,000", icon: "Target" },
        { label: "Tickets", count: 2, summary: "2 open", icon: "MessageSquare", severity: "warning" },
        { label: "Contracts", count: 6, summary: 6, icon: "FileText" },
      ]}
    />
  );
}

function RailNextActionsDemo() {
  return (
    <RailNextActions
      actions={[
        { id: "send-q3", label: "Send Q3 review pack", source: "ai", rationale: "Renewal in 5 months" },
        { id: "qbr", label: "Schedule QBR with Maya", source: "rule" },
      ]}
    />
  );
}

function RailRiskFlagsDemo() {
  return (
    <RailRiskFlags
      flags={[
        { id: "outreach", label: "Outreach drop on Tuesdays", detail: "Calls down 18% w/w", severity: "warning" },
        { id: "silent", label: "Acme silent 11d", detail: "Was high-engagement", severity: "danger" },
      ]}
    />
  );
}

function PeriodSelectorDemo() {
  const [period, setPeriod] = React.useState<PeriodKey>("30d");
  return <PeriodSelector value={period} onChange={setPeriod} withCompare />;
}

function CommandHintsDemo() {
  return (
    <CommandHints
      hints={[
        { keys: "⌘K", label: "Palette" },
        { keys: "/", label: "Search" },
        { keys: "?", label: "Help" },
      ]}
    />
  );
}

function FilterChipBarDemo() {
  const { chips, add, remove, clear } = useFilterChips();
  return (
    <FilterChipBar
      chips={chips}
      onRemove={remove}
      onClear={clear}
      onAdd={() => add({ field: "status", op: "eq", value: "open" })}
    />
  );
}

function BulkActionBarDemo() {
  const sel = useSelection<string>();
  const [seeded, setSeeded] = React.useState(false);
  React.useEffect(() => {
    if (!seeded) {
      sel.setAll(["a", "b", "c"]);
      setSeeded(true);
    }
  }, [seeded, sel]);
  const actions: BulkAction[] = [
    { id: "send", label: "Send email", onAction: () => alert("Send (mock)") },
    {
      id: "archive",
      label: "Archive",
      variant: "danger",
      confirm: { title: "Archive 3 records?", description: "You can restore them later." },
      onAction: () => alert("Archive (mock)"),
    },
  ];
  return (
    <BulkActionBar
      selectedCount={sel.size}
      onClear={sel.clear}
      actions={actions}
    />
  );
}

function AttentionQueueDemo() {
  return (
    <AttentionQueue
      title="Attention"
      items={[
        { id: "a", icon: "AlertTriangle", severity: "warning", title: "3 stalled deals over 14 days" },
        { id: "b", icon: "Clock", severity: "danger", title: "8 invoices overdue 7+ days" },
        { id: "c", icon: "Flame", severity: "info", title: "Hot lead: Acme Corp" },
      ]}
    />
  );
}

function SparklineDemo() {
  return (
    <div className="flex items-center gap-3 text-text-muted">
      <Sparkline data={mockSeries(50, 8, 14)} description="Trend last 14 days" />
      <Sparkline data={mockSeries(50, 8, 14)} stroke="#10B981" fill="#10B981" />
      <Sparkline data={mockSeries(50, 8, 14)} stroke="#EF4444" />
    </div>
  );
}

/* ---------- View registration --------------------------------------------- */

export const archetypesCatalogView = defineCustomView({
  id: "admin-tools.archetypes-catalog.view",
  title: "Archetypes catalog",
  description: "Live catalog of every archetype + widget for plugin authors.",
  resource: "platform.archetypes-catalog",
  archetype: "dashboard",
  density: "comfortable",
  render: () => <ArchetypesCatalogPage />,
});

/** Re-export so the wiring file's lint stays clean if cn becomes unused. */
export { cn };
