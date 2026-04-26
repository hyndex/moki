import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import * as React from "react";
import { RefreshCw, Search, Zap } from "lucide-react";
import { PageHeader } from "@/admin-primitives/PageHeader";
import { Card, CardContent } from "@/admin-primitives/Card";
import { EmptyState } from "@/admin-primitives/EmptyState";
import { StatusDot } from "@/admin-primitives/StatusDot";
import { Button } from "@/primitives/Button";
import { Input } from "@/primitives/Input";
import { Badge } from "@/primitives/Badge";
import { Avatar } from "@/primitives/Avatar";
import { Spinner } from "@/primitives/Spinner";
import { useLiveAudit } from "@/runtime/audit";
import { formatRelative } from "@/lib/format";
/** Shows the *real* audit log from /api/audit (not the seeded audit.event
 *  resource). Updates live through the realtime WebSocket. */
export function LiveAuditPage() {
    const [search, setSearch] = React.useState("");
    const [page, setPage] = React.useState(1);
    const { data, loading, error, refetch } = useLiveAudit({
        page,
        pageSize: 50,
        search: search || undefined,
    });
    React.useEffect(() => setPage(1), [search]);
    return (_jsxs("div", { className: "flex flex-col gap-4", children: [_jsx(PageHeader, { title: "Audit log", description: data
                    ? `${data.total.toLocaleString()} events · live stream`
                    : "Live stream of every mutation on the backend.", actions: _jsxs(_Fragment, { children: [_jsxs("span", { className: "inline-flex items-center gap-1 text-xs text-intent-success", children: [_jsx(StatusDot, { intent: "success", pulse: true }), " Realtime"] }), _jsx(Button, { variant: "ghost", size: "sm", onClick: refetch, iconLeft: loading ? _jsx(Spinner, { size: 12 }) : _jsx(RefreshCw, { className: "h-3.5 w-3.5" }), children: "Refresh" })] }) }), _jsx("div", { className: "flex items-center gap-2 flex-wrap", children: _jsx("div", { className: "min-w-[220px] flex-1 max-w-md", children: _jsx(Input, { prefix: _jsx(Search, { className: "h-3.5 w-3.5" }), placeholder: "Search actor, action, resource\u2026", value: search, onChange: (e) => setSearch(e.target.value) }) }) }), error ? (_jsx(EmptyState, { title: "Couldn't load audit log", description: error instanceof Error ? error.message : "Unknown error" })) : !data ? (_jsxs("div", { className: "py-16 flex items-center justify-center text-sm text-text-muted", children: [_jsx(Spinner, { size: 14 }), " ", _jsx("span", { className: "ml-2", children: "Loading audit log\u2026" })] })) : data.rows.length === 0 ? (_jsx(EmptyState, { title: "No audit events", description: "The backend hasn't recorded any state-changing events yet.", icon: _jsx(Zap, { className: "h-5 w-5" }) })) : (_jsx(Card, { children: _jsx(CardContent, { className: "p-0", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { className: "bg-surface-1 border-b border-border text-xs uppercase tracking-wider text-text-muted", children: _jsxs("tr", { children: [_jsx("th", { className: "text-left px-3 py-2 font-medium w-40", children: "When" }), _jsx("th", { className: "text-left py-2 font-medium w-20", children: "Level" }), _jsx("th", { className: "text-left py-2 font-medium", children: "Actor" }), _jsx("th", { className: "text-left py-2 font-medium", children: "Action" }), _jsx("th", { className: "text-left py-2 font-medium", children: "Resource" }), _jsx("th", { className: "text-left py-2 font-medium pr-3", children: "Record" })] }) }), _jsx("tbody", { children: data.rows.map((ev) => (_jsxs("tr", { className: "border-b border-border-subtle last:border-b-0 hover:bg-surface-1 transition-colors", children: [_jsx("td", { className: "px-3 py-2 text-text-secondary", children: formatRelative(ev.occurredAt) }), _jsx("td", { className: "py-2", children: _jsx(Badge, { intent: ev.level === "error"
                                                    ? "danger"
                                                    : ev.level === "warn"
                                                        ? "warning"
                                                        : "info", children: ev.level }) }), _jsx("td", { className: "py-2", children: _jsxs("span", { className: "inline-flex items-center gap-2", children: [_jsx(Avatar, { name: ev.actor, size: "xs" }), _jsx("span", { className: "text-text-primary", children: ev.actor })] }) }), _jsx("td", { className: "py-2 text-text-primary font-medium", children: _jsx("code", { className: "text-xs font-mono", children: ev.action }) }), _jsx("td", { className: "py-2 text-text-secondary", children: _jsx("code", { className: "text-xs font-mono", children: ev.resource }) }), _jsx("td", { className: "py-2 pr-3", children: ev.recordId ? (_jsx("code", { className: "text-xs font-mono text-text-muted", children: ev.recordId })) : null })] }, ev.id))) })] }) }) })), data && data.total > data.pageSize && (_jsxs("div", { className: "flex items-center justify-between text-xs text-text-muted", children: [_jsxs("span", { children: ["Page ", data.page, " \u00B7 showing ", data.rows.length, " of", " ", data.total.toLocaleString()] }), _jsxs("div", { className: "flex gap-2", children: [_jsx(Button, { size: "sm", variant: "ghost", disabled: data.page <= 1, onClick: () => setPage((p) => Math.max(1, p - 1)), children: "Previous" }), _jsx(Button, { size: "sm", variant: "ghost", disabled: data.rows.length < data.pageSize, onClick: () => setPage((p) => p + 1), children: "Next" })] })] }))] }));
}
