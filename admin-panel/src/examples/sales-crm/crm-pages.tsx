import * as React from "react";
import {
  Mail,
  Phone,
  CalendarPlus,
  StickyNote,
  MoreHorizontal,
  UserPlus,
  Search,
  Download,
  Tag,
  TrendingUp,
  ArrowUpRight,
  Star,
  Clock,
  MessageCircle,
  CheckCircle2,
  Plus,
  Filter,
} from "lucide-react";
import { defineCustomView } from "@/builders";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/admin-primitives/Card";
import {
  PageGrid,
  Col,
  Section,
  Inline,
  Stack,
} from "@/admin-primitives/PageLayout";
import { PageHeader } from "@/admin-primitives/PageHeader";
import { DetailHeader } from "@/admin-primitives/DetailHeader";
import { StatCard } from "@/admin-primitives/StatCard";
import { PropertyList } from "@/admin-primitives/PropertyList";
import { TabBar } from "@/admin-primitives/TabBar";
import { QuickFilterBar } from "@/admin-primitives/QuickFilter";
import { Timeline } from "@/admin-primitives/Timeline";
import { EmptyState } from "@/admin-primitives/EmptyState";
import { StatusDot } from "@/admin-primitives/StatusDot";
import { Donut } from "@/admin-primitives/charts/Donut";
import { Sparkline } from "@/admin-primitives/charts/Sparkline";
import { BarChart } from "@/admin-primitives/charts/BarChart";
import { Avatar } from "@/primitives/Avatar";
import { AvatarGroup } from "@/primitives/AvatarGroup";
import { Badge } from "@/primitives/Badge";
import { Button } from "@/primitives/Button";
import { Input } from "@/primitives/Input";
import { Textarea } from "@/primitives/Textarea";
import { Checkbox } from "@/primitives/Checkbox";
import { LiveDnDKanban } from "@/admin-primitives/LiveDnDKanban";
import { cn } from "@/lib/cn";
import { formatCurrency, formatRelative } from "@/lib/format";
import {
  STAGES,
  stageIntent,
  stageLabel,
  type Contact,
  type ActivityItem,
} from "./data";
import { useActivities, useContacts, useDeals } from "./data-hooks";
import { useCrmNotes } from "./live-data-hooks";
import { humanBytes, uploadFile, useRecordFiles } from "@/runtime/files";
import { useRuntime } from "@/runtime/context";
import { Spinner } from "@/primitives/Spinner";
import { navigateTo } from "@/views/useRoute";

/* ========================================================================
 * Overview — the rich CRM landing.
 * ======================================================================== */

export const crmOverviewView = defineCustomView({
  id: "crm.overview.view",
  title: "Overview",
  description: "CRM health and recent activity.",
  resource: "crm.contact",
  render: () => <CrmOverviewPage />,
});

