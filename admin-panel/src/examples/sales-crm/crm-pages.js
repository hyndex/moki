import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import * as React from "react";
import { Mail, Phone, CalendarPlus, StickyNote, MoreHorizontal, UserPlus, Search, Download, Tag, TrendingUp, ArrowUpRight, Star, Clock, MessageCircle, CheckCircle2, Plus, Filter, } from "lucide-react";
import { defineCustomView } from "@/builders";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, } from "@/admin-primitives/Card";
import { PageGrid, Col, Section, Inline, Stack, } from "@/admin-primitives/PageLayout";
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
import { STAGES, stageIntent, stageLabel, } from "./data";
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
    render: () => _jsx(CrmOverviewPage, {}),
});
function CrmOverviewPage() {
    const { data: contacts, loading: contactsLoading } = useContacts();
    const { data: activities } = useActivities();
    if (contactsLoading && contacts.length === 0)
        return _jsx(LoadingShell, {});
    {
        const CONTACTS = contacts;
        const ACTIVITIES = activities;
        const total = CONTACTS.length;
        const vips = CONTACTS.filter((c) => c.vip).length;
        const stale = CONTACTS.filter((c) => {
            const days = (Date.now() - new Date(c.lastActivityAt).getTime()) / 86400_000;
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
        const companyCounts = groupTop(CONTACTS.map((c) => c.company), 5);
        const recent = CONTACTS.slice(0, 8);
        const activity = ACTIVITIES.slice(0, 8).map((a) => ({
            id: a.id,
            title: a.summary,
            description: a.body,
            occurredAt: a.when,
            intent: activityIntent(a.kind),
            icon: activityIcon(a.kind),
        }));
        return (_jsxs(Stack, { children: [_jsx(PageHeader, { title: "CRM overview", description: "How your pipeline is moving this week.", actions: _jsxs(_Fragment, { children: [_jsx(Button, { variant: "ghost", size: "sm", iconLeft: _jsx(Download, { className: "h-3.5 w-3.5" }), children: "Export" }), _jsx(Button, { variant: "primary", size: "sm", iconLeft: _jsx(UserPlus, { className: "h-3.5 w-3.5" }), onClick: () => navigateTo("/contacts/new"), children: "New contact" })] }) }), _jsxs(PageGrid, { columns: 4, children: [_jsx(StatCard, { label: "Contacts", value: total.toLocaleString(), trend: { value: 9, positive: true, label: "vs last mo" }, spark: [34, 38, 41, 39, 44, 48, 52, 57, 60, 64, 66, total], sparkColor: "rgb(var(--accent))" }), _jsx(StatCard, { label: "New this week", value: thisWeek, trend: { value: 14, positive: true }, intent: "success", icon: _jsx(UserPlus, { className: "h-3 w-3" }) }), _jsx(StatCard, { label: "VIPs", value: vips, secondary: `${Math.round((vips / total) * 100)}% of book`, intent: "warning", icon: _jsx(Star, { className: "h-3 w-3" }) }), _jsx(StatCard, { label: "Stale \u226520d", value: stale, trend: { value: 3, positive: false, label: "vs last wk" }, intent: "danger", icon: _jsx(Clock, { className: "h-3 w-3" }) })] }), _jsxs(PageGrid, { columns: 3, children: [_jsx(Col, { span: 2, children: _jsxs(Card, { children: [_jsxs(CardHeader, { children: [_jsxs("div", { children: [_jsx(CardTitle, { children: "Recent contacts" }), _jsx(CardDescription, { children: "Added or updated in the last 30 days." })] }), _jsx(Button, { size: "sm", variant: "ghost", iconRight: _jsx(ArrowUpRight, { className: "h-3 w-3" }), onClick: () => navigateTo("/contacts"), children: "View all" })] }), _jsx(CardContent, { className: "p-0", children: _jsx("ul", { className: "divide-y divide-border-subtle", children: recent.map((c) => (_jsx("li", { children: _jsxs("button", { type: "button", onClick: () => navigateTo(`/contacts/${c.id}`), className: "w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-surface-1 transition-colors", children: [_jsx(Avatar, { name: c.name, size: "md" }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "text-sm font-medium text-text-primary truncate", children: c.name }), c.vip && _jsx(Badge, { intent: "warning", children: "VIP" })] }), _jsxs("div", { className: "text-xs text-text-muted truncate", children: [c.title, " \u00B7 ", c.company] })] }), _jsxs("div", { className: "flex items-center gap-3 shrink-0", children: [_jsx(Sparkline, { data: c.activityTrend ?? [], width: 80, height: 22 }), _jsx(Badge, { intent: stageIntent(c.stage), children: stageLabel(c.stage) }), _jsx("span", { className: "text-xs text-text-muted w-24 text-right tabular-nums", children: formatRelative(c.lastActivityAt) })] })] }) }, c.id))) }) })] }) }), _jsxs(Stack, { children: [_jsxs(Card, { children: [_jsx(CardHeader, { children: _jsx("div", { children: _jsx(CardTitle, { children: "Stages" }) }) }), _jsx(CardContent, { children: _jsx(Donut, { data: stageCounts, centerLabel: _jsxs("div", { children: [_jsx("div", { className: "text-xl font-semibold text-text-primary", children: total }), _jsx("div", { className: "text-xs text-text-muted", children: "contacts" })] }) }) })] }), _jsxs(Card, { children: [_jsx(CardHeader, { children: _jsx("div", { children: _jsx(CardTitle, { children: "Top companies" }) }) }), _jsx(CardContent, { className: "p-0", children: _jsx("ul", { className: "divide-y divide-border-subtle", children: companyCounts.map((c) => (_jsxs("li", { className: "flex items-center gap-2 px-4 py-2 text-sm", children: [_jsx(Avatar, { name: c.key, size: "sm" }), _jsx("span", { className: "flex-1 min-w-0 truncate text-text-primary", children: c.key }), _jsx("span", { className: "text-text-muted tabular-nums", children: c.count })] }, c.key))) }) })] })] })] }), _jsxs(PageGrid, { columns: 2, children: [_jsxs(Card, { children: [_jsx(CardHeader, { children: _jsx("div", { children: _jsx(CardTitle, { children: "Activity \u2014 last 7 days" }) }) }), _jsx(CardContent, { children: _jsx(BarChart, { data: [
                                            { label: "Mon", value: 14 },
                                            { label: "Tue", value: 22 },
                                            { label: "Wed", value: 28 },
                                            { label: "Thu", value: 19 },
                                            { label: "Fri", value: 12 },
                                            { label: "Sat", value: 4 },
                                            { label: "Sun", value: 2 },
                                        ], height: 160 }) })] }), _jsxs(Card, { children: [_jsxs(CardHeader, { children: [_jsxs("div", { children: [_jsx(CardTitle, { children: "Latest activity" }), _jsx(CardDescription, { children: "Across every contact." })] }), _jsx(Button, { size: "sm", variant: "ghost", iconRight: _jsx(ArrowUpRight, { className: "h-3 w-3" }), onClick: () => navigateTo("/contacts/activity"), children: "See all" })] }), _jsx(CardContent, { children: _jsx(Timeline, { items: activity }) })] })] })] }));
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
    render: () => _jsx(ContactsList, {}),
});
function ContactsList() {
    const { data: CONTACTS, loading } = useContacts();
    const [filter, setFilter] = React.useState("all");
    const [search, setSearch] = React.useState("");
    const [selected, setSelected] = React.useState(new Set());
    if (loading && CONTACTS.length === 0)
        return _jsx(LoadingShell, {});
    const filters = [
        { id: "all", label: "All", count: CONTACTS.length },
        { id: "vip", label: "VIPs", count: CONTACTS.filter((c) => c.vip).length },
        {
            id: "stale",
            label: "Stale",
            count: CONTACTS.filter((c) => (Date.now() - new Date(c.lastActivityAt).getTime()) / 86400_000 > 20).length,
        },
        {
            id: "recent",
            label: "Recent",
            count: CONTACTS.filter((c) => (Date.now() - new Date(c.createdAt).getTime()) / 86400_000 < 14).length,
        },
    ];
    const filtered = CONTACTS.filter((c) => {
        if (filter === "vip" && !c.vip)
            return false;
        if (filter === "stale") {
            const days = (Date.now() - new Date(c.lastActivityAt).getTime()) / 86400_000;
            if (days < 20)
                return false;
        }
        if (filter === "recent") {
            const days = (Date.now() - new Date(c.createdAt).getTime()) / 86400_000;
            if (days > 14)
                return false;
        }
        if (search) {
            const q = search.toLowerCase();
            return (c.name.toLowerCase().includes(q) ||
                c.company.toLowerCase().includes(q) ||
                c.email.toLowerCase().includes(q));
        }
        return true;
    });
    const allSelected = filtered.length > 0 && filtered.every((c) => selected.has(c.id));
    const toggleAll = () => {
        if (allSelected) {
            setSelected(new Set());
        }
        else
            setSelected(new Set(filtered.map((c) => c.id)));
    };
    return (_jsxs(Stack, { children: [_jsx(PageHeader, { title: "Contacts", description: `${filtered.length} of ${CONTACTS.length} contacts`, actions: _jsxs(_Fragment, { children: [_jsx(Button, { variant: "ghost", size: "sm", iconLeft: _jsx(Download, { className: "h-3.5 w-3.5" }), children: "Export" }), _jsx(Button, { variant: "primary", size: "sm", iconLeft: _jsx(UserPlus, { className: "h-3.5 w-3.5" }), onClick: () => navigateTo("/contacts/new"), children: "New contact" })] }) }), _jsxs(Inline, { gap: "gap-3", wrap: true, children: [_jsx(QuickFilterBar, { filters: filters, active: filter, onChange: setFilter }), _jsx("div", { className: "min-w-[220px] flex-1 max-w-sm", children: _jsx(Input, { placeholder: "Search name, company, email\u2026", prefix: _jsx(Search, { className: "h-3.5 w-3.5" }), value: search, onChange: (e) => setSearch(e.target.value) }) }), _jsx(Button, { variant: "ghost", size: "sm", iconLeft: _jsx(Filter, { className: "h-3.5 w-3.5" }), children: "Filters" })] }), selected.size > 0 && (_jsxs("div", { className: "flex items-center gap-2 rounded-md bg-accent-subtle/60 border border-accent/30 px-3 py-2", children: [_jsxs("span", { className: "text-sm text-accent font-medium", children: [selected.size, " selected"] }), _jsx("span", { className: "flex-1" }), _jsx(Button, { size: "sm", variant: "secondary", iconLeft: _jsx(Mail, { className: "h-3.5 w-3.5" }), children: "Email" }), _jsx(Button, { size: "sm", variant: "secondary", iconLeft: _jsx(Tag, { className: "h-3.5 w-3.5" }), children: "Tag" }), _jsx(Button, { size: "sm", variant: "secondary", iconLeft: _jsx(Star, { className: "h-3.5 w-3.5" }), children: "Mark VIP" }), _jsx(Button, { size: "sm", variant: "ghost", onClick: () => setSelected(new Set()), children: "Clear" })] })), _jsx(Card, { children: _jsx(CardContent, { className: "p-0", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { className: "bg-surface-1 border-b border-border text-xs uppercase tracking-wider text-text-muted", children: _jsxs("tr", { children: [_jsx("th", { className: "w-9 pl-4", children: _jsx(Checkbox, { checked: allSelected
                                                    ? true
                                                    : filtered.some((c) => selected.has(c.id))
                                                        ? "indeterminate"
                                                        : false, onCheckedChange: toggleAll, "aria-label": "Select all" }) }), _jsx("th", { className: "text-left py-2 font-medium", children: "Name" }), _jsx("th", { className: "text-left py-2 font-medium", children: "Stage" }), _jsx("th", { className: "text-left py-2 font-medium", children: "Owner" }), _jsx("th", { className: "text-right py-2 font-medium", children: "LTV" }), _jsx("th", { className: "text-right py-2 font-medium pr-2", children: "Activity (12mo)" }), _jsx("th", { className: "text-right py-2 font-medium pr-4", children: "Last touch" })] }) }), _jsx("tbody", { children: filtered.length === 0 ? (_jsx("tr", { children: _jsx("td", { colSpan: 7, children: _jsx(EmptyState, { title: "No contacts match", description: "Try clearing your filters or searching for something else." }) }) })) : (filtered.map((c) => {
                                    const isSel = selected.has(c.id);
                                    return (_jsxs("tr", { className: cn("border-b border-border-subtle last:border-b-0 cursor-pointer transition-colors", isSel ? "bg-accent-subtle/40" : "hover:bg-surface-1"), onClick: (e) => {
                                            if (e.target.closest("[data-stop]"))
                                                return;
                                            navigateTo(`/contacts/${c.id}`);
                                        }, children: [_jsx("td", { className: "pl-4 py-2", "data-stop": true, children: _jsx(Checkbox, { checked: isSel, onCheckedChange: () => {
                                                        const next = new Set(selected);
                                                        isSel ? next.delete(c.id) : next.add(c.id);
                                                        setSelected(next);
                                                    } }) }), _jsx("td", { className: "py-2", children: _jsxs("div", { className: "flex items-center gap-2.5", children: [_jsx(Avatar, { name: c.name, size: "sm" }), _jsxs("div", { className: "min-w-0", children: [_jsxs("div", { className: "flex items-center gap-1.5", children: [_jsx("span", { className: "text-sm font-medium text-text-primary truncate", children: c.name }), c.vip && (_jsx(Star, { className: "h-3 w-3 fill-intent-warning text-intent-warning shrink-0", "aria-label": "VIP" }))] }), _jsxs("div", { className: "text-xs text-text-muted truncate", children: [c.title, " \u00B7 ", c.company] })] })] }) }), _jsx("td", { className: "py-2", children: _jsx(Badge, { intent: stageIntent(c.stage), children: stageLabel(c.stage) }) }), _jsx("td", { className: "py-2 text-text-secondary", children: c.owner }), _jsx("td", { className: "py-2 text-right tabular-nums text-text-primary", children: formatCurrency(c.lifetimeValue) }), _jsx("td", { className: "py-2 pr-2 text-right", children: _jsx(Sparkline, { data: c.activityTrend ?? [], width: 80, height: 22 }) }), _jsx("td", { className: "py-2 pr-4 text-right text-xs text-text-muted", children: formatRelative(c.lastActivityAt) })] }, c.id));
                                })) })] }) }) })] }));
}
/* ========================================================================
 * Pipeline — stage totals, weighted value, richer cards.
 * ======================================================================== */
