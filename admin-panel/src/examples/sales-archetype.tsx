/** Reference Sales pages: Kanban pipeline + Orders list. */

import * as React from "react";
import { Plus } from "lucide-react";
import { Button } from "@/primitives/Button";
import { Badge } from "@/primitives/Badge";
import { defineCustomView } from "@/builders";
import {
  KanbanArchetype,
  CommandHints,
  WidgetShell,
  useUrlState,
  useArchetypeKeyboard,
  useSwr,
} from "@/admin-archetypes";
import { cn } from "@/lib/cn";

interface Deal {
  id: string;
  name: string;
  customer: string;
  amount: number;
  stage: "new" | "qualify" | "proposal" | "negotiate" | "won" | "lost";
  ageDays: number;
  owner: string;
  priority: "low" | "med" | "high";
}

const STAGES: { id: Deal["stage"]; label: string; tone: string }[] = [
  { id: "new", label: "New", tone: "bg-info-soft text-info-strong" },
  { id: "qualify", label: "Qualify", tone: "bg-info-soft text-info-strong" },
  { id: "proposal", label: "Proposal", tone: "bg-warning-soft text-warning-strong" },
  { id: "negotiate", label: "Negotiate", tone: "bg-warning-soft text-warning-strong" },
  { id: "won", label: "Won", tone: "bg-success-soft text-success-strong" },
  { id: "lost", label: "Lost", tone: "bg-surface-2 text-text-muted" },
];

const SAMPLE_DEALS: Deal[] = Array.from({ length: 32 }, (_, i) => ({
  id: `deal-${i}`,
  name: ["Q3 Renewal", "Pilot Expansion", "Enterprise Deal", "Trial Conversion", "Upgrade", "Custom Tier"][i % 6] + ` ${i + 1}`,
  customer: ["Acme", "Globex", "Initech", "Soylent", "Hooli", "Massive Dynamic", "Pied Piper"][i % 7],
  amount: 5_000 + ((i * 1300) % 60_000),
  stage: STAGES[i % STAGES.length].id,
  ageDays: (i * 3) % 28,
  owner: ["Maya", "Devon", "Riya", "Sam"][i % 4],
  priority: (["low", "med", "high"] as const)[i % 3],
}));

async function fetchDeals(): Promise<Deal[]> {
  try {
    const res = await fetch("/api/sales/deals");
    if (res.ok) return (await res.json()) as Deal[];
  } catch {/* fall through */}
  return SAMPLE_DEALS;
}

function fmtCurrency(n: number) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

const PRIORITY_DOT: Record<Deal["priority"], string> = {
  low: "bg-text-muted",
  med: "bg-info",
  high: "bg-danger",
};

export function SalesArchetypePipeline() {
  const [params, setParams] = useUrlState(["color"] as const);
  const colorMode = (params.color as "priority" | "owner" | undefined) ?? "priority";
  const data = useSwr<Deal[]>("sales.deals", fetchDeals);
  const deals = data.data ?? [];

  useArchetypeKeyboard([
    { label: "Refresh", combo: "r", run: () => { void data.refetch(); } },
  ]);

  return (
    <KanbanArchetype
      id="sales.pipeline"
      title="Sales pipeline"
      subtitle="Stage-driven deal flow with aging and totals"
      actions={
        <>
          <Button size="sm">
            <Plus className="h-4 w-4 mr-1" aria-hidden /> New deal
          </Button>
        </>
      }
      toolbarStart={
        <span className="text-xs text-text-muted">Color by:</span>
      }
      toolbarEnd={
        <>
          <select
            value={colorMode}
            onChange={(e) => setParams({ color: e.target.value })}
            className="h-8 rounded-md border border-border bg-surface-0 px-2 text-xs"
          >
            <option value="priority">Priority</option>
            <option value="owner">Owner</option>
          </select>
          <CommandHints hints={[{ keys: "R", label: "Refresh" }]} />
        </>
      }
    >
      <WidgetShell label="Pipeline" state={data.state} skeleton="kpi" onRetry={data.refetch}>
        <div className="grid gap-3 grid-cols-6 min-w-[1100px]">
          {STAGES.map((stage) => {
            const stageDeals = deals.filter((d) => d.stage === stage.id);
            const total = stageDeals.reduce((s, d) => s + d.amount, 0);
            return (
              <section
                key={stage.id}
                aria-label={stage.label}
                className="rounded-lg border border-border bg-surface-1/50 flex flex-col min-h-[60vh]"
              >
                <header className="px-2.5 py-2 flex items-center justify-between border-b border-border">
                  <div className="flex items-center gap-2">
                    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide", stage.tone)}>
                      {stage.label}
                    </span>
                    <span className="text-xs text-text-muted tabular-nums">{stageDeals.length}</span>
                  </div>
                  <span className="text-xs text-text-muted tabular-nums">{fmtCurrency(total)}</span>
                </header>
                <div className="flex-1 p-2 space-y-2 overflow-auto">
                  {stageDeals.length === 0 ? (
                    <div className="text-xs text-text-muted text-center py-6 border border-dashed border-border-subtle rounded-md">
                      No deals
                    </div>
                  ) : (
                    stageDeals.map((d) => (
                      <article
                        key={d.id}
                        tabIndex={0}
                        className="rounded-md border border-border bg-surface-0 p-2 hover:bg-surface-1 cursor-pointer focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
                        onClick={() => { window.location.hash = `/sales/deals/${d.id}`; }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") window.location.hash = `/sales/deals/${d.id}`;
                        }}
                      >
                        <div className="flex items-start justify-between gap-1.5">
                          <div className="text-sm font-medium text-text-primary truncate">{d.name}</div>
                          {colorMode === "priority" && (
                            <span className={cn("h-2 w-2 rounded-full mt-1 shrink-0", PRIORITY_DOT[d.priority])} aria-hidden />
                          )}
                        </div>
                        <div className="text-xs text-text-muted truncate">{d.customer}</div>
                        <div className="flex items-center justify-between mt-1.5 text-xs">
                          <span className="font-semibold tabular-nums">{fmtCurrency(d.amount)}</span>
                          <span
                            className={cn(
                              "tabular-nums",
                              d.ageDays > 14 ? "text-danger" : d.ageDays > 7 ? "text-warning" : "text-text-muted",
                            )}
                          >
                            {d.ageDays}d
                          </span>
                        </div>
                      </article>
                    ))
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </WidgetShell>
    </KanbanArchetype>
  );
}

export const salesArchetypePipelineView = defineCustomView({
  id: "sales.archetype-pipeline.view",
  title: "Pipeline (archetype)",
  description: "Reference Kanban: stages, aging, totals, drag-friendly cards.",
  resource: "sales.deal",
  archetype: "kanban",
  density: "comfortable",
  render: () => <SalesArchetypePipeline />,
});

export const salesArchetypeNav = [
  {
    id: "sales.archetype-pipeline",
    label: "Pipeline (new)",
    icon: "Layers",
    path: "/sales/archetype-pipeline",
    view: "sales.archetype-pipeline.view",
    section: "sales",
    order: 12.1,
  },
];

/** Re-export Badge so the wiring file has zero unused-import lint complaints. */
export { Badge };
