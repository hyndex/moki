/** Reference Workspace Hub for an individual contact (CRM person). */

import * as React from "react";
import { Edit3, MailPlus, Phone, MoreHorizontal, CalendarPlus } from "lucide-react";
import { Button } from "@/primitives/Button";
import { Badge } from "@/primitives/Badge";
import { defineCustomView } from "@/builders";
import {
  WorkspaceHub,
  KpiTile,
  RailEntityCard,
  RailRelatedEntities,
  RailNextActions,
  RailRecordHealth,
  RailRiskFlags,
  WidgetShell,
  CommandHints,
  useArchetypeKeyboard,
  useUrlState,
  useRecordLinks,
} from "@/admin-archetypes";
import { useRecord } from "@/runtime/hooks";

interface PersonHub {
  id: string;
  name: string;
  email: string;
  phone: string;
  title: string;
  company: string;
  stage: "lead" | "prospect" | "customer" | "churned";
  ltv: number;
  lastTouchDays: number;
  openDeals: number;
  openTickets: number;
  health: { score: number; tier: "success" | "info" | "warning" | "danger" };
  preferences: { channel: "email" | "phone" | "sms"; doNotContact: boolean };
}

const SAMPLE: PersonHub = {
  id: "p-ada",
  name: "Ada Lovelace",
  email: "ada.knuth@acme.com",
  phone: "+1 555 0142",
  title: "Director, Operations",
  company: "Acme Corp",
  stage: "customer",
  ltv: 18_400,
  lastTouchDays: 4,
  openDeals: 1,
  openTickets: 0,
  health: { score: 89, tier: "success" },
  preferences: { channel: "email", doNotContact: false },
};

const STAGE_TONE: Record<PersonHub["stage"], "success" | "info" | "warning" | "neutral"> = {
  customer: "success",
  prospect: "info",
  lead: "warning",
  churned: "neutral",
};

function liveOrSample(rec: Record<string, unknown> | null | undefined, fallback: PersonHub): PersonHub {
  if (!rec) return fallback;
  // Best-effort projection of the framework record into our local
  // PersonHub shape. Missing fields fall back to the sample so the
  // page UX is never blank.
  const r = rec as Partial<PersonHub> & { name?: string; firstName?: string; lastName?: string };
  return {
    id: String(r.id ?? fallback.id),
    name:
      r.name ??
      ([r.firstName, r.lastName].filter(Boolean).join(" ") || fallback.name),
    email: r.email ?? fallback.email,
    phone: r.phone ?? fallback.phone,
    title: r.title ?? fallback.title,
    company: r.company ?? fallback.company,
    stage: (r.stage as PersonHub["stage"]) ?? fallback.stage,
    ltv: typeof r.ltv === "number" ? r.ltv : (rec as { lifetimeValue?: number }).lifetimeValue ?? fallback.ltv,
    lastTouchDays: typeof r.lastTouchDays === "number" ? r.lastTouchDays : fallback.lastTouchDays,
    openDeals: typeof r.openDeals === "number" ? r.openDeals : fallback.openDeals,
    openTickets: typeof r.openTickets === "number" ? r.openTickets : fallback.openTickets,
    health: r.health ?? fallback.health,
    preferences: r.preferences ?? fallback.preferences,
  };
}

