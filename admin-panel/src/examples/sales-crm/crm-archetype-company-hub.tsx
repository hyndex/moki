/** Reference Workspace Hub for a CRM company entity. */

import * as React from "react";
import { Edit3, MailPlus, Phone, MoreHorizontal } from "lucide-react";
import { Button } from "@/primitives/Button";
import { defineCustomView } from "@/builders";
import {
  WorkspaceHub,
  KpiTile,
  KpiRing,
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
import { useAllRecords } from "@/runtime/hooks";
import { Badge } from "@/primitives/Badge";

interface CompanyHubData {
  id: string;
  name: string;
  industry: string;
  tier: "smb" | "mid" | "enterprise";
  arr: number;
  openDeals: { count: number; value: number };
  tickets: { open: number; closed: number };
  csat: number;
  health: { score: number; tier: "success" | "info" | "warning" | "danger" };
  renewal: string;
  owner: string;
  contactsCount: number;
  contracts: number;
}

const SAMPLE: CompanyHubData = {
  id: "co-acme",
  name: "Acme Corp",
  industry: "Industrial",
  tier: "enterprise",
  arr: 84_000,
  openDeals: { count: 3, value: 120_000 },
  tickets: { open: 2, closed: 12 },
  csat: 4.6,
  health: { score: 84, tier: "success" },
  renewal: "2026-09-30",
  owner: "Maya R.",
  contactsCount: 8,
  contracts: 6,
};

export function CrmArchetypeCompanyHub() {
  const [params, setParams] = useUrlState(["tab", "id"] as const);
  const tab = params.tab ?? "overview";
  const id = params.id ?? "co-acme";
  // Real backend reads — pull every contact + deal scoped to the
  // company name. Falls back to SAMPLE when the resource is empty so
  // the demo path keeps working.
  const contacts = useAllRecords<{ id: string; company?: string; lifetimeValue?: number }>("crm.contact");
  const deals = useAllRecords<{ id: string; company?: string; amount?: number; stage?: string; status?: string }>("sales.deal");
  const co = React.useMemo<CompanyHubData>(() => {
    const companyName = SAMPLE.name;
    const contactsForCo = contacts.data.filter(
      (c) => (c.company ?? "").toLowerCase() === companyName.toLowerCase(),
    );
    const dealsForCo = deals.data.filter(
      (d) => (d.company ?? "").toLowerCase() === companyName.toLowerCase(),
    );
    if (contactsForCo.length === 0 && dealsForCo.length === 0) return SAMPLE;
    const arr = contactsForCo.reduce(
      (s, c) => s + (c.lifetimeValue ?? 0),
      0,
    );
    const openDeals = dealsForCo.filter(
      (d) => d.stage !== "won" && d.stage !== "lost" && d.status !== "closed",
    );
    return {
      ...SAMPLE,
      arr,
      openDeals: {
        count: openDeals.length,
        value: openDeals.reduce((s, d) => s + (d.amount ?? 0), 0),
      },
      contactsCount: contactsForCo.length,
    };
  }, [contacts.data, deals.data]);
  const { groups: linkGroups } = useRecordLinks({ type: "crm.contact", id });

  useArchetypeKeyboard([
    { label: "Edit", combo: "e", run: () => alert("Edit company (mock)") },
    { label: "Email", combo: "m", run: () => alert("Compose email (mock)") },
    { label: "Tab 1", combo: "cmd+1", run: () => setParams({ tab: "overview" }, true) },
    { label: "Tab 2", combo: "cmd+2", run: () => setParams({ tab: "deals" }, true) },
    { label: "Tab 3", combo: "cmd+3", run: () => setParams({ tab: "tickets" }, true) },
  ]);

  const fmtCurrency = (n: number) =>
    new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

  return (
    <WorkspaceHub
      id="crm.company.hub"
      title={co?.name ?? "Loading…"}
      subtitle={co ? `${co.industry} · Customer since 2024-03-12 · Owner ${co.owner}` : undefined}
      badge={co && <Badge intent="success">{co.tier}</Badge>}
      actions={
        <>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const primary = (contacts.data ?? []).find(
                (c) => c.company === co?.name,
              ) as { email?: string } | undefined;
              if (primary?.email) window.location.href = `mailto:${primary.email}`;
            }}
            disabled={!co}
          >
            <MailPlus className="h-4 w-4 mr-1" aria-hidden /> Email
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const primary = (contacts.data ?? []).find(
                (c) => c.company === co?.name,
              ) as { phone?: string } | undefined;
              if (primary?.phone) window.location.href = `tel:${primary.phone}`;
            }}
            disabled={!co}
          >
            <Phone className="h-4 w-4 mr-1" aria-hidden /> Call
          </Button>
          <Button
            size="sm"
            onClick={() => {
              if (id) window.location.hash = `#/contacts/${encodeURIComponent(id)}/edit`;
            }}
          >
            <Edit3 className="h-4 w-4 mr-1" aria-hidden /> Edit
          </Button>
          <Button size="sm" variant="ghost" aria-label="More" disabled>
            <MoreHorizontal className="h-4 w-4" aria-hidden />
          </Button>
        </>
      }
      tabs={
        <nav role="tablist" className="flex items-center gap-1 text-sm">
          {[
            { id: "overview", label: "Overview" },
            { id: "deals", label: `Deals${co ? ` · ${co.openDeals.count}` : ""}` },
            { id: "tickets", label: `Tickets${co ? ` · ${co.tickets.open}` : ""}` },
            { id: "files", label: "Files" },
            { id: "activity", label: "Activity" },
            { id: "audit", label: "Audit" },
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
          <WidgetShell label="ARR" state={(contacts.error || deals.error) ? { status: "error" as const, error: contacts.error ?? deals.error } : (contacts.loading && deals.loading) ? { status: "loading" as const } : { status: "ready" as const }} skeleton="kpi" onRetry={() => { contacts.refetch(); deals.refetch(); }}>
            <KpiTile label="ARR" value={co ? fmtCurrency(co.arr) : "—"} />
          </WidgetShell>
          <WidgetShell label="Open deals" state={(contacts.error || deals.error) ? { status: "error" as const, error: contacts.error ?? deals.error } : (contacts.loading && deals.loading) ? { status: "loading" as const } : { status: "ready" as const }} skeleton="kpi" onRetry={() => { contacts.refetch(); deals.refetch(); }}>
            <KpiTile label="Open deals" value={co ? `${co.openDeals.count} · ${fmtCurrency(co.openDeals.value)}` : "—"}
              drillTo={{ kind: "hash", hash: "/crm/deals?filter=company:eq:Acme" }} />
          </WidgetShell>
          <WidgetShell label="Tickets" state={(contacts.error || deals.error) ? { status: "error" as const, error: contacts.error ?? deals.error } : (contacts.loading && deals.loading) ? { status: "loading" as const } : { status: "ready" as const }} skeleton="kpi" onRetry={() => { contacts.refetch(); deals.refetch(); }}>
            <KpiTile label="Tickets" value={co ? `${co.tickets.open} open / ${co.tickets.closed}` : "—"} />
          </WidgetShell>
          <WidgetShell label="CSAT" state={(contacts.error || deals.error) ? { status: "error" as const, error: contacts.error ?? deals.error } : (contacts.loading && deals.loading) ? { status: "loading" as const } : { status: "ready" as const }} skeleton="kpi" onRetry={() => { contacts.refetch(); deals.refetch(); }}>
            <KpiRing label="CSAT" current={co?.csat ?? 0} target={5} format={(n) => `${n.toFixed(1)}/5`} />
          </WidgetShell>
        </>
      }
      main={
        tab === "overview" ? (
          <WidgetShell label="Overview" state={(contacts.error || deals.error) ? { status: "error" as const, error: contacts.error ?? deals.error } : (contacts.loading && deals.loading) ? { status: "loading" as const } : { status: "ready" as const }} skeleton="list" onRetry={() => { contacts.refetch(); deals.refetch(); }}>
            <div className="rounded-lg border border-border bg-surface-0 p-4 grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-text-muted">Industry: </span>{co?.industry}</div>
              <div><span className="text-text-muted">Tier: </span>{co?.tier}</div>
              <div><span className="text-text-muted">Owner: </span>{co?.owner}</div>
              <div><span className="text-text-muted">Renewal: </span>{co?.renewal}</div>
              <div><span className="text-text-muted">Contacts: </span>{co?.contactsCount}</div>
              <div><span className="text-text-muted">Contracts: </span>{co?.contracts}</div>
            </div>
            <CommandHints hints={[
              { keys: "E", label: "Edit" },
              { keys: "M", label: "Email" },
              { keys: "⌘1-3", label: "Tabs" },
            ]} className="pt-2" />
          </WidgetShell>
        ) : tab === "deals" ? (
          <div className="rounded-lg border border-border bg-surface-0 p-4 text-sm text-text-muted">
            Deals tab — list of {co?.openDeals.count ?? 0} open deals. (Demo placeholder.)
          </div>
        ) : tab === "tickets" ? (
          <div className="rounded-lg border border-border bg-surface-0 p-4 text-sm text-text-muted">
            Tickets tab — {co?.tickets.open ?? 0} open, {co?.tickets.closed ?? 0} closed.
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-surface-0 p-4 text-sm text-text-muted">
            Tab "{tab}" — content placeholder.
          </div>
        )
      }
      railTop={
        <RailEntityCard
          title={co?.name ?? "—"}
          subtitle={co ? `${co.industry} · ${co.tier}` : undefined}
          initials={co?.name?.slice(0, 2).toUpperCase()}
          status={co && { label: co.tier, tone: "success" }}
          facts={co && [
            { label: "Owner", value: co.owner },
            { label: "Renewal", value: co.renewal },
            { label: "Plan", value: co.tier },
            { label: "ARR", value: fmtCurrency(co.arr) },
          ]}
        />
      }
      rail={
        <>
          <RailRecordHealth score={{ score: co?.health.score ?? 0, tier: co?.health.tier ?? "info" }} />
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
                    { label: "Contacts", count: co?.contactsCount ?? 0, summary: co?.contactsCount, icon: "Users", drillTo: { kind: "hash", hash: "/crm/people?filter=company:eq:Acme" } },
                    { label: "Open deals", count: co?.openDeals.count ?? 0, summary: fmtCurrency(co?.openDeals.value ?? 0), icon: "Target", drillTo: { kind: "hash", hash: "/crm/deals?filter=company:eq:Acme" } },
                    { label: "Tickets", count: co?.tickets.open ?? 0, summary: `${co?.tickets.open} open`, icon: "MessageSquare", severity: "warning" },
                    { label: "Contracts", count: co?.contracts ?? 0, summary: co?.contracts, icon: "FileText" },
                  ]
            }
          />
          <RailNextActions actions={[
            { id: "review", label: "Send Q3 business review", source: "ai", rationale: "Renewal in 5 months" },
            { id: "qbr", label: "Schedule QBR with Maya", source: "rule" },
          ]} />
          <RailRiskFlags flags={[
            { id: "support-tickets", label: "2 open SLA-breach tickets", severity: "warning" },
          ]} />
        </>
      }
    />
  );
}

export const crmArchetypeCompanyHubView = defineCustomView({
  id: "crm.archetype-company-hub.view",
  title: "Company hub (archetype)",
  description: "Reference Workspace Hub for a customer entity.",
  resource: "crm.contact",
  archetype: "workspace-hub",
  density: "comfortable",
  render: () => <CrmArchetypeCompanyHub />,
});