export const crmPipelineView = defineCustomView({
    id: "crm.pipeline.view",
    title: "Pipeline",
    description: "Contacts grouped by lifecycle stage.",
    resource: "crm.contact",
    render: () => _jsx(CrmPipelinePage, {}),
});
function CrmPipelinePage() {
    const { data: CONTACTS, loading } = useContacts();
    if (loading && CONTACTS.length === 0)
        return _jsx(LoadingShell, {});
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
        return (_jsxs(Stack, { children: [_jsx(PageHeader, { title: "Contact pipeline", description: "Every contact's stage + LTV.", actions: _jsx(Button, { variant: "secondary", size: "sm", iconLeft: _jsx(Filter, { className: "h-3.5 w-3.5" }), children: "Filters" }) }), _jsx(PageGrid, { columns: 4, children: columns.map((c) => (_jsx(StatCard, { label: c.title, value: c.items.length, secondary: formatCurrency(c.total), intent: c.intent === "success" ? "success" : c.intent === "danger" ? "danger" : c.intent === "info" ? "info" : "neutral" }, c.id))) }), _jsx(LiveDnDKanban, { resource: "crm.contact", statusField: "stage", columns: columns.map((c) => ({
                        id: c.id,
                        title: `${c.title} · ${c.items.length}`,
                        intent: c.intent,
                    })), onCardClick: (c) => navigateTo(`/contacts/${c.id}`), renderCard: (c) => (_jsxs("div", { children: [_jsxs(Inline, { gap: "gap-2", children: [_jsx(Avatar, { name: c.name, size: "sm" }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsx("div", { className: "text-sm font-medium text-text-primary truncate", children: c.name }), _jsx("div", { className: "text-xs text-text-muted truncate", children: c.company })] }), c.vip && _jsx(Star, { className: "h-3.5 w-3.5 fill-intent-warning text-intent-warning" })] }), _jsxs(Inline, { gap: "gap-2", className: "mt-2 justify-between", children: [_jsx(Badge, { intent: "accent", children: formatCurrency(c.lifetimeValue) }), _jsx("span", { className: "text-xs text-text-muted", children: c.owner })] })] })) }), _jsxs("div", { className: "text-xs text-text-muted text-right pr-2", children: ["Total book value: ", _jsx("span", { className: "font-semibold tabular-nums text-text-primary", children: formatCurrency(grand) })] })] }));
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
    render: () => _jsx(ActivityStream, {}),
});
function ActivityStream() {
    const { data: ACTIVITIES, loading } = useActivities();
    const { data: CONTACTS } = useContacts();
    const [tab, setTab] = React.useState("all");
    const [note, setNote] = React.useState("");
    const [posted, setPosted] = React.useState([]);
    if (loading && ACTIVITIES.length === 0)
        return _jsx(LoadingShell, {});
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
        if (!note.trim())
            return;
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
    return (_jsxs(Stack, { children: [_jsx(PageHeader, { title: "Activity", description: "Every interaction, newest first." }), _jsx(Card, { children: _jsx(CardContent, { className: "pt-4", children: _jsxs(Inline, { gap: "gap-2", align: "start", children: [_jsx(Avatar, { name: "You", size: "md" }), _jsxs(Stack, { gap: "gap-2", className: "flex-1", children: [_jsx(Textarea, { placeholder: "Add a quick note \u2014 it'll appear against the first contact in your book.", rows: 2, value: note, onChange: (e) => setNote(e.target.value) }), _jsxs(Inline, { gap: "gap-2", className: "justify-between", children: [_jsxs(Inline, { gap: "gap-1", children: [_jsx(Button, { variant: "ghost", size: "xs", iconLeft: _jsx(Mail, { className: "h-3 w-3" }), children: "Email" }), _jsx(Button, { variant: "ghost", size: "xs", iconLeft: _jsx(Phone, { className: "h-3 w-3" }), children: "Call" }), _jsx(Button, { variant: "ghost", size: "xs", iconLeft: _jsx(CalendarPlus, { className: "h-3 w-3" }), children: "Meeting" }), _jsx(Button, { variant: "ghost", size: "xs", iconLeft: _jsx(StickyNote, { className: "h-3 w-3" }), children: "Note" })] }), _jsx(Button, { size: "sm", variant: "primary", onClick: addNote, disabled: !note.trim(), children: "Post" })] })] })] }) }) }), _jsx(TabBar, { tabs: tabs, active: tab, onChange: setTab }), _jsx(Stack, { gap: "gap-5", children: grouped.map((g) => (_jsx(Section, { title: g.label, bare: true, children: _jsx(Timeline, { items: g.items.map((a) => ({
                            id: a.id,
                            title: (_jsxs("span", { children: [_jsx("span", { className: "font-medium text-text-primary", children: a.rep }), " · ", a.summary] })),
                            description: a.body,
                            occurredAt: a.when,
                            intent: activityIntent(a.kind),
                            icon: activityIcon(a.kind),
                        })) }) }, g.label))) })] }));
}
/* ========================================================================
 * Segments — saved filtered views.
 * ======================================================================== */
