import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import * as React from "react";
import { Users, Building2, Briefcase, UserCircle2, Search } from "lucide-react";
import { defineCustomView } from "@/builders";
import { PageHeader } from "@/admin-primitives/PageHeader";
import { DetailHeader } from "@/admin-primitives/DetailHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/admin-primitives/Card";
import { PageGrid, Section, Inline, Stack } from "@/admin-primitives/PageLayout";
import { StatCard } from "@/admin-primitives/StatCard";
import { PropertyList } from "@/admin-primitives/PropertyList";
import { TabBar } from "@/admin-primitives/TabBar";
import { Avatar } from "@/primitives/Avatar";
import { Badge } from "@/primitives/Badge";
import { Button } from "@/primitives/Button";
import { Input } from "@/primitives/Input";
import { useEdges, useEntities } from "./data-hooks";
import { Spinner } from "@/primitives/Spinner";
import { EmptyState } from "@/admin-primitives/EmptyState";
import { navigateTo } from "@/views/useRoute";
const KIND_COLOR = {
    company: "rgb(var(--accent))",
    person: "rgb(var(--intent-info))",
    vendor: "rgb(var(--intent-warning))",
    partner: "rgb(var(--intent-success))",
};
const KIND_ICON = {
    company: Building2,
    person: UserCircle2,
    vendor: Briefcase,
    partner: Users,
};
/* ------------------------------------------------------------------------ */
export const partyGraphView = defineCustomView({
    id: "party-relationships.graph.view",
    title: "Relationship graph",
    description: "Visualize how entities connect.",
    resource: "party-relationships.relationship",
    render: () => _jsx(GraphPage, {}),
});
function GraphPage() {
    const { data: ENTITIES, loading } = useEntities();
    const { data: EDGES } = useEdges();
    const [hover, setHover] = React.useState(null);
    if (loading && ENTITIES.length === 0)
        return _jsx(LoadingShell, {});
    const size = 480;
    const center = { x: size / 2, y: size / 2 };
    // Layout — put Gutu in the middle, others on a ring.
    const ring = ENTITIES.filter((e) => e.id !== "e_gutu");
    const positions = new Map();
    positions.set("e_gutu", center);
    ring.forEach((e, i) => {
        const angle = (i / ring.length) * Math.PI * 2 - Math.PI / 2;
        const r = 180;
        positions.set(e.id, {
            x: center.x + r * Math.cos(angle),
            y: center.y + r * Math.sin(angle),
        });
    });
    const counts = ["company", "person", "vendor", "partner"].map((k) => ({
        kind: k,
        count: ENTITIES.filter((e) => e.kind === k).length,
    }));
    return (_jsxs(Stack, { children: [_jsx(PageHeader, { title: "Relationship graph", description: `${ENTITIES.length} entities · ${EDGES.length} relationships.` }), _jsx(PageGrid, { columns: 4, children: counts.map(({ kind, count }) => {
                    const Icon = KIND_ICON[kind];
                    return (_jsx(StatCard, { label: kind, value: count, icon: _jsx(Icon, { className: "h-3 w-3" }) }, kind));
                }) }), _jsxs(PageGrid, { columns: 3, children: [_jsx("div", { className: "lg:col-span-2", children: _jsxs(Card, { children: [_jsx(CardHeader, { children: _jsx("div", { children: _jsx(CardTitle, { children: "Network" }) }) }), _jsx(CardContent, { children: _jsxs("svg", { viewBox: `0 0 ${size} ${size}`, width: "100%", className: "max-h-[520px]", role: "img", "aria-label": "Relationship graph", children: [EDGES.map((e) => {
                                                const from = positions.get(e.from);
                                                const to = positions.get(e.to);
                                                if (!from || !to)
                                                    return null;
                                                const highlighted = !hover || hover === e.from || hover === e.to;
                                                return (_jsx("line", { x1: from.x, y1: from.y, x2: to.x, y2: to.y, stroke: "rgb(var(--text-muted))", strokeWidth: 1 + e.strength, opacity: highlighted ? 0.6 : 0.1 }, e.id));
                                            }), ENTITIES.map((e) => {
                                                const p = positions.get(e.id);
                                                if (!p)
                                                    return null;
                                                const color = KIND_COLOR[e.kind];
                                                const focused = hover === e.id || !hover;
                                                return (_jsxs("g", { transform: `translate(${p.x} ${p.y})`, onMouseEnter: () => setHover(e.id), onMouseLeave: () => setHover(null), onClick: () => navigateTo(`/party-relationships/${e.id}`), style: { cursor: "pointer" }, children: [_jsx("circle", { r: e.id === "e_gutu" ? 22 : 14, fill: color, opacity: focused ? 1 : 0.4 }), _jsx("text", { y: e.id === "e_gutu" ? 38 : 28, textAnchor: "middle", fontSize: "10", className: "fill-text-secondary", opacity: focused ? 1 : 0.4, children: e.label })] }, e.id));
                                            })] }) })] }) }), _jsxs(Card, { children: [_jsx(CardHeader, { children: _jsx("div", { children: _jsx(CardTitle, { children: "Legend" }) }) }), _jsxs(CardContent, { children: [_jsx(Stack, { gap: "gap-2", children: ["company", "person", "vendor", "partner"].map((k) => {
                                            const Icon = KIND_ICON[k];
                                            return (_jsxs(Inline, { gap: "gap-2", children: [_jsx("span", { className: "w-3 h-3 rounded-full", style: { background: KIND_COLOR[k] } }), _jsx(Icon, { className: "h-3.5 w-3.5 text-text-muted" }), _jsx("span", { className: "text-sm capitalize text-text-primary", children: k }), _jsx("span", { className: "ml-auto text-xs text-text-muted", children: ENTITIES.filter((e) => e.kind === k).length })] }, k));
                                        }) }), _jsxs("div", { className: "mt-4 pt-3 border-t border-border-subtle", children: [_jsx("div", { className: "text-xs font-semibold uppercase tracking-wider text-text-muted mb-2", children: "Relationship types" }), _jsx(Inline, { gap: "gap-1", wrap: true, children: [...new Set(EDGES.map((e) => e.kind))].map((k) => (_jsx(Badge, { intent: "neutral", children: k }, k))) })] })] })] })] })] }));
}
/* ------------------------------------------------------------------------ */
export const partyListView = defineCustomView({
    id: "party-relationships.list.view",
    title: "Relationships",
    description: "All entities and their links.",
    resource: "party-relationships.relationship",
    render: () => _jsx(RelationshipsList, {}),
});
function RelationshipsList() {
    const { data: ENTITIES, loading } = useEntities();
    const { data: EDGES } = useEdges();
    const [tab, setTab] = React.useState("entities");
    const [search, setSearch] = React.useState("");
    if (loading && ENTITIES.length === 0)
        return _jsx(LoadingShell, {});
    const entities = ENTITIES.filter((e) => !search || e.label.toLowerCase().includes(search.toLowerCase()));
    const edges = EDGES.map((e) => ({
        ...e,
        fromLabel: ENTITIES.find((x) => x.id === e.from)?.label ?? e.from,
        toLabel: ENTITIES.find((x) => x.id === e.to)?.label ?? e.to,
    })).filter((e) => !search ||
        e.fromLabel.toLowerCase().includes(search.toLowerCase()) ||
        e.toLabel.toLowerCase().includes(search.toLowerCase()) ||
        e.kind.toLowerCase().includes(search.toLowerCase()));
    const tabs = [
        { id: "entities", label: "Entities", count: ENTITIES.length },
        { id: "edges", label: "Relationships", count: EDGES.length },
    ];
    return (_jsxs(Stack, { children: [_jsx(PageHeader, { title: "Party relationships", description: "Companies, people, vendors, and partners \u2014 and how they connect." }), _jsx(Inline, { gap: "gap-3", wrap: true, children: _jsx("div", { className: "max-w-sm flex-1 min-w-[220px]", children: _jsx(Input, { placeholder: "Search by label, kind\u2026", prefix: _jsx(Search, { className: "h-3.5 w-3.5" }), value: search, onChange: (e) => setSearch(e.target.value) }) }) }), _jsx(TabBar, { tabs: tabs, active: tab, onChange: (id) => setTab(id) }), tab === "entities" ? (_jsx(Card, { children: _jsx(CardContent, { className: "p-0", children: _jsx("ul", { className: "divide-y divide-border-subtle", children: entities.map((e) => {
                            const Icon = KIND_ICON[e.kind];
                            const edgesOut = EDGES.filter((x) => x.from === e.id).length;
                            const edgesIn = EDGES.filter((x) => x.to === e.id).length;
                            return (_jsxs("li", { className: "flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-surface-1 transition-colors", onClick: () => navigateTo(`/party-relationships/${e.id}`), children: [_jsx("div", { className: "w-8 h-8 rounded-md flex items-center justify-center shrink-0 text-white", style: { background: KIND_COLOR[e.kind] }, children: _jsx(Icon, { className: "h-4 w-4" }) }), _jsxs(Stack, { gap: "gap-0.5", className: "flex-1 min-w-0", children: [_jsx("span", { className: "text-sm font-medium text-text-primary truncate", children: e.label }), _jsxs("span", { className: "text-xs text-text-muted", children: [edgesOut + edgesIn, " links \u00B7 ", edgesOut, " out \u00B7 ", edgesIn, " in"] })] }), _jsx(Badge, { intent: "neutral", className: "capitalize", children: e.kind })] }, e.id));
                        }) }) }) })) : (_jsx(Card, { children: _jsx(CardContent, { className: "p-0", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { className: "border-b border-border bg-surface-1 text-xs uppercase tracking-wider text-text-muted", children: _jsxs("tr", { children: [_jsx("th", { className: "text-left px-4 py-2 font-medium", children: "From" }), _jsx("th", { className: "text-left py-2 font-medium", children: "Kind" }), _jsx("th", { className: "text-left py-2 font-medium", children: "To" }), _jsx("th", { className: "text-right py-2 font-medium pr-4", children: "Strength" })] }) }), _jsx("tbody", { children: edges.map((e) => (_jsxs("tr", { className: "border-b border-border-subtle last:border-b-0", children: [_jsx("td", { className: "px-4 py-2", children: _jsxs(Inline, { gap: "gap-2", children: [_jsx(Avatar, { name: e.fromLabel, size: "xs" }), _jsx("span", { className: "text-text-primary", children: e.fromLabel })] }) }), _jsx("td", { className: "py-2 text-text-secondary capitalize", children: _jsx(Badge, { intent: "accent", children: e.kind }) }), _jsx("td", { className: "py-2", children: _jsxs(Inline, { gap: "gap-2", children: [_jsx(Avatar, { name: e.toLabel, size: "xs" }), _jsx("span", { className: "text-text-primary", children: e.toLabel })] }) }), _jsx("td", { className: "py-2 pr-4 text-right", children: _jsx("div", { className: "inline-block w-20 h-1.5 rounded-full bg-surface-2 overflow-hidden align-middle", children: _jsx("div", { className: "h-full bg-accent", style: { width: `${e.strength * 100}%` } }) }) })] }, e.id))) })] }) }) }))] }));
}
/* ------------------------------------------------------------------------ */
export const partyEntityDetailView = defineCustomView({
    id: "party-relationships.entity-detail.view",
    title: "Entity",
    description: "Single entity and its graph neighborhood.",
    resource: "party-relationships.relationship",
    render: () => _jsx(EntityDetailPage, {}),
});
function EntityDetailPage() {
    const { data: ENTITIES, loading } = useEntities();
    const { data: EDGES } = useEdges();
    const id = useLastSegment();
    if (loading && ENTITIES.length === 0)
        return _jsx(LoadingShell, {});
    const entity = ENTITIES.find((e) => e.id === id) ?? ENTITIES[0];
    if (!entity) {
        return (_jsx(EmptyState, { title: "Entity not found", description: `No entity with id "${id}".` }));
    }
    const Icon = KIND_ICON[entity.kind];
    const outgoing = EDGES.filter((e) => e.from === entity.id).map((e) => ({
        ...e,
        other: ENTITIES.find((x) => x.id === e.to),
    }));
    const incoming = EDGES.filter((e) => e.to === entity.id).map((e) => ({
        ...e,
        other: ENTITIES.find((x) => x.id === e.from),
    }));
    return (_jsxs(Stack, { children: [_jsx(DetailHeader, { avatar: { name: entity.label }, title: entity.label, subtitle: _jsx("span", { className: "capitalize", children: entity.kind }), badges: _jsx(Badge, { intent: "neutral", className: "capitalize", children: entity.kind }), meta: _jsxs(_Fragment, { children: [_jsxs("span", { className: "inline-flex items-center gap-1", children: [_jsx(Icon, { className: "h-3 w-3" }), " ", outgoing.length, " outgoing"] }), _jsxs("span", { children: [incoming.length, " incoming"] })] }), actions: _jsx(Button, { size: "sm", variant: "secondary", onClick: () => navigateTo("/party-relationships/graph"), children: "View on graph" }) }), _jsxs(PageGrid, { columns: 3, children: [_jsx("div", { className: "lg:col-span-2", children: _jsxs(Stack, { children: [_jsx(Section, { title: "Outgoing relationships", children: outgoing.length === 0 ? (_jsx("div", { className: "text-sm text-text-muted", children: "No outgoing links." })) : (_jsx("ul", { className: "divide-y divide-border-subtle", children: outgoing.map((o) => (_jsxs("li", { className: "flex items-center gap-3 py-2 cursor-pointer hover:bg-surface-1 transition-colors px-2 -mx-2 rounded", onClick: () => o.other &&
                                                navigateTo(`/party-relationships/${o.other.id}`), children: [_jsx(Badge, { intent: "accent", className: "capitalize", children: o.kind }), _jsx("span", { className: "text-sm text-text-muted", children: "\u2192" }), _jsx(Avatar, { name: o.other?.label ?? "?", size: "sm" }), _jsx("span", { className: "flex-1 text-sm text-text-primary", children: o.other?.label ?? "—" }), _jsxs("span", { className: "text-xs text-text-muted", children: [Math.round(o.strength * 100), "%"] })] }, o.id))) })) }), _jsx(Section, { title: "Incoming relationships", children: incoming.length === 0 ? (_jsx("div", { className: "text-sm text-text-muted", children: "No incoming links." })) : (_jsx("ul", { className: "divide-y divide-border-subtle", children: incoming.map((o) => (_jsxs("li", { className: "flex items-center gap-3 py-2 cursor-pointer hover:bg-surface-1 transition-colors px-2 -mx-2 rounded", onClick: () => o.other &&
                                                navigateTo(`/party-relationships/${o.other.id}`), children: [_jsx(Avatar, { name: o.other?.label ?? "?", size: "sm" }), _jsx("span", { className: "flex-1 text-sm text-text-primary", children: o.other?.label ?? "—" }), _jsx("span", { className: "text-sm text-text-muted", children: "\u2192" }), _jsx(Badge, { intent: "accent", className: "capitalize", children: o.kind }), _jsxs("span", { className: "text-xs text-text-muted", children: [Math.round(o.strength * 100), "%"] })] }, o.id))) })) })] }) }), _jsx(Stack, { children: _jsx(Section, { title: "About", children: _jsx(PropertyList, { items: [
                                    { label: "ID", value: _jsx("code", { className: "font-mono text-xs", children: entity.id }) },
                                    { label: "Kind", value: _jsx("span", { className: "capitalize", children: entity.kind }) },
                                    { label: "Outgoing", value: outgoing.length },
                                    { label: "Incoming", value: incoming.length },
                                ] }) }) })] })] }));
}
function LoadingShell() {
    return (_jsxs("div", { className: "h-full w-full flex items-center justify-center gap-2 text-sm text-text-muted py-16", children: [_jsx(Spinner, { size: 14 }), "Loading\u2026"] }));
}
function useLastSegment() {
    const [hash, setHash] = React.useState(() => typeof window === "undefined" ? "" : window.location.hash.slice(1));
    React.useEffect(() => {
        const on = () => setHash(window.location.hash.slice(1));
        window.addEventListener("hashchange", on);
        return () => window.removeEventListener("hashchange", on);
    }, []);
    const parts = hash.replace(/^\/+/, "").split("/").filter(Boolean);
    return parts[parts.length - 1];
}