export function CrmArchetypePersonHub() {
  const [params, setParams] = useUrlState(["tab", "id"] as const);
  const tab = params.tab ?? "overview";
  const id = params.id ?? "p-ada";
  // Real backend read for the focused entity. Falls back to sample
  // when the id isn't found (e.g., demo path).
  const live = useRecord("crm.contact", id);
  const data = {
    data: liveOrSample(live.data, SAMPLE),
    state: live.error
      ? ({ status: "error" as const, error: live.error })
      : live.loading && !live.data
        ? ({ status: "loading" as const })
        : ({ status: "ready" as const }),
    refetch: () => {
      /* useRecord already auto-refreshes on resource change. */
    },
  };
  // Surface real cross-plugin links via the framework adapter.
  const { groups: linkGroups } = useRecordLinks(
    live.data ? { type: "crm.contact", id: String(live.data.id) } : null,
  );
  const p = data.data;

  useArchetypeKeyboard([
    { label: "Edit", combo: "e", run: () => alert("Edit person (mock)") },
    { label: "Email", combo: "m", run: () => alert("Compose email (mock)") },
    { label: "Call", combo: "c", run: () => alert("Place call (mock)") },
    { label: "Schedule", combo: "s", run: () => alert("Schedule (mock)") },
    { label: "Tab 1", combo: "cmd+1", run: () => setParams({ tab: "overview" }, true) },
    { label: "Tab 2", combo: "cmd+2", run: () => setParams({ tab: "deals" }, true) },
    { label: "Tab 3", combo: "cmd+3", run: () => setParams({ tab: "tickets" }, true) },
  ]);

  const fmtCurrency = (n: number) =>
    new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(n);

  return (
    <WorkspaceHub
      id="crm.person.hub"
      title={p?.name ?? "Loading…"}
      subtitle={p && `${p.title} · ${p.company} · last touch ${p.lastTouchDays}d ago`}
      badge={p && <Badge intent={STAGE_TONE[p.stage]}>{p.stage}</Badge>}
      actions={
        <>
          <Button size="sm" variant="outline">
            <MailPlus className="h-4 w-4 mr-1" aria-hidden /> Email
          </Button>
          <Button size="sm" variant="outline">
            <Phone className="h-4 w-4 mr-1" aria-hidden /> Call
          </Button>
          <Button size="sm" variant="outline">
            <CalendarPlus className="h-4 w-4 mr-1" aria-hidden /> Schedule
          </Button>
          <Button size="sm">
            <Edit3 className="h-4 w-4 mr-1" aria-hidden /> Edit
          </Button>
          <Button size="sm" variant="ghost" aria-label="More">
            <MoreHorizontal className="h-4 w-4" aria-hidden />
          </Button>
        </>
      }
      tabs={
        <nav role="tablist" className="flex items-center gap-1 text-sm">
          {[
            { id: "overview", label: "Overview" },
            { id: "deals", label: `Deals${p ? ` · ${p.openDeals}` : ""}` },
            { id: "tickets", label: `Tickets${p ? ` · ${p.openTickets}` : ""}` },
            { id: "files", label: "Files" },
            { id: "activity", label: "Activity" },
          ].map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setParams({ tab: t.id }, true)}
              className={
                "px-2.5 py-1 rounded-md " +
                (tab === t.id ? "bg-info-soft/40 text-text-primary" : "text-text-muted hover:text-text-primary hover:bg-surface-1")
              }
            >
              {t.label}
            </button>
          ))}
        </nav>
      }
      kpis={
        <>
          <WidgetShell label="LTV" state={data.state} skeleton="kpi" onRetry={data.refetch}>
            <KpiTile label="Lifetime value" value={p ? fmtCurrency(p.ltv) : "—"} />
          </WidgetShell>
          <WidgetShell label="Open deals" state={data.state} skeleton="kpi" onRetry={data.refetch}>
            <KpiTile label="Open deals" value={p?.openDeals ?? 0} drillTo={{ kind: "hash", hash: `/crm/deals?filter=person:eq:${id}` }} />
          </WidgetShell>
          <WidgetShell label="Open tickets" state={data.state} skeleton="kpi" onRetry={data.refetch}>
            <KpiTile label="Open tickets" value={p?.openTickets ?? 0} />
          </WidgetShell>
          <WidgetShell label="Days since last touch" state={data.state} skeleton="kpi" onRetry={data.refetch}>
            <KpiTile label="Last touch" value={`${p?.lastTouchDays ?? "—"}d`} />
          </WidgetShell>
        </>
      }
      main={
        tab === "overview" ? (
          <WidgetShell label="Overview" state={data.state} skeleton="list" onRetry={data.refetch}>
            <div className="rounded-lg border border-border bg-surface-0 p-4 grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-text-muted">Email: </span><a className="hover:underline" href={`mailto:${p?.email}`}>{p?.email}</a></div>
              <div><span className="text-text-muted">Phone: </span>{p?.phone}</div>
              <div><span className="text-text-muted">Title: </span>{p?.title}</div>
              <div><span className="text-text-muted">Company: </span>{p?.company}</div>
              <div><span className="text-text-muted">Preferred channel: </span>{p?.preferences.channel}</div>
              <div>
                <span className="text-text-muted">Do-not-contact: </span>
                {p?.preferences.doNotContact ? <Badge intent="danger">on</Badge> : <Badge intent="neutral">off</Badge>}
              </div>
            </div>
            <CommandHints
              hints={[
                { keys: "E", label: "Edit" },
                { keys: "M", label: "Email" },
                { keys: "C", label: "Call" },
                { keys: "S", label: "Schedule" },
              ]}
              className="pt-2"
            />
          </WidgetShell>
        ) : tab === "deals" ? (
          <div className="rounded-lg border border-border bg-surface-0 p-4 text-sm text-text-muted">
            Deals tab — list of {p?.openDeals ?? 0} open deals. (Demo placeholder.)
          </div>
        ) : tab === "tickets" ? (
          <div className="rounded-lg border border-border bg-surface-0 p-4 text-sm text-text-muted">
            Tickets tab — {p?.openTickets ?? 0} open. (Demo placeholder.)
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-surface-0 p-4 text-sm text-text-muted">
            Tab "{tab}" — placeholder.
          </div>
        )
      }
      railTop={
        p && (
          <RailEntityCard
            title={p.name}
            subtitle={`${p.title} · ${p.company}`}
            initials={p.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
            status={{ label: p.stage, tone: STAGE_TONE[p.stage] }}
            facts={[
              { label: "Email", value: p.email },
              { label: "Phone", value: p.phone },
              { label: "LTV", value: fmtCurrency(p.ltv) },
              { label: "Last touch", value: `${p.lastTouchDays}d` },
            ]}
            footer={
              <a
                href={`#/contacts/${encodeURIComponent(p.id)}`}
                className="inline-flex items-center gap-1 text-xs font-medium text-info hover:text-info-strong transition-colors group"
              >
                Open canonical record
                <span aria-hidden className="transition-transform duration-fast group-hover:translate-x-0.5">→</span>
              </a>
            }
          />
        )
      }
      rail={
        <>
          <RailRecordHealth score={{ score: p?.health.score ?? 0, tier: p?.health.tier ?? "info" }} />
          <RailRelatedEntities
            groups={
              linkGroups.length > 0
                ? linkGroups.map((g) => ({
                    label: g.label,
                    count: g.count,
                    summary: g.summary,
                    icon: g.icon,
                    severity: g.severity,
                    drillTo: g.href ? { kind: "url", url: g.href } : undefined,
                  }))
                : [
                    { label: "Open deals", count: p?.openDeals ?? 0, summary: p?.openDeals, icon: "Target", drillTo: { kind: "hash", hash: `/crm/deals?filter=person:eq:${id}` } },
                    { label: "Open tickets", count: p?.openTickets ?? 0, summary: p?.openTickets, icon: "MessageSquare" },
                    { label: "Files", count: 4, summary: 4, icon: "FileText" },
                  ]
            }
          />
          <RailNextActions
            actions={[
              { id: "follow-up", label: "Send follow-up email", source: "rule" },
              { id: "qbr", label: "Schedule QBR with Maya", source: "ai", rationale: "5 months to renewal" },
            ]}
          />
          <RailRiskFlags flags={[]} />
        </>
      }
    />
  );
}

export const crmArchetypePersonHubView = defineCustomView({
  id: "crm.archetype-person-hub.view",
  title: "Person hub (archetype)",
  description: "Reference Workspace Hub for an individual contact.",
  resource: "crm.contact",
  archetype: "workspace-hub",
  density: "comfortable",
  render: () => <CrmArchetypePersonHub />,
});
