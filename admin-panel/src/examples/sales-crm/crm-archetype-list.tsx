/** Reference SmartList page using `@/admin-archetypes`.
 *
 *  Demonstrates: SmartList archetype + filter chips (URL-backed) +
 *  selection (bulk action bar) + saved-view-style toolbar + keyboard
 *  shortcuts (J/K, Cmd+A, Esc) + density toggle. */

import * as React from "react";
import { Plus, Download, Mail, Trash2, Search, Filter } from "lucide-react";
import { Button } from "@/primitives/Button";
import { Input } from "@/primitives/Input";
import { Badge } from "@/primitives/Badge";
import {
  SmartList,
  FilterChipBar,
  DensityToggle,
  PeriodSelector,
  type PeriodKey,
  CommandHints,
  WidgetShell,
  useArchetypeKeyboard,
  useFilterChips,
  useSelection,
  useUrlState,
  useSwr,
  type BulkAction,
} from "@/admin-archetypes";
import { CONTACTS } from "./data";

interface Person {
  id: string;
  name: string;
  email: string;
  company: string;
  stage: string;
  owner: string;
  lifetimeValue: number;
  lastActivityAt: string;
}

const STAGE_TONE: Record<string, "success" | "info" | "warning" | "danger" | "neutral"> = {
  customer: "success",
  prospect: "info",
  lead: "warning",
  churned: "danger",
};

export default function CrmArchetypeList() {
  const [params, setParams] = useUrlState(["period", "q"] as const);
  const period = (params.period as PeriodKey | undefined) ?? "30d";
  const q = params.q ?? "";

  const { chips, add, remove, clear } = useFilterChips();
  const selection = useSelection<string>();

  const data = useSwr<Person[]>(
    `crm.people?q=${q}&filters=${chips.length}`,
    async () => {
      // No backend in dev — read from the seeded CONTACTS dataset.
      let rows = CONTACTS as unknown as Person[];
      if (q) {
        const ql = q.toLowerCase();
        rows = rows.filter(
          (r) =>
            r.name.toLowerCase().includes(ql) ||
            r.company.toLowerCase().includes(ql) ||
            r.email.toLowerCase().includes(ql),
        );
      }
      for (const c of chips) {
        rows = rows.filter((r) => {
          const v = (r as unknown as Record<string, unknown>)[c.field];
          if (c.op === "eq") return String(v) === c.value;
          if (c.op === "neq") return String(v) !== c.value;
          if (c.op === "contains") return String(v ?? "").toLowerCase().includes(c.value.toLowerCase());
          return true;
        });
      }
      return rows;
    },
    { ttlMs: 15_000 },
  );

  const rows = data.data ?? [];
  const totalSelected = selection.size;

  useArchetypeKeyboard([
    {
      label: "Search",
      combo: "/",
      run: () => document.getElementById("crm-list-search")?.focus(),
    },
    {
      label: "Select all visible",
      combo: "cmd+a",
      run: () => {
        if (selection.size === rows.length) selection.clear();
        else selection.setAll(rows.map((r) => r.id));
      },
    },
    {
      label: "Clear selection",
      combo: "esc",
      run: () => {
        if (selection.size > 0) selection.clear();
      },
    },
  ]);

  const bulkActions: BulkAction[] = [
    {
      id: "email",
      label: "Send email",
      icon: <Mail className="h-3.5 w-3.5 mr-1" aria-hidden />,
      onAction: () => {
        // Real impl: open compose; for the demo, log + clear.
        console.info("[crm.list] Bulk email", Array.from(selection.ids));
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
        a.download = `crm-people-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
      },
    },
    {
      id: "archive",
      label: "Archive",
      variant: "danger",
      icon: <Trash2 className="h-3.5 w-3.5 mr-1" aria-hidden />,
      confirm: {
        title: `Archive ${totalSelected} contacts?`,
        description: "They will be hidden from the active list. You can restore them anytime.",
      },
      onAction: () => {
        console.info("[crm.list] Archive", Array.from(selection.ids));
        selection.clear();
      },
    },
  ];

  return (
    <SmartList
      id="crm.people.list"
      title="People"
      subtitle="Active contacts and leads"
      actions={
        <>
          <PeriodSelector value={period} onChange={(p) => setParams({ period: p })} />
          <Button size="sm">
            <Plus className="h-4 w-4 mr-1" aria-hidden /> New person
          </Button>
        </>
      }
      toolbarStart={
        <>
          <FilterChipBar
            chips={chips}
            onRemove={remove}
            onClear={clear}
            onAdd={() => add({ field: "stage", op: "eq", value: "lead" })}
          />
        </>
      }
      toolbarEnd={
        <>
          <div className="relative">
            <Search
              className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-muted pointer-events-none"
              aria-hidden
            />
            <Input
              id="crm-list-search"
              type="search"
              value={q}
              onChange={(e) => setParams({ q: e.target.value }, true)}
              placeholder="Search…"
              className="pl-7 h-8 w-48"
            />
          </div>
          <DensityToggle />
        </>
      }
      selected={selection.ids}
      bulkActions={bulkActions}
      onClearSelection={selection.clear}
      keyboardHints={
        <CommandHints
          hints={[
            { keys: "/", label: "Search" },
            { keys: "⌘A", label: "Select all" },
            { keys: "Esc", label: "Clear" },
          ]}
        />
      }
    >
      <WidgetShell
        label="People"
        state={data.state}
        skeleton="table"
        onRetry={data.refetch}
        empty={{
          title: "No people match your filters",
          description: "Clear filters or add a new person.",
          icon: <Filter className="h-6 w-6" aria-hidden />,
          action: { label: "Clear filters", onAction: clear },
        }}
      >
        <div className="rounded-lg border border-border overflow-hidden bg-surface-0">
          <table className="w-full text-sm">
            <thead className="bg-surface-1 text-xs text-text-muted uppercase tracking-wide">
              <tr>
                <th className="w-10 px-2 py-2">
                  <input
                    type="checkbox"
                    aria-label="Select all"
                    checked={rows.length > 0 && selection.size === rows.length}
                    onChange={(e) => {
                      if (e.target.checked) selection.setAll(rows.map((r) => r.id));
                      else selection.clear();
                    }}
                  />
                </th>
                <th className="px-2 py-2 text-left font-medium">Name</th>
                <th className="px-2 py-2 text-left font-medium">Company</th>
                <th className="px-2 py-2 text-left font-medium">Stage</th>
                <th className="px-2 py-2 text-left font-medium">Owner</th>
                <th className="px-2 py-2 text-right font-medium">LTV</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className="border-t border-border-subtle hover:bg-surface-1"
                  data-selected={selection.has(r.id) ? "true" : "false"}
                >
                  <td className="px-2 py-2">
                    <input
                      type="checkbox"
                      aria-label={`Select ${r.name}`}
                      checked={selection.has(r.id)}
                      onChange={() => selection.toggle(r.id)}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <div className="font-medium text-text-primary">{r.name}</div>
                    <div className="text-xs text-text-muted">{r.email}</div>
                  </td>
                  <td className="px-2 py-2 text-text-primary">{r.company}</td>
                  <td className="px-2 py-2">
                    <Badge intent={STAGE_TONE[r.stage] ?? "neutral"}>{r.stage}</Badge>
                  </td>
                  <td className="px-2 py-2 text-text-muted">{r.owner}</td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    {new Intl.NumberFormat(undefined, {
                      style: "currency",
                      currency: "USD",
                      maximumFractionDigits: 0,
                    }).format(r.lifetimeValue)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </WidgetShell>
    </SmartList>
  );
}
