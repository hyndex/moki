/** Reference Notifications Inbox (Split Inbox archetype). */

import * as React from "react";
import { Bell, ArrowRight, Check, Clock, AlertTriangle } from "lucide-react";
import { Button } from "@/primitives/Button";
import { defineCustomView } from "@/builders";
import {
  SplitInbox,
  CommandHints,
  WidgetShell,
  useArchetypeKeyboard,
  useUrlState,
  type LoadState,
} from "@/admin-archetypes";
import { useAllRecords } from "@/runtime/hooks";
import { cn } from "@/lib/cn";

interface Notif {
  id: string;
  source: string;
  title: string;
  body: string;
  ts: string;
  unread: boolean;
  severity: "info" | "warning" | "danger" | "success";
}

const SAMPLE: Notif[] = Array.from({ length: 24 }, (_, i) => {
  const sev: Notif["severity"] = (["info", "warning", "danger", "success"] as const)[i % 4];
  return {
    id: `n-${i}`,
    source: ["accounting", "inventory", "crm", "hr", "system"][i % 5],
    title: [
      "Invoice INV-0042 paid",
      "Stock-out alert: SKU-481",
      "New lead from /contact form",
      "Onboarding task overdue",
      "Backup completed",
      "Approval requested: PR-204",
    ][i % 6],
    body: "This is the body of the notification. It includes context, links, and any next-step actions.",
    ts: `${i + 1} ${i === 0 ? "min" : "min"} ago`,
    unread: i % 3 !== 0,
    severity: sev,
  };
});

const SEV_DOT: Record<Notif["severity"], string> = {
  info: "bg-info",
  warning: "bg-warning",
  danger: "bg-danger",
  success: "bg-success",
};

async function fetchNotifs(): Promise<Notif[]> {
  try {
    const res = await fetch("/api/notifications/inbox");
    if (res.ok) return (await res.json()) as Notif[];
  } catch {/* fall through */}
  return SAMPLE;
}

interface DeliveryRow {
  id: string;
  channel?: string;
  template?: string;
  recipient?: string;
  status?: "queued" | "sent" | "delivered" | "bounced" | "failed";
  subject?: string;
  preview?: string;
  body?: string;
  createdAt?: string;
}

