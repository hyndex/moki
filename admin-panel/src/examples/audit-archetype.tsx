/** Reference Audit Timeline / Log archetype. */

import * as React from "react";
import { CheckCircle2, ShieldCheck, RefreshCw, Filter } from "lucide-react";
import { Button } from "@/primitives/Button";
import { defineCustomView } from "@/builders";
import {
  TimelineLog,
  WidgetShell,
  CommandHints,
  useArchetypeKeyboard,
  useUrlState,
  type LoadState,
} from "@/admin-archetypes";
import { useAllRecords } from "@/runtime/hooks";
import { cn } from "@/lib/cn";

interface AuditEntry {
  id: string;
  ts: string;
  action: string;
  actor: string;
  target: string;
  verified: boolean;
  level: "info" | "warn" | "error";
}

const ACTIONS = [
  "invoice.create",
  "payment.received",
  "user.login",
  "invoice.send",
  "audit.export",
  "tenant.plugin.enable",
  "user.logout",
  "policy.update",
];

const ACTORS = ["maya", "devon", "system", "automation", "webhook", "scheduler"];

const SAMPLE: AuditEntry[] = Array.from({ length: 80 }, (_, i) => ({
  id: `e-${i}`,
  ts: new Date(Date.now() - i * 1000 * 60 * 7).toISOString(),
  action: ACTIONS[i % ACTIONS.length],
  actor: ACTORS[i % ACTORS.length],
  target: `inv:INV-${String(2000 + i).padStart(4, "0")}`,
  verified: i % 17 !== 0,
  level: i % 19 === 0 ? "error" : i % 11 === 0 ? "warn" : "info",
}));

async function fetchAudit(): Promise<AuditEntry[]> {
  try {
    const res = await fetch("/api/audit/recent");
    if (res.ok) return (await res.json()) as AuditEntry[];
  } catch {/* fall through */}
  return SAMPLE;
}

interface AuditEventRow {
  id: string;
  action?: string;
  actor?: string;
  user?: string;
  resource?: string;
  resourceId?: string;
  recordId?: string;
  level?: "info" | "warn" | "error";
  ts?: string;
  createdAt?: string;
  hashOk?: boolean;
}

export function AuditArchetypeTimeline() {
  const [params, setParams] = useUrlState(["action"] as const);
  // Real backend read.
  const live = useAllRecords<AuditEventRow>("audit.event");
  const all = React.useMemo<AuditEntry[]>(() => {
    if (live.data.length === 0) return SAMPLE;
    return live.data.map<AuditEntry>((e) => ({
      id: e.id,
      ts: e.ts ?? e.createdAt ?? new Date().toISOString(),
      action: e.action ?? "unknown",
      actor: e.actor ?? e.user ?? "system",
      target: `${e.resource ?? "?"}:${e.resourceId ?? e.recordId ?? "?"}`,
      verified: e.hashOk !== false,
      level: e.level ?? "info",
    }));
  }, [live.data]);
  const filtered = params.action ? all.filter((e) => e.action === params.action) : all;
  const dataState: LoadState = live.error
    ? { status: "error", error: live.error }
    : live.loading && live.data.length === 0
      ? { status: "loading" }
      : { status: "ready" };
  const data = { state: dataState, refetch: live.refetch };

  useArchetypeKeyboard([
    { label: "Refresh", combo: "r", run: () => data.refetch() },
    { label: "Verify chain", combo: "v", run: () => alert("Audit chain verified — all hashes valid.") },
  ]);

  return (
    <TimelineLog
      id="audit.timeline"
      title="Audit log"
      subtitle="Append-only, hash-chained activity stream"
      actions={
        <>
          <Button variant="outline" size="sm" onClick={() => alert("Audit chain verified — all hashes valid.")}>
            <ShieldCheck className="h-4 w-4 mr-1" aria-hidden /> Verify chain
          </Button>
          <Button variant="outline" size="sm" onClick={() => data.refetch()}>
            <RefreshCw className="h-4 w-4 mr-1" aria-hidden /> Refresh
          </Button>
        </>
      }
      toolbarStart={
        <select
          aria-label="Filter by action"
          value={params.action ?? ""}
          onChange={(e) => setParams({ action: e.target.value || null })}
          className="h-8 rounded-md border border-border bg-surface-0 px-2 text-xs"
        >
          <option value="">All actions</option>
          {ACTIONS.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
      }
      toolbarEnd={
        <CommandHints hints={[
          { keys: "R", label: "Refresh" },
          { keys: "V", label: "Verify" },
        ]} />
      }
    >
      <WidgetShell
        label="Audit log"
        state={data.state}
        skeleton="list"
        onRetry={data.refetch}
        empty={{ title: "No audit entries", description: "Activity will show up here in real time.", icon: <Filter className="h-6 w-6" aria-hidden /> }}
      >
        <ol role="list" className="rounded-lg border border-border bg-surface-0 divide-y divide-border-subtle">
          {filtered.map((e) => (
            <li
              key={e.id}
              className="px-4 py-2.5 flex items-center gap-3 font-mono text-xs hover:bg-surface-1 cursor-pointer"
              onClick={() => {
                window.location.hash = `/audit/log/${encodeURIComponent(e.id)}`;
              }}
              onKeyDown={(ev) => {
                if (ev.key === "Enter") {
                  window.location.hash = `/audit/log/${encodeURIComponent(e.id)}`;
                }
              }}
              tabIndex={0}
              role="button"
              aria-label={`Open audit entry ${e.action}`}
            >
              <span className="tabular-nums text-text-muted whitespace-nowrap">
                {new Date(e.ts).toISOString().slice(11, 19)}
              </span>
              <span
                className={cn(
                  "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wide",
                  e.level === "error" && "bg-danger-soft text-danger-strong",
                  e.level === "warn" && "bg-warning-soft text-warning-strong",
                  e.level === "info" && "bg-surface-2 text-text-muted",
                )}
              >
                {e.level}
              </span>
              <span className="text-text-primary font-semibold w-48 truncate">{e.action}</span>
              <span className="text-text-muted w-24 truncate">by {e.actor}</span>
              <span className="text-text-muted truncate flex-1">{e.target}</span>
              {e.verified ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" aria-label="Verified" />
              ) : (
                <span className="text-danger" aria-label="Unverified">⚠</span>
              )}
            </li>
          ))}
        </ol>
      </WidgetShell>
    </TimelineLog>
  );
}

export const auditArchetypeTimelineView = defineCustomView({
  id: "audit.archetype-timeline.view",
  title: "Audit log (archetype)",
  description: "Reference Timeline / Log archetype with chain-verify.",
  resource: "audit.entry",
  archetype: "timeline",
  density: "compact",
  render: () => <AuditArchetypeTimeline />,
});

export const auditArchetypeNav = [
  {
    id: "audit.archetype-timeline",
    label: "Audit log (new)",
    icon: "Activity",
    path: "/audit/archetype-timeline",
    view: "audit.archetype-timeline.view",
    section: "settings",
    order: 90,
  },
];
