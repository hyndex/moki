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
  type BulkAction,
  type LoadState,
  SavedViewSwitcher,
  type SavedView,
  KeyboardHelpOverlay,
  useKeyboardHelp,
} from "@/admin-archetypes";
import { useAllRecords } from "@/runtime/hooks";
import { useRuntime } from "@/runtime/context";

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
  const [helpOpen, setHelpOpen] = useKeyboardHelp();
  const [savedViews, setSavedViews] = React.useState<SavedView[]>(() => [
    { id: "all", label: "All", pinned: true, description: "Every contact." },
    { id: "vip", label: "VIPs", pinned: true, description: "High-LTV customers." },
    { id: "no-touch", label: "No-touch >30d", description: "Stale relationships." },
    { id: "new", label: "New (7d)", description: "Recently added." },
  ]);

  // Real backend read via the framework's resource client. Auto-
  // refetches on `realtime:resource-changed` events.
  const { data: live, loading, error, refetch } = useAllRecords<Person>("crm.contact");
  const runtime = useRuntime();

  const rows = React.useMemo(() => {
    let result = live;
    if (q) {
      const ql = q.toLowerCase();
      result = result.filter(
        (r) =>
          r.name.toLowerCase().includes(ql) ||
          r.company.toLowerCase().includes(ql) ||
          r.email.toLowerCase().includes(ql),
      );
    }
    for (const c of chips) {
      result = result.filter((r) => {
        const v = (r as unknown as Record<string, unknown>)[c.field];
        if (c.op === "eq") return String(v) === c.value;
        if (c.op === "neq") return String(v) !== c.value;
        if (c.op === "contains")
          return String(v ?? "").toLowerCase().includes(c.value.toLowerCase());
        return true;
      });
    }
    return result;
  }, [live, q, chips]);

  const dataState = React.useMemo<LoadState>(
    () =>
      error
        ? { status: "error", error }
        : loading
          ? { status: "loading" }
          : { status: "ready" },
    [error, loading],
  );
  const totalSelected = selection.size;

  const bindings = useArchetypeKeyboard([
    {
      label: "Search",
      combo: "/",
      group: "Navigation",
      run: () => document.getElementById("crm-list-search")?.focus(),
    },
    {
      label: "Select all visible",
      combo: "cmd+a",
      group: "Selection",
      run: () => {
        if (selection.size === rows.length) selection.clear();
        else selection.setAll(rows.map((r) => r.id));
      },
    },
    {
      label: "Clear selection",
      combo: "esc",
      group: "Selection",
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
        description: "They will be removed from the active list.",
      },
      toast: (n) => ({ success: `Archived ${n} contact${n === 1 ? "" : "s"}`, error: "Archive failed" }),
      onAction: async () => {
        const ids = Array.from(selection.ids);
        // Use the framework's action runtime — real DELETE through
        // the resource client; cache + realtime sub auto-refresh.
        await Promise.all(ids.map((id) => runtime.actions.delete("crm.contact", id)));
        selection.clear();
        refetch();
      },
    },
  ];

  return (
    <>
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
          <SavedViewSwitcher
            views={savedViews}
            onCreate={(label) =>
              setSavedViews((prev) => [
                ...prev,
                { id: label.toLowerCase().replace(/\s+/g, "-"), label },
              ])
            }
            onTogglePin={(id) =>
              setSavedViews((prev) =>
                prev.map((v) => (v.id === id ? { ...v, pinned: !v.pinned } : v)),
              )
            }
            onDelete={(id) =>
              setSavedViews((prev) => prev.filter((v) => v.id !== id))
            }
          />
          <span className="h-4 w-px bg-border" aria-hidden />
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
            { keys: "?", label: "Help" },
          ]}
        />
      }
    >
      <WidgetShell
        label="People"
        state={dataState}
        skeleton="table"
        onRetry={refetch}
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
                  className="border-t border-border-subtle hover:bg-surface-1 cursor-pointer transition-colors duration-fast outline-none focus-visible:bg-surface-1 focus-visible:shadow-[inset_2px_0_0_rgb(var(--accent))]"
                  data-selected={selection.has(r.id) ? "true" : "false"}
                  onClick={(e) => {
                    // Don't drill in when the click landed on an interactive
                    // element inside the row (checkbox, link, button). We
                    // explicitly exclude the row itself even though it has
                    // role="button" — `closest()` matches the row first
                    // and would always early-return otherwise.
                    const tgt = e.target as HTMLElement;
                    if (tgt.closest('input,button,a')) return;
                    window.location.hash = `/crm/archetype-person-hub?id=${encodeURIComponent(r.id)}`;
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      window.location.hash = `/crm/archetype-person-hub?id=${encodeURIComponent(r.id)}`;
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  aria-label={`Open ${r.name}`}
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
    <KeyboardHelpOverlay
      open={helpOpen}
      onClose={() => setHelpOpen(false)}
      bindings={bindings}
    />
    </>
  );
}