export const crmSegmentsView = defineCustomView({
    id: "crm.segments.view",
    title: "Segments",
    description: "Saved groups of contacts.",
    resource: "crm.contact",
    render: () => _jsx(CrmSegmentsPage, {}),
});
function CrmSegmentsPage() {
    const { data: CONTACTS, loading } = useContacts();
    if (loading && CONTACTS.length === 0)
        return _jsx(LoadingShell, {});
    {
        const segments = [
            {
                id: "vip",
                name: "VIPs",
                description: "Accounts flagged as strategically important.",
                count: CONTACTS.filter((c) => c.vip).length,
                intent: "warning",
                icon: _jsx(Star, { className: "h-4 w-4" }),
            },
            {
                id: "stale",
                name: "Stale (>20d)",
                description: "No activity in three weeks or more.",
                count: CONTACTS.filter((c) => (Date.now() - new Date(c.lastActivityAt).getTime()) / 86400_000 > 20).length,
                intent: "danger",
                icon: _jsx(Clock, { className: "h-4 w-4" }),
            },
            {
                id: "new",
                name: "New this quarter",
                description: "Created in the last 90 days.",
                count: CONTACTS.filter((c) => (Date.now() - new Date(c.createdAt).getTime()) / 86400_000 < 90).length,
                intent: "success",
                icon: _jsx(UserPlus, { className: "h-4 w-4" }),
            },
            {
                id: "enterprise",
                name: "Enterprise",
                description: "Tagged enterprise in the past 180 days.",
                count: CONTACTS.filter((c) => (c.tags ?? []).includes("enterprise")).length,
                intent: "info",
                icon: _jsx(TrendingUp, { className: "h-4 w-4" }),
            },
            {
                id: "high-ltv",
                name: "LTV ≥ $50K",
                description: "High lifetime-value accounts.",
                count: CONTACTS.filter((c) => c.lifetimeValue >= 50_000).length,
                intent: "accent",
                icon: _jsx(Tag, { className: "h-4 w-4" }),
            },
        ];
        return (_jsxs(Stack, { children: [_jsx(PageHeader, { title: "Segments", description: "Reusable, saved slices of your book.", actions: _jsx(Button, { variant: "primary", size: "sm", iconLeft: _jsx(Plus, { className: "h-3.5 w-3.5" }), children: "New segment" }) }), _jsx(PageGrid, { columns: 3, children: segments.map((s) => (_jsx(Card, { className: "hover:border-accent transition-colors cursor-pointer", children: _jsxs(CardContent, { className: "pt-4", children: [_jsxs(Inline, { gap: "gap-2", className: "mb-2", children: [_jsx("div", { className: cn("w-8 h-8 rounded-md flex items-center justify-center", s.intent === "warning" && "bg-intent-warning-bg text-intent-warning", s.intent === "danger" && "bg-intent-danger-bg text-intent-danger", s.intent === "success" && "bg-intent-success-bg text-intent-success", s.intent === "info" && "bg-intent-info-bg text-intent-info", s.intent === "accent" && "bg-accent-subtle text-accent"), children: s.icon }), _jsxs(Stack, { gap: "gap-0.5", className: "flex-1", children: [_jsx("div", { className: "text-sm font-semibold text-text-primary", children: s.name }), _jsx("div", { className: "text-xs text-text-muted", children: s.description })] })] }), _jsxs(Inline, { className: "justify-between", children: [_jsx(AvatarGroup, { names: CONTACTS.slice(0, 4).map((c) => c.name), size: "xs" }), _jsx("div", { className: "text-lg font-semibold tabular-nums text-text-primary", children: s.count })] })] }) }, s.id))) })] }));
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
    render: () => _jsx(ContactDetailPage, {}),
});
function ContactDetailPage() {
    const { data: CONTACTS, loading } = useContacts();
    const { data: ACTIVITIES } = useActivities();
    const { data: DEALS } = useDeals();
    const { data: NOTES } = useCrmNotes();
    const id = useRouteId();
    const files = useRecordFiles("crm.contact", id);
    const [tab, setTab] = React.useState("overview");
    if (loading && CONTACTS.length === 0)
        return _jsx(LoadingShell, {});
    const contact = CONTACTS.find((c) => c.id === id) ?? CONTACTS[0];
    if (!contact) {
        return (_jsx(EmptyState, { title: "Contact not found", description: `No contact with id "${id}".` }));
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
    return (_jsxs(Stack, { children: [_jsx(DetailHeader, { avatar: { name: contact.name }, title: _jsxs("span", { className: "inline-flex items-center gap-2", children: [contact.name, contact.vip && (_jsxs(Badge, { intent: "warning", children: [_jsx(Star, { className: "h-3 w-3 mr-0.5" }), " VIP"] }))] }), subtitle: `${contact.title} · ${contact.company}`, badges: _jsx(Badge, { intent: stageIntent(contact.stage), children: stageLabel(contact.stage) }), meta: _jsxs(_Fragment, { children: [_jsxs("span", { className: "inline-flex items-center gap-1", children: [_jsx(Mail, { className: "h-3 w-3" }), " ", contact.email] }), _jsxs("span", { className: "inline-flex items-center gap-1", children: [_jsx(Phone, { className: "h-3 w-3" }), " ", contact.phone] }), _jsxs("span", { className: "inline-flex items-center gap-1", children: [_jsx(Clock, { className: "h-3 w-3" }), " Last touch ", daysSinceTouch, "d ago"] }), _jsxs("span", { className: "inline-flex items-center gap-1", children: ["Owner: ", _jsx("span", { className: "text-text-primary", children: contact.owner })] })] }), actions: _jsxs(_Fragment, { children: [_jsx(Button, { variant: "ghost", size: "sm", iconLeft: _jsx(Mail, { className: "h-3.5 w-3.5" }), children: "Email" }), _jsx(Button, { variant: "ghost", size: "sm", iconLeft: _jsx(Phone, { className: "h-3.5 w-3.5" }), children: "Call" }), _jsx(Button, { variant: "ghost", size: "sm", iconLeft: _jsx(CalendarPlus, { className: "h-3.5 w-3.5" }), children: "Meeting" }), _jsx(Button, { variant: "secondary", size: "sm", iconLeft: _jsx(MoreHorizontal, { className: "h-3.5 w-3.5" }), children: "More" })] }) }), _jsx(TabBar, { tabs: tabs, active: tab, onChange: setTab }), tab === "overview" && (_jsxs(PageGrid, { columns: 3, children: [_jsx(Col, { span: 2, children: _jsxs(Stack, { children: [_jsx(Section, { title: "About", children: _jsx(PropertyList, { columns: 2, items: [
                                            { label: "Email", value: _jsx("a", { href: `mailto:${contact.email}`, className: "text-text-link hover:underline", children: contact.email }) },
                                            { label: "Phone", value: contact.phone },
                                            { label: "Company", value: contact.company },
                                            { label: "Title", value: contact.title },
                                            { label: "Stage", value: _jsx(Badge, { intent: stageIntent(contact.stage), children: stageLabel(contact.stage) }) },
                                            { label: "Owner", value: contact.owner },
                                            { label: "LTV", value: formatCurrency(contact.lifetimeValue) },
                                            { label: "Created", value: formatRelative(contact.createdAt) },
                                        ] }) }), _jsx(Section, { title: "Tags", actions: _jsx(Button, { size: "xs", variant: "ghost", iconLeft: _jsx(Plus, { className: "h-3 w-3" }), children: "Add tag" }), children: _jsx(Inline, { wrap: true, gap: "gap-1.5", children: (contact.tags ?? []).map((t) => (_jsxs(Badge, { intent: "neutral", children: ["#", t] }, t))) }) }), _jsx(Section, { title: "Recent activity", children: _jsx(Timeline, { items: related.slice(0, 5).map((a) => ({
                                            id: a.id,
                                            title: a.summary,
                                            description: a.body,
                                            occurredAt: a.when,
                                            intent: activityIntent(a.kind),
                                            icon: activityIcon(a.kind),
                                        })) }) })] }) }), _jsxs(Stack, { children: [_jsx(Card, { children: _jsx(CardContent, { className: "pt-4", children: _jsxs(Stack, { gap: "gap-3", children: [_jsx(StatCard, { label: "Activity (12 months)", value: (contact.activityTrend ?? []).reduce((a, b) => a + b, 0), spark: contact.activityTrend ?? [], intent: "accent" }), _jsx(StatCard, { label: "Lifetime value", value: formatCurrency(contact.lifetimeValue), intent: "success" })] }) }) }), _jsx(Section, { title: "Team", children: _jsxs(Stack, { gap: "gap-2", children: [_jsxs(Inline, { gap: "gap-2", children: [_jsx(Avatar, { name: contact.owner, size: "sm" }), _jsxs(Stack, { gap: "gap-0.5", children: [_jsx("span", { className: "text-sm font-medium text-text-primary", children: contact.owner }), _jsx("span", { className: "text-xs text-text-muted", children: "Owner" })] })] }), _jsxs(Inline, { gap: "gap-2", children: [_jsx(AvatarGroup, { names: ["Taylor Nguyen", "Jordan Park", "Casey Morgan"], size: "sm" }), _jsx("span", { className: "text-xs text-text-muted", children: "Watchers" })] })] }) }), _jsx(Section, { title: "Automation", children: _jsxs(Stack, { gap: "gap-2", children: [_jsxs(Inline, { gap: "gap-2", children: [_jsx(StatusDot, { intent: "success" }), _jsx("span", { className: "text-sm text-text-primary", children: "Enrolled in onboarding sequence" })] }), _jsxs(Inline, { gap: "gap-2", children: [_jsx(CheckCircle2, { className: "h-3.5 w-3.5 text-intent-success" }), _jsx("span", { className: "text-xs text-text-muted", children: "3 of 5 emails sent" })] })] }) })] })] })), tab === "activity" && (_jsx(Card, { children: _jsx(CardContent, { children: _jsx(Timeline, { items: related.map((a) => ({
                            id: a.id,
                            title: a.summary,
                            description: a.body,
                            occurredAt: a.when,
                            intent: activityIntent(a.kind),
                            icon: activityIcon(a.kind),
                        })) }) }) })), tab === "deals" && _jsx(ContactDealsTab, { contactName: contact.name }), tab === "notes" && _jsx(ContactNotesTab, { contactId: contact.id }), tab === "files" && (_jsx(ContactFilesTab, { files: files.data, loading: files.loading, onUpload: async (file) => {
                    await uploadFile(file, { resource: "crm.contact", recordId: contact.id });
                    files.reload();
                } }))] }));
}
/* --- Contact detail sub-tabs (live-data) --------------------------------- */
function ContactDealsTab({ contactName }) {
    const { data: DEALS } = useDeals();
    const related = DEALS.filter((d) => d.contact === contactName);
    if (related.length === 0) {
        return (_jsx(EmptyState, { title: "No deals linked", description: `No deals list ${contactName} as the primary contact.` }));
    }
    return (_jsx(Card, { children: _jsx(CardContent, { className: "p-0", children: _jsx("ul", { className: "divide-y divide-border-subtle", children: related.map((d) => (_jsxs("li", { className: "flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-surface-1 transition-colors", onClick: () => navigateTo(`/sales/deals/${d.id}`), children: [_jsxs(Stack, { gap: "gap-0.5", className: "flex-1 min-w-0", children: [_jsxs(Inline, { gap: "gap-2", children: [_jsx("code", { className: "font-mono text-xs text-text-muted", children: d.code }), _jsx("span", { className: "text-sm font-medium text-text-primary truncate", children: d.name })] }), _jsxs("span", { className: "text-xs text-text-muted", children: ["Closes ", formatRelative(d.closeAt)] })] }), _jsx(Badge, { intent: dealBadgeIntent(d.stage), children: d.stage.replace(/_/g, " ") }), _jsx("div", { className: "w-24 text-right tabular-nums text-sm font-medium text-text-primary", children: formatCurrency(d.amount) })] }, d.id))) }) }) }));
}
function dealBadgeIntent(stage) {
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
function ContactNotesTab({ contactId }) {
    const { data: notes } = useCrmNotes();
    const runtime = useRuntime();
    const [draft, setDraft] = React.useState("");
    const [busy, setBusy] = React.useState(false);
    const scoped = notes.filter((n) => n.contactId === contactId);
    const addNote = async () => {
        if (!draft.trim())
            return;
        setBusy(true);
        try {
            await runtime.actions.create("crm.note", {
                contactId,
                author: "You",
                body: draft.trim(),
                createdAt: new Date().toISOString(),
            });
            setDraft("");
        }
        finally {
            setBusy(false);
        }
    };
    return (_jsxs(Stack, { children: [_jsx(Card, { children: _jsx(CardContent, { className: "pt-4", children: _jsxs(Stack, { gap: "gap-2", children: [_jsx(Textarea, { rows: 3, placeholder: "Add a note to this contact\u2026", value: draft, onChange: (e) => setDraft(e.target.value) }), _jsx(Inline, { className: "justify-end", children: _jsx(Button, { variant: "primary", size: "sm", loading: busy, disabled: !draft.trim(), onClick: addNote, children: "Post note" }) })] }) }) }), scoped.length === 0 ? (_jsx(EmptyState, { title: "No notes yet", description: "Add the first note using the composer above." })) : (_jsx(Card, { children: _jsx(CardContent, { className: "p-0", children: _jsx("ul", { className: "divide-y divide-border-subtle", children: scoped
                            .slice()
                            .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
                            .map((n) => (_jsxs("li", { className: "p-4", children: [_jsxs(Inline, { gap: "gap-2", className: "mb-1", children: [_jsx(Avatar, { name: n.author, size: "sm" }), _jsx("span", { className: "text-sm font-medium text-text-primary", children: n.author }), _jsx("span", { className: "text-xs text-text-muted", children: formatRelative(n.createdAt) })] }), _jsx("div", { className: "text-sm text-text-primary whitespace-pre-wrap", children: n.body })] }, n.id))) }) }) }))] }));
}
function ContactFilesTab({ files, loading, onUpload, }) {
    const [dragging, setDragging] = React.useState(false);
    const [busy, setBusy] = React.useState(false);
    const [error, setError] = React.useState(null);
    const inputRef = React.useRef(null);
    const handleUpload = async (file) => {
        setBusy(true);
        setError(null);
        try {
            await onUpload(file);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "upload failed");
        }
        finally {
            setBusy(false);
        }
    };
    return (_jsxs(Stack, { children: [_jsxs("div", { onDragOver: (e) => {
                    e.preventDefault();
                    setDragging(true);
                }, onDragLeave: () => setDragging(false), onDrop: (e) => {
                    e.preventDefault();
                    setDragging(false);
                    const f = e.dataTransfer.files?.[0];
                    if (f)
                        void handleUpload(f);
                }, onClick: () => inputRef.current?.click(), className: cn("border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors", dragging
                    ? "border-accent bg-accent-subtle/30"
                    : "border-border bg-surface-1 hover:border-border-strong"), children: [_jsx("input", { ref: inputRef, type: "file", className: "hidden", onChange: (e) => {
                            const f = e.target.files?.[0];
                            if (f)
                                void handleUpload(f);
                        } }), _jsx("div", { className: "text-sm text-text-primary font-medium", children: busy ? "Uploading…" : "Drop file here or click to upload" }), _jsx("div", { className: "text-xs text-text-muted mt-1", children: "Attached files are stored on the backend and linked to this contact." }), error && (_jsx("div", { className: "text-xs text-intent-danger mt-2", children: error }))] }), loading && files.length === 0 ? (_jsx(LoadingShell, {})) : files.length === 0 ? (_jsx(EmptyState, { title: "No files yet", description: "Upload the first one." })) : (_jsx(Card, { children: _jsx(CardContent, { className: "p-0", children: _jsx("ul", { className: "divide-y divide-border-subtle", children: files.map((f) => (_jsxs("li", { className: "flex items-center gap-3 px-4 py-2.5", children: [_jsx(MessageCircle, { className: "h-4 w-4 text-text-muted" }), _jsxs(Stack, { gap: "gap-0.5", className: "flex-1", children: [_jsx("span", { className: "text-sm text-text-primary", children: f.name }), _jsxs("span", { className: "text-xs text-text-muted", children: [humanBytes(f.sizeBytes), " \u00B7 uploaded by ", f.owner, " \u00B7", " ", formatRelative(f.uploadedAt)] })] }), _jsx("a", { href: f.url, target: "_blank", rel: "noreferrer", children: _jsx(Button, { size: "sm", variant: "ghost", type: "button", children: "Download" }) })] }, f.id))) }) }) }))] }));
}
/* ========================================================================
 * Helpers
 * ======================================================================== */
function useRouteId() {
    const [hash, setHash] = React.useState(() => typeof window === "undefined" ? "" : window.location.hash.slice(1));
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
function groupTop(vals, n) {
    const map = new Map();
    for (const v of vals)
        map.set(v, (map.get(v) ?? 0) + 1);
    return Array.from(map.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, n)
        .map(([key, count]) => ({ key, count }));
}
function groupByDay(items) {
    const buckets = new Map();
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
function isSameDay(a, b) {
    return (a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate());
}
function activityIntent(k) {
    switch (k) {
        case "call":
            return "success";
        case "email":
            return "info";
        case "meeting":
            return "accent";
        case "note":
            return "warning";
        case "task":
            return "neutral";
    }
}
function LoadingShell() {
    return (_jsxs("div", { className: "h-full w-full flex items-center justify-center gap-2 text-sm text-text-muted py-16", children: [_jsx(Spinner, { size: 14 }), "Loading\u2026"] }));
}
function activityIcon(k) {
    const cls = "h-3.5 w-3.5";
    switch (k) {
        case "call":
            return _jsx(Phone, { className: cls });
        case "email":
            return _jsx(Mail, { className: cls });
        case "meeting":
            return _jsx(CalendarPlus, { className: cls });
        case "note":
            return _jsx(StickyNote, { className: cls });
        case "task":
            return _jsx(CheckCircle2, { className: cls });
    }
}
