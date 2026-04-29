import * as React from "react";
import {
  Activity,
  CheckCircle2,
  Clock,
  Cpu,
  ShieldCheck,
  User,
  Mail,
  Database,
  Webhook,
  Key,
  Palette,
  Bell,
  Globe,
} from "lucide-react";
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
import { Textarea } from "@/primitives/Textarea";
import { Switch } from "@/primitives/Switch";
import { Checkbox } from "@/primitives/Checkbox";
import { cn } from "@/lib/cn";
import { formatRelative } from "@/lib/format";
import { useRuntime } from "@/runtime/context";
import { Sparkline } from "@/admin-primitives/charts/Sparkline";
import { useAllRecords, useList } from "@/runtime/hooks";
import { useLiveAudit } from "@/runtime/audit";
import { apiFetch, authStore } from "@/runtime/auth";
import { Spinner } from "@/primitives/Spinner";

/* --- Home overview -------------------------------------------------------- */

interface PlatformMetric {
  id: string;
  key: string;
  label: string;
  unit: string;
  latest?: number;
  trendPct?: number;
  series?: { x: string; y: number }[];
  services?: { name: string; status: "ok" | "warn" | "down"; latency: number[] }[];
}

export function HomeOverviewPage() {
  const { data: metrics, loading: metricsLoading } = useAllRecords<PlatformMetric>(
    "platform.metric",
  );
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
    return (
      <div className="flex items-center justify-center py-16 text-sm text-text-muted">
        <Spinner size={14} /> <span className="ml-2">Loading dashboard…</span>
      </div>
    );
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

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Operations overview"
        description="Live snapshot across every plugin in this workspace."
      />

      <MetricGrid
        columns={4}
        metrics={[
          {
            label: mrr?.label ?? "MRR",
            value: mrr ? `$${Math.round((mrr.latest ?? 0) / 1000)}K` : "—",
            trend:
              mrr?.trendPct != null
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
            trend:
              pipeline?.trendPct != null
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
            trend:
              activeUsers?.trendPct != null
                ? {
                    value: activeUsers.trendPct,
                    positive: activeUsers.trendPct >= 0,
                    label: "dau",
                  }
                : undefined,
          },
        ]}
      />

      <div className="grid gap-3 grid-cols-1 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>{mrr?.label ?? "Revenue"} trend</CardTitle>
              <CardDescription>Monthly recurring revenue, last 12 months.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {months.length > 0 ? (
              <LineChart
                xLabels={months}
                series={[{ label: "MRR ($K)", data: mrrSeries }]}
                height={220}
                valueFormatter={(v) => `$${Math.round(v)}K`}
              />
            ) : (
              <div className="text-sm text-text-muted py-8 text-center">No data yet</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Tickets by status</CardTitle>
              <CardDescription>Support workload distribution.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <Donut
              data={[
                { label: "Open", value: openCount },
                { label: "In progress", value: inProgressCount },
                { label: "Resolved", value: resolvedCount },
              ]}
              centerLabel={
                <div>
                  <div className="text-xl font-semibold text-text-primary">
                    {totalTickets}
                  </div>
                  <div className="text-xs text-text-muted">total</div>
                </div>
              }
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-3 grid-cols-1 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>System health</CardTitle>
              <CardDescription>All critical services.</CardDescription>
            </div>
            <Badge
              intent={
                systemHealth?.services?.some((s) => s.status === "down")
                  ? "danger"
                  : systemHealth?.services?.some((s) => s.status === "warn")
                    ? "warning"
                    : "success"
              }
            >
              <StatusDot
                intent={
                  systemHealth?.services?.some((s) => s.status === "down")
                    ? "danger"
                    : systemHealth?.services?.some((s) => s.status === "warn")
                      ? "warning"
                      : "success"
                }
                pulse
              />{" "}
              {systemHealth?.services?.some((s) => s.status !== "ok")
                ? "Degraded"
                : "Operational"}
            </Badge>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-2">
              {(systemHealth?.services ?? []).map((s) => {
                const intent =
                  s.status === "ok"
                    ? "success"
                    : s.status === "warn"
                      ? "warning"
                      : "danger";
                return (
                  <li key={s.name} className="flex items-center gap-3 py-1">
                    <StatusDot intent={intent} />
                    <span className="text-sm text-text-primary">{s.name}</span>
                    <Sparkline
                      data={s.latency}
                      className="ml-auto"
                      color={
                        s.status === "ok"
                          ? "rgb(var(--intent-success))"
                          : s.status === "warn"
                            ? "rgb(var(--intent-warning))"
                            : "rgb(var(--intent-danger))"
                      }
                    />
                    <span className="text-xs text-text-muted w-12 text-right tabular-nums">
                      {s.latency[s.latency.length - 1]}ms
                    </span>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Recent activity</CardTitle>
              <CardDescription>Latest API mutations across the platform.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {!audit || audit.rows.length === 0 ? (
              <EmptyState title="No events yet" description="Start clicking around." />
            ) : (
              <Timeline
                items={audit.rows.map((ev) => ({
                  id: ev.id,
                  title: (
                    <span>
                      <span className="font-medium text-text-primary">{ev.actor}</span>{" "}
                      <code className="text-xs font-mono text-text-secondary">{ev.action}</code>
                    </span>
                  ),
                  description: ev.recordId ? (
                    <code className="text-xs font-mono text-text-muted">{ev.recordId}</code>
                  ) : undefined,
                  occurredAt: ev.occurredAt,
                  intent:
                    ev.level === "error"
                      ? "danger"
                      : ev.level === "warn"
                        ? "warning"
                        : "info",
                  icon: <Activity className="h-3.5 w-3.5" />,
                }))}
              />
            )}
          </CardContent>
        </Card>
      </div>

      {pluginActivity?.series && (
        <Card>
          <CardHeader>
            <div>
              <CardTitle>{pluginActivity.label}</CardTitle>
              <CardDescription>Calls per plugin over the last 24 hours.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <BarChart
              data={pluginActivity.series.map((s) => ({ label: s.x, value: s.y }))}
              height={200}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* --- Settings hub --------------------------------------------------------- */

export function SettingsPage() {
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Settings"
        description="Configure your workspace, team, billing, and integrations."
      />
      <SettingsLayout
        sections={[
          { id: "general", label: "General", icon: "Settings", render: GeneralSettings },
          { id: "profile", label: "Profile", icon: "User", render: ProfileSettings },
          { id: "team", label: "Team", icon: "UsersRound", render: TeamSettings },
          { id: "billing", label: "Billing", icon: "CreditCard", render: BillingSettings },
          { id: "security", label: "Security", icon: "Shield", render: SecuritySettings },
          { id: "api", label: "API keys", icon: "Key", render: ApiKeysSettings },
          { id: "webhooks", label: "Webhooks", icon: "Webhook", render: WebhooksSettings },
          { id: "notifications", label: "Notifications", icon: "Bell", render: NotificationSettings },
          { id: "appearance", label: "Appearance", icon: "Palette", render: AppearanceSettings },
        ]}
      />
    </div>
  );
}

function SettingRow({
  label,
  description,
  children,
}: {
  label: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-6 py-3 border-b border-border-subtle last:border-b-0">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-text-primary">{label}</div>
        {description && (
          <div className="text-xs text-text-muted mt-0.5">{description}</div>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function GeneralSettings() {
  const runtime = useRuntime();
  return (
    <Card>
      <CardContent className="pt-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            runtime.actions.toast({ title: "Workspace settings saved", intent: "success" });
          }}
        >
          <SettingRow label="Workspace name">
            <Input defaultValue="Gutu" className="w-64" />
          </SettingRow>
          <SettingRow label="Timezone">
            <Input defaultValue="America/Los_Angeles" className="w-64" />
          </SettingRow>
          <SettingRow label="Default currency">
            <Input defaultValue="USD" className="w-32" />
          </SettingRow>
          <SettingRow label="Locale">
            <Input defaultValue="en-US" className="w-32" />
          </SettingRow>
          <div className="flex justify-end pt-3">
            <Button variant="primary" type="submit">Save changes</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function ProfileSettings() {
  const runtime = useRuntime();
  const fileRef = React.useRef<HTMLInputElement>(null);
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-center gap-4 pb-4 border-b border-border-subtle mb-2">
          <div className="w-14 h-14 rounded-full bg-accent-subtle text-accent flex items-center justify-center text-lg font-semibold">
            CB
          </div>
          <div>
            <div className="text-sm font-medium text-text-primary">Chinmoy Bhuyan</div>
            <div className="text-xs text-text-muted">chinmoy@gutu.dev · Admin</div>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                runtime.actions.toast({
                  title: `Photo "${file.name}" ready to upload`,
                  intent: "success",
                });
              }
            }}
          />
          <Button
            variant="secondary"
            size="sm"
            className="ml-auto"
            onClick={() => fileRef.current?.click()}
          >
            Change photo
          </Button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            runtime.actions.toast({ title: "Profile saved", intent: "success" });
          }}
        >
          <div className="grid grid-cols-2 gap-4 pb-3">
            <FormField label="First name">
              <Input defaultValue="Chinmoy" />
            </FormField>
            <FormField label="Last name">
              <Input defaultValue="Bhuyan" />
            </FormField>
            <FormField label="Email" className="col-span-2">
              <Input defaultValue="chinmoy@gutu.dev" type="email" />
            </FormField>
            <FormField label="Title">
              <Input defaultValue="Founder" />
            </FormField>
            <FormField label="Timezone">
              <Input defaultValue="America/Los_Angeles" />
            </FormField>
          </div>
          <div className="flex justify-end pt-3">
            <Button variant="primary" type="submit">Save profile</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function TeamSettings() {
  const seats = [
    { name: "Chinmoy Bhuyan", email: "chinmoy@gutu.dev", role: "Admin", status: "active" },
    { name: "Sam Rivera", email: "sam@gutu.dev", role: "Member", status: "active" },
    { name: "Alex Chen", email: "alex@gutu.dev", role: "Member", status: "invited" },
    { name: "Taylor Nguyen", email: "taylor@gutu.dev", role: "Viewer", status: "active" },
  ];
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Members</CardTitle>
          <CardDescription>4 of 10 seats used on the Pro plan.</CardDescription>
        </div>
        <Button
          size="sm"
          variant="primary"
          onClick={() => { window.location.hash = "#/platform/tenants/members"; }}
        >
          Invite member
        </Button>
      </CardHeader>
      <CardContent>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-text-muted border-b border-border">
              <th className="py-2 font-medium">Name</th>
              <th className="py-2 font-medium">Role</th>
              <th className="py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {seats.map((s) => (
              <tr key={s.email} className="border-b border-border-subtle last:border-b-0">
                <td className="py-2">
                  <div className="text-text-primary">{s.name}</div>
                  <div className="text-xs text-text-muted">{s.email}</div>
                </td>
                <td className="py-2">
                  <Badge
                    intent={s.role === "Admin" ? "danger" : s.role === "Viewer" ? "neutral" : "info"}
                  >
                    {s.role}
                  </Badge>
                </td>
                <td className="py-2">
                  <StatusDot intent={s.status === "active" ? "success" : "warning"} />
                  <span className="ml-2 text-text-secondary">
                    {s.status === "active" ? "Active" : "Invite pending"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function BillingSettings() {
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-medium text-text-muted uppercase tracking-wide">
                Current plan
              </div>
              <div className="text-2xl font-semibold text-text-primary mt-1">Pro</div>
              <div className="text-sm text-text-muted">$240 / month · next charge Feb 1</div>
            </div>
            <Button
              variant="secondary"
              onClick={() => { window.location.hash = "#/platform/billing/plans"; }}
            >
              Change plan
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Usage this cycle</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <MetricGrid
            columns={3}
            metrics={[
              { label: "Seats", value: "4 / 10" },
              { label: "Records", value: "24,180 / 100K" },
              { label: "AI tokens", value: "1.2M / 5M" },
            ]}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function SecuritySettings() {
  return (
    <div className="flex flex-col gap-4">
      <MfaCard />
      <PasswordCard />
      <Card>
        <CardContent className="pt-4">
          <SettingRow
            label="Session timeout"
            description="Auto-sign-out after inactivity."
          >
            <Input defaultValue="30 minutes" className="w-40" />
          </SettingRow>
          <SettingRow
            label="SSO enforcement"
            description="Require Google / Okta for all members."
          >
            <Switch />
          </SettingRow>
          <SettingRow
            label="IP allowlist"
            description="Comma-separated CIDR ranges."
          >
            <Input defaultValue="10.0.0.0/8, 203.0.113.0/24" className="w-72" />
          </SettingRow>
        </CardContent>
      </Card>
    </div>
  );
}

function MfaCard() {
  const [status, setStatus] = React.useState<{ enabled: boolean; setupStarted: boolean } | null>(null);
  const [setupSecret, setSetupSecret] = React.useState<{ secret: string; otpauthUrl: string } | null>(null);
  const [code, setCode] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    try {
      const res = await apiFetch<{ enabled: boolean; setupStarted: boolean }>("/auth/mfa/status");
      setStatus(res);
    } catch (err) {
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
      const res = await apiFetch<{ secret: string; otpauthUrl: string }>(
        "/auth/mfa/setup",
        { method: "POST" },
      );
      setSetupSecret(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "setup failed");
    } finally {
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "enable failed");
    } finally {
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "disable failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Two-factor authentication</CardTitle>
          <CardDescription>
            Require a TOTP code on every sign-in. Use any standard authenticator app.
          </CardDescription>
        </div>
        <Badge intent={status?.enabled ? "success" : "neutral"}>
          {status?.enabled ? "Enabled" : "Disabled"}
        </Badge>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="text-xs text-intent-danger bg-intent-danger-bg border border-intent-danger/30 rounded-md px-2 py-1.5 mb-3">
            {error}
          </div>
        )}
        {!status?.enabled && !setupSecret && (
          <Button variant="primary" size="sm" loading={busy} onClick={start}>
            Start MFA setup
          </Button>
        )}
        {setupSecret && (
          <div className="flex flex-col gap-3">
            <div className="text-sm text-text-secondary">
              Scan this otpauth URL with an authenticator app, then enter the
              6-digit code it generates:
            </div>
            <pre className="text-xs font-mono bg-surface-1 border border-border rounded-md p-3 overflow-x-auto break-all whitespace-pre-wrap">
              {setupSecret.otpauthUrl}
            </pre>
            <div className="text-xs text-text-muted">
              Or enter this secret manually:{" "}
              <code className="font-mono text-text-secondary">{setupSecret.secret}</code>
            </div>
            <div className="flex items-center gap-2">
              <Input
                placeholder="123 456"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-32 font-mono"
              />
              <Button variant="primary" size="sm" loading={busy} onClick={enable}>
                Verify & enable
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setSetupSecret(null)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
        {status?.enabled && (
          <div className="flex items-center gap-2">
            <Input
              placeholder="Enter 6-digit code to disable"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-52 font-mono"
            />
            <Button variant="danger" size="sm" loading={busy} onClick={disable}>
              Disable MFA
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PasswordCard() {
  const [email, setEmail] = React.useState(authStore.user?.email ?? "");
  const [sent, setSent] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const trigger = async () => {
    setBusy(true);
    setError(null);
    setSent(null);
    try {
      const res = await apiFetch<{ ok: boolean; devToken?: string }>(
        "/auth/forgot-password",
        { method: "POST", body: JSON.stringify({ email }) },
      );
      setSent(
        res.devToken
          ? `Reset link logged to backend console + devToken: ${res.devToken}`
          : "If that email exists, a reset link was sent.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Password reset</CardTitle>
          <CardDescription>
            Request a reset link for yourself or another team member.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-72"
          />
          <Button
            size="sm"
            variant="primary"
            loading={busy}
            onClick={trigger}
            disabled={!email}
          >
            Send reset link
          </Button>
        </div>
        {sent && <div className="text-xs text-intent-success mt-2">{sent}</div>}
        {error && <div className="text-xs text-intent-danger mt-2">{error}</div>}
      </CardContent>
    </Card>
  );
}

function ApiKeysSettings() {
  const keys = [
    { name: "Production", prefix: "pk_live_24f8…", created: "2025-08-12", lastUsed: "2 min ago" },
    { name: "Staging", prefix: "pk_test_a11b…", created: "2025-11-03", lastUsed: "Yesterday" },
    { name: "CI", prefix: "pk_ci_ff92…", created: "2024-12-20", lastUsed: "3 weeks ago" },
  ];
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>API keys</CardTitle>
          <CardDescription>Server-to-server credentials.</CardDescription>
        </div>
        <Button
          size="sm"
          variant="primary"
          iconLeft={<Key className="h-3.5 w-3.5" />}
          onClick={() => { window.location.hash = "#/auth/api-tokens/new"; }}
        >
          New key
        </Button>
      </CardHeader>
      <CardContent>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-text-muted border-b border-border">
              <th className="py-2 font-medium">Name</th>
              <th className="py-2 font-medium">Key</th>
              <th className="py-2 font-medium">Created</th>
              <th className="py-2 font-medium">Last used</th>
            </tr>
          </thead>
          <tbody>
            {keys.map((k) => (
              <tr key={k.name} className="border-b border-border-subtle last:border-b-0">
                <td className="py-2 text-text-primary">{k.name}</td>
                <td className="py-2 font-mono text-xs text-text-secondary">{k.prefix}</td>
                <td className="py-2 text-text-secondary">{k.created}</td>
                <td className="py-2 text-text-secondary">{k.lastUsed}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function WebhooksSettings() {
  const hooks = [
    { url: "https://api.acme.com/gutu-events", events: 12, status: "ok" },
    { url: "https://zapier.com/hooks/abc123", events: 4, status: "ok" },
    { url: "https://staging.globex.io/in", events: 7, status: "failing" },
  ];
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Webhooks</CardTitle>
          <CardDescription>Outbound events delivered to your endpoints.</CardDescription>
        </div>
        <Button
          size="sm"
          variant="primary"
          iconLeft={<Webhook className="h-3.5 w-3.5" />}
          onClick={() => { window.location.hash = "#/automation/webhooks/new"; }}
        >
          Add endpoint
        </Button>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col divide-y divide-border-subtle">
          {hooks.map((h) => (
            <li key={h.url} className="flex items-center gap-3 py-2">
              <StatusDot intent={h.status === "ok" ? "success" : "danger"} pulse={h.status !== "ok"} />
              <code className="flex-1 font-mono text-xs text-text-secondary truncate">{h.url}</code>
              <span className="text-xs text-text-muted">{h.events} events</span>
              <Button
                size="xs"
                variant="ghost"
                onClick={() => {
                  window.location.hash = `#/automation/webhooks/${encodeURIComponent(h.url)}`;
                }}
              >
                Test
              </Button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function NotificationSettings() {
  return (
    <Card>
      <CardContent className="pt-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-text-muted border-b border-border">
              <th className="py-2 font-medium">Event</th>
              <th className="py-2 font-medium text-center">Email</th>
              <th className="py-2 font-medium text-center">In-app</th>
              <th className="py-2 font-medium text-center">Slack</th>
            </tr>
          </thead>
          <tbody>
            {[
              { name: "New contact", email: true, inapp: true, slack: false },
              { name: "Ticket assigned to me", email: true, inapp: true, slack: true },
              { name: "Invoice paid", email: false, inapp: true, slack: false },
              { name: "Booking cancelled", email: true, inapp: true, slack: true },
              { name: "Deploy finished", email: false, inapp: true, slack: true },
              { name: "Weekly digest", email: true, inapp: false, slack: false },
            ].map((r, i) => (
              <tr key={i} className="border-b border-border-subtle last:border-b-0">
                <td className="py-2 text-text-primary">{r.name}</td>
                <td className="py-2 text-center"><Checkbox defaultChecked={r.email} /></td>
                <td className="py-2 text-center"><Checkbox defaultChecked={r.inapp} /></td>
                <td className="py-2 text-center"><Checkbox defaultChecked={r.slack} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function AppearanceSettings() {
  return (
    <Card>
      <CardContent className="pt-4">
        <SettingRow
          label="Theme"
          description="Toggle in the top bar to switch instantly."
        >
          <span className="text-xs text-text-muted">Use the sun/moon icon in the topbar.</span>
        </SettingRow>
        <SettingRow
          label="Density"
          description="Affects row height everywhere."
        >
          <span className="text-xs text-text-muted">Also in the topbar menu.</span>
        </SettingRow>
        <SettingRow
          label="Accent color"
          description="Design token override at the workspace level."
        >
          <div className="flex items-center gap-1">
            {["#4f46e5", "#2563eb", "#0891b2", "#059669", "#d97706", "#db2777"].map((c) => (
              <button
                key={c}
                className={cn(
                  "w-6 h-6 rounded-md ring-2 ring-offset-2 ring-offset-surface-0 transition-all",
                  c === "#4f46e5" ? "ring-text-primary" : "ring-transparent",
                )}
                style={{ background: c }}
                aria-label={c}
                type="button"
              />
            ))}
          </div>
        </SettingRow>
      </CardContent>
    </Card>
  );
}

/* --- Profile -------------------------------------------------------------- */

export function ProfilePage() {
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Your profile" description="Personal account details." />
      <ProfileSettings />
    </div>
  );
}

/* --- Notifications inbox -------------------------------------------------- */

export function NotificationsInboxPage() {
  const { data: serverItems, loading } = useAllRecords<{
    id: string;
    title: string;
    intent: "info" | "warning" | "success" | "danger" | "accent";
    read: boolean;
    createdAt: string;
    recipient: string;
  }>("platform.notification");
  const [readIds, setReadIds] = React.useState<Set<string>>(new Set());
  const [hideIds, setHideIds] = React.useState<Set<string>>(new Set());

  if (loading && serverItems.length === 0)
    return (
      <div className="py-16 flex items-center justify-center text-sm text-text-muted gap-2">
        <Spinner size={14} /> Loading…
      </div>
    );

  const items = serverItems
    .filter((n) => !hideIds.has(n.id))
    .map((n) => ({ ...n, read: n.read || readIds.has(n.id) }))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const unread = items.filter((n) => !n.read).length;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Notifications"
        description={`${unread} unread · ${items.length} total`}
        actions={
          <Button
            variant="secondary"
            onClick={() => setReadIds(new Set(items.map((i) => i.id)))}
          >
            Mark all read
          </Button>
        }
      />
      {items.length === 0 ? (
        <EmptyState title="Inbox zero" description="You're all caught up." />
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y divide-border-subtle">
              {items.map((n) => (
                <li
                  key={n.id}
                  className={cn(
                    "flex items-center gap-3 p-3",
                    !n.read && "bg-accent-subtle/30",
                  )}
                >
                  <StatusDot intent={n.intent} />
                  <div className="flex-1 min-w-0">
                    <div
                      className={cn(
                        "text-sm",
                        !n.read
                          ? "text-text-primary font-medium"
                          : "text-text-secondary",
                      )}
                    >
                      {n.title}
                    </div>
                    <div className="text-xs text-text-muted">
                      {formatRelative(n.createdAt)}
                    </div>
                  </div>
                  {!n.read && (
                    <Button
                      size="xs"
                      variant="ghost"
                      onClick={() =>
                        setReadIds((s) => {
                          const next = new Set(s);
                          next.add(n.id);
                          return next;
                        })
                      }
                    >
                      Mark read
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* --- Global search -------------------------------------------------------- */

export function SearchResultsPage() {
  const [q, setQ] = React.useState("");
  const { data: index } = useAllRecords<{
    id: string;
    label: string;
    kind: string;
    path: string;
  }>("platform.search-index");
  const results = q
    ? index.filter(
        (r) =>
          r.label.toLowerCase().includes(q.toLowerCase()) ||
          r.kind.toLowerCase().includes(q.toLowerCase()),
      )
    : [];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Search"
        description="Look up records across every plugin."
      />
      <Card>
        <CardContent className="pt-4 flex flex-col gap-3">
          <Input
            placeholder="Search for contacts, invoices, tickets, models…"
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          {q === "" ? (
            <div className="text-sm text-text-muted py-6 text-center">
              Start typing. Try “ada”, “acme”, or “claude”.
            </div>
          ) : results.length === 0 ? (
            <EmptyState
              title="No matches"
              description={`Nothing indexed under “${q}”. Try a different query.`}
            />
          ) : (
            <ul className="divide-y divide-border-subtle">
              {results.map((r) => (
                <li key={r.id}>
                  <a
                    href={`#${r.path}`}
                    className="flex items-center gap-3 py-2.5 hover:bg-surface-2 rounded-md px-2 transition-colors"
                  >
                    <Database className="h-4 w-4 text-text-muted" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-text-primary">{r.label}</div>
                      <div className="text-xs text-text-muted font-mono">{r.path}</div>
                    </div>
                    <Badge intent="neutral">{r.kind}</Badge>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* --- Auth preview (mock UI) ---------------------------------------------- */

export function SignInPreviewPage() {
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Sign-in screen"
        description="Preview of the unauthenticated shell (mock)."
      />
      <Card>
        <CardContent className="py-10 flex items-center justify-center">
          <div className="w-full max-w-sm flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-md bg-accent text-accent-fg flex items-center justify-center font-bold">
                G
              </div>
              <div>
                <div className="text-sm font-semibold text-text-primary">Gutu</div>
                <div className="text-xs text-text-muted">Sign in to your workspace</div>
              </div>
            </div>
            <FormField label="Workspace">
              <Input defaultValue="gutu" suffix={<span className="text-xs text-text-muted">.gutu.app</span>} />
            </FormField>
            <FormField label="Email">
              <Input type="email" defaultValue="chinmoy@gutu.dev" />
            </FormField>
            <FormField label="Password">
              <Input type="password" defaultValue="••••••••" />
            </FormField>
            <div className="flex items-center justify-between text-xs">
              <label className="inline-flex items-center gap-2 text-text-secondary">
                <Checkbox defaultChecked /> Keep me signed in
              </label>
              <a href="#" className="text-text-link hover:underline">Forgot password?</a>
            </div>
            <Button
              variant="primary"
              size="lg"
              onClick={() => { window.location.hash = "#/signin"; }}
            >
              Continue
            </Button>
            <div className="text-center text-xs text-text-muted">
              or continue with
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => { window.location.href = "/api/auth/oauth/google"; }}
              >
                <Globe className="h-3.5 w-3.5 mr-1" /> Google
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => { window.location.href = "/api/auth/oauth/okta"; }}
              >
                Okta
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => { window.location.href = "/api/auth/saml"; }}
              >
                SAML
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function SignUpPreviewPage() {
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Sign-up screen"
        description="Preview of the new-workspace flow."
      />
      <Card>
        <CardContent className="py-10 flex items-center justify-center">
          <div className="w-full max-w-sm flex flex-col gap-4">
            <div className="text-lg font-semibold text-text-primary">Start a workspace</div>
            <FormField label="Full name">
              <Input defaultValue="Ada Lovelace" />
            </FormField>
            <FormField label="Work email">
              <Input type="email" />
            </FormField>
            <FormField label="Workspace URL">
              <Input defaultValue="ada-works" suffix={<span className="text-xs text-text-muted">.gutu.app</span>} />
            </FormField>
            <FormField label="Password">
              <Input type="password" />
            </FormField>
            <label className="inline-flex items-start gap-2 text-xs text-text-secondary">
              <Checkbox defaultChecked />
              <span>I agree to the Terms of Service and Privacy Policy.</span>
            </label>
            <Button
              variant="primary"
              size="lg"
              onClick={() => { window.location.hash = "#/platform/tenants/new"; }}
            >
              Create workspace
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* --- Onboarding wizard --------------------------------------------------- */

export function OnboardingPage() {
  const { data: raw } = useAllRecords<{
    id: string;
    order: number;
    title: string;
    description: string;
    done: boolean;
  }>("platform.onboarding-step");
  const steps = raw
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((s) => ({ title: s.title, desc: s.description, done: s.done }));
  const progress =
    steps.length > 0
      ? Math.round(
          (steps.filter((s) => s.done).length / steps.length) * 100,
        )
      : 0;
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Onboarding"
        description={`${progress}% complete`}
      />
      <Card>
        <CardContent className="pt-4">
          <div className="w-full h-2 bg-surface-2 rounded-full overflow-hidden mb-4">
            <div
              className="h-full bg-accent transition-all duration-base"
              style={{ width: `${progress}%` }}
            />
          </div>
          <ol className="flex flex-col gap-3">
            {steps.map((s, i) => (
              <li
                key={i}
                className={cn(
                  "flex items-start gap-3 p-3 rounded-md border",
                  s.done
                    ? "border-intent-success/30 bg-intent-success-bg/40"
                    : "border-border bg-surface-0",
                )}
              >
                <div
                  className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center shrink-0",
                    s.done
                      ? "bg-intent-success text-white"
                      : "bg-surface-3 text-text-muted",
                  )}
                >
                  {s.done ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-text-primary">
                    {s.title}
                  </div>
                  <div className="text-xs text-text-muted">{s.desc}</div>
                </div>
                {!s.done && i === steps.findIndex((x) => !x.done) && (
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => {
                      // Walk to the section the step is hinting at —
                      // the desc usually contains a noun like "team",
                      // "billing", "domain"; route to /platform plus
                      // that hint, falling back to /home.
                      const slug = (s.desc?.toLowerCase().match(/team|billing|domain|members|api/) ?? ["home"])[0];
                      window.location.hash = `#/platform/${slug === "members" ? "tenants/members" : slug}`;
                    }}
                  >
                    Start
                  </Button>
                )}
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}

/* --- Release notes -------------------------------------------------------- */

export function ReleaseNotesPage() {
  const { data: raw } = useAllRecords<{
    id: string;
    version: string;
    releasedAt: string;
    entries: { kind: string; text: string }[];
  }>("platform.release");
  const releases = raw
    .slice()
    .sort((a, b) => (a.releasedAt < b.releasedAt ? 1 : -1))
    .map((r) => ({ ver: r.version, date: r.releasedAt, entries: r.entries }));
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Release notes"
        description="What shipped and when."
      />
      <div className="flex flex-col gap-4">
        {releases.map((r) => (
          <Card key={r.ver}>
            <CardHeader>
              <div>
                <CardTitle>v{r.ver}</CardTitle>
                <CardDescription>{r.date}</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="flex flex-col gap-2">
                {r.entries.map((e, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <Badge
                      intent={
                        e.kind === "feat"
                          ? "success"
                          : e.kind === "fix"
                            ? "warning"
                            : "neutral"
                      }
                      className="uppercase"
                    >
                      {e.kind}
                    </Badge>
                    <span className="text-text-primary">{e.text}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
