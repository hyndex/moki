import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import * as React from "react";
import { ChevronRight, MoreHorizontal } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./Card";
import { Badge } from "@/primitives/Badge";
import { Button } from "@/primitives/Button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, } from "@/primitives/DropdownMenu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/primitives/Tabs";
import { Spinner } from "@/primitives/Spinner";
import { EmptyStateFramework } from "./EmptyStateFramework";
import { ErrorRecoveryFramework } from "./ErrorRecoveryFramework";
import { FreshnessIndicator } from "./FreshnessIndicator";
import { cn } from "@/lib/cn";
import { Breadcrumbs } from "./Breadcrumbs";
import { StarRecordButton } from "./StarRecordButton";
export function RichDetailPage({ loading, error, onRetry, breadcrumb, avatar, title, subtitle, status, metrics, workflow, primaryAction, secondaryActions, extraActions, lastUpdatedAt, live, tabs, defaultTabId, rail, beforeTabs, favoriteTarget, className, }) {
    const visibleTabs = React.useMemo(() => tabs.filter((t) => !t.hidden), [tabs]);
    const [active, setActive] = React.useState(defaultTabId ?? visibleTabs[0]?.id ?? "");
    React.useEffect(() => {
        if (!visibleTabs.some((t) => t.id === active) && visibleTabs[0]) {
            setActive(visibleTabs[0].id);
        }
    }, [visibleTabs, active]);
    if (error) {
        return (_jsx("div", { className: cn("py-8", className), children: _jsx(ErrorRecoveryFramework, { message: error.message, onRetry: onRetry }) }));
    }
    if (loading) {
        return (_jsxs("div", { className: cn("py-16 flex items-center justify-center gap-2 text-sm text-text-muted", className), children: [_jsx(Spinner, { size: 14 }), " Loading\u2026"] }));
    }
    const visibleExtras = (extraActions ?? []).filter((a) => !a.hidden);
    const visibleSecondaries = (secondaryActions ?? []).filter((a) => !a.hidden);
    return (_jsxs("div", { className: cn("flex flex-col gap-4", className), children: [breadcrumb && breadcrumb.length > 0 && (_jsx(Breadcrumbs, { items: breadcrumb.map((b) => ({ label: b.label, path: b.path })) })), _jsx(Card, { children: _jsx(CardContent, { className: "py-4", children: _jsxs("div", { className: "flex items-start gap-4", children: [avatar && _jsx("div", { className: "shrink-0", children: avatar }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsxs("div", { className: "flex items-start justify-between gap-3", children: [_jsxs("div", { className: "min-w-0", children: [_jsxs("div", { className: "flex items-center gap-2 flex-wrap", children: [_jsx("h1", { className: "text-xl font-semibold text-text-primary truncate", children: title }), favoriteTarget && (_jsx(StarRecordButton, { resource: favoriteTarget.resource, recordId: favoriteTarget.recordId, label: favoriteTarget.label ??
                                                                    (typeof title === "string" ? title : undefined), size: "xs", className: "shrink-0" })), status && (_jsx(Badge, { intent: status.intent, children: status.label }))] }), subtitle && (_jsx("div", { className: "text-sm text-text-muted mt-0.5 truncate", children: subtitle }))] }), _jsxs("div", { className: "flex items-center gap-2 shrink-0", children: [lastUpdatedAt !== undefined && (_jsx(FreshnessIndicator, { lastUpdatedAt: lastUpdatedAt, live: live })), visibleSecondaries.map((a) => (_jsx(Button, { variant: "ghost", size: "sm", onClick: () => void a.onClick(), disabled: a.disabled, iconLeft: a.icon, children: a.label }, a.id))), primaryAction && !primaryAction.hidden && (_jsx(Button, { variant: primaryAction.intent === "danger" ? "danger" : "primary", size: "sm", onClick: () => void primaryAction.onClick(), disabled: primaryAction.disabled, iconLeft: primaryAction.icon, children: primaryAction.label })), visibleExtras.length > 0 && (_jsxs(DropdownMenu, { children: [_jsx(DropdownMenuTrigger, { asChild: true, children: _jsx(Button, { variant: "ghost", size: "icon", "aria-label": "More actions", children: _jsx(MoreHorizontal, { className: "h-4 w-4" }) }) }), _jsx(DropdownMenuContent, { align: "end", children: visibleExtras.map((a, i) => [
                                                                    i > 0 && a.intent === "danger" ? (_jsx(DropdownMenuSeparator, {}, `${a.id}-sep`)) : null,
                                                                    _jsxs(DropdownMenuItem, { onSelect: () => void a.onClick(), disabled: a.disabled, intent: a.intent === "danger" ? "danger" : undefined, children: [a.icon, a.label] }, a.id),
                                                                ]) })] }))] })] }), metrics && metrics.length > 0 && (_jsx("div", { className: "mt-3 grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4", children: metrics.map((m) => (_jsxs("div", { className: "min-w-0", children: [_jsx("div", { className: "text-[11px] uppercase tracking-wider text-text-muted font-medium", children: m.label }), _jsx("div", { className: cn("text-lg font-semibold tabular-nums mt-0.5 truncate", m.intent === "success" && "text-intent-success", m.intent === "warning" && "text-intent-warning", m.intent === "danger" && "text-intent-danger", (!m.intent || m.intent === "neutral" || m.intent === "info" || m.intent === "accent") && "text-text-primary"), children: m.value }), m.helper && (_jsx("div", { className: "text-xs text-text-muted mt-0.5 truncate", children: m.helper }))] }, m.label))) })), workflow && workflow.steps.length > 0 && (_jsx("div", { className: "mt-4", children: _jsx(WorkflowProgress, { steps: workflow.steps, activeId: workflow.activeId }) }))] })] }) }) }), beforeTabs, _jsxs("div", { className: "grid gap-4 lg:grid-cols-[1fr_320px]", children: [_jsx("div", { className: "min-w-0", children: _jsxs(Tabs, { value: active, onValueChange: setActive, children: [_jsx(TabsList, { children: visibleTabs.map((t) => (_jsxs(TabsTrigger, { value: t.id, children: [t.label, t.count !== undefined && (_jsx("span", { className: "ml-1.5 text-xs text-text-muted tabular-nums", children: t.count }))] }, t.id))) }), visibleTabs.map((t) => (_jsx(TabsContent, { value: t.id, className: "mt-4 flex flex-col gap-3", children: t.loading ? (_jsxs("div", { className: "py-10 flex items-center justify-center gap-2 text-sm text-text-muted", children: [_jsx(Spinner, { size: 12 }), " Loading\u2026"] })) : (t.render()) }, t.id)))] }) }), rail && rail.length > 0 && (_jsx("aside", { className: "flex flex-col gap-3 lg:sticky lg:top-4 self-start", children: [...rail]
                            .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
                            .map((m) => (_jsx(React.Fragment, { children: m.render() }, m.id))) }))] })] }));
}
/* ----------------------------------------------------------- */
/* Supporting: inline workflow progress strip                    */
/* ----------------------------------------------------------- */
function WorkflowProgress({ steps, activeId, }) {
    return (_jsx("ol", { className: "flex items-center gap-0 w-full overflow-x-auto", children: steps.map((s, i) => {
            const isActive = s.id === activeId || s.status === "active";
            return (_jsxs("li", { className: "flex items-center flex-1 min-w-0", children: [_jsxs("div", { className: "flex flex-col items-center gap-1 min-w-0 px-1", children: [_jsx("div", { className: cn("h-5 w-5 rounded-full flex items-center justify-center shrink-0 text-[10px] font-semibold tabular-nums", s.status === "completed" && "bg-intent-success text-white", s.status === "error" && "bg-intent-danger text-white", isActive && "bg-accent text-accent-fg", s.status === "skipped" && "bg-surface-2 text-text-muted", s.status === "pending" && !isActive && "bg-surface-2 text-text-muted"), children: s.status === "completed" ? "✓" : i + 1 }), _jsx("div", { className: cn("text-[10px] uppercase tracking-wider truncate max-w-[80px]", isActive && "text-text-primary font-medium", !isActive && "text-text-muted"), children: s.label })] }), i < steps.length - 1 && (_jsx("div", { className: cn("flex-1 h-px mx-1 mt-[-18px]", s.status === "completed" ? "bg-intent-success" : "bg-border") }))] }, s.id));
        }) }));
}
/* ----------------------------------------------------------- */
/* Common rail modules (exported helpers)                        */
/* ----------------------------------------------------------- */
/** Metadata card — owner, created/updated, id. Common to every detail page. */
export function MetadataRailCard({ items, }) {
    return (_jsxs(Card, { children: [_jsx(CardHeader, { children: _jsx(CardTitle, { children: "Metadata" }) }), _jsx(CardContent, { className: "p-0", children: _jsx("dl", { className: "divide-y divide-border-subtle", children: items.map((i) => (_jsxs("div", { className: "px-3 py-2 flex items-start gap-3", children: [_jsx("dt", { className: "text-xs text-text-muted w-24 shrink-0", children: i.label }), _jsx("dd", { className: "text-sm text-text-primary min-w-0 flex-1 truncate", children: i.value })] }, i.label))) }) })] }));
}
/** Stub empty state for "tab without data yet". */
export function TabEmpty({ title, description, }) {
    return (_jsx(Card, { children: _jsx(CardContent, { children: _jsx(EmptyStateFramework, { kind: "cleared", title: title, description: description }) }) }));
}
/** Consistent "related records" block — used in the Related tab. */
export function RelatedRecordsBlock({ title, description, rows, columns, onRowClick, allHref, }) {
    if (rows.length === 0) {
        return (_jsxs(Card, { children: [_jsxs(CardHeader, { children: [_jsx(CardTitle, { children: title }), description && _jsx(CardDescription, { children: description })] }), _jsx(CardContent, { children: _jsx(EmptyStateFramework, { kind: "cleared", title: "Nothing linked yet" }) })] }));
    }
    return (_jsxs(Card, { children: [_jsx(CardHeader, { children: _jsxs("div", { className: "flex items-center justify-between w-full", children: [_jsxs("div", { children: [_jsx(CardTitle, { children: title }), description && _jsx(CardDescription, { children: description })] }), allHref && (_jsxs("a", { href: `#${allHref}`, className: "text-xs text-text-muted hover:text-text-primary inline-flex items-center gap-1", children: ["View all", _jsx(ChevronRight, { className: "h-3 w-3" })] }))] }) }), _jsx(CardContent, { className: "p-0", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { children: _jsx("tr", { className: "border-b border-border text-xs uppercase tracking-wider text-text-muted", children: columns.map((c) => (_jsx("th", { className: "text-left px-3 py-2 font-medium", children: c.label }, c.label))) }) }), _jsx("tbody", { children: rows.map((r, i) => (_jsx("tr", { className: cn("border-b border-border-subtle last:border-b-0", onRowClick && "cursor-pointer hover:bg-surface-1"), onClick: () => onRowClick?.(r), children: columns.map((c) => (_jsx("td", { className: "px-3 py-2", children: c.render(r) }, c.label))) }, i))) })] }) })] }));
}