export function NotificationsArchetypeInbox() {
  const [params, setParams] = useUrlState(["sel", "q"] as const);
  // Real backend read.
  const live = useAllRecords<DeliveryRow>("notifications.delivery");
  const data: { data: Notif[]; refetch: () => void; state: LoadState } = {
    data: live.data.length
      ? live.data.map<Notif>((d) => ({
          id: d.id,
          source: d.channel ?? "system",
          title: d.subject ?? d.template ?? d.id,
          body: d.body ?? d.preview ?? "",
          ts: d.createdAt
            ? new Date(d.createdAt).toLocaleString()
            : "now",
          unread: d.status !== "delivered",
          severity:
            d.status === "bounced" || d.status === "failed"
              ? "danger"
              : d.status === "queued"
                ? "warning"
                : d.status === "sent"
                  ? "info"
                  : "success",
        }))
      : SAMPLE,
    refetch: live.refetch,
    state: live.error
      ? { status: "error", error: live.error }
      : live.loading && live.data.length === 0
        ? { status: "loading" }
        : { status: "ready" },
  };
  const all = data.data;
  const q = params.q ?? "";
  const filtered = q
    ? all.filter((n) =>
        n.title.toLowerCase().includes(q.toLowerCase()) ||
        n.source.toLowerCase().includes(q.toLowerCase()) ||
        n.body.toLowerCase().includes(q.toLowerCase()),
      )
    : all;
  const selectedId = params.sel ?? filtered[0]?.id;
  const selected = filtered.find((n) => n.id === selectedId) ?? null;

  useArchetypeKeyboard([
    {
      label: "Next",
      combo: "j",
      run: () => {
        const idx = filtered.findIndex((n) => n.id === selectedId);
        const next = filtered[Math.min(filtered.length - 1, idx + 1)];
        if (next) setParams({ sel: next.id }, true);
      },
    },
    {
      label: "Prev",
      combo: "k",
      run: () => {
        const idx = filtered.findIndex((n) => n.id === selectedId);
        const prev = filtered[Math.max(0, idx - 1)];
        if (prev) setParams({ sel: prev.id }, true);
      },
    },
    { label: "Refresh", combo: "r", run: () => data.refetch() },
  ]);

  return (
    <SplitInbox
      id="notifications.inbox"
      title="Inbox"
      subtitle={`${all.filter(n => n.unread).length} unread`}
      actions={
        <Button
          size="sm"
          onClick={() => {
            // Mock-state mutation: flip every notification's unread flag.
            // Real implementation would POST /api/notifications/mark-all-read.
            for (const n of all) n.unread = false;
            data.refetch();
          }}
        >
          <Check className="h-4 w-4 mr-1" aria-hidden /> Mark all read
        </Button>
      }
      toolbarStart={
        <input
          type="search"
          value={q}
          onChange={(e) => setParams({ q: e.target.value }, true)}
          placeholder="Search…"
          className="h-8 w-56 rounded-md border border-border bg-surface-0 px-2 text-sm"
        />
      }
      toolbarEnd={
        <CommandHints hints={[
          { keys: "J/K", label: "Next/prev" },
          { keys: "R", label: "Refresh" },
        ]} />
      }
      list={
        <WidgetShell label="Notifications" state={data.state} skeleton="list" onRetry={data.refetch}>
          <ul role="list" className="divide-y divide-border-subtle">
            {filtered.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => setParams({ sel: n.id }, true)}
                  className={cn(
                    "w-full text-left px-3 py-2.5 flex items-start gap-2.5 hover:bg-surface-1",
                    n.id === selectedId && "bg-info-soft/30",
                  )}
                >
                  <span className={cn("h-2 w-2 rounded-full shrink-0 mt-1.5", SEV_DOT[n.severity], !n.unread && "opacity-30")} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <div className={cn("text-sm truncate", n.unread ? "font-semibold text-text-primary" : "text-text-muted")}>
                      {n.title}
                    </div>
                    <div className="text-xs text-text-muted truncate">
                      {n.source} · {n.ts}
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </WidgetShell>
      }
      preview={
        selected ? (
          <article className="p-4 flex flex-col gap-3 h-full">
            <header className="flex items-start justify-between gap-2">
              <div>
                <div className="text-base font-semibold text-text-primary">{selected.title}</div>
                <div className="text-xs text-text-muted mt-0.5">
                  {selected.source} · {selected.ts}
                </div>
              </div>
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
                  selected.severity === "danger" && "bg-danger-soft text-danger-strong",
                  selected.severity === "warning" && "bg-warning-soft text-warning-strong",
                  selected.severity === "info" && "bg-info-soft text-info-strong",
                  selected.severity === "success" && "bg-success-soft text-success-strong",
                )}
              >
                {selected.severity}
              </span>
            </header>
            <p className="text-sm text-text-primary whitespace-pre-wrap">{selected.body}</p>
            <div className="flex items-center gap-2 mt-auto pt-2 border-t border-border-subtle">
              <Button
                size="sm"
                onClick={() => {
                  window.location.hash = `/notifications/log/${encodeURIComponent(selected.id)}`;
                }}
              >
                <ArrowRight className="h-4 w-4 mr-1" aria-hidden /> Open record
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  if (!selected) return;
                  // Mock snooze: hide for 1 hour by setting a future
                  // remindAt and marking as read so it leaves the inbox.
                  selected.unread = false;
                  (selected as { remindAt?: string }).remindAt = new Date(Date.now() + 3600_000).toISOString();
                  data.refetch();
                }}
              >
                <Clock className="h-4 w-4 mr-1" aria-hidden /> Snooze
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  if (!selected) return;
                  const idx = all.findIndex((n) => n.id === selected.id);
                  if (idx >= 0) all.splice(idx, 1);
                  setParams({ sel: undefined }, true);
                  data.refetch();
                }}
              >
                Dismiss
              </Button>
            </div>
          </article>
        ) : (
          <div className="p-6 text-center text-sm text-text-muted">
            <Bell className="h-6 w-6 mx-auto mb-2 text-text-muted" aria-hidden />
            Select a notification to preview.
          </div>
        )
      }
    />
  );
}

export const notificationsArchetypeInboxView = defineCustomView({
  id: "notifications.archetype-inbox.view",
  title: "Inbox (archetype)",
  description: "Reference Split Inbox.",
  resource: "notifications.notification",
  archetype: "split-inbox",
  density: "compact",
  render: () => <NotificationsArchetypeInbox />,
});

export const notificationsArchetypeNav = [
  {
    id: "notifications.archetype-inbox",
    label: "Inbox (new)",
    icon: "Inbox",
    path: "/inbox/archetype",
    view: "notifications.archetype-inbox.view",
    section: "workspace",
    order: 0.5,
  },
];

/* keep these icons exported so the wiring file's lint is happy */
export { AlertTriangle };