function CrmOverviewPage() {
  const { data: contacts, loading: contactsLoading } = useContacts();
  const { data: activities } = useActivities();
  if (contactsLoading && contacts.length === 0) return <LoadingShell />;
  {
    const CONTACTS = contacts;
    const ACTIVITIES = activities;
    const total = CONTACTS.length;
    const vips = CONTACTS.filter((c) => c.vip).length;
    const stale = CONTACTS.filter((c) => {
      const days =
        (Date.now() - new Date(c.lastActivityAt).getTime()) / 86400_000;
      return days > 20;
    }).length;
    const thisWeek = CONTACTS.filter((c) => {
      const days = (Date.now() - new Date(c.createdAt).getTime()) / 86400_000;
      return days < 7;
    }).length;
    const stageCounts = STAGES.map((s) => ({
      label: s.label,
      value: CONTACTS.filter((c) => c.stage === s.id).length,
    }));
    const companyCounts = groupTop(
      CONTACTS.map((c) => c.company),
      5,
    );
    const recent = CONTACTS.slice(0, 8);
    const activity = ACTIVITIES.slice(0, 8).map((a) => ({
      id: a.id,
      title: a.summary,
      description: a.body,
      occurredAt: a.when,
      intent: activityIntent(a.kind),
      icon: activityIcon(a.kind),
    }));

    return (
      <Stack>
        <PageHeader
          title="CRM overview"
          description="How your pipeline is moving this week."
          actions={
            <>
              <Button variant="ghost" size="sm" iconLeft={<Download className="h-3.5 w-3.5" />}>
                Export
              </Button>
              <Button
                variant="primary"
                size="sm"
                iconLeft={<UserPlus className="h-3.5 w-3.5" />}
                onClick={() => navigateTo("/contacts/new")}
              >
                New contact
              </Button>
            </>
          }
        />

        <PageGrid columns={4}>
          <StatCard
            label="Contacts"
            value={total.toLocaleString()}
            trend={{ value: 9, positive: true, label: "vs last mo" }}
            spark={[34, 38, 41, 39, 44, 48, 52, 57, 60, 64, 66, total]}
            sparkColor="rgb(var(--accent))"
          />
          <StatCard
            label="New this week"
            value={thisWeek}
            trend={{ value: 14, positive: true }}
            intent="success"
            icon={<UserPlus className="h-3 w-3" />}
          />
          <StatCard
            label="VIPs"
            value={vips}
            secondary={`${Math.round((vips / total) * 100)}% of book`}
            intent="warning"
            icon={<Star className="h-3 w-3" />}
          />
          <StatCard
            label="Stale ≥20d"
            value={stale}
            trend={{ value: 3, positive: false, label: "vs last wk" }}
            intent="danger"
            icon={<Clock className="h-3 w-3" />}
          />
        </PageGrid>

        <PageGrid columns={3}>
          <Col span={2}>
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Recent contacts</CardTitle>
                  <CardDescription>Added or updated in the last 30 days.</CardDescription>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  iconRight={<ArrowUpRight className="h-3 w-3" />}
                  onClick={() => navigateTo("/contacts")}
                >
                  View all
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <ul className="divide-y divide-border-subtle">
                  {recent.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => navigateTo(`/contacts/${c.id}`)}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-surface-1 transition-colors"
                      >
                        <Avatar name={c.name} size="md" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-text-primary truncate">
                              {c.name}
                            </span>
                            {c.vip && <Badge intent="warning">VIP</Badge>}
                          </div>
                          <div className="text-xs text-text-muted truncate">
                            {c.title} · {c.company}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <Sparkline
                            data={c.activityTrend ?? []}
                            width={80}
                            height={22}
                          />
                          <Badge intent={stageIntent(c.stage)}>{stageLabel(c.stage)}</Badge>
                          <span className="text-xs text-text-muted w-24 text-right tabular-nums">
                            {formatRelative(c.lastActivityAt)}
                          </span>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </Col>
          <Stack>
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Stages</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <Donut
                  data={stageCounts}
                  centerLabel={
                    <div>
                      <div className="text-xl font-semibold text-text-primary">
                        {total}
                      </div>
                      <div className="text-xs text-text-muted">contacts</div>
                    </div>
                  }
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Top companies</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <ul className="divide-y divide-border-subtle">
                  {companyCounts.map((c) => (
                    <li
                      key={c.key}
                      className="flex items-center gap-2 px-4 py-2 text-sm"
                    >
                      <Avatar name={c.key} size="sm" />
                      <span className="flex-1 min-w-0 truncate text-text-primary">
                        {c.key}
                      </span>
                      <span className="text-text-muted tabular-nums">
                        {c.count}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </Stack>
        </PageGrid>

        <PageGrid columns={2}>
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Activity — last 7 days</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <BarChart
                data={[
                  { label: "Mon", value: 14 },
                  { label: "Tue", value: 22 },
                  { label: "Wed", value: 28 },
                  { label: "Thu", value: 19 },
                  { label: "Fri", value: 12 },
                  { label: "Sat", value: 4 },
                  { label: "Sun", value: 2 },
                ]}
                height={160}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Latest activity</CardTitle>
                <CardDescription>Across every contact.</CardDescription>
              </div>
              <Button
                size="sm"
                variant="ghost"
                iconRight={<ArrowUpRight className="h-3 w-3" />}
                onClick={() => navigateTo("/contacts/activity")}
              >
                See all
              </Button>
            </CardHeader>
            <CardContent>
              <Timeline items={activity} />
            </CardContent>
          </Card>
        </PageGrid>
      </Stack>
    );
  }
}

/* ========================================================================
 * Contacts list — enriched rows, quick filter bar, multi-select, bulk.
 * ======================================================================== */

export const crmContactsView = defineCustomView({
  id: "crm.contacts.view",
  title: "Contacts",
  description: "Everyone in your book, enriched with activity.",
  resource: "crm.contact",
  render: () => <ContactsList />,
});

function ContactsList() {
  const { data: CONTACTS, loading } = useContacts();
  const [filter, setFilter] = React.useState("all");
  const [search, setSearch] = React.useState("");
  const [selected, setSelected] = React.useState<Set<string>>(new Set());

  if (loading && CONTACTS.length === 0) return <LoadingShell />;

  const filters = [
    { id: "all", label: "All", count: CONTACTS.length },
    { id: "vip", label: "VIPs", count: CONTACTS.filter((c) => c.vip).length },
    {
      id: "stale",
      label: "Stale",
      count: CONTACTS.filter(
        (c) =>
          (Date.now() - new Date(c.lastActivityAt).getTime()) / 86400_000 > 20,
      ).length,
    },
    {
      id: "recent",
      label: "Recent",
      count: CONTACTS.filter(
        (c) =>
          (Date.now() - new Date(c.createdAt).getTime()) / 86400_000 < 14,
      ).length,
    },
  ];

  const filtered = CONTACTS.filter((c) => {
    if (filter === "vip" && !c.vip) return false;
    if (filter === "stale") {
      const days =
        (Date.now() - new Date(c.lastActivityAt).getTime()) / 86400_000;
      if (days < 20) return false;
    }
    if (filter === "recent") {
      const days =
        (Date.now() - new Date(c.createdAt).getTime()) / 86400_000;
      if (days > 14) return false;
    }
    if (search) {
      const q = search.toLowerCase();
      return (
        c.name.toLowerCase().includes(q) ||
        c.company.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const allSelected =
    filtered.length > 0 && filtered.every((c) => selected.has(c.id));
  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else setSelected(new Set(filtered.map((c) => c.id)));
  };

  return (
    <Stack>
      <PageHeader
        title="Contacts"
        description={`${filtered.length} of ${CONTACTS.length} contacts`}
        actions={
          <>
            <Button variant="ghost" size="sm" iconLeft={<Download className="h-3.5 w-3.5" />}>
              Export
            </Button>
            <Button
              variant="primary"
              size="sm"
              iconLeft={<UserPlus className="h-3.5 w-3.5" />}
              onClick={() => navigateTo("/contacts/new")}
            >
              New contact
            </Button>
          </>
        }
      />

      <Inline gap="gap-3" wrap>
        <QuickFilterBar filters={filters} active={filter} onChange={setFilter} />
        <div className="min-w-[220px] flex-1 max-w-sm">
          <Input
            placeholder="Search name, company, email…"
            prefix={<Search className="h-3.5 w-3.5" />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button variant="ghost" size="sm" iconLeft={<Filter className="h-3.5 w-3.5" />}>
          Filters
        </Button>
      </Inline>

      {selected.size > 0 && (
        <div className="flex items-center gap-2 rounded-md bg-accent-subtle/60 border border-accent/30 px-3 py-2">
          <span className="text-sm text-accent font-medium">
            {selected.size} selected
          </span>
          <span className="flex-1" />
          <Button size="sm" variant="secondary" iconLeft={<Mail className="h-3.5 w-3.5" />}>
            Email
          </Button>
          <Button size="sm" variant="secondary" iconLeft={<Tag className="h-3.5 w-3.5" />}>
            Tag
          </Button>
          <Button size="sm" variant="secondary" iconLeft={<Star className="h-3.5 w-3.5" />}>
            Mark VIP
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSelected(new Set())}
          >
            Clear
          </Button>
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-surface-1 border-b border-border text-xs uppercase tracking-wider text-text-muted">
              <tr>
                <th className="w-9 pl-4">
                  <Checkbox
                    checked={
                      allSelected
                        ? true
                        : filtered.some((c) => selected.has(c.id))
                          ? "indeterminate"
                          : false
                    }
                    onCheckedChange={toggleAll}
                    aria-label="Select all"
                  />
                </th>
                <th className="text-left py-2 font-medium">Name</th>
                <th className="text-left py-2 font-medium">Stage</th>
                <th className="text-left py-2 font-medium">Owner</th>
                <th className="text-right py-2 font-medium">LTV</th>
                <th className="text-right py-2 font-medium pr-2">Activity (12mo)</th>
                <th className="text-right py-2 font-medium pr-4">Last touch</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <EmptyState
                      title="No contacts match"
                      description="Try clearing your filters or searching for something else."
                    />
                  </td>
                </tr>
              ) : (
                filtered.map((c) => {
                  const isSel = selected.has(c.id);
                  return (
                    <tr
                      key={c.id}
                      className={cn(
                        "border-b border-border-subtle last:border-b-0 cursor-pointer transition-colors",
                        isSel ? "bg-accent-subtle/40" : "hover:bg-surface-1",
                      )}
                      onClick={(e) => {
                        if ((e.target as HTMLElement).closest("[data-stop]")) return;
                        navigateTo(`/contacts/${c.id}`);
                      }}
                    >
                      <td className="pl-4 py-2" data-stop>
                        <Checkbox
                          checked={isSel}
                          onCheckedChange={() => {
                            const next = new Set(selected);
                            isSel ? next.delete(c.id) : next.add(c.id);
                            setSelected(next);
                          }}
                        />
                      </td>
                      <td className="py-2">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={c.name} size="sm" />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-medium text-text-primary truncate">
                                {c.name}
                              </span>
                              {c.vip && (
                                <Star
                                  className="h-3 w-3 fill-intent-warning text-intent-warning shrink-0"
                                  aria-label="VIP"
                                />
                              )}
                            </div>
                            <div className="text-xs text-text-muted truncate">
                              {c.title} · {c.company}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-2">
                        <Badge intent={stageIntent(c.stage)}>
                          {stageLabel(c.stage)}
                        </Badge>
                      </td>
                      <td className="py-2 text-text-secondary">{c.owner}</td>
                      <td className="py-2 text-right tabular-nums text-text-primary">
                        {formatCurrency(c.lifetimeValue)}
                      </td>
                      <td className="py-2 pr-2 text-right">
                        <Sparkline data={c.activityTrend ?? []} width={80} height={22} />
                      </td>
                      <td className="py-2 pr-4 text-right text-xs text-text-muted">
                        {formatRelative(c.lastActivityAt)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </Stack>
  );
}

/* ========================================================================
 * Pipeline — stage totals, weighted value, richer cards.
 * ======================================================================== */

export const crmPipelineView = defineCustomView({
  id: "crm.pipeline.view",
  title: "Pipeline",
  description: "Contacts grouped by lifecycle stage.",
  resource: "crm.contact",
  render: () => <CrmPipelinePage />,
});

function CrmPipelinePage() {
  const { data: CONTACTS, loading } = useContacts();
  if (loading && CONTACTS.length === 0) return <LoadingShell />;
  {
    const columns = STAGES.map((s) => {
      const items = CONTACTS.filter((c) => c.stage === s.id);
      const total = items.reduce((a, c) => a + c.lifetimeValue, 0);
      return {
        id: s.id,
        title: s.label,
        intent: s.intent,
        total,
        items,
      };
    });
    const grand = columns.reduce((a, c) => a + c.total, 0);

    return (
      <Stack>
        <PageHeader
          title="Contact pipeline"
          description="Every contact's stage + LTV."
          actions={
            <Button variant="secondary" size="sm" iconLeft={<Filter className="h-3.5 w-3.5" />}>
              Filters
            </Button>
          }
        />

        <PageGrid columns={4}>
          {columns.map((c) => (
            <StatCard
              key={c.id}
              label={c.title}
              value={c.items.length}
              secondary={formatCurrency(c.total)}
              intent={c.intent === "success" ? "success" : c.intent === "danger" ? "danger" : c.intent === "info" ? "info" : "neutral"}
            />
          ))}
        </PageGrid>

        <LiveDnDKanban<Contact>
          resource="crm.contact"
          statusField="stage"
          columns={columns.map((c) => ({
            id: c.id,
            title: `${c.title} · ${c.items.length}`,
            intent: c.intent,
          }))}
          onCardClick={(c) => navigateTo(`/contacts/${c.id}`)}
          renderCard={(c) => (
            <div>
              <Inline gap="gap-2">
                <Avatar name={c.name} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-text-primary truncate">
                    {c.name}
                  </div>
                  <div className="text-xs text-text-muted truncate">
                    {c.company}
                  </div>
                </div>
                {c.vip && <Star className="h-3.5 w-3.5 fill-intent-warning text-intent-warning" />}
              </Inline>
              <Inline gap="gap-2" className="mt-2 justify-between">
                <Badge intent="accent">{formatCurrency(c.lifetimeValue)}</Badge>
                <span className="text-xs text-text-muted">{c.owner}</span>
              </Inline>
            </div>
          )}
        />

        <div className="text-xs text-text-muted text-right pr-2">
          Total book value: <span className="font-semibold tabular-nums text-text-primary">{formatCurrency(grand)}</span>
        </div>
      </Stack>
    );
  }
}

/* ========================================================================
 * Activity — grouped by day with composer.
 * ======================================================================== */

export const crmActivityView = defineCustomView({
  id: "crm.activity.view",
  title: "Activity",
  description: "Recent engagements across contacts.",
  resource: "crm.contact",
  render: () => <ActivityStream />,
});

function ActivityStream() {
  const { data: ACTIVITIES, loading } = useActivities();
  const { data: CONTACTS } = useContacts();
  const [tab, setTab] = React.useState("all");
  const [note, setNote] = React.useState("");
  const [posted, setPosted] = React.useState<ActivityItem[]>([]);

  if (loading && ACTIVITIES.length === 0) return <LoadingShell />;

  const tabs = [
    { id: "all", label: "All", count: ACTIVITIES.length + posted.length },
    { id: "email", label: "Email", count: ACTIVITIES.filter((a) => a.kind === "email").length },
    { id: "call", label: "Calls", count: ACTIVITIES.filter((a) => a.kind === "call").length },
    { id: "meeting", label: "Meetings", count: ACTIVITIES.filter((a) => a.kind === "meeting").length },
    { id: "note", label: "Notes", count: ACTIVITIES.filter((a) => a.kind === "note").length + posted.filter((a) => a.kind === "note").length },
  ];
  const items = [...posted, ...ACTIVITIES].filter((a) => tab === "all" || a.kind === tab);
  const grouped = groupByDay(items);

  const addNote = () => {
    if (!note.trim()) return;
    const contact = CONTACTS[0] ?? { id: "unknown", name: "Unknown" };
    setPosted((p) => [
      {
        id: `new_${Date.now()}`,
        kind: "note",
        contactId: contact.id,
        contactName: contact.name,
        summary: `Note on ${contact.name}`,
        body: note.trim(),
        when: new Date().toISOString(),
        rep: "You",
      },
      ...p,
    ]);
    setNote("");
  };

  return (
    <Stack>
      <PageHeader
        title="Activity"
        description="Every interaction, newest first."
      />

      <Card>
        <CardContent className="pt-4">
          <Inline gap="gap-2" align="start">
            <Avatar name="You" size="md" />
            <Stack gap="gap-2" className="flex-1">
              <Textarea
                placeholder="Add a quick note — it'll appear against the first contact in your book."
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <Inline gap="gap-2" className="justify-between">
                <Inline gap="gap-1">
                  <Button variant="ghost" size="xs" iconLeft={<Mail className="h-3 w-3" />}>
                    Email
                  </Button>
                  <Button variant="ghost" size="xs" iconLeft={<Phone className="h-3 w-3" />}>
                    Call
                  </Button>
                  <Button variant="ghost" size="xs" iconLeft={<CalendarPlus className="h-3 w-3" />}>
                    Meeting
                  </Button>
                  <Button variant="ghost" size="xs" iconLeft={<StickyNote className="h-3 w-3" />}>
                    Note
                  </Button>
                </Inline>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={addNote}
                  disabled={!note.trim()}
                >
                  Post
                </Button>
              </Inline>
            </Stack>
          </Inline>
        </CardContent>
      </Card>

      <TabBar tabs={tabs} active={tab} onChange={setTab} />

      <Stack gap="gap-5">
        {grouped.map((g) => (
          <Section key={g.label} title={g.label} bare>
            <Timeline
              items={g.items.map((a) => ({
                id: a.id,
                title: (
                  <span>
                    <span className="font-medium text-text-primary">{a.rep}</span>
                    {" · "}
                    {a.summary}
                  </span>
                ),
                description: a.body,
                occurredAt: a.when,
                intent: activityIntent(a.kind),
                icon: activityIcon(a.kind),
              }))}
            />
          </Section>
        ))}
      </Stack>
    </Stack>
  );
}

/* ========================================================================
 * Segments — saved filtered views.
 * ======================================================================== */

export const crmSegmentsView = defineCustomView({
  id: "crm.segments.view",
  title: "Segments",
  description: "Saved groups of contacts.",
  resource: "crm.contact",
  render: () => <CrmSegmentsPage />,
});

function CrmSegmentsPage() {
  const { data: CONTACTS, loading } = useContacts();
  if (loading && CONTACTS.length === 0) return <LoadingShell />;
  {
    const segments = [
      {
        id: "vip",
        name: "VIPs",
        description: "Accounts flagged as strategically important.",
        count: CONTACTS.filter((c) => c.vip).length,
        intent: "warning" as const,
        icon: <Star className="h-4 w-4" />,
      },
      {
        id: "stale",
        name: "Stale (>20d)",
        description: "No activity in three weeks or more.",
        count: CONTACTS.filter(
          (c) => (Date.now() - new Date(c.lastActivityAt).getTime()) / 86400_000 > 20,
        ).length,
        intent: "danger" as const,
        icon: <Clock className="h-4 w-4" />,
      },
      {
        id: "new",
        name: "New this quarter",
        description: "Created in the last 90 days.",
        count: CONTACTS.filter(
          (c) => (Date.now() - new Date(c.createdAt).getTime()) / 86400_000 < 90,
        ).length,
        intent: "success" as const,
        icon: <UserPlus className="h-4 w-4" />,
      },
      {
        id: "enterprise",
        name: "Enterprise",
        description: "Tagged enterprise in the past 180 days.",
        count: CONTACTS.filter((c) => (c.tags ?? []).includes("enterprise")).length,
        intent: "info" as const,
        icon: <TrendingUp className="h-4 w-4" />,
      },
      {
        id: "high-ltv",
        name: "LTV ≥ $50K",
        description: "High lifetime-value accounts.",
        count: CONTACTS.filter((c) => c.lifetimeValue >= 50_000).length,
        intent: "accent" as const,
        icon: <Tag className="h-4 w-4" />,
      },
    ];

    return (
      <Stack>
        <PageHeader
          title="Segments"
          description="Reusable, saved slices of your book."
          actions={
            <Button
              variant="primary"
              size="sm"
              iconLeft={<Plus className="h-3.5 w-3.5" />}
            >
              New segment
            </Button>
          }
        />

        <PageGrid columns={3}>
          {segments.map((s) => (
            <Card key={s.id} className="hover:border-accent transition-colors cursor-pointer">
              <CardContent className="pt-4">
                <Inline gap="gap-2" className="mb-2">
                  <div
                    className={cn(
                      "w-8 h-8 rounded-md flex items-center justify-center",
                      s.intent === "warning" && "bg-intent-warning-bg text-intent-warning",
                      s.intent === "danger" && "bg-intent-danger-bg text-intent-danger",
                      s.intent === "success" && "bg-intent-success-bg text-intent-success",
                      s.intent === "info" && "bg-intent-info-bg text-intent-info",
                      s.intent === "accent" && "bg-accent-subtle text-accent",
                    )}
                  >
                    {s.icon}
                  </div>
                  <Stack gap="gap-0.5" className="flex-1">
                    <div className="text-sm font-semibold text-text-primary">{s.name}</div>
                    <div className="text-xs text-text-muted">{s.description}</div>
                  </Stack>
                </Inline>
                <Inline className="justify-between">
                  <AvatarGroup
                    names={CONTACTS.slice(0, 4).map((c) => c.name)}
                    size="xs"
                  />
                  <div className="text-lg font-semibold tabular-nums text-text-primary">
                    {s.count}
                  </div>
                </Inline>
              </CardContent>
            </Card>
          ))}
        </PageGrid>
      </Stack>
    );
  }
}

/* ========================================================================
 * Contact detail — rich profile page.
 * ======================================================================== */

export const crmContactDetailView = defineCustomView({
  id: "crm.contact-detail.view",
  title: "Contact",
  description: "Full contact profile.",
  resource: "crm.contact",
  render: () => <ContactDetailPage />,
});

function ContactDetailPage() {
  const { data: CONTACTS, loading } = useContacts();
  const { data: ACTIVITIES } = useActivities();
  const { data: DEALS } = useDeals();
  const { data: NOTES } = useCrmNotes();
  const id = useRouteId();
  const files = useRecordFiles("crm.contact", id);
  const [tab, setTab] = React.useState("overview");

  if (loading && CONTACTS.length === 0) return <LoadingShell />;

  const contact = CONTACTS.find((c) => c.id === id) ?? CONTACTS[0];
  if (!contact) {
    return (
      <EmptyState
        title="Contact not found"
        description={`No contact with id "${id}".`}
      />
    );
  }

  const related = ACTIVITIES.filter((a) => a.contactId === contact.id).slice(0, 10);
  const lastTouchMs = contact.lastActivityAt
    ? new Date(contact.lastActivityAt).getTime()
    : Date.now();
  const daysSinceTouch = Math.round((Date.now() - lastTouchMs) / 86400_000);

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "activity", label: "Activity", count: related.length },
    { id: "deals", label: "Deals", count: 2 },
    { id: "notes", label: "Notes", count: related.filter((a) => a.kind === "note").length },
    { id: "files", label: "Files", count: 3 },
  ];

  return (
    <Stack>
      <DetailHeader
        avatar={{ name: contact.name }}
        title={
          <span className="inline-flex items-center gap-2">
            {contact.name}
            {contact.vip && (
              <Badge intent="warning">
                <Star className="h-3 w-3 mr-0.5" /> VIP
              </Badge>
            )}
          </span>
        }
        subtitle={`${contact.title} · ${contact.company}`}
        badges={<Badge intent={stageIntent(contact.stage)}>{stageLabel(contact.stage)}</Badge>}
        meta={
          <>
            <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" /> {contact.email}</span>
            <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" /> {contact.phone}</span>
            <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> Last touch {daysSinceTouch}d ago</span>
            <span className="inline-flex items-center gap-1">Owner: <span className="text-text-primary">{contact.owner}</span></span>
          </>
        }
        actions={
          <>
            <Button variant="ghost" size="sm" iconLeft={<Mail className="h-3.5 w-3.5" />}>
              Email
            </Button>
            <Button variant="ghost" size="sm" iconLeft={<Phone className="h-3.5 w-3.5" />}>
              Call
            </Button>
            <Button variant="ghost" size="sm" iconLeft={<CalendarPlus className="h-3.5 w-3.5" />}>
              Meeting
            </Button>
            <Button variant="secondary" size="sm" iconLeft={<MoreHorizontal className="h-3.5 w-3.5" />}>
              More
            </Button>
          </>
        }
      />

      <TabBar tabs={tabs} active={tab} onChange={setTab} />

      {tab === "overview" && (
        <PageGrid columns={3}>
          <Col span={2}>
            <Stack>
              <Section title="About">
                <PropertyList
                  columns={2}
                  items={[
                    { label: "Email", value: <a href={`mailto:${contact.email}`} className="text-text-link hover:underline">{contact.email}</a> },
                    { label: "Phone", value: contact.phone },
                    { label: "Company", value: contact.company },
                    { label: "Title", value: contact.title },
                    { label: "Stage", value: <Badge intent={stageIntent(contact.stage)}>{stageLabel(contact.stage)}</Badge> },
                    { label: "Owner", value: contact.owner },
                    { label: "LTV", value: formatCurrency(contact.lifetimeValue) },
                    { label: "Created", value: formatRelative(contact.createdAt) },
                  ]}
                />
              </Section>
              <Section
                title="Tags"
                actions={<Button size="xs" variant="ghost" iconLeft={<Plus className="h-3 w-3" />}>Add tag</Button>}
              >
                <Inline wrap gap="gap-1.5">
                  {(contact.tags ?? []).map((t) => (
                    <Badge key={t} intent="neutral">
                      #{t}
                    </Badge>
                  ))}
                </Inline>
              </Section>
              <Section title="Recent activity">
                <Timeline
                  items={related.slice(0, 5).map((a) => ({
                    id: a.id,
                    title: a.summary,
                    description: a.body,
                    occurredAt: a.when,
                    intent: activityIntent(a.kind),
                    icon: activityIcon(a.kind),
                  }))}
                />
              </Section>
            </Stack>
          </Col>
          <Stack>
            <Card>
              <CardContent className="pt-4">
                <Stack gap="gap-3">
                  <StatCard
                    label="Activity (12 months)"
                    value={(contact.activityTrend ?? []).reduce(
                      (a, b) => a + b,
                      0,
                    )}
                    spark={contact.activityTrend ?? []}
                    intent="accent"
                  />
                  <StatCard
                    label="Lifetime value"
                    value={formatCurrency(contact.lifetimeValue)}
                    intent="success"
                  />
                </Stack>
              </CardContent>
            </Card>
            <Section title="Team">
              <Stack gap="gap-2">
                <Inline gap="gap-2">
                  <Avatar name={contact.owner} size="sm" />
                  <Stack gap="gap-0.5">
                    <span className="text-sm font-medium text-text-primary">{contact.owner}</span>
                    <span className="text-xs text-text-muted">Owner</span>
                  </Stack>
                </Inline>
                <Inline gap="gap-2">
                  <AvatarGroup
                    names={["Taylor Nguyen", "Jordan Park", "Casey Morgan"]}
                    size="sm"
                  />
                  <span className="text-xs text-text-muted">Watchers</span>
                </Inline>
              </Stack>
            </Section>
            <Section title="Automation">
              <Stack gap="gap-2">
                <Inline gap="gap-2">
                  <StatusDot intent="success" />
                  <span className="text-sm text-text-primary">
                    Enrolled in onboarding sequence
                  </span>
                </Inline>
                <Inline gap="gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-intent-success" />
                  <span className="text-xs text-text-muted">
                    3 of 5 emails sent
                  </span>
                </Inline>
              </Stack>
            </Section>
          </Stack>
        </PageGrid>
      )}

      {tab === "activity" && (
        <Card>
          <CardContent>
            <Timeline
              items={related.map((a) => ({
                id: a.id,
                title: a.summary,
                description: a.body,
                occurredAt: a.when,
                intent: activityIntent(a.kind),
                icon: activityIcon(a.kind),
              }))}
            />
          </CardContent>
        </Card>
      )}

      {tab === "deals" && <ContactDealsTab contactName={contact.name} />}

      {tab === "notes" && <ContactNotesTab contactId={contact.id} />}

      {tab === "files" && (
        <ContactFilesTab
          files={files.data}
          loading={files.loading}
          onUpload={async (file) => {
            await uploadFile(file, { resource: "crm.contact", recordId: contact.id });
            files.reload();
          }}
        />
      )}
    </Stack>
  );
}

/* --- Contact detail sub-tabs (live-data) --------------------------------- */

function ContactDealsTab({ contactName }: { contactName: string }) {
  const { data: DEALS } = useDeals();
  const related = DEALS.filter((d) => d.contact === contactName);
  if (related.length === 0) {
    return (
      <EmptyState
        title="No deals linked"
        description={`No deals list ${contactName} as the primary contact.`}
      />
    );
  }
  return (
    <Card>
      <CardContent className="p-0">
        <ul className="divide-y divide-border-subtle">
          {related.map((d) => (
            <li
              key={d.id}
              className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-surface-1 transition-colors"
              onClick={() => navigateTo(`/sales/deals/${d.id}`)}
            >
              <Stack gap="gap-0.5" className="flex-1 min-w-0">
                <Inline gap="gap-2">
                  <code className="font-mono text-xs text-text-muted">{d.code}</code>
                  <span className="text-sm font-medium text-text-primary truncate">
                    {d.name}
                  </span>
                </Inline>
                <span className="text-xs text-text-muted">
                  Closes {formatRelative(d.closeAt)}
                </span>
              </Stack>
              <Badge intent={dealBadgeIntent(d.stage)}>
                {d.stage.replace(/_/g, " ")}
              </Badge>
              <div className="w-24 text-right tabular-nums text-sm font-medium text-text-primary">
                {formatCurrency(d.amount)}
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function dealBadgeIntent(
  stage: string,
): "neutral" | "info" | "warning" | "success" | "danger" {
  switch (stage) {
    case "qualify":
      return "neutral";
    case "proposal":
      return "info";
    case "negotiate":
      return "warning";
    case "won":
      return "success";
    case "lost":
      return "danger";
    default:
      return "neutral";
  }
}

function ContactNotesTab({ contactId }: { contactId: string }) {
  const { data: notes } = useCrmNotes();
  const runtime = useRuntime();
  const [draft, setDraft] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const scoped = notes.filter((n) => n.contactId === contactId);

  const addNote = async () => {
    if (!draft.trim()) return;
    setBusy(true);
    try {
      await runtime.actions.create("crm.note", {
        contactId,
        author: "You",
        body: draft.trim(),
        createdAt: new Date().toISOString(),
      });
      setDraft("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Stack>
      <Card>
        <CardContent className="pt-4">
          <Stack gap="gap-2">
            <Textarea
              rows={3}
              placeholder="Add a note to this contact…"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
            <Inline className="justify-end">
              <Button
                variant="primary"
                size="sm"
                loading={busy}
                disabled={!draft.trim()}
                onClick={addNote}
              >
                Post note
              </Button>
            </Inline>
          </Stack>
        </CardContent>
      </Card>
      {scoped.length === 0 ? (
        <EmptyState
          title="No notes yet"
          description="Add the first note using the composer above."
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y divide-border-subtle">
              {scoped
                .slice()
                .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
                .map((n) => (
                  <li key={n.id} className="p-4">
                    <Inline gap="gap-2" className="mb-1">
                      <Avatar name={n.author} size="sm" />
                      <span className="text-sm font-medium text-text-primary">
                        {n.author}
                      </span>
                      <span className="text-xs text-text-muted">
                        {formatRelative(n.createdAt)}
                      </span>
                    </Inline>
                    <div className="text-sm text-text-primary whitespace-pre-wrap">
                      {n.body}
                    </div>
                  </li>
                ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </Stack>
  );
}

function ContactFilesTab({
  files,
  loading,
  onUpload,
}: {
  files: ReturnType<typeof useRecordFiles>["data"];
  loading: boolean;
  onUpload: (file: File) => Promise<void>;
}) {
  const [dragging, setDragging] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleUpload = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      await onUpload(file);
    } catch (err) {
      setError(err instanceof Error ? err.message : "upload failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Stack>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const f = e.dataTransfer.files?.[0];
          if (f) void handleUpload(f);
        }}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
          dragging
            ? "border-accent bg-accent-subtle/30"
            : "border-border bg-surface-1 hover:border-border-strong",
        )}
      >
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleUpload(f);
          }}
        />
        <div className="text-sm text-text-primary font-medium">
          {busy ? "Uploading…" : "Drop file here or click to upload"}
        </div>
        <div className="text-xs text-text-muted mt-1">
          Attached files are stored on the backend and linked to this contact.
        </div>
        {error && (
          <div className="text-xs text-intent-danger mt-2">{error}</div>
        )}
      </div>

      {loading && files.length === 0 ? (
        <LoadingShell />
      ) : files.length === 0 ? (
        <EmptyState title="No files yet" description="Upload the first one." />
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y divide-border-subtle">
              {files.map((f) => (
                <li
                  key={f.id}
                  className="flex items-center gap-3 px-4 py-2.5"
                >
                  <MessageCircle className="h-4 w-4 text-text-muted" />
                  <Stack gap="gap-0.5" className="flex-1">
                    <span className="text-sm text-text-primary">{f.name}</span>
                    <span className="text-xs text-text-muted">
                      {humanBytes(f.sizeBytes)} · uploaded by {f.owner} ·{" "}
                      {formatRelative(f.uploadedAt)}
                    </span>
                  </Stack>
                  <a href={f.url} target="_blank" rel="noreferrer">
                    <Button size="sm" variant="ghost" type="button">
                      Download
                    </Button>
                  </a>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </Stack>
  );
}

/* ========================================================================
 * Helpers
 * ======================================================================== */

function useRouteId(): string | undefined {
  const [hash, setHash] = React.useState(() =>
    typeof window === "undefined" ? "" : window.location.hash.slice(1),
  );
  React.useEffect(() => {
    const on = () => setHash(window.location.hash.slice(1));
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  const parts = hash.replace(/^\/+/, "").split("/");
  // paths look like /contacts/:id — return last segment if it's an id-like.
  const last = parts[parts.length - 1];
  return last && last !== "contacts" ? last : undefined;
}

function groupTop(vals: readonly string[], n: number) {
  const map = new Map<string, number>();
  for (const v of vals) map.set(v, (map.get(v) ?? 0) + 1);
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([key, count]) => ({ key, count }));
}

function groupByDay(items: readonly ActivityItem[]) {
  const buckets = new Map<string, ActivityItem[]>();
  for (const a of items) {
    const d = new Date(a.when);
    const key = isSameDay(d, new Date())
      ? "Today"
      : isSameDay(d, new Date(Date.now() - 86400_000))
        ? "Yesterday"
        : d.toLocaleDateString(undefined, {
            weekday: "long",
            month: "short",
            day: "numeric",
          });
    const arr = buckets.get(key) ?? [];
    arr.push(a);
    buckets.set(key, arr);
  }
  return Array.from(buckets.entries()).map(([label, items]) => ({ label, items }));
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function activityIntent(k: ActivityItem["kind"]) {
  switch (k) {
    case "call":
      return "success" as const;
    case "email":
      return "info" as const;
    case "meeting":
      return "accent" as const;
    case "note":
      return "warning" as const;
    case "task":
      return "neutral" as const;
  }
}

function LoadingShell() {
  return (
    <div className="h-full w-full flex items-center justify-center gap-2 text-sm text-text-muted py-16">
      <Spinner size={14} />
      Loading…
    </div>
  );
}

function activityIcon(k: ActivityItem["kind"]) {
  const cls = "h-3.5 w-3.5";
  switch (k) {
    case "call":
      return <Phone className={cls} />;
    case "email":
      return <Mail className={cls} />;
    case "meeting":
      return <CalendarPlus className={cls} />;
    case "note":
      return <StickyNote className={cls} />;
    case "task":
      return <CheckCircle2 className={cls} />;
  }
}
