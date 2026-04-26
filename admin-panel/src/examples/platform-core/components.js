import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import * as React from "react";
import { Activity, CheckCircle2, Database, Webhook, Key, Globe, } from "lucide-react";
import { PageHeader } from "@/admin-primitives/PageHeader";
import { MetricGrid } from "@/admin-primitives/MetricGrid";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/admin-primitives/Card";
import { BarChart } from "@/admin-primitives/charts/BarChart";
import { LineChart } from "@/admin-primitives/charts/LineChart";
import { Donut } from "@/admin-primitives/charts/Donut";
import { Timeline } from "@/admin-primitives/Timeline";
import { SettingsLayout } from "@/admin-primitives/SettingsLayout";
import { StatusDot } from "@/admin-primitives/StatusDot";
import { EmptyState } from "@/admin-primitives/EmptyState";
import { FormField } from "@/admin-primitives/FormField";
import { Badge } from "@/primitives/Badge";
import { Button } from "@/primitives/Button";
import { Input } from "@/primitives/Input";
import { Switch } from "@/primitives/Switch";
import { Checkbox } from "@/primitives/Checkbox";
import { cn } from "@/lib/cn";
import { formatRelative } from "@/lib/format";
import { Sparkline } from "@/admin-primitives/charts/Sparkline";
import { useAllRecords, useList } from "@/runtime/hooks";
import { useLiveAudit } from "@/runtime/audit";
import { apiFetch, authStore } from "@/runtime/auth";
import { Spinner } from "@/primitives/Spinner";
export function HomeOverviewPage() {
    const { data: metrics, loading: metricsLoading } = useAllRecords("platform.metric");
    const { data: ticketsOpen } = useList("support-service.ticket", {
        filters: { status: "open" },
        pageSize: 1,
    });
    const { data: ticketsInProgress } = useList("support-service.ticket", {
        filters: { status: "in_progress" },
        pageSize: 1,
    });
    const { data: ticketsResolved } = useList("support-service.ticket", {
        filters: { status: "resolved" },
        pageSize: 1,
    });
    const { data: dealsOpen } = useList("sales.deal", {
        filters: { stage: "negotiate" },
        pageSize: 1,
    });
    const { data: audit } = useLiveAudit({ pageSize: 6 });
    if (metricsLoading && metrics.length === 0) {
        return (_jsxs("div", { className: "flex items-center justify-center py-16 text-sm text-text-muted", children: [_jsx(Spinner, { size: 14 }), " ", _jsx("span", { className: "ml-2", children: "Loading dashboard\u2026" })] }));
    }
    const mrr = metrics.find((m) => m.key === "mrr");
    const activeUsers = metrics.find((m) => m.key === "active-users");
    const pipeline = metrics.find((m) => m.key === "pipeline-value");
    const systemHealth = metrics.find((m) => m.key === "system-health");
    const pluginActivity = metrics.find((m) => m.key === "plugin-activity-24h");
    const openCount = ticketsOpen?.total ?? 0;
    const inProgressCount = ticketsInProgress?.total ?? 0;
    const resolvedCount = ticketsResolved?.total ?? 0;
    const totalTickets = openCount + inProgressCount + resolvedCount;
    const months = mrr?.series?.map((s) => s.x) ?? [];
    const mrrSeries = mrr?.series?.map((s) => s.y / 1000) ?? [];
    return (_jsxs("div", { className: "flex flex-col gap-5", children: [_jsx(PageHeader, { title: "Operations overview", description: "Live snapshot across every plugin in this workspace." }), _jsx(MetricGrid, { columns: 4, metrics: [
                    {
                        label: mrr?.label ?? "MRR",
                        value: mrr ? `$${Math.round((mrr.latest ?? 0) / 1000)}K` : "—",
                        trend: mrr?.trendPct != null
                            ? { value: mrr.trendPct, positive: mrr.trendPct >= 0, label: "vs last mo" }
                            : undefined,
                    },
                    {
                        label: "Open tickets",
                        value: String(openCount),
                        trend: { value: 4, positive: false, label: `of ${totalTickets}` },
                    },
                    {
                        label: pipeline?.label ?? "Pipeline",
                        value: pipeline
                            ? `$${((pipeline.latest ?? 0) / 1_000_000).toFixed(2)}M`
                            : "—",
                        trend: pipeline?.trendPct != null
                            ? {
                                value: pipeline.trendPct,
                                positive: pipeline.trendPct >= 0,
                                label: `${dealsOpen?.total ?? 0} negotiating`,
                            }
                            : undefined,
                    },
                    {
                        label: activeUsers?.label ?? "Active users",
                        value: activeUsers ? activeUsers.latest?.toLocaleString() ?? "—" : "—",
                        trend: activeUsers?.trendPct != null
                            ? {
                                value: activeUsers.trendPct,
                                positive: activeUsers.trendPct >= 0,
                                label: "dau",
                            }
                            : undefined,
                    },
                ] }), _jsxs("div", { className: "grid gap-3 grid-cols-1 lg:grid-cols-3", children: [_jsxs(Card, { className: "lg:col-span-2", children: [_jsx(CardHeader, { children: _jsxs("div", { children: [_jsxs(CardTitle, { children: [mrr?.label ?? "Revenue", " trend"] }), _jsx(CardDescription, { children: "Monthly recurring revenue, last 12 months." })] }) }), _jsx(CardContent, { children: months.length > 0 ? (_jsx(LineChart, { xLabels: months, series: [{ label: "MRR ($K)", data: mrrSeries }], height: 220, valueFormatter: (v) => `$${Math.round(v)}K` })) : (_jsx("div", { className: "text-sm text-text-muted py-8 text-center", children: "No data yet" })) })] }), _jsxs(Card, { children: [_jsx(CardHeader, { children: _jsxs("div", { children: [_jsx(CardTitle, { children: "Tickets by status" }), _jsx(CardDescription, { children: "Support workload distribution." })] }) }), _jsx(CardContent, { children: _jsx(Donut, { data: [
                                        { label: "Open", value: openCount },
                                        { label: "In progress", value: inProgressCount },
                                        { label: "Resolved", value: resolvedCount },
                                    ], centerLabel: _jsxs("div", { children: [_jsx("div", { className: "text-xl font-semibold text-text-primary", children: totalTickets }), _jsx("div", { className: "text-xs text-text-muted", children: "total" })] }) }) })] })] }), _jsxs("div", { className: "grid gap-3 grid-cols-1 lg:grid-cols-2", children: [_jsxs(Card, { children: [_jsxs(CardHeader, { children: [_jsxs("div", { children: [_jsx(CardTitle, { children: "System health" }), _jsx(CardDescription, { children: "All critical services." })] }), _jsxs(Badge, { intent: systemHealth?.services?.some((s) => s.status === "down")
                                            ? "danger"
                                            : systemHealth?.services?.some((s) => s.status === "warn")
                                                ? "warning"
                                                : "success", children: [_jsx(StatusDot, { intent: systemHealth?.services?.some((s) => s.status === "down")
                                                    ? "danger"
                                                    : systemHealth?.services?.some((s) => s.status === "warn")
                                                        ? "warning"
                                                        : "success", pulse: true }), " ", systemHealth?.services?.some((s) => s.status !== "ok")
                                                ? "Degraded"
                                                : "Operational"] })] }), _jsx(CardContent, { children: _jsx("ul", { className: "flex flex-col gap-2", children: (systemHealth?.services ?? []).map((s) => {
                                        const intent = s.status === "ok"
                                            ? "success"
                                            : s.status === "warn"
                                                ? "warning"
                                                : "danger";
                                        return (_jsxs("li", { className: "flex items-center gap-3 py-1", children: [_jsx(StatusDot, { intent: intent }), _jsx("span", { className: "text-sm text-text-primary", children: s.name }), _jsx(Sparkline, { data: s.latency, className: "ml-auto", color: s.status === "ok"
                                                        ? "rgb(var(--intent-success))"
                                                        : s.status === "warn"
                                                            ? "rgb(var(--intent-warning))"
                                                            : "rgb(var(--intent-danger))" }), _jsxs("span", { className: "text-xs text-text-muted w-12 text-right tabular-nums", children: [s.latency[s.latency.length - 1], "ms"] })] }, s.name));
                                    }) }) })] }), _jsxs(Card, { children: [_jsx(CardHeader, { children: _jsxs("div", { children: [_jsx(CardTitle, { children: "Recent activity" }), _jsx(CardDescription, { children: "Latest API mutations across the platform." })] }) }), _jsx(CardContent, { children: !audit || audit.rows.length === 0 ? (_jsx(EmptyState, { title: "No events yet", description: "Start clicking around." })) : (_jsx(Timeline, { items: audit.rows.map((ev) => ({
                                        id: ev.id,
                                        title: (_jsxs("span", { children: [_jsx("span", { className: "font-medium text-text-primary", children: ev.actor }), " ", _jsx("code", { className: "text-xs font-mono text-text-secondary", children: ev.action })] })),
                                        description: ev.recordId ? (_jsx("code", { className: "text-xs font-mono text-text-muted", children: ev.recordId })) : undefined,
                                        occurredAt: ev.occurredAt,
                                        intent: ev.level === "error"
                                            ? "danger"
                                            : ev.level === "warn"
                                                ? "warning"
                                                : "info",
                                        icon: _jsx(Activity, { className: "h-3.5 w-3.5" }),
                                    })) })) })] })] }), pluginActivity?.series && (_jsxs(Card, { children: [_jsx(CardHeader, { children: _jsxs("div", { children: [_jsx(CardTitle, { children: pluginActivity.label }), _jsx(CardDescription, { children: "Calls per plugin over the last 24 hours." })] }) }), _jsx(CardContent, { children: _jsx(BarChart, { data: pluginActivity.series.map((s) => ({ label: s.x, value: s.y })), height: 200 }) })] }))] }));
}
/* --- Settings hub --------------------------------------------------------- */
export function SettingsPage() {
    return (_jsxs("div", { className: "flex flex-col gap-4", children: [_jsx(PageHeader, { title: "Settings", description: "Configure your workspace, team, billing, and integrations." }), _jsx(SettingsLayout, { sections: [
                    { id: "general", label: "General", icon: "Settings", render: GeneralSettings },
                    { id: "profile", label: "Profile", icon: "User", render: ProfileSettings },
                    { id: "team", label: "Team", icon: "UsersRound", render: TeamSettings },
                    { id: "billing", label: "Billing", icon: "CreditCard", render: BillingSettings },
                    { id: "security", label: "Security", icon: "Shield", render: SecuritySettings },
                    { id: "api", label: "API keys", icon: "Key", render: ApiKeysSettings },
                    { id: "webhooks", label: "Webhooks", icon: "Webhook", render: WebhooksSettings },
                    { id: "notifications", label: "Notifications", icon: "Bell", render: NotificationSettings },
                    { id: "appearance", label: "Appearance", icon: "Palette", render: AppearanceSettings },
                ] })] }));
}
function SettingRow({ label, description, children, }) {
    return (_jsxs("div", { className: "flex items-start justify-between gap-6 py-3 border-b border-border-subtle last:border-b-0", children: [_jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("div", { className: "text-sm font-medium text-text-primary", children: label }), description && (_jsx("div", { className: "text-xs text-text-muted mt-0.5", children: description }))] }), _jsx("div", { className: "shrink-0", children: children })] }));
}
function GeneralSettings() {
    return (_jsx(Card, { children: _jsxs(CardContent, { className: "pt-4", children: [_jsx(SettingRow, { label: "Workspace name", children: _jsx(Input, { defaultValue: "Gutu", className: "w-64" }) }), _jsx(SettingRow, { label: "Timezone", children: _jsx(Input, { defaultValue: "America/Los_Angeles", className: "w-64" }) }), _jsx(SettingRow, { label: "Default currency", children: _jsx(Input, { defaultValue: "USD", className: "w-32" }) }), _jsx(SettingRow, { label: "Locale", children: _jsx(Input, { defaultValue: "en-US", className: "w-32" }) }), _jsx("div", { className: "flex justify-end pt-3", children: _jsx(Button, { variant: "primary", children: "Save changes" }) })] }) }));
}
function ProfileSettings() {
    return (_jsx(Card, { children: _jsxs(CardContent, { className: "pt-4", children: [_jsxs("div", { className: "flex items-center gap-4 pb-4 border-b border-border-subtle mb-2", children: [_jsx("div", { className: "w-14 h-14 rounded-full bg-accent-subtle text-accent flex items-center justify-center text-lg font-semibold", children: "CB" }), _jsxs("div", { children: [_jsx("div", { className: "text-sm font-medium text-text-primary", children: "Chinmoy Bhuyan" }), _jsx("div", { className: "text-xs text-text-muted", children: "chinmoy@gutu.dev \u00B7 Admin" })] }), _jsx(Button, { variant: "secondary", size: "sm", className: "ml-auto", children: "Change photo" })] }), _jsxs("div", { className: "grid grid-cols-2 gap-4 pb-3", children: [_jsx(FormField, { label: "First name", children: _jsx(Input, { defaultValue: "Chinmoy" }) }), _jsx(FormField, { label: "Last name", children: _jsx(Input, { defaultValue: "Bhuyan" }) }), _jsx(FormField, { label: "Email", className: "col-span-2", children: _jsx(Input, { defaultValue: "chinmoy@gutu.dev", type: "email" }) }), _jsx(FormField, { label: "Title", children: _jsx(Input, { defaultValue: "Founder" }) }), _jsx(FormField, { label: "Timezone", children: _jsx(Input, { defaultValue: "America/Los_Angeles" }) })] }), _jsx("div", { className: "flex justify-end pt-3", children: _jsx(Button, { variant: "primary", children: "Save profile" }) })] }) }));
}
function TeamSettings() {
    const seats = [
        { name: "Chinmoy Bhuyan", email: "chinmoy@gutu.dev", role: "Admin", status: "active" },
        { name: "Sam Rivera", email: "sam@gutu.dev", role: "Member", status: "active" },
        { name: "Alex Chen", email: "alex@gutu.dev", role: "Member", status: "invited" },
        { name: "Taylor Nguyen", email: "taylor@gutu.dev", role: "Viewer", status: "active" },
    ];
    return (_jsxs(Card, { children: [_jsxs(CardHeader, { children: [_jsxs("div", { children: [_jsx(CardTitle, { children: "Members" }), _jsx(CardDescription, { children: "4 of 10 seats used on the Pro plan." })] }), _jsx(Button, { size: "sm", variant: "primary", children: "Invite member" })] }), _jsx(CardContent, { children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "text-left text-xs uppercase tracking-wider text-text-muted border-b border-border", children: [_jsx("th", { className: "py-2 font-medium", children: "Name" }), _jsx("th", { className: "py-2 font-medium", children: "Role" }), _jsx("th", { className: "py-2 font-medium", children: "Status" })] }) }), _jsx("tbody", { children: seats.map((s) => (_jsxs("tr", { className: "border-b border-border-subtle last:border-b-0", children: [_jsxs("td", { className: "py-2", children: [_jsx("div", { className: "text-text-primary", children: s.name }), _jsx("div", { className: "text-xs text-text-muted", children: s.email })] }), _jsx("td", { className: "py-2", children: _jsx(Badge, { intent: s.role === "Admin" ? "danger" : s.role === "Viewer" ? "neutral" : "info", children: s.role }) }), _jsxs("td", { className: "py-2", children: [_jsx(StatusDot, { intent: s.status === "active" ? "success" : "warning" }), _jsx("span", { className: "ml-2 text-text-secondary", children: s.status === "active" ? "Active" : "Invite pending" })] })] }, s.email))) })] }) })] }));
}
function BillingSettings() {
    return (_jsxs("div", { className: "flex flex-col gap-4", children: [_jsx(Card, { children: _jsx(CardContent, { className: "pt-4", children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("div", { className: "text-xs font-medium text-text-muted uppercase tracking-wide", children: "Current plan" }), _jsx("div", { className: "text-2xl font-semibold text-text-primary mt-1", children: "Pro" }), _jsx("div", { className: "text-sm text-text-muted", children: "$240 / month \u00B7 next charge Feb 1" })] }), _jsx(Button, { variant: "secondary", children: "Change plan" })] }) }) }), _jsxs(Card, { children: [_jsx(CardHeader, { children: _jsx("div", { children: _jsx(CardTitle, { children: "Usage this cycle" }) }) }), _jsx(CardContent, { children: _jsx(MetricGrid, { columns: 3, metrics: [
                                { label: "Seats", value: "4 / 10" },
                                { label: "Records", value: "24,180 / 100K" },
                                { label: "AI tokens", value: "1.2M / 5M" },
                            ] }) })] })] }));
}
function SecuritySettings() {
    return (_jsxs("div", { className: "flex flex-col gap-4", children: [_jsx(MfaCard, {}), _jsx(PasswordCard, {}), _jsx(Card, { children: _jsxs(CardContent, { className: "pt-4", children: [_jsx(SettingRow, { label: "Session timeout", description: "Auto-sign-out after inactivity.", children: _jsx(Input, { defaultValue: "30 minutes", className: "w-40" }) }), _jsx(SettingRow, { label: "SSO enforcement", description: "Require Google / Okta for all members.", children: _jsx(Switch, {}) }), _jsx(SettingRow, { label: "IP allowlist", description: "Comma-separated CIDR ranges.", children: _jsx(Input, { defaultValue: "10.0.0.0/8, 203.0.113.0/24", className: "w-72" }) })] }) })] }));
}
function MfaCard() {
    const [status, setStatus] = React.useState(null);
    const [setupSecret, setSetupSecret] = React.useState(null);
    const [code, setCode] = React.useState("");
    const [busy, setBusy] = React.useState(false);
    const [error, setError] = React.useState(null);
    const load = React.useCallback(async () => {
        try {
            const res = await apiFetch("/auth/mfa/status");
            setStatus(res);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "failed");
        }
    }, []);
    React.useEffect(() => {
        void load();
    }, [load]);
    const start = async () => {
        setBusy(true);
        setError(null);
        try {
            const res = await apiFetch("/auth/mfa/setup", { method: "POST" });
            setSetupSecret(res);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "setup failed");
        }
        finally {
            setBusy(false);
        }
    };
    const enable = async () => {
        setBusy(true);
        setError(null);
        try {
            await apiFetch("/auth/mfa/enable", {
                method: "POST",
                body: JSON.stringify({ code }),
            });
            setSetupSecret(null);
            setCode("");
            await load();
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "enable failed");
        }
        finally {
            setBusy(false);
        }
    };
    const disable = async () => {
        setBusy(true);
        setError(null);
        try {
            await apiFetch("/auth/mfa/disable", {
                method: "POST",
                body: JSON.stringify({ code }),
            });
            setCode("");
            await load();
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "disable failed");
        }
        finally {
            setBusy(false);
        }
    };
    return (_jsxs(Card, { children: [_jsxs(CardHeader, { children: [_jsxs("div", { children: [_jsx(CardTitle, { children: "Two-factor authentication" }), _jsx(CardDescription, { children: "Require a TOTP code on every sign-in. Use any standard authenticator app." })] }), _jsx(Badge, { intent: status?.enabled ? "success" : "neutral", children: status?.enabled ? "Enabled" : "Disabled" })] }), _jsxs(CardContent, { children: [error && (_jsx("div", { className: "text-xs text-intent-danger bg-intent-danger-bg border border-intent-danger/30 rounded-md px-2 py-1.5 mb-3", children: error })), !status?.enabled && !setupSecret && (_jsx(Button, { variant: "primary", size: "sm", loading: busy, onClick: start, children: "Start MFA setup" })), setupSecret && (_jsxs("div", { className: "flex flex-col gap-3", children: [_jsx("div", { className: "text-sm text-text-secondary", children: "Scan this otpauth URL with an authenticator app, then enter the 6-digit code it generates:" }), _jsx("pre", { className: "text-xs font-mono bg-surface-1 border border-border rounded-md p-3 overflow-x-auto break-all whitespace-pre-wrap", children: setupSecret.otpauthUrl }), _jsxs("div", { className: "text-xs text-text-muted", children: ["Or enter this secret manually:", " ", _jsx("code", { className: "font-mono text-text-secondary", children: setupSecret.secret })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Input, { placeholder: "123 456", value: code, onChange: (e) => setCode(e.target.value), className: "w-32 font-mono" }), _jsx(Button, { variant: "primary", size: "sm", loading: busy, onClick: enable, children: "Verify & enable" }), _jsx(Button, { variant: "ghost", size: "sm", onClick: () => setSetupSecret(null), children: "Cancel" })] })] })), status?.enabled && (_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Input, { placeholder: "Enter 6-digit code to disable", value: code, onChange: (e) => setCode(e.target.value), className: "w-52 font-mono" }), _jsx(Button, { variant: "danger", size: "sm", loading: busy, onClick: disable, children: "Disable MFA" })] }))] })] }));
}
function PasswordCard() {
    const [email, setEmail] = React.useState(authStore.user?.email ?? "");
    const [sent, setSent] = React.useState(null);
    const [busy, setBusy] = React.useState(false);
    const [error, setError] = React.useState(null);
    const trigger = async () => {
        setBusy(true);
        setError(null);
        setSent(null);
        try {
            const res = await apiFetch("/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) });
            setSent(res.devToken
                ? `Reset link logged to backend console + devToken: ${res.devToken}`
                : "If that email exists, a reset link was sent.");
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "failed");
        }
        finally {
            setBusy(false);
        }
    };
    return (_jsxs(Card, { children: [_jsx(CardHeader, { children: _jsxs("div", { children: [_jsx(CardTitle, { children: "Password reset" }), _jsx(CardDescription, { children: "Request a reset link for yourself or another team member." })] }) }), _jsxs(CardContent, { children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Input, { type: "email", value: email, onChange: (e) => setEmail(e.target.value), className: "w-72" }), _jsx(Button, { size: "sm", variant: "primary", loading: busy, onClick: trigger, disabled: !email, children: "Send reset link" })] }), sent && _jsx("div", { className: "text-xs text-intent-success mt-2", children: sent }), error && _jsx("div", { className: "text-xs text-intent-danger mt-2", children: error })] })] }));
}
function ApiKeysSettings() {
    const keys = [
        { name: "Production", prefix: "pk_live_24f8…", created: "2025-08-12", lastUsed: "2 min ago" },
        { name: "Staging", prefix: "pk_test_a11b…", created: "2025-11-03", lastUsed: "Yesterday" },
        { name: "CI", prefix: "pk_ci_ff92…", created: "2024-12-20", lastUsed: "3 weeks ago" },
    ];
    return (_jsxs(Card, { children: [_jsxs(CardHeader, { children: [_jsxs("div", { children: [_jsx(CardTitle, { children: "API keys" }), _jsx(CardDescription, { children: "Server-to-server credentials." })] }), _jsx(Button, { size: "sm", variant: "primary", iconLeft: _jsx(Key, { className: "h-3.5 w-3.5" }), children: "New key" })] }), _jsx(CardContent, { children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "text-left text-xs uppercase tracking-wider text-text-muted border-b border-border", children: [_jsx("th", { className: "py-2 font-medium", children: "Name" }), _jsx("th", { className: "py-2 font-medium", children: "Key" }), _jsx("th", { className: "py-2 font-medium", children: "Created" }), _jsx("th", { className: "py-2 font-medium", children: "Last used" })] }) }), _jsx("tbody", { children: keys.map((k) => (_jsxs("tr", { className: "border-b border-border-subtle last:border-b-0", children: [_jsx("td", { className: "py-2 text-text-primary", children: k.name }), _jsx("td", { className: "py-2 font-mono text-xs text-text-secondary", children: k.prefix }), _jsx("td", { className: "py-2 text-text-secondary", children: k.created }), _jsx("td", { className: "py-2 text-text-secondary", children: k.lastUsed })] }, k.name))) })] }) })] }));
}
function WebhooksSettings() {
    const hooks = [
        { url: "https://api.acme.com/gutu-events", events: 12, status: "ok" },
        { url: "https://zapier.com/hooks/abc123", events: 4, status: "ok" },
        { url: "https://staging.globex.io/in", events: 7, status: "failing" },
    ];
    return (_jsxs(Card, { children: [_jsxs(CardHeader, { children: [_jsxs("div", { children: [_jsx(CardTitle, { children: "Webhooks" }), _jsx(CardDescription, { children: "Outbound events delivered to your endpoints." })] }), _jsx(Button, { size: "sm", variant: "primary", iconLeft: _jsx(Webhook, { className: "h-3.5 w-3.5" }), children: "Add endpoint" })] }), _jsx(CardContent, { children: _jsx("ul", { className: "flex flex-col divide-y divide-border-subtle", children: hooks.map((h) => (_jsxs("li", { className: "flex items-center gap-3 py-2", children: [_jsx(StatusDot, { intent: h.status === "ok" ? "success" : "danger", pulse: h.status !== "ok" }), _jsx("code", { className: "flex-1 font-mono text-xs text-text-secondary truncate", children: h.url }), _jsxs("span", { className: "text-xs text-text-muted", children: [h.events, " events"] }), _jsx(Button, { size: "xs", variant: "ghost", children: "Test" })] }, h.url))) }) })] }));
}
function NotificationSettings() {
    return (_jsx(Card, { children: _jsx(CardContent, { className: "pt-4", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "text-left text-xs uppercase tracking-wider text-text-muted border-b border-border", children: [_jsx("th", { className: "py-2 font-medium", children: "Event" }), _jsx("th", { className: "py-2 font-medium text-center", children: "Email" }), _jsx("th", { className: "py-2 font-medium text-center", children: "In-app" }), _jsx("th", { className: "py-2 font-medium text-center", children: "Slack" })] }) }), _jsx("tbody", { children: [
                            { name: "New contact", email: true, inapp: true, slack: false },
                            { name: "Ticket assigned to me", email: true, inapp: true, slack: true },
                            { name: "Invoice paid", email: false, inapp: true, slack: false },
                            { name: "Booking cancelled", email: true, inapp: true, slack: true },
                            { name: "Deploy finished", email: false, inapp: true, slack: true },
                            { name: "Weekly digest", email: true, inapp: false, slack: false },
                        ].map((r, i) => (_jsxs("tr", { className: "border-b border-border-subtle last:border-b-0", children: [_jsx("td", { className: "py-2 text-text-primary", children: r.name }), _jsx("td", { className: "py-2 text-center", children: _jsx(Checkbox, { defaultChecked: r.email }) }), _jsx("td", { className: "py-2 text-center", children: _jsx(Checkbox, { defaultChecked: r.inapp }) }), _jsx("td", { className: "py-2 text-center", children: _jsx(Checkbox, { defaultChecked: r.slack }) })] }, i))) })] }) }) }));
}
function AppearanceSettings() {
    return (_jsx(Card, { children: _jsxs(CardContent, { className: "pt-4", children: [_jsx(SettingRow, { label: "Theme", description: "Toggle in the top bar to switch instantly.", children: _jsx("span", { className: "text-xs text-text-muted", children: "Use the sun/moon icon in the topbar." }) }), _jsx(SettingRow, { label: "Density", description: "Affects row height everywhere.", children: _jsx("span", { className: "text-xs text-text-muted", children: "Also in the topbar menu." }) }), _jsx(SettingRow, { label: "Accent color", description: "Design token override at the workspace level.", children: _jsx("div", { className: "flex items-center gap-1", children: ["#4f46e5", "#2563eb", "#0891b2", "#059669", "#d97706", "#db2777"].map((c) => (_jsx("button", { className: cn("w-6 h-6 rounded-md ring-2 ring-offset-2 ring-offset-surface-0 transition-all", c === "#4f46e5" ? "ring-text-primary" : "ring-transparent"), style: { background: c }, "aria-label": c, type: "button" }, c))) }) })] }) }));
}
/* --- Profile -------------------------------------------------------------- */
export function ProfilePage() {
    return (_jsxs("div", { className: "flex flex-col gap-4", children: [_jsx(PageHeader, { title: "Your profile", description: "Personal account details." }), _jsx(ProfileSettings, {})] }));
}
/* --- Notifications inbox -------------------------------------------------- */
export function NotificationsInboxPage() {
    const { data: serverItems, loading } = useAllRecords("platform.notification");
    const [readIds, setReadIds] = React.useState(new Set());
    const [hideIds, setHideIds] = React.useState(new Set());
    if (loading && serverItems.length === 0)
        return (_jsxs("div", { className: "py-16 flex items-center justify-center text-sm text-text-muted gap-2", children: [_jsx(Spinner, { size: 14 }), " Loading\u2026"] }));
    const items = serverItems
        .filter((n) => !hideIds.has(n.id))
        .map((n) => ({ ...n, read: n.read || readIds.has(n.id) }))
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    const unread = items.filter((n) => !n.read).length;
    return (_jsxs("div", { className: "flex flex-col gap-4", children: [_jsx(PageHeader, { title: "Notifications", description: `${unread} unread · ${items.length} total`, actions: _jsx(Button, { variant: "secondary", onClick: () => setReadIds(new Set(items.map((i) => i.id))), children: "Mark all read" }) }), items.length === 0 ? (_jsx(EmptyState, { title: "Inbox zero", description: "You're all caught up." })) : (_jsx(Card, { children: _jsx(CardContent, { className: "p-0", children: _jsx("ul", { className: "divide-y divide-border-subtle", children: items.map((n) => (_jsxs("li", { className: cn("flex items-center gap-3 p-3", !n.read && "bg-accent-subtle/30"), children: [_jsx(StatusDot, { intent: n.intent }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("div", { className: cn("text-sm", !n.read
                                                ? "text-text-primary font-medium"
                                                : "text-text-secondary"), children: n.title }), _jsx("div", { className: "text-xs text-text-muted", children: formatRelative(n.createdAt) })] }), !n.read && (_jsx(Button, { size: "xs", variant: "ghost", onClick: () => setReadIds((s) => {
                                        const next = new Set(s);
                                        next.add(n.id);
                                        return next;
                                    }), children: "Mark read" }))] }, n.id))) }) }) }))] }));
}
/* --- Global search -------------------------------------------------------- */
export function SearchResultsPage() {
    const [q, setQ] = React.useState("");
    const { data: index } = useAllRecords("platform.search-index");
    const results = q
        ? index.filter((r) => r.label.toLowerCase().includes(q.toLowerCase()) ||
            r.kind.toLowerCase().includes(q.toLowerCase()))
        : [];
    return (_jsxs("div", { className: "flex flex-col gap-4", children: [_jsx(PageHeader, { title: "Search", description: "Look up records across every plugin." }), _jsx(Card, { children: _jsxs(CardContent, { className: "pt-4 flex flex-col gap-3", children: [_jsx(Input, { placeholder: "Search for contacts, invoices, tickets, models\u2026", autoFocus: true, value: q, onChange: (e) => setQ(e.target.value) }), q === "" ? (_jsx("div", { className: "text-sm text-text-muted py-6 text-center", children: "Start typing. Try \u201Cada\u201D, \u201Cacme\u201D, or \u201Cclaude\u201D." })) : results.length === 0 ? (_jsx(EmptyState, { title: "No matches", description: `Nothing indexed under “${q}”. Try a different query.` })) : (_jsx("ul", { className: "divide-y divide-border-subtle", children: results.map((r) => (_jsx("li", { children: _jsxs("a", { href: `#${r.path}`, className: "flex items-center gap-3 py-2.5 hover:bg-surface-2 rounded-md px-2 transition-colors", children: [_jsx(Database, { className: "h-4 w-4 text-text-muted" }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("div", { className: "text-sm text-text-primary", children: r.label }), _jsx("div", { className: "text-xs text-text-muted font-mono", children: r.path })] }), _jsx(Badge, { intent: "neutral", children: r.kind })] }) }, r.id))) }))] }) })] }));
}
/* --- Auth preview (mock UI) ---------------------------------------------- */
export function SignInPreviewPage() {
    return (_jsxs("div", { className: "flex flex-col gap-4", children: [_jsx(PageHeader, { title: "Sign-in screen", description: "Preview of the unauthenticated shell (mock)." }), _jsx(Card, { children: _jsx(CardContent, { className: "py-10 flex items-center justify-center", children: _jsxs("div", { className: "w-full max-w-sm flex flex-col gap-4", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: "w-8 h-8 rounded-md bg-accent text-accent-fg flex items-center justify-center font-bold", children: "G" }), _jsxs("div", { children: [_jsx("div", { className: "text-sm font-semibold text-text-primary", children: "Gutu" }), _jsx("div", { className: "text-xs text-text-muted", children: "Sign in to your workspace" })] })] }), _jsx(FormField, { label: "Workspace", children: _jsx(Input, { defaultValue: "gutu", suffix: _jsx("span", { className: "text-xs text-text-muted", children: ".gutu.app" }) }) }), _jsx(FormField, { label: "Email", children: _jsx(Input, { type: "email", defaultValue: "chinmoy@gutu.dev" }) }), _jsx(FormField, { label: "Password", children: _jsx(Input, { type: "password", defaultValue: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" }) }), _jsxs("div", { className: "flex items-center justify-between text-xs", children: [_jsxs("label", { className: "inline-flex items-center gap-2 text-text-secondary", children: [_jsx(Checkbox, { defaultChecked: true }), " Keep me signed in"] }), _jsx("a", { href: "#", className: "text-text-link hover:underline", children: "Forgot password?" })] }), _jsx(Button, { variant: "primary", size: "lg", children: "Continue" }), _jsx("div", { className: "text-center text-xs text-text-muted", children: "or continue with" }), _jsxs("div", { className: "grid grid-cols-3 gap-2", children: [_jsxs(Button, { variant: "outline", size: "sm", children: [_jsx(Globe, { className: "h-3.5 w-3.5 mr-1" }), " Google"] }), _jsx(Button, { variant: "outline", size: "sm", children: "Okta" }), _jsx(Button, { variant: "outline", size: "sm", children: "SAML" })] })] }) }) })] }));
}
export function SignUpPreviewPage() {
    return (_jsxs("div", { className: "flex flex-col gap-4", children: [_jsx(PageHeader, { title: "Sign-up screen", description: "Preview of the new-workspace flow." }), _jsx(Card, { children: _jsx(CardContent, { className: "py-10 flex items-center justify-center", children: _jsxs("div", { className: "w-full max-w-sm flex flex-col gap-4", children: [_jsx("div", { className: "text-lg font-semibold text-text-primary", children: "Start a workspace" }), _jsx(FormField, { label: "Full name", children: _jsx(Input, { defaultValue: "Ada Lovelace" }) }), _jsx(FormField, { label: "Work email", children: _jsx(Input, { type: "email" }) }), _jsx(FormField, { label: "Workspace URL", children: _jsx(Input, { defaultValue: "ada-works", suffix: _jsx("span", { className: "text-xs text-text-muted", children: ".gutu.app" }) }) }), _jsx(FormField, { label: "Password", children: _jsx(Input, { type: "password" }) }), _jsxs("label", { className: "inline-flex items-start gap-2 text-xs text-text-secondary", children: [_jsx(Checkbox, { defaultChecked: true }), _jsx("span", { children: "I agree to the Terms of Service and Privacy Policy." })] }), _jsx(Button, { variant: "primary", size: "lg", children: "Create workspace" })] }) }) })] }));
}
/* --- Onboarding wizard --------------------------------------------------- */
export function OnboardingPage() {
    const { data: raw } = useAllRecords("platform.onboarding-step");
    const steps = raw
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((s) => ({ title: s.title, desc: s.description, done: s.done }));
    const progress = steps.length > 0
        ? Math.round((steps.filter((s) => s.done).length / steps.length) * 100)
        : 0;
    return (_jsxs("div", { className: "flex flex-col gap-4", children: [_jsx(PageHeader, { title: "Onboarding", description: `${progress}% complete` }), _jsx(Card, { children: _jsxs(CardContent, { className: "pt-4", children: [_jsx("div", { className: "w-full h-2 bg-surface-2 rounded-full overflow-hidden mb-4", children: _jsx("div", { className: "h-full bg-accent transition-all duration-base", style: { width: `${progress}%` } }) }), _jsx("ol", { className: "flex flex-col gap-3", children: steps.map((s, i) => (_jsxs("li", { className: cn("flex items-start gap-3 p-3 rounded-md border", s.done
                                    ? "border-intent-success/30 bg-intent-success-bg/40"
                                    : "border-border bg-surface-0"), children: [_jsx("div", { className: cn("w-6 h-6 rounded-full flex items-center justify-center shrink-0", s.done
                                            ? "bg-intent-success text-white"
                                            : "bg-surface-3 text-text-muted"), children: s.done ? _jsx(CheckCircle2, { className: "h-4 w-4" }) : i + 1 }), _jsxs("div", { className: "flex-1", children: [_jsx("div", { className: "text-sm font-medium text-text-primary", children: s.title }), _jsx("div", { className: "text-xs text-text-muted", children: s.desc })] }), !s.done && i === steps.findIndex((x) => !x.done) && (_jsx(Button, { size: "sm", variant: "primary", children: "Start" }))] }, i))) })] }) })] }));
}
/* --- Release notes -------------------------------------------------------- */
export function ReleaseNotesPage() {
    const { data: raw } = useAllRecords("platform.release");
    const releases = raw
        .slice()
        .sort((a, b) => (a.releasedAt < b.releasedAt ? 1 : -1))
        .map((r) => ({ ver: r.version, date: r.releasedAt, entries: r.entries }));
    return (_jsxs("div", { className: "flex flex-col gap-4", children: [_jsx(PageHeader, { title: "Release notes", description: "What shipped and when." }), _jsx("div", { className: "flex flex-col gap-4", children: releases.map((r) => (_jsxs(Card, { children: [_jsx(CardHeader, { children: _jsxs("div", { children: [_jsxs(CardTitle, { children: ["v", r.ver] }), _jsx(CardDescription, { children: r.date })] }) }), _jsx(CardContent, { children: _jsx("ul", { className: "flex flex-col gap-2", children: r.entries.map((e, i) => (_jsxs("li", { className: "flex items-start gap-2 text-sm", children: [_jsx(Badge, { intent: e.kind === "feat"
                                                ? "success"
                                                : e.kind === "fix"
                                                    ? "warning"
                                                    : "neutral", className: "uppercase", children: e.kind }), _jsx("span", { className: "text-text-primary", children: e.text })] }, i))) }) })] }, r.ver))) })] }));
}
