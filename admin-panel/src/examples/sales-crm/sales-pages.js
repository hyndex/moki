import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import * as React from "react";
import { ArrowUpRight, Download, Plus, Trophy, Target, TrendingUp, Clock, Filter, Search, Flame, } from "lucide-react";
import { defineCustomView } from "@/builders";
import { PageHeader } from "@/admin-primitives/PageHeader";
import { DetailHeader } from "@/admin-primitives/DetailHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/admin-primitives/Card";
import { PageGrid, Col, Section, Inline, Stack, } from "@/admin-primitives/PageLayout";
import { StatCard } from "@/admin-primitives/StatCard";
import { PropertyList } from "@/admin-primitives/PropertyList";
import { TabBar } from "@/admin-primitives/TabBar";
import { QuickFilterBar } from "@/admin-primitives/QuickFilter";
import { LiveDnDKanban } from "@/admin-primitives/LiveDnDKanban";
import { Timeline } from "@/admin-primitives/Timeline";
import { EmptyState } from "@/admin-primitives/EmptyState";
import { BarChart } from "@/admin-primitives/charts/BarChart";
import { LineChart } from "@/admin-primitives/charts/LineChart";
import { Donut } from "@/admin-primitives/charts/Donut";
import { Funnel } from "@/admin-primitives/charts/Funnel";
import { Sparkline } from "@/admin-primitives/charts/Sparkline";
import { Avatar } from "@/primitives/Avatar";
import { AvatarGroup } from "@/primitives/AvatarGroup";
import { Badge } from "@/primitives/Badge";
import { Button } from "@/primitives/Button";
import { Input } from "@/primitives/Input";
import { ProgressBar } from "@/primitives/ProgressBar";
import { cn } from "@/lib/cn";
import { formatCurrency, formatRelative } from "@/lib/format";
import { DEAL_STAGES, dealStageIntent, dealStageLabel, } from "./data";
import { useActivities, useContacts, useDeals, useQuotes, } from "./data-hooks";
import { useDealEvents, useDealLineItems, useLostReasons, usePlatformConfig, useSalesReps, useStageVelocity, } from "./live-data-hooks";
import { Spinner } from "@/primitives/Spinner";
import { navigateTo } from "@/views/useRoute";
/* ------------------------------------------------------------------------ */
export const salesOverviewView = defineCustomView({
    id: "sales.overview.view",
    title: "Sales overview",
    description: "Pipeline + performance in one view.",
    resource: "sales.deal",
    render: () => _jsx(SalesOverviewPage, {}),
});
function SalesOverviewPage() {
    const { data: DEALS, loading } = useDeals();
    const { data: REPS } = useSalesReps();
    const { value: fiscal } = usePlatformConfig("fiscal");
    const { value: targets } = usePlatformConfig("sales-targets");
    if (loading && DEALS.length === 0)
        return _jsx(LoadingShell, {});
    const fiscalQuarter = fiscal?.quarter ?? "This quarter";
    const repQuota = targets?.repQuotaQuarter ?? 120_000;
    const open = DEALS.filter((d) => d.stage !== "won" && d.stage !== "lost");
    const won = DEALS.filter((d) => d.stage === "won");
    const pipelineValue = open.reduce((a, d) => a + d.amount, 0);
    const weighted = open.reduce((a, d) => a + d.amount * d.probability, 0);
    const bookedYtd = won.reduce((a, d) => a + d.amount, 0);
    const closingSoon = open
        .filter((d) => new Date(d.closeAt).getTime() - Date.now() < 14 * 86400_000 &&
        new Date(d.closeAt).getTime() > Date.now())
        .slice(0, 6);
    const byStage = DEAL_STAGES.filter((s) => s.id !== "won" && s.id !== "lost").map((s) => ({
        label: s.label,
        value: DEALS.filter((d) => d.stage === s.id).length,
        color: s.intent === "neutral"
            ? "rgb(var(--text-muted))"
            : `rgb(var(--intent-${s.intent}))`,
    }));
    const leaderboard = REPS.slice(0, 5)
        .map((rep) => {
        const deals = DEALS.filter((d) => d.owner === rep.name && d.stage === "won");
        const closed = deals.reduce((a, d) => a + d.amount, 0);
        return {
            rep: rep.name,
            closed,
            attainment: Math.min(1.25, closed / (rep.quotaQuarter || repQuota)),
        };
    })
        .sort((a, b) => b.closed - a.closed);
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const FISCAL_QUARTER = fiscalQuarter;
    return (_jsxs(Stack, { children: [_jsx(PageHeader, { title: `Sales · ${FISCAL_QUARTER}`, description: "Real-time view of pipeline, bookings, and team performance.", actions: _jsxs(_Fragment, { children: [_jsx(Button, { variant: "ghost", size: "sm", iconLeft: _jsx(Download, { className: "h-3.5 w-3.5" }), children: "Export" }), _jsx(Button, { variant: "primary", size: "sm", iconLeft: _jsx(Plus, { className: "h-3.5 w-3.5" }), onClick: () => navigateTo("/sales/deals/new"), children: "New deal" })] }) }), _jsxs(PageGrid, { columns: 4, children: [_jsx(StatCard, { label: "Booked YTD", value: formatCurrency(bookedYtd), trend: { value: 22, positive: true, label: "vs last yr" }, intent: "success", icon: _jsx(Trophy, { className: "h-3 w-3" }) }), _jsx(StatCard, { label: "Pipeline", value: formatCurrency(pipelineValue), secondary: `${open.length} deals open`, intent: "accent", icon: _jsx(TrendingUp, { className: "h-3 w-3" }) }), _jsx(StatCard, { label: "Weighted", value: formatCurrency(weighted), secondary: "probability-adjusted", intent: "info", icon: _jsx(Target, { className: "h-3 w-3" }) }), _jsx(StatCard, { label: "Win rate", value: "32%", trend: { value: 3, positive: true }, spark: [26, 28, 29, 30, 28, 31, 32, 33, 32, 33, 34, 32] })] }), _jsxs(PageGrid, { columns: 3, children: [_jsx(Col, { span: 2, children: _jsxs(Card, { children: [_jsx(CardHeader, { children: _jsxs("div", { children: [_jsx(CardTitle, { children: "Pipeline by stage" }), _jsx(CardDescription, { children: "Deal count, excluding closed." })] }) }), _jsx(CardContent, { children: _jsx(BarChart, { data: byStage, height: 200 }) })] }) }), _jsxs(Card, { children: [_jsx(CardHeader, { children: _jsx("div", { children: _jsx(CardTitle, { children: "Revenue mix" }) }) }), _jsx(CardContent, { children: _jsx(Donut, { data: [
                                        { label: "New logos", value: 620 },
                                        { label: "Expansion", value: 480 },
                                        { label: "Renewal", value: 340 },
                                    ], centerLabel: _jsxs("div", { children: [_jsx("div", { className: "text-lg font-semibold text-text-primary tabular-nums", children: "$1.44M" }), _jsx("div", { className: "text-xs text-text-muted", children: "YTD" })] }) }) })] })] }), _jsxs(Card, { children: [_jsx(CardHeader, { children: _jsxs("div", { children: [_jsx(CardTitle, { children: "Bookings trend" }), _jsx(CardDescription, { children: "Monthly closed-won revenue vs target." })] }) }), _jsx(CardContent, { children: _jsx(LineChart, { xLabels: months, series: [
                                { label: "Actual", data: [160, 180, 210, 240, 280, 310, 340, 390, 420, 460, 510, 580] },
                                {
                                    label: "Target",
                                    data: [150, 170, 200, 220, 260, 290, 320, 360, 400, 440, 480, 540],
                                    color: "rgb(var(--text-muted))",
                                },
                            ], valueFormatter: (v) => `$${v}K`, height: 230 }) })] }), _jsxs(PageGrid, { columns: 2, children: [_jsxs(Card, { children: [_jsxs(CardHeader, { children: [_jsxs("div", { children: [_jsx(CardTitle, { children: "Closing soon" }), _jsx(CardDescription, { children: "Deals with a close date within 14 days." })] }), _jsx(Button, { size: "sm", variant: "ghost", iconRight: _jsx(ArrowUpRight, { className: "h-3 w-3" }), onClick: () => navigateTo("/sales/deals"), children: "See all" })] }), _jsx(CardContent, { className: "p-0", children: closingSoon.length === 0 ? (_jsx(EmptyState, { title: "Nothing closing soon", description: "Breathe." })) : (_jsx("ul", { className: "divide-y divide-border-subtle", children: closingSoon.map((d) => (_jsx("li", { children: _jsxs("button", { type: "button", onClick: () => navigateTo(`/sales/deals/${d.id}`), className: "w-full px-4 py-2.5 flex items-center gap-3 text-left hover:bg-surface-1 transition-colors", children: [_jsx(Avatar, { name: d.account, size: "sm" }), _jsxs(Stack, { gap: "gap-0.5", className: "flex-1 min-w-0", children: [_jsx("span", { className: "text-sm font-medium text-text-primary truncate", children: d.name }), _jsxs("span", { className: "text-xs text-text-muted", children: [d.owner, " \u00B7 closes ", formatRelative(d.closeAt)] })] }), _jsx(Badge, { intent: dealStageIntent(d.stage), children: dealStageLabel(d.stage) }), _jsx("div", { className: "w-24 text-right tabular-nums text-sm font-medium", children: formatCurrency(d.amount) })] }) }, d.id))) })) })] }), _jsxs(Card, { children: [_jsxs(CardHeader, { children: [_jsxs("div", { children: [_jsxs(CardTitle, { children: ["Leaderboard \u2014 ", FISCAL_QUARTER] }), _jsx(CardDescription, { children: "Closed-won vs quota." })] }), _jsx(Button, { size: "sm", variant: "ghost", iconRight: _jsx(ArrowUpRight, { className: "h-3 w-3" }), onClick: () => navigateTo("/sales/leaderboard"), children: "Full board" })] }), _jsx(CardContent, { children: _jsx(Stack, { gap: "gap-3", children: leaderboard.map((rep, i) => (_jsxs(Stack, { gap: "gap-1", children: [_jsxs(Inline, { gap: "gap-2", children: [_jsx("span", { className: cn("w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0", i === 0 && "bg-intent-warning text-white", i === 1 && "bg-text-muted text-white", i === 2 && "bg-accent-subtle text-accent", i >= 3 && "bg-surface-3 text-text-secondary"), children: i + 1 }), _jsx(Avatar, { name: rep.rep, size: "sm" }), _jsx("span", { className: "text-sm font-medium text-text-primary flex-1", children: rep.rep }), _jsx("span", { className: "text-sm tabular-nums text-text-secondary", children: formatCurrency(rep.closed) })] }), _jsx(ProgressBar, { value: rep.attainment * 100, max: 125, intent: rep.attainment >= 1
                                                    ? "success"
                                                    : rep.attainment >= 0.7
                                                        ? "accent"
                                                        : "warning", size: "xs" })] }, rep.rep))) }) })] })] })] }));
}
/* ------------------------------------------------------------------------ */
export const salesDealsView = defineCustomView({
    id: "sales.deals.view",
    title: "Deals",
    description: "All deals in one searchable, filterable list.",
    resource: "sales.deal",
    render: () => _jsx(DealsList, {}),
});
function DealsList() {
    const { data: DEALS, loading } = useDeals();
    const [tab, setTab] = React.useState("open");
    const [search, setSearch] = React.useState("");
    if (loading && DEALS.length === 0)
        return _jsx(LoadingShell, {});
    const filtered = DEALS.filter((d) => {
        if (tab === "open" && (d.stage === "won" || d.stage === "lost"))
            return false;
        if (tab === "won" && d.stage !== "won")
            return false;
        if (tab === "lost" && d.stage !== "lost")
            return false;
        if (search) {
            const q = search.toLowerCase();
            return (d.name.toLowerCase().includes(q) ||
                d.account.toLowerCase().includes(q) ||
                d.code.toLowerCase().includes(q));
        }
        return true;
    });
    const tabs = [
        { id: "all", label: "All", count: DEALS.length },
        { id: "open", label: "Open", count: DEALS.filter((d) => d.stage !== "won" && d.stage !== "lost").length },
        { id: "won", label: "Closed won", count: DEALS.filter((d) => d.stage === "won").length },
        { id: "lost", label: "Closed lost", count: DEALS.filter((d) => d.stage === "lost").length },
    ];
    return (_jsxs(Stack, { children: [_jsx(PageHeader, { title: "Deals", description: `${filtered.length} of ${DEALS.length} deals`, actions: _jsx(Button, { variant: "primary", size: "sm", iconLeft: _jsx(Plus, { className: "h-3.5 w-3.5" }), onClick: () => navigateTo("/sales/deals/new"), children: "New deal" }) }), _jsx(TabBar, { tabs: tabs, active: tab, onChange: setTab }), _jsxs(Inline, { gap: "gap-3", wrap: true, children: [_jsx("div", { className: "min-w-[220px] flex-1 max-w-sm", children: _jsx(Input, { placeholder: "Search name, account, or code\u2026", prefix: _jsx(Search, { className: "h-3.5 w-3.5" }), value: search, onChange: (e) => setSearch(e.target.value) }) }), _jsx(Button, { variant: "ghost", size: "sm", iconLeft: _jsx(Filter, { className: "h-3.5 w-3.5" }), children: "Filters" })] }), _jsx(Card, { children: _jsx(CardContent, { className: "p-0", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { className: "bg-surface-1 border-b border-border text-xs uppercase tracking-wider text-text-muted", children: _jsxs("tr", { children: [_jsx("th", { className: "text-left px-4 py-2 font-medium", children: "Deal" }), _jsx("th", { className: "text-left py-2 font-medium", children: "Stage" }), _jsx("th", { className: "text-left py-2 font-medium", children: "Owner" }), _jsx("th", { className: "text-right py-2 font-medium", children: "Probability" }), _jsx("th", { className: "text-right py-2 font-medium", children: "Amount" }), _jsx("th", { className: "text-right py-2 font-medium pr-4", children: "Close" })] }) }), _jsx("tbody", { children: filtered.length === 0 ? (_jsx("tr", { children: _jsx("td", { colSpan: 6, children: _jsx(EmptyState, { title: "No deals match", description: "Try a different filter or search." }) }) })) : (filtered.map((d) => (_jsxs("tr", { className: "border-b border-border-subtle last:border-b-0 cursor-pointer hover:bg-surface-1 transition-colors", onClick: () => navigateTo(`/sales/deals/${d.id}`), children: [_jsx("td", { className: "px-4 py-2", children: _jsxs(Inline, { gap: "gap-2.5", children: [_jsx(Avatar, { name: d.account, size: "sm" }), _jsxs(Stack, { gap: "gap-0.5", children: [_jsxs(Inline, { gap: "gap-2", children: [_jsx("code", { className: "font-mono text-xs text-text-muted", children: d.code }), _jsx("span", { className: "text-sm font-medium text-text-primary", children: d.name })] }), _jsx("span", { className: "text-xs text-text-muted", children: d.contact })] })] }) }), _jsx("td", { className: "py-2", children: _jsx(Badge, { intent: dealStageIntent(d.stage), children: dealStageLabel(d.stage) }) }), _jsx("td", { className: "py-2", children: _jsxs(Inline, { gap: "gap-1.5", children: [_jsx(Avatar, { name: d.owner, size: "xs" }), _jsx("span", { className: "text-xs text-text-secondary", children: d.owner })] }) }), _jsx("td", { className: "py-2 text-right", children: _jsx(ProgressBar, { value: d.probability * 100, className: "w-20 inline-flex", intent: d.probability >= 0.8
                                                    ? "success"
                                                    : d.probability >= 0.4
                                                        ? "accent"
                                                        : "neutral", size: "xs" }) }), _jsx("td", { className: "py-2 text-right tabular-nums text-text-primary font-medium", children: formatCurrency(d.amount) }), _jsx("td", { className: "py-2 pr-4 text-right text-xs text-text-muted", children: formatRelative(d.closeAt) })] }, d.id)))) })] }) }) })] }));
}
/* ------------------------------------------------------------------------ */
export const salesPipelineView = defineCustomView({
    id: "sales.pipeline.view",
    title: "Pipeline",
    description: "Every active deal, by stage.",
    resource: "sales.deal",
    render: () => _jsx(SalesPipelinePage, {}),
});
function SalesPipelinePage() {
    const { data: DEALS, loading } = useDeals();
    if (loading && DEALS.length === 0)
        return _jsx(LoadingShell, {});
    {
        const columns = DEAL_STAGES.filter((s) => s.id !== "lost").map((s) => {
            const items = DEALS.filter((d) => d.stage === s.id);
            const total = items.reduce((a, d) => a + d.amount, 0);
            const weighted = items.reduce((a, d) => a + d.amount * d.probability, 0);
            return {
                id: s.id,
                title: s.label,
                intent: s.intent,
                items,
                total,
                weighted,
            };
        });
        return (_jsxs(Stack, { children: [_jsx(PageHeader, { title: "Sales pipeline", description: "Drag-free board. Click any card for the full deal." }), _jsx(PageGrid, { columns: 4, children: columns.map((c) => (_jsx(StatCard, { label: c.title, value: c.items.length, secondary: `${formatCurrency(c.total)} · weighted ${formatCurrency(c.weighted)}`, intent: c.intent === "success" ? "success" : c.intent === "warning" ? "warning" : c.intent === "info" ? "info" : "neutral" }, c.id))) }), _jsx(LiveDnDKanban, { resource: "sales.deal", statusField: "stage", columns: columns.map((c) => ({
                        id: c.id,
                        title: `${c.title} · ${c.items.length}`,
                        intent: c.intent,
                    })), onCardClick: (d) => navigateTo(`/sales/deals/${d.id}`), renderCard: (d) => (_jsxs("div", { children: [_jsxs(Inline, { gap: "gap-2", children: [_jsx(Avatar, { name: d.account, size: "sm" }), _jsxs(Stack, { gap: "gap-0.5", className: "flex-1 min-w-0", children: [_jsx("code", { className: "text-[10px] font-mono text-text-muted", children: d.code }), _jsx("span", { className: "text-sm font-medium text-text-primary truncate", children: d.name })] })] }), _jsxs(Inline, { gap: "gap-2", className: "mt-2 justify-between", children: [_jsx("span", { className: "text-xs text-text-secondary", children: d.owner }), _jsx(Badge, { intent: "accent", children: formatCurrency(d.amount) })] }), _jsx(ProgressBar, { value: d.probability * 100, intent: d.probability >= 0.8
                                    ? "success"
                                    : d.probability >= 0.4
                                        ? "accent"
                                        : "neutral", size: "xs", className: "mt-2" })] })) })] }));
    }
}
/* ------------------------------------------------------------------------ */
export const salesForecastView = defineCustomView({
    id: "sales.forecast.view",
    title: "Forecast",
    description: "Commit / best case / worst case.",
    resource: "sales.deal",
    render: () => _jsx(ForecastPage, {}),
});
function ForecastPage() {
    const { data: DEALS, loading } = useDeals();
    const { value: fiscal } = usePlatformConfig("fiscal");
    const { value: targets } = usePlatformConfig("sales-targets");
    const [scenario, setScenario] = React.useState("commit");
    if (loading && DEALS.length === 0)
        return _jsx(LoadingShell, {});
    const FISCAL_QUARTER = fiscal?.quarter ?? "This quarter";
    const target = targets?.companyQuarter ?? 1_800_000;
    const open = DEALS.filter((d) => d.stage !== "won" && d.stage !== "lost");
    const commit = open.filter((d) => d.probability >= 0.65);
    const best = open;
    const worst = open.filter((d) => d.probability >= 0.85);
    const won = DEALS.filter((d) => d.stage === "won");
    const wonTotal = won.reduce((a, d) => a + d.amount, 0);
    const selected = scenario === "commit" ? commit : scenario === "best" ? best : worst;
    const forecastTotal = selected.reduce((a, d) => a + d.amount * d.probability, 0);
    const tabs = [
        { id: "commit", label: "Commit", count: commit.length },
        { id: "best", label: "Best case", count: best.length },
        { id: "worst", label: "Worst case", count: worst.length },
    ];
    return (_jsxs(Stack, { children: [_jsx(PageHeader, { title: `Forecast · ${FISCAL_QUARTER}`, description: "Projected close, adjusted by probability." }), _jsxs(PageGrid, { columns: 4, children: [_jsx(StatCard, { label: "Booked", value: formatCurrency(wonTotal), intent: "success" }), _jsx(StatCard, { label: "Forecast", value: formatCurrency(forecastTotal), intent: "accent" }), _jsx(StatCard, { label: "Total expected", value: formatCurrency(wonTotal + forecastTotal), trend: { value: 14, positive: true, label: "vs Q1" } }), _jsx(StatCard, { label: "Target", value: formatCurrency(target), secondary: `${Math.round(((wonTotal + forecastTotal) / target) * 100)}% to goal`, intent: "warning" })] }), _jsx(Card, { children: _jsx(CardContent, { className: "pt-4", children: _jsxs(Stack, { gap: "gap-2", children: [_jsxs(Inline, { className: "justify-between", children: [_jsxs("span", { className: "text-sm font-medium text-text-primary", children: ["Progress to ", formatCurrency(target), " target"] }), _jsx("span", { className: "text-sm text-text-secondary tabular-nums", children: formatCurrency(wonTotal + forecastTotal) })] }), _jsxs("div", { className: "relative w-full h-3 bg-surface-2 rounded-full overflow-hidden", children: [_jsx("div", { className: "absolute left-0 top-0 h-full bg-intent-success rounded-full", style: { width: `${(wonTotal / target) * 100}%` }, title: `Booked: ${formatCurrency(wonTotal)}` }), _jsx("div", { className: "absolute top-0 h-full bg-accent rounded-full opacity-70", style: {
                                            left: `${(wonTotal / target) * 100}%`,
                                            width: `${(forecastTotal / target) * 100}%`,
                                        }, title: `Forecast: ${formatCurrency(forecastTotal)}` })] }), _jsxs(Inline, { gap: "gap-3", className: "text-xs text-text-muted", children: [_jsxs("span", { className: "inline-flex items-center gap-1", children: [_jsx("span", { className: "w-2 h-2 rounded-full bg-intent-success" }), " Booked"] }), _jsxs("span", { className: "inline-flex items-center gap-1", children: [_jsx("span", { className: "w-2 h-2 rounded-full bg-accent" }), " Forecast"] })] })] }) }) }), _jsx(TabBar, { tabs: tabs, active: scenario, onChange: (id) => setScenario(id) }), _jsx(Card, { children: _jsx(CardContent, { className: "p-0", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { className: "bg-surface-1 border-b border-border text-xs uppercase tracking-wider text-text-muted", children: _jsxs("tr", { children: [_jsx("th", { className: "text-left px-4 py-2 font-medium", children: "Deal" }), _jsx("th", { className: "text-left py-2 font-medium", children: "Stage" }), _jsx("th", { className: "text-right py-2 font-medium", children: "Prob." }), _jsx("th", { className: "text-right py-2 font-medium", children: "Amount" }), _jsx("th", { className: "text-right py-2 font-medium pr-4", children: "Weighted" })] }) }), _jsx("tbody", { children: selected.map((d) => (_jsxs("tr", { className: "border-b border-border-subtle last:border-b-0 cursor-pointer hover:bg-surface-1 transition-colors", onClick: () => navigateTo(`/sales/deals/${d.id}`), children: [_jsx("td", { className: "px-4 py-2", children: _jsxs(Inline, { gap: "gap-2", children: [_jsx(Avatar, { name: d.account, size: "sm" }), _jsxs(Stack, { gap: "gap-0.5", children: [_jsx("span", { className: "text-sm font-medium text-text-primary", children: d.name }), _jsxs("span", { className: "text-xs text-text-muted", children: [d.owner, " \u00B7 ", formatRelative(d.closeAt)] })] })] }) }), _jsx("td", { className: "py-2", children: _jsx(Badge, { intent: dealStageIntent(d.stage), children: dealStageLabel(d.stage) }) }), _jsxs("td", { className: "py-2 text-right tabular-nums text-text-secondary", children: [Math.round(d.probability * 100), "%"] }), _jsx("td", { className: "py-2 text-right tabular-nums", children: formatCurrency(d.amount) }), _jsx("td", { className: "py-2 pr-4 text-right tabular-nums text-text-primary font-medium", children: formatCurrency(d.amount * d.probability) })] }, d.id))) })] }) }) })] }));
}
/* ------------------------------------------------------------------------ */
export const salesLeaderboardView = defineCustomView({
    id: "sales.leaderboard.view",
    title: "Leaderboard",
    description: "Reps ranked by closed-won.",
    resource: "sales.deal",
    render: () => _jsx(LeaderboardPage, {}),
});
function LeaderboardPage() {
    const { data: DEALS, loading } = useDeals();
    const { data: REPS } = useSalesReps();
    const { value: fiscal } = usePlatformConfig("fiscal");
    if (loading && DEALS.length === 0)
        return _jsx(LoadingShell, {});
    const FISCAL_QUARTER = fiscal?.quarter ?? "This quarter";
    {
        const reps = REPS.map((rep) => {
            const won = DEALS.filter((d) => d.owner === rep.name && d.stage === "won");
            const closed = won.reduce((a, d) => a + d.amount, 0);
            const open = DEALS.filter((d) => d.owner === rep.name && d.stage !== "won" && d.stage !== "lost");
            const openValue = open.reduce((a, d) => a + d.amount, 0);
            const quota = rep.quotaQuarter || 120_000;
            return {
                rep: rep.name,
                closed,
                openValue,
                deals: won.length,
                attainment: closed / quota,
            };
        }).sort((a, b) => b.closed - a.closed);
        return (_jsxs(Stack, { children: [_jsx(PageHeader, { title: `Leaderboard · ${FISCAL_QUARTER}`, description: "Closed-won, open pipeline, and quota attainment per rep." }), _jsx(PageGrid, { columns: 3, children: reps.slice(0, 3).map((r, i) => (_jsx(Card, { className: cn(i === 0 && "border-intent-warning/50", i === 1 && "border-text-muted/30", i === 2 && "border-accent/30"), children: _jsxs(CardContent, { className: "pt-4", children: [_jsxs(Inline, { gap: "gap-3", children: [_jsx("div", { className: cn("w-10 h-10 rounded-full flex items-center justify-center text-base font-bold shrink-0", i === 0 && "bg-intent-warning text-white", i === 1 && "bg-text-muted text-white", i === 2 && "bg-accent-subtle text-accent"), children: i === 0 ? _jsx(Trophy, { className: "h-5 w-5" }) : i + 1 }), _jsxs(Stack, { gap: "gap-0.5", className: "flex-1", children: [_jsx("div", { className: "text-sm font-semibold text-text-primary", children: r.rep }), _jsxs("div", { className: "text-xs text-text-muted", children: [r.deals, " closed \u00B7 ", formatCurrency(r.openValue), " open"] })] }), _jsx(Avatar, { name: r.rep, size: "lg" })] }), _jsxs("div", { className: "mt-4", children: [_jsxs("div", { className: "flex items-baseline justify-between mb-1", children: [_jsx("span", { className: "text-2xl font-semibold tabular-nums text-text-primary", children: formatCurrency(r.closed) }), _jsxs("span", { className: "text-xs text-text-muted", children: [Math.round(r.attainment * 100), "% of quota"] })] }), _jsx(ProgressBar, { value: r.attainment * 100, max: 125, intent: r.attainment >= 1
                                                ? "success"
                                                : r.attainment >= 0.7
                                                    ? "accent"
                                                    : "warning" })] })] }) }, r.rep))) }), _jsx(Card, { children: _jsx(CardContent, { className: "p-0", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { className: "bg-surface-1 border-b border-border text-xs uppercase tracking-wider text-text-muted", children: _jsxs("tr", { children: [_jsx("th", { className: "text-left pl-4 py-2 font-medium w-10", children: "#" }), _jsx("th", { className: "text-left py-2 font-medium", children: "Rep" }), _jsx("th", { className: "text-right py-2 font-medium", children: "Closed" }), _jsx("th", { className: "text-right py-2 font-medium", children: "Open" }), _jsx("th", { className: "text-right py-2 font-medium", children: "Deals" }), _jsx("th", { className: "text-left py-2 font-medium pr-4", children: "Attainment" })] }) }), _jsx("tbody", { children: reps.map((r, i) => (_jsxs("tr", { className: "border-b border-border-subtle last:border-b-0", children: [_jsx("td", { className: "pl-4 py-2 text-text-muted tabular-nums", children: i + 1 }), _jsx("td", { className: "py-2", children: _jsxs(Inline, { gap: "gap-2", children: [_jsx(Avatar, { name: r.rep, size: "sm" }), _jsx("span", { className: "text-text-primary", children: r.rep })] }) }), _jsx("td", { className: "py-2 text-right tabular-nums font-medium text-text-primary", children: formatCurrency(r.closed) }), _jsx("td", { className: "py-2 text-right tabular-nums text-text-secondary", children: formatCurrency(r.openValue) }), _jsx("td", { className: "py-2 text-right tabular-nums text-text-secondary", children: r.deals }), _jsx("td", { className: "py-2 pr-4 w-60", children: _jsx(ProgressBar, { value: r.attainment * 100, max: 125, showLabel: true, label: `${Math.round(r.attainment * 100)}%`, intent: r.attainment >= 1
                                                        ? "success"
                                                        : r.attainment >= 0.7
                                                            ? "accent"
                                                            : "warning" }) })] }, r.rep))) })] }) }) })] }));
    }
}
/* ------------------------------------------------------------------------ */
export const salesRevenueView = defineCustomView({
    id: "sales.revenue.view",
    title: "Revenue",
    description: "Closed-won revenue across 12 months.",
    resource: "sales.deal",
    render: () => _jsx(SalesRevenuePage, {}),
});
function SalesRevenuePage() {
    const { data: DEALS, loading } = useDeals();
    const { data: REPS } = useSalesReps();
    if (loading && DEALS.length === 0)
        return _jsx(LoadingShell, {});
    const months = [
        "Jan", "Feb", "Mar", "Apr", "May", "Jun",
        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ];
    const won = DEALS.filter((d) => d.stage === "won");
    const wonTotal = won.reduce((a, d) => a + d.amount, 0);
    const avgDeal = won.length > 0 ? Math.round(wonTotal / won.length / 100) * 100 : 0;
    const winRate = DEALS.length > 0
        ? Math.round((won.length /
            DEALS.filter((d) => d.stage === "won" || d.stage === "lost").length ||
            1) * 100)
        : 0;
    // Bucket closed-won by calendar month for the trend chart.
    const now = new Date();
    const series = Array.from({ length: 12 }, () => 0);
    for (const d of won) {
        const t = new Date(d.closeAt);
        const diff = (now.getFullYear() - t.getFullYear()) * 12 + (now.getMonth() - t.getMonth());
        if (diff >= 0 && diff < 12)
            series[11 - diff] += d.amount / 1000;
    }
    const target = series.map((_, i) => 150 + i * 35);
    // Revenue by owner.
    const byOwner = {};
    for (const d of won)
        byOwner[d.owner] = (byOwner[d.owner] ?? 0) + d.amount;
    const ownerData = REPS.slice(0, 6).map((r) => ({
        label: r.name.split(" ")[0],
        value: Math.round((byOwner[r.name] ?? 0) / 1000),
    }));
    return (_jsxs(Stack, { children: [_jsx(PageHeader, { title: "Revenue analytics", description: "Closed-won bookings over time." }), _jsxs(PageGrid, { columns: 4, children: [_jsx(StatCard, { label: "Booked (YTD)", value: `$${Math.round(wonTotal / 1000).toLocaleString()}K`, intent: "success" }), _jsx(StatCard, { label: "Avg deal size", value: `$${Math.round(avgDeal / 1000).toLocaleString()}K` }), _jsx(StatCard, { label: "Win rate", value: `${winRate}%`, trend: { value: 3, positive: true } }), _jsx(StatCard, { label: "Sales cycle", value: "42 d" })] }), _jsxs(Card, { children: [_jsx(CardHeader, { children: _jsx("div", { children: _jsx(CardTitle, { children: "Revenue (closed-won) vs target" }) }) }), _jsx(CardContent, { children: _jsx(LineChart, { xLabels: months, series: [
                                {
                                    label: "Actual",
                                    data: series.map((v) => Math.round(v)),
                                },
                                {
                                    label: "Target",
                                    data: target,
                                    color: "rgb(var(--text-muted))",
                                },
                            ], height: 240, valueFormatter: (v) => `$${v}K` }) })] }), _jsxs(PageGrid, { columns: 2, children: [_jsxs(Card, { children: [_jsx(CardHeader, { children: _jsx("div", { children: _jsx(CardTitle, { children: "Revenue by owner \u2014 QTD" }) }) }), _jsx(CardContent, { children: _jsx(BarChart, { data: ownerData, height: 180, valueFormatter: (v) => `$${v}K` }) })] }), _jsxs(Card, { children: [_jsx(CardHeader, { children: _jsx("div", { children: _jsx(CardTitle, { children: "Revenue by segment" }) }) }), _jsx(CardContent, { children: _jsx(Donut, { data: [
                                        { label: "Enterprise", value: Math.round(wonTotal * 0.55) / 1000 },
                                        { label: "Mid-market", value: Math.round(wonTotal * 0.3) / 1000 },
                                        { label: "SMB", value: Math.round(wonTotal * 0.15) / 1000 },
                                    ] }) })] })] })] }));
}
/* ------------------------------------------------------------------------ */
export const salesFunnelView = defineCustomView({
    id: "sales.funnel.view",
    title: "Funnel",
    description: "Conversion through deal stages.",
    resource: "sales.deal",
    render: () => _jsx(SalesFunnelPage, {}),
});
function SalesFunnelPage() {
    const { data: DEALS, loading } = useDeals();
    const { data: LOST_REASONS } = useLostReasons();
    const { data: VELOCITY } = useStageVelocity();
    if (loading && DEALS.length === 0)
        return _jsx(LoadingShell, {});
    const stages = ["qualify", "proposal", "negotiate", "won"];
    const data = stages.map((stage) => ({
        label: dealStageLabel(stage),
        value: DEALS.filter((d) => d.stage === stage || rank(d.stage) > rank(stage))
            .length,
    }));
    return (_jsxs(Stack, { children: [_jsx(PageHeader, { title: "Sales funnel", description: "Volume of deals at each stage. Shows stage-to-stage conversion." }), _jsx(Card, { children: _jsx(CardContent, { className: "pt-4", children: _jsx(Funnel, { data: data }) }) }), _jsxs(PageGrid, { columns: 2, children: [_jsxs(Card, { children: [_jsx(CardHeader, { children: _jsx("div", { children: _jsx(CardTitle, { children: "Stage velocity" }) }) }), _jsx(CardContent, { children: _jsx(BarChart, { data: VELOCITY.map((v) => ({ label: v.stage, value: v.avgDays })), height: 180, valueFormatter: (v) => `${v} days` }) })] }), _jsxs(Card, { children: [_jsx(CardHeader, { children: _jsx("div", { children: _jsx(CardTitle, { children: "Lost reasons" }) }) }), _jsx(CardContent, { children: _jsx(Donut, { data: LOST_REASONS.map((l) => ({
                                        label: l.reason,
                                        value: l.count,
                                    })) }) })] })] })] }));
}
/* ------------------------------------------------------------------------ */
export const salesQuotesView = defineCustomView({
    id: "sales.quotes.view",
    title: "Quotes",
    description: "All outgoing quotes + their lifecycle.",
    resource: "sales.deal",
    render: () => _jsx(SalesQuotesPage, {}),
});
function SalesQuotesPage() {
    const { data: QUOTES, loading } = useQuotes();
    const [filter, setFilter] = React.useState("all");
    if (loading && QUOTES.length === 0)
        return _jsx(LoadingShell, {});
    {
        const filtered = QUOTES.filter((q) => filter === "all" || q.status === filter);
        const quickFilters = [
            { id: "all", label: "All", count: QUOTES.length },
            { id: "draft", label: "Draft", count: QUOTES.filter((q) => q.status === "draft").length },
            { id: "sent", label: "Sent", count: QUOTES.filter((q) => q.status === "sent").length },
            { id: "accepted", label: "Accepted", count: QUOTES.filter((q) => q.status === "accepted").length },
            { id: "expired", label: "Expired", count: QUOTES.filter((q) => q.status === "expired").length },
        ];
        return (_jsxs(Stack, { children: [_jsx(PageHeader, { title: "Quotes", description: "Proposals, sent and in-flight.", actions: _jsx(Button, { variant: "primary", size: "sm", iconLeft: _jsx(Plus, { className: "h-3.5 w-3.5" }), children: "New quote" }) }), _jsx(QuickFilterBar, { filters: quickFilters, active: filter, onChange: setFilter }), _jsx(Card, { children: _jsx(CardContent, { className: "p-0", children: _jsx("ul", { className: "divide-y divide-border-subtle", children: filtered.map((q) => (_jsxs("li", { className: "flex items-center gap-3 px-4 py-3 hover:bg-surface-1 transition-colors", children: [_jsx(Avatar, { name: q.account, size: "md" }), _jsxs(Stack, { gap: "gap-0.5", className: "flex-1 min-w-0", children: [_jsxs(Inline, { gap: "gap-2", children: [_jsx("code", { className: "font-mono text-xs text-text-muted", children: q.number }), _jsx("span", { className: "text-sm font-medium text-text-primary truncate", children: q.account })] }), _jsxs("span", { className: "text-xs text-text-muted", children: ["expires ", formatRelative(q.expiresAt)] })] }), _jsx(Badge, { intent: q.status === "accepted"
                                            ? "success"
                                            : q.status === "sent"
                                                ? "info"
                                                : q.status === "draft"
                                                    ? "neutral"
                                                    : "danger", children: q.status }), _jsx("div", { className: "w-24 text-right tabular-nums text-sm font-medium", children: formatCurrency(q.amount) })] }, q.id))) }) }) })] }));
    }
}
/* ------------------------------------------------------------------------ */
export const salesDealDetailView = defineCustomView({
    id: "sales.deal-detail.view",
    title: "Deal",
    description: "Complete deal record.",
    resource: "sales.deal",
    render: () => _jsx(DealDetailPage, {}),
});
function DealDetailPage() {
    const { data: DEALS, loading: dealsLoading } = useDeals();
    const { data: CONTACTS } = useContacts();
    const { data: ACTIVITIES } = useActivities();
    const { data: QUOTES } = useQuotes();
    const { data: LINE_ITEMS } = useDealLineItems();
    const { data: DEAL_EVENTS } = useDealEvents();
    const hash = useHash();
    const id = hash.split("/").pop();
    const [tab, setTab] = React.useState("overview");
    if (dealsLoading && DEALS.length === 0)
        return _jsx(LoadingShell, {});
    const deal = DEALS.find((d) => d.id === id) ?? DEALS[0];
    if (!deal) {
        return (_jsx(EmptyState, { title: "Deal not found", description: `No deal with id "${id}".` }));
    }
    const contact = CONTACTS.find((c) => c.name === deal.contact) ?? CONTACTS[0] ?? {
        id: "unknown",
        name: deal.contact ?? "Unknown",
        company: deal.account,
        title: "",
    };
    const stageIndex = DEAL_STAGES.findIndex((s) => s.id === deal.stage);
    const tabs = [
        { id: "overview", label: "Overview" },
        { id: "activity", label: "Activity", count: 8 },
        { id: "quotes", label: "Quotes", count: 2 },
        { id: "products", label: "Products", count: 4 },
    ];
    const relatedActivity = ACTIVITIES.filter((a) => a.contactId === contact.id).slice(0, 8);
    return (_jsxs(Stack, { children: [_jsx(DetailHeader, { title: _jsxs("span", { className: "inline-flex items-center gap-2", children: [_jsx("code", { className: "font-mono text-sm text-text-muted", children: deal.code }), deal.name] }), subtitle: deal.account, badges: _jsx(Badge, { intent: dealStageIntent(deal.stage), children: dealStageLabel(deal.stage) }), avatar: { name: deal.account }, meta: _jsxs(_Fragment, { children: [_jsxs("span", { className: "inline-flex items-center gap-1", children: ["Contact: ", _jsx("span", { className: "text-text-primary", children: deal.contact })] }), _jsxs("span", { className: "inline-flex items-center gap-1", children: ["Owner: ", _jsx("span", { className: "text-text-primary", children: deal.owner })] }), _jsxs("span", { className: "inline-flex items-center gap-1", children: [_jsx(Clock, { className: "h-3 w-3" }), " Closes ", formatRelative(deal.closeAt)] }), _jsxs("span", { className: "inline-flex items-center gap-1", children: [_jsx(Flame, { className: "h-3 w-3" }), " ", Math.round(deal.probability * 100), "% probability"] })] }), actions: _jsxs(_Fragment, { children: [_jsx(Button, { variant: "secondary", size: "sm", children: "Log call" }), _jsx(Button, { variant: "primary", size: "sm", children: "Advance stage" })] }) }), _jsx(Card, { children: _jsx(CardContent, { className: "pt-4", children: _jsx("div", { className: "flex items-center gap-2", children: DEAL_STAGES.map((s, i) => {
                            const passed = i <= stageIndex && deal.stage !== "lost";
                            const isCurrent = i === stageIndex;
                            return (_jsxs(React.Fragment, { children: [_jsxs("div", { className: "flex items-center gap-2 shrink-0", children: [_jsx("div", { className: cn("w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold", passed && !isCurrent && "bg-intent-success text-white", isCurrent && "bg-accent text-accent-fg", !passed && "bg-surface-3 text-text-muted"), children: i + 1 }), _jsx("span", { className: cn("text-xs", isCurrent ? "text-text-primary font-medium" : "text-text-muted"), children: s.label })] }), i < DEAL_STAGES.length - 1 && (_jsx("div", { className: cn("flex-1 h-px", i < stageIndex ? "bg-intent-success" : "bg-border") }))] }, s.id));
                        }) }) }) }), _jsx(TabBar, { tabs: tabs, active: tab, onChange: setTab }), tab === "overview" && (_jsxs(PageGrid, { columns: 3, children: [_jsx(Col, { span: 2, children: _jsxs(Stack, { children: [_jsx(Section, { title: "Key details", children: _jsx(PropertyList, { columns: 2, items: [
                                            { label: "Amount", value: _jsx("span", { className: "text-base font-semibold", children: formatCurrency(deal.amount) }) },
                                            { label: "Weighted", value: formatCurrency(deal.amount * deal.probability) },
                                            { label: "Account", value: deal.account },
                                            { label: "Contact", value: deal.contact },
                                            { label: "Stage", value: _jsx(Badge, { intent: dealStageIntent(deal.stage), children: dealStageLabel(deal.stage) }) },
                                            { label: "Probability", value: `${Math.round(deal.probability * 100)}%` },
                                            { label: "Close date", value: formatRelative(deal.closeAt) },
                                            { label: "Created", value: formatRelative(deal.createdAt) },
                                        ] }) }), _jsx(Section, { title: "Next steps", children: _jsxs("ul", { className: "flex flex-col gap-2 text-sm text-text-primary", children: [_jsxs("li", { className: "flex items-center gap-2", children: [_jsx("span", { className: "w-4 h-4 rounded-full border-2 border-accent shrink-0" }), "Send security questionnaire to ", deal.contact] }), _jsxs("li", { className: "flex items-center gap-2 text-text-muted", children: [_jsx("span", { className: "w-4 h-4 rounded-full border-2 border-border shrink-0" }), "Schedule technical deep-dive"] }), _jsxs("li", { className: "flex items-center gap-2 text-text-muted", children: [_jsx("span", { className: "w-4 h-4 rounded-full border-2 border-border shrink-0" }), "Draft redline for legal"] })] }) })] }) }), _jsxs(Stack, { children: [_jsx(Section, { title: "Team", children: _jsxs(Stack, { gap: "gap-2", children: [_jsxs(Inline, { gap: "gap-2", children: [_jsx(Avatar, { name: deal.owner, size: "sm" }), _jsxs(Stack, { gap: "gap-0.5", children: [_jsx("span", { className: "text-sm text-text-primary", children: deal.owner }), _jsx("span", { className: "text-xs text-text-muted", children: "Owner" })] })] }), _jsxs(Inline, { gap: "gap-2", children: [_jsx(AvatarGroup, { names: ["Taylor Nguyen", "Riley Kim"], size: "sm" }), _jsx("span", { className: "text-xs text-text-muted", children: "Collaborators" })] })] }) }), _jsx(Section, { title: "Contact", children: _jsxs(Inline, { gap: "gap-2", children: [_jsx(Avatar, { name: contact.name, size: "md" }), _jsxs(Stack, { gap: "gap-0.5", children: [_jsx("a", { href: `#/contacts/${contact.id}`, className: "text-sm font-medium text-text-primary hover:underline", children: contact.name }), _jsxs("span", { className: "text-xs text-text-muted", children: [contact.title, " \u00B7 ", contact.company] })] })] }) }), _jsx(Section, { title: "Probability sparkline", children: (() => {
                                    const events = DEAL_EVENTS.filter((e) => e.dealId === deal.id)
                                        .sort((a, b) => (a.occurredAt < b.occurredAt ? -1 : 1));
                                    const series = events.length > 1
                                        ? events.map((e) => e.probability)
                                        : [deal.probability];
                                    const delta = events.length > 1
                                        ? Math.round((events[events.length - 1].probability - events[0].probability) *
                                            100)
                                        : 0;
                                    return (_jsxs(Stack, { gap: "gap-1", children: [_jsx(Sparkline, { data: series, width: 240, height: 36 }), _jsx("span", { className: "text-xs text-text-muted", children: events.length > 1
                                                    ? `Trended ${delta >= 0 ? "up" : "down"} ${Math.abs(delta)} points across ${events.length} stage changes`
                                                    : "No stage history yet" })] }));
                                })() })] })] })), tab === "activity" && (_jsx(Card, { children: _jsx(CardContent, { children: _jsx(Timeline, { items: relatedActivity.map((a) => ({
                            id: a.id,
                            title: a.summary,
                            description: a.body,
                            occurredAt: a.when,
                            intent: a.kind === "call"
                                ? "success"
                                : a.kind === "email"
                                    ? "info"
                                    : a.kind === "meeting"
                                        ? "accent"
                                        : "warning",
                        })) }) }) })), tab === "quotes" && (_jsx(Card, { children: _jsx(CardContent, { className: "p-0", children: _jsx("ul", { className: "divide-y divide-border-subtle", children: QUOTES.slice(0, 2).map((q) => (_jsxs("li", { className: "flex items-center gap-3 px-4 py-3", children: [_jsxs(Stack, { gap: "gap-0.5", className: "flex-1", children: [_jsx("code", { className: "font-mono text-xs text-text-muted", children: q.number }), _jsx("span", { className: "text-sm font-medium", children: deal.account })] }), _jsx(Badge, { intent: q.status === "accepted"
                                        ? "success"
                                        : q.status === "sent"
                                            ? "info"
                                            : q.status === "draft"
                                                ? "neutral"
                                                : "danger", children: q.status }), _jsx("span", { className: "w-24 text-right tabular-nums text-sm font-medium", children: formatCurrency(q.amount) })] }, q.id))) }) }) })), tab === "products" && (_jsx(Card, { children: _jsx(CardContent, { className: "p-0", children: (() => {
                        const items = LINE_ITEMS.filter((li) => li.dealId === deal.id);
                        if (items.length === 0) {
                            return (_jsx(EmptyState, { title: "No line items", description: "This deal has no product lines attached." }));
                        }
                        const total = items.reduce((a, p) => a + p.total, 0);
                        return (_jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { className: "border-b border-border bg-surface-1 text-xs uppercase tracking-wider text-text-muted", children: _jsxs("tr", { children: [_jsx("th", { className: "text-left px-4 py-2 font-medium", children: "Product" }), _jsx("th", { className: "text-right py-2 font-medium", children: "Qty" }), _jsx("th", { className: "text-right py-2 font-medium", children: "Price" }), _jsx("th", { className: "text-right py-2 pr-4 font-medium", children: "Total" })] }) }), _jsxs("tbody", { children: [items.map((p) => (_jsxs("tr", { className: "border-b border-border-subtle last:border-b-0", children: [_jsx("td", { className: "px-4 py-2 text-text-primary", children: p.name }), _jsx("td", { className: "py-2 text-right tabular-nums", children: p.quantity }), _jsx("td", { className: "py-2 text-right tabular-nums", children: formatCurrency(p.unitPrice) }), _jsx("td", { className: "py-2 pr-4 text-right tabular-nums font-medium", children: formatCurrency(p.total) })] }, p.id))), _jsxs("tr", { children: [_jsx("td", { colSpan: 3, className: "px-4 py-2 text-right font-medium text-text-primary", children: "Total" }), _jsx("td", { className: "py-2 pr-4 text-right font-semibold tabular-nums", children: formatCurrency(total) })] })] })] }));
                    })() }) }))] }));
}
function LoadingShell() {
    return (_jsxs("div", { className: "h-full w-full flex items-center justify-center gap-2 text-sm text-text-muted py-16", children: [_jsx(Spinner, { size: 14 }), "Loading\u2026"] }));
}
function rank(stage) {
    return DEAL_STAGES.findIndex((s) => s.id === stage);
}
function useHash() {
    const [hash, setHash] = React.useState(() => typeof window === "undefined" ? "" : window.location.hash.slice(1));
    React.useEffect(() => {
        const on = () => setHash(window.location.hash.slice(1));
        window.addEventListener("hashchange", on);
        return () => window.removeEventListener("hashchange", on);
    }, []);
    return hash;
}
