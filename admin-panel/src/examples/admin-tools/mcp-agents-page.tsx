/** MCP Agents admin page.
 *
 *  Operator surface for the MCP host:
 *    - list every agent in the current tenant
 *    - create + edit (scopes, risk ceiling, rate limits, budget)
 *    - issue + revoke bearer tokens (plaintext shown ONCE)
 *    - issue dual-key tokens for irreversible actions
 *    - view recent call log + per-agent stats
 *
 *  Every mutation goes through the existing `/api/mcp/admin/*`
 *  endpoints (human session auth). Plaintext tokens are never
 *  persisted client-side — copied to clipboard once + cleared. */

import * as React from "react";
import { Button } from "@/primitives/Button";
import { Input } from "@/primitives/Input";
import { Label } from "@/primitives/Label";
import { Textarea } from "@/primitives/Textarea";
import { Badge } from "@/primitives/Badge";
import { defineCustomView } from "@/builders";
import { authStore } from "@/runtime/auth";
import { cn } from "@/lib/cn";
import { ResourceScopePicker, ToolPicker, type ScopeMap, type ScopeAction } from "@/admin-primitives/pickers";
import { useUiResources } from "@/runtime/useUiMetadata";

interface Agent {
  id: string;
  name: string;
  description: string;
  tenantId: string;
  issuerUserId: string;
  mirrorUserId?: string;
  scopes: Record<string, string[]>;
  riskCeiling: "safe-read" | "low-mutation" | "high-mutation";
  rateLimits: { "safe-read"?: number; "low-mutation"?: number; "high-mutation"?: number };
  budget: { dailyWriteCap?: number; dailyCostCap?: number };
  instructions?: string;
  status: "active" | "suspended" | "revoked";
  createdAt: string;
  lastUsedAt?: string;
}

interface CallRow {
  id: string;
  agentId: string;
  method: string;
  toolName?: string;
  resource?: string;
  recordId?: string;
  risk?: string;
  ok: boolean;
  errorCode?: number;
  errorMessage?: string;
  latencyMs?: number;
  createdAt: string;
}

interface AgentStats {
  callsTotal: number;
  callsOk: number;
  callsError: number;
  errorRate: number;
  avgLatencyMs: number;
  callsLast24h: number;
  mutationCallsLast24h: number;
}

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (authStore.token) headers.set("Authorization", `Bearer ${authStore.token}`);
  const res = await fetch(`/api${path}`, { ...init, headers, credentials: "include" });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${text.slice(0, 240)}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

const STATUS_INTENT: Record<Agent["status"], "success" | "warning" | "danger"> = {
  active: "success",
  suspended: "warning",
  revoked: "danger",
};
const RISK_LABEL: Record<Agent["riskCeiling"], string> = {
  "safe-read": "Read only",
  "low-mutation": "Low mutation",
  "high-mutation": "High mutation",
};

type Tab = "agents" | "plans" | "undo" | "dual-key";

/** Connection snippets shown ONCE after a token is issued. The token
 *  itself is irrecoverable after this banner is dismissed; the helper
 *  shows the three transports (HTTP JSON-RPC, HTTP+SSE, stdio bin) so
 *  operators can hand the right one-liner to the AI agent owner. */
function ConnectAgentSnippet({
  token,
  onDismiss,
}: {
  token: string;
  onDismiss: () => void;
}): React.ReactElement {
  const [copied, setCopied] = React.useState<string | null>(null);
  const origin = typeof window !== "undefined" ? window.location.origin : "https://your-host";
  const endpoint = `${origin}/api/mcp`;

  const httpCurl = `curl -X POST '${endpoint}' \\
  -H 'Authorization: Bearer ${token}' \\
  -H 'Content-Type: application/json' \\
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"my-agent","version":"1.0.0"}}}'`;

  const sseCurl = `curl -N -X POST '${endpoint}' \\
  -H 'Authorization: Bearer ${token}' \\
  -H 'Content-Type: application/json' \\
  -H 'Accept: text/event-stream' \\
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"my-agent","version":"1.0.0"}}}'`;

  const stdioCmd = `MCP_AGENT_TOKEN='${token}' bun run mcp:stdio`;

  const claudeDesktopCfg = JSON.stringify(
    {
      mcpServers: {
        gutu: {
          command: "bun",
          args: ["run", "mcp:stdio"],
          env: { MCP_AGENT_TOKEN: token },
          cwd: "/path/to/admin-panel/backend",
        },
      },
    },
    null,
    2,
  );

  const copy = (label: string, text: string): void => {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(label);
      setTimeout(() => setCopied(null), 1500);
    });
  };

  return (
    <div className="rounded-md border border-warning-strong/30 bg-warning-soft p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-semibold text-warning-strong">
          New token issued — copy it now, you won't see it again
        </div>
        <Button variant="ghost" size="sm" onClick={onDismiss}>
          Dismiss
        </Button>
      </div>

      {/* Bare token row — quickest path for clients that already know
          how to wire MCP themselves. */}
      <div className="flex items-center gap-2">
        <code className="flex-1 font-mono text-xs bg-surface-1 rounded px-2 py-1.5 break-all">
          {token}
        </code>
        <Button
          variant="outline"
          size="sm"
          onClick={() => copy("token", token)}
        >
          {copied === "token" ? "Copied" : "Copy token"}
        </Button>
      </div>

      <details className="rounded-md border border-border-subtle bg-surface-0 p-2 text-xs" open>
        <summary className="cursor-pointer font-semibold text-text-primary py-1 px-1">
          Connect a CLI agent
        </summary>
        <div className="space-y-3 pt-2 px-1 pb-1 text-text-secondary">
          <p className="leading-relaxed">
            The Gutu MCP host speaks three transports from one bearer token.
            Pick the one that fits the agent runtime, then keep the token in a
            secrets store — these snippets paste it inline only as a starter.
          </p>

          {/* HTTP plain JSON */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="font-medium text-text-primary">
                1. HTTP — POST a JSON-RPC envelope
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copy("http", httpCurl)}
              >
                {copied === "http" ? "Copied" : "Copy"}
              </Button>
            </div>
            <pre className="overflow-x-auto rounded bg-surface-1 px-2 py-1.5 font-mono text-[11px] leading-relaxed text-text-primary whitespace-pre">
{httpCurl}
            </pre>
            <p className="text-[11px] text-text-muted">
              Returns a single JSON response. Use{" "}
              <code className="font-mono">notifications/poll</code> in a loop
              to drain change notifications.
            </p>
          </div>

          {/* SSE upgrade */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="font-medium text-text-primary">
                2. SSE upgrade — long-lived push channel
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copy("sse", sseCurl)}
              >
                {copied === "sse" ? "Copied" : "Copy"}
              </Button>
            </div>
            <pre className="overflow-x-auto rounded bg-surface-1 px-2 py-1.5 font-mono text-[11px] leading-relaxed text-text-primary whitespace-pre">
{sseCurl}
            </pre>
            <p className="text-[11px] text-text-muted">
              Same endpoint, but with{" "}
              <code className="font-mono">Accept: text/event-stream</code>.
              Each <code className="font-mono">message</code> SSE event carries
              a JSON-RPC response, server-initiated sampling request, or
              resource-updated notification.
            </p>
          </div>

          {/* stdio bin */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="font-medium text-text-primary">
                3. stdio — for Claude Desktop / local CLI agents
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copy("stdio", stdioCmd)}
              >
                {copied === "stdio" ? "Copied" : "Copy"}
              </Button>
            </div>
            <pre className="overflow-x-auto rounded bg-surface-1 px-2 py-1.5 font-mono text-[11px] leading-relaxed text-text-primary whitespace-pre">
{stdioCmd}
            </pre>
            <p className="text-[11px] text-text-muted">
              Newline-delimited JSON over stdin/stdout. Run from{" "}
              <code className="font-mono">admin-panel/backend</code>. The
              parent agent process owns the lifecycle — the bin exits cleanly
              on stdin EOF or SIGTERM.
            </p>
          </div>

          {/* Claude Desktop config */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="font-medium text-text-primary">
                Claude Desktop config snippet
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copy("claude", claudeDesktopCfg)}
              >
                {copied === "claude" ? "Copied" : "Copy"}
              </Button>
            </div>
            <pre className="overflow-x-auto rounded bg-surface-1 px-2 py-1.5 font-mono text-[11px] leading-relaxed text-text-primary whitespace-pre">
{claudeDesktopCfg}
            </pre>
            <p className="text-[11px] text-text-muted">
              Paste into{" "}
              <code className="font-mono">
                ~/Library/Application Support/Claude/claude_desktop_config.json
              </code>{" "}
              (macOS) or the Windows equivalent. Update{" "}
              <code className="font-mono">cwd</code> to the absolute path of
              this repo's <code className="font-mono">admin-panel/backend</code>.
            </p>
          </div>
        </div>
      </details>
    </div>
  );
}

export function McpAgentsPage(): React.ReactElement {
  const [tab, setTab] = React.useState<Tab>("agents");
  const [agents, setAgents] = React.useState<Agent[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | undefined>();
  const [selected, setSelected] = React.useState<Agent | null>(null);
  const [showCreate, setShowCreate] = React.useState(false);
  const [issuedToken, setIssuedToken] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    try {
      const r = await api<{ agents: Agent[] }>("/mcp/admin/agents");
      setAgents(r.agents);
      setError(undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const onIssueToken = async (a: Agent): Promise<void> => {
    try {
      const r = await api<{ token: string }>(`/mcp/admin/agents/${a.id}/tokens`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      setIssuedToken(r.token);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const onSuspend = async (a: Agent): Promise<void> => {
    try {
      await api(`/mcp/admin/agents/${a.id}/suspend`, { method: "POST" });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const onRevoke = async (a: Agent): Promise<void> => {
    if (!confirm(`Revoke ${a.name}? Every token is invalidated and cannot be reactivated.`)) return;
    try {
      await api(`/mcp/admin/agents/${a.id}`, { method: "DELETE" });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-4">
      <header className="flex items-baseline justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">MCP agents</h1>
          <p className="text-sm text-text-muted leading-relaxed">
            AI agent identities for the Model Context Protocol. Each agent has
            scoped credentials, a risk ceiling, rate limits, a daily write budget,
            and a full audit trail. Irreversible actions always require a human
            dual-key token.
          </p>
        </div>
        {tab === "agents" && <Button onClick={() => setShowCreate(true)}>New agent</Button>}
      </header>

      <nav role="tablist" className="border-b border-border flex items-center gap-1 -mb-px overflow-x-auto scrollbar-thin">
        {([
          { id: "agents", label: "Agents" },
          { id: "plans", label: "Plans" },
          { id: "undo", label: "Undo log" },
          { id: "dual-key", label: "Dual-key tokens" },
        ] as const).map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "px-3 py-1.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap",
              tab === t.id
                ? "border-accent text-text-primary"
                : "border-transparent text-text-muted hover:text-text-primary",
            )}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {error && (
        <div role="alert" className="rounded-md border border-danger-strong/30 bg-danger-soft p-2 text-xs text-danger-strong">
          {error}
        </div>
      )}

      {issuedToken && (
        <ConnectAgentSnippet token={issuedToken} onDismiss={() => setIssuedToken(null)} />
      )}

      {/* AGENTS TAB */}
      {tab === "agents" && (
        <>
          <div className="rounded-lg border border-border bg-surface-0 shadow-sm">
            <div className="px-4 py-3 border-b border-border-subtle text-sm font-semibold">
              Agents ({agents.length})
            </div>
            {loading ? (
              <div className="px-4 py-8 text-center text-sm text-text-muted">Loading…</div>
            ) : agents.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-text-muted">
                No agents yet. Create one to grant an AI agent scoped MCP access.
              </div>
            ) : (
              <ul className="divide-y divide-border-subtle">
                {agents.map((a) => (
                  <li
                    key={a.id}
                    className="px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-surface-1 transition-colors"
                    onClick={() => setSelected(a)}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <div className="text-sm font-semibold text-text-primary truncate">
                          {a.name}
                        </div>
                        <Badge intent={STATUS_INTENT[a.status]}>{a.status}</Badge>
                        <span className="text-[11px] text-text-muted">
                          {RISK_LABEL[a.riskCeiling]}
                        </span>
                      </div>
                      {a.description && (
                        <div className="text-xs text-text-muted truncate">{a.description}</div>
                      )}
                      <div className="text-[11px] text-text-muted mt-0.5 flex items-center gap-3">
                        <span>{Object.keys(a.scopes).length} scoped resource{Object.keys(a.scopes).length === 1 ? "" : "s"}</span>
                        <span>·</span>
                        <span>{a.lastUsedAt ? `last used ${new Date(a.lastUsedAt).toLocaleString()}` : "never used"}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                      {a.status === "active" && (
                        <>
                          <Button variant="outline" size="sm" onClick={() => onIssueToken(a)}>
                            New token
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => onSuspend(a)}>
                            Suspend
                          </Button>
                        </>
                      )}
                      {a.status !== "revoked" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onRevoke(a)}
                          className="text-danger hover:text-danger-strong"
                        >
                          Revoke
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {selected && <AgentDetailPanel agent={selected} onClose={() => setSelected(null)} />}
        </>
      )}

      {tab === "plans" && <PlansTab agents={agents} setError={setError} />}
      {tab === "undo" && <UndoTab agents={agents} setError={setError} />}
      {tab === "dual-key" && <DualKeyTab agents={agents} setError={setError} />}

      {showCreate && (
        <CreateAgentDialog
          onClose={() => setShowCreate(false)}
          onCreated={async () => {
            setShowCreate(false);
            await refresh();
          }}
        />
      )}
    </div>
  );
}

/* -- plans tab ---------------------------------------------------- */

interface PlanStep {
  id: string;
  seq: number;
  toolName: string;
  arguments: Record<string, unknown>;
  note?: string;
  status: "pending" | "running" | "succeeded" | "failed" | "skipped";
  errorMessage?: string;
  callLogId?: string;
}

interface Plan {
  id: string;
  agentId: string;
  title: string;
  summary: string;
  status: "proposed" | "approved" | "running" | "done" | "failed" | "rejected" | "cancelled";
  proposedAt: string;
  approvedAt?: string;
  approvedByUser?: string;
  failureReason?: string;
  steps: PlanStep[];
}

const PLAN_STATUS_INTENT: Record<Plan["status"], "info" | "success" | "warning" | "danger" | "neutral"> = {
  proposed: "info",
  approved: "info",
  running: "warning",
  done: "success",
  failed: "danger",
  rejected: "neutral",
  cancelled: "neutral",
};

function PlansTab({
  agents,
  setError,
}: {
  agents: Agent[];
  setError: (s: string | undefined) => void;
}): React.ReactElement {
  const [plans, setPlans] = React.useState<Plan[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [autoRollback, setAutoRollback] = React.useState(false);
  const refresh = React.useCallback(async () => {
    setLoading(true);
    try {
      const r = await api<{ plans: Plan[] }>("/mcp/admin/plans");
      setPlans(r.plans);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [setError]);
  React.useEffect(() => {
    void refresh();
  }, [refresh]);
  // Poll every 2s while a plan is running so the operator sees
  // step-by-step progress without having to click refresh.
  React.useEffect(() => {
    const hasRunning = plans.some((p) => p.status === "running");
    if (!hasRunning) return;
    const t = setInterval(() => void refresh(), 2000);
    return () => clearInterval(t);
  }, [plans, refresh]);

  const agentName = (id: string): string => agents.find((a) => a.id === id)?.name ?? id;

  const act = async (id: string, action: "approve" | "reject" | "cancel" | "execute"): Promise<void> => {
    try {
      const path = `/mcp/admin/plans/${id}/${action}`;
      const body = action === "execute" ? JSON.stringify({ autoRollback }) : "{}";
      await api(path, { method: "POST", body });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <section className="space-y-3">
      <div className="rounded-md border border-border-subtle bg-surface-0 px-4 py-2 flex items-center justify-between">
        <label className="inline-flex items-center gap-2 text-xs text-text-primary">
          <input
            type="checkbox"
            checked={autoRollback}
            onChange={(e) => setAutoRollback(e.target.checked)}
          />
          Auto-rollback on step failure (reverses every succeeded step via the undo log)
        </label>
        <Button variant="ghost" size="sm" onClick={refresh}>Refresh</Button>
      </div>
      <div className="rounded-lg border border-border bg-surface-0 shadow-sm">
        <div className="px-4 py-3 border-b border-border-subtle text-sm font-semibold">
          Plans ({plans.length})
        </div>
        {loading ? (
          <div className="px-4 py-6 text-center text-sm text-text-muted">Loading…</div>
        ) : plans.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-text-muted">
            No plans yet. Agents propose plans via plans/propose; you approve them here.
          </div>
        ) : (
          <ul className="divide-y divide-border-subtle">
            {plans.map((p) => (
              <li key={p.id} className="px-4 py-3 space-y-2">
                <div className="flex items-baseline gap-2">
                  <div className="text-sm font-semibold text-text-primary truncate flex-1">{p.title}</div>
                  <Badge intent={PLAN_STATUS_INTENT[p.status]}>{p.status}</Badge>
                  <span className="text-[11px] text-text-muted">{agentName(p.agentId)}</span>
                </div>
                {p.summary && <div className="text-xs text-text-muted">{p.summary}</div>}
                <ol className="text-xs space-y-0.5 pl-4 list-decimal">
                  {p.steps.map((s) => (
                    <li
                      key={s.id}
                      className={cn(
                        "font-mono",
                        s.status === "succeeded" && "text-success-strong",
                        s.status === "failed" && "text-danger-strong",
                        s.status === "running" && "text-warning-strong",
                        s.status === "skipped" && "text-text-muted line-through",
                      )}
                    >
                      {s.toolName}
                      {s.note && <span className="ml-2 text-[11px] text-text-muted">— {s.note}</span>}
                      {s.errorMessage && (
                        <span className="ml-2 text-[11px] text-danger">: {s.errorMessage}</span>
                      )}
                    </li>
                  ))}
                </ol>
                {p.failureReason && (
                  <div className="text-xs text-danger-strong">Failure: {p.failureReason}</div>
                )}
                <div className="flex items-center gap-1 pt-1">
                  {p.status === "proposed" && (
                    <>
                      <Button variant="outline" size="sm" onClick={() => act(p.id, "approve")}>Approve</Button>
                      <Button variant="ghost" size="sm" onClick={() => act(p.id, "reject")}>Reject</Button>
                    </>
                  )}
                  {p.status === "approved" && (
                    <Button size="sm" onClick={() => act(p.id, "execute")}>Execute</Button>
                  )}
                  {(p.status === "proposed" || p.status === "approved") && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => act(p.id, "cancel")}
                      className="text-danger hover:text-danger-strong"
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

/* -- undo tab ----------------------------------------------------- */

interface UndoEntry {
  id: string;
  agentId: string;
  resource: string;
  recordId: string;
  op: "create" | "update" | "delete";
  createdAt: string;
  expiresAt: string;
}

function UndoTab({
  agents,
  setError,
}: {
  agents: Agent[];
  setError: (s: string | undefined) => void;
}): React.ReactElement {
  const [entries, setEntries] = React.useState<UndoEntry[]>([]);
  const [loading, setLoading] = React.useState(true);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    try {
      const r = await api<{ entries: UndoEntry[] }>("/mcp/admin/undo");
      setEntries(r.entries);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [setError]);
  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const agentName = (id: string): string => agents.find((a) => a.id === id)?.name ?? id;

  const reverse = async (id: string, force: boolean): Promise<void> => {
    if (!confirm(force ? "Force-revert? Any human edits since the agent's change will be overwritten." : "Revert?")) return;
    try {
      const r = await api<{ ok: boolean; message: string }>(`/mcp/admin/undo/${id}`, {
        method: "POST",
        body: JSON.stringify({ force }),
      });
      if (!r.ok) setError(r.message);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="rounded-lg border border-border bg-surface-0 shadow-sm">
      <div className="px-4 py-3 border-b border-border-subtle text-sm font-semibold">
        Undo log ({entries.length} reversible — 24h retention)
      </div>
      {loading ? (
        <div className="px-4 py-6 text-center text-sm text-text-muted">Loading…</div>
      ) : entries.length === 0 ? (
        <div className="px-4 py-6 text-center text-sm text-text-muted">
          No reversible mutations in the window.
        </div>
      ) : (
        <ul className="divide-y divide-border-subtle">
          {entries.map((e) => (
            <li key={e.id} className="px-4 py-2.5 flex items-center gap-3">
              <span className="text-xs font-mono text-text-muted shrink-0">
                {new Date(e.createdAt).toLocaleString()}
              </span>
              <span className="text-xs">
                <Badge intent={e.op === "delete" ? "danger" : e.op === "create" ? "success" : "info"}>
                  {e.op}
                </Badge>
                <span className="ml-1.5 font-mono text-text-primary">
                  {e.resource}/{e.recordId}
                </span>
              </span>
              <span className="text-[11px] text-text-muted ml-auto">{agentName(e.agentId)}</span>
              <Button variant="outline" size="sm" onClick={() => reverse(e.id, false)}>
                Revert
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => reverse(e.id, true)}
                className="text-danger"
                title="Force-revert even if a human has edited the record since"
              >
                Force
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* -- dual-key tab ------------------------------------------------- */

function DualKeyTab({
  agents,
  setError,
}: {
  agents: Agent[];
  setError: (s: string | undefined) => void;
}): React.ReactElement {
  const [agentId, setAgentId] = React.useState(agents[0]?.id ?? "");
  const [toolName, setToolName] = React.useState("");
  const [argsJson, setArgsJson] = React.useState('{\n  "id": "<record-id>"\n}');
  const [ttlMinutes, setTtlMinutes] = React.useState(30);
  const [issued, setIssued] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const submit = async (): Promise<void> => {
    setSubmitting(true);
    setError(undefined);
    setIssued(null);
    try {
      let parsedArgs: Record<string, unknown>;
      try {
        parsedArgs = JSON.parse(argsJson) as Record<string, unknown>;
      } catch {
        setError("arguments must be valid JSON");
        return;
      }
      const r = await api<{ dualKeyToken: string }>("/mcp/admin/dual-key", {
        method: "POST",
        body: JSON.stringify({ agentId, toolName, arguments: parsedArgs, ttlMinutes }),
      });
      setIssued(r.dualKeyToken);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="rounded-lg border border-border bg-surface-0 shadow-sm">
      <div className="px-4 py-3 border-b border-border-subtle">
        <div className="text-sm font-semibold text-text-primary">Issue dual-key token</div>
        <p className="text-xs text-text-muted leading-relaxed">
          Pre-approve ONE irreversible call by an agent. The token is bound to the exact (agent, tool, arguments)
          you specify; reusing it on different arguments is rejected. Single-use, expiring.
        </p>
      </div>
      <div className="p-4 space-y-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Agent</Label>
          <select
            value={agentId}
            onChange={(e) => setAgentId(e.target.value)}
            className="h-8 w-full rounded-md border border-border bg-surface-0 px-2 text-sm"
          >
            {agents.filter((a) => a.status === "active").map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Tool</Label>
          <ToolPicker
            value={toolName || undefined}
            onChange={(v) => setToolName(v ?? "")}
            riskFilter={["irreversible"]}
            placeholder="Select an irreversible tool…"
          />
          <p className="text-[11px] text-text-muted">
            Dual-key tokens only matter for irreversible operations. The list is filtered to that risk class.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Arguments (exact match required)</Label>
          <Textarea
            value={argsJson}
            onChange={(e) => setArgsJson(e.target.value)}
            rows={5}
            className="font-mono text-xs"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">TTL (minutes)</Label>
          <Input
            type="number"
            min={1}
            max={1440}
            value={ttlMinutes}
            onChange={(e) => setTtlMinutes(Number(e.target.value) || 30)}
          />
        </div>
        <Button onClick={submit} disabled={submitting || !agentId || !toolName}>
          {submitting ? "Issuing…" : "Issue token"}
        </Button>
        {issued && (
          <div className="rounded-md border border-warning-strong/30 bg-warning-soft p-3 space-y-2">
            <div className="text-sm font-semibold text-warning-strong">
              Dual-key token — copy now, won't be shown again
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 font-mono text-xs bg-surface-1 rounded px-2 py-1.5 break-all">
                {issued}
              </code>
              <Button variant="outline" size="sm" onClick={() => void navigator.clipboard.writeText(issued)}>
                Copy
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setIssued(null)}>
                Dismiss
              </Button>
            </div>
            <div className="text-[11px] text-warning-strong">
              The agent passes this in the next tools/call as <code>_meta.dualKeyToken</code>.
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

/* -- agent detail (stats + recent calls + scopes editor) ---------- */

function AgentDetailPanel({ agent, onClose }: { agent: Agent; onClose: () => void }): React.ReactElement {
  const [stats, setStats] = React.useState<AgentStats | null>(null);
  const [calls, setCalls] = React.useState<CallRow[]>([]);
  React.useEffect(() => {
    void api<{ stats: AgentStats }>(`/mcp/admin/agents/${agent.id}/stats`)
      .then((r) => setStats(r.stats))
      .catch(() => undefined);
    void api<{ calls: CallRow[] }>(`/mcp/admin/calls?agentId=${encodeURIComponent(agent.id)}&limit=50`)
      .then((r) => setCalls(r.calls))
      .catch(() => undefined);
  }, [agent.id]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-black/40 flex items-end justify-center md:items-center md:justify-end p-4"
      onClick={onClose}
    >
      <div
        className="bg-surface-0 rounded-lg border border-border shadow-2xl w-full md:max-w-2xl md:h-[88vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="sticky top-0 bg-surface-0 px-4 py-3 border-b border-border flex items-center justify-between">
          <div>
            <div className="text-base font-semibold">{agent.name}</div>
            <div className="text-xs text-text-muted">{agent.id}</div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
        </header>
        <div className="p-4 space-y-4">
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Stat label="Total calls" value={stats.callsTotal} />
              <Stat label="Errors" value={stats.callsError} muted={stats.callsError === 0} />
              <Stat label="Last 24h" value={stats.callsLast24h} />
              <Stat label="Mutations 24h" value={stats.mutationCallsLast24h} />
              <Stat label="Avg latency" value={`${stats.avgLatencyMs}ms`} />
              <Stat label="Error rate" value={`${(stats.errorRate * 100).toFixed(1)}%`} />
            </div>
          )}

          <Section title="Scopes">
            <ScopeDisplay scopes={agent.scopes} />
          </Section>

          <Section title="Risk + limits">
            <div className="text-xs space-y-1">
              <div>Risk ceiling: <code className="font-mono">{agent.riskCeiling}</code></div>
              {agent.rateLimits["safe-read"] !== undefined && <div>Reads/min: {agent.rateLimits["safe-read"]}</div>}
              {agent.rateLimits["low-mutation"] !== undefined && <div>Low mutations/min: {agent.rateLimits["low-mutation"]}</div>}
              {agent.rateLimits["high-mutation"] !== undefined && <div>High mutations/min: {agent.rateLimits["high-mutation"]}</div>}
              {agent.budget.dailyWriteCap !== undefined && <div>Daily write cap: {agent.budget.dailyWriteCap}</div>}
            </div>
          </Section>

          <Section title="Recent calls">
            {calls.length === 0 ? (
              <div className="text-xs text-text-muted">No calls yet.</div>
            ) : (
              <ul className="text-xs divide-y divide-border-subtle">
                {calls.map((c) => (
                  <li key={c.id} className="py-1.5 flex items-baseline gap-2">
                    <span className="text-text-muted tabular-nums shrink-0">
                      {new Date(c.createdAt).toLocaleTimeString()}
                    </span>
                    <span className={cn("font-mono", c.ok ? "text-text-primary" : "text-danger-strong")}>
                      {c.toolName ?? c.method}
                    </span>
                    {c.risk && (
                      <span className="text-[10px] text-text-muted uppercase tracking-wide">{c.risk}</span>
                    )}
                    {!c.ok && c.errorMessage && (
                      <span className="text-danger-strong text-[11px] truncate">{c.errorMessage}</span>
                    )}
                    {c.latencyMs !== undefined && (
                      <span className="ml-auto text-text-muted tabular-nums">{c.latencyMs}ms</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}

/** Read-only scope panel — uses the same registry the picker reads
 *  from so labels stay in sync. Falls back to the raw id when the
 *  registry hasn't loaded the descriptor yet. */
function ScopeDisplay({ scopes }: { scopes: Record<string, string[]> }): React.ReactElement {
  const { data: resources } = useUiResources();
  const byId = React.useMemo(() => new Map(resources.map((r) => [r.id, r])), [resources]);
  const entries = Object.entries(scopes);
  if (entries.length === 0) {
    return (
      <div className="text-xs text-text-muted">
        No scopes — agent can connect but cannot call any tool.
      </div>
    );
  }
  return (
    <ul className="text-xs space-y-1.5">
      {entries.map(([resource, actions]) => {
        const meta = byId.get(resource);
        return (
          <li key={resource} className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-text-primary">{meta?.label ?? resource}</span>
            <code className="font-mono text-[10px] text-text-muted">{resource}</code>
            <div className="ml-auto flex items-center gap-1">
              {actions.map((a) => (
                <Badge key={a} intent={a === "delete" ? "danger" : a === "write" ? "warning" : "neutral"}>
                  {a}
                </Badge>
              ))}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function Stat({ label, value, muted }: { label: string; value: React.ReactNode; muted?: boolean }): React.ReactElement {
  return (
    <div className="rounded-md border border-border bg-surface-1 p-2">
      <div className="text-[10px] text-text-muted uppercase tracking-wide">{label}</div>
      <div className={cn("text-sm font-semibold tabular-nums mt-0.5", muted ? "text-text-muted" : "text-text-primary")}>
        {value}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }): React.ReactElement {
  return (
    <section className="rounded-md border border-border bg-surface-0">
      <div className="border-b border-border-subtle px-3 py-1.5 text-[10px] uppercase tracking-wide text-text-muted">
        {title}
      </div>
      <div className="px-3 py-2">{children}</div>
    </section>
  );
}

/* -- create dialog ----------------------------------------------- */

function CreateAgentDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => Promise<void>;
}): React.ReactElement {
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [riskCeiling, setRiskCeiling] = React.useState<Agent["riskCeiling"]>("safe-read");
  const [scopes, setScopes] = React.useState<ScopeMap>({});
  const [instructions, setInstructions] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [err, setErr] = React.useState<string | undefined>();

  // Allowed actions follow the risk ceiling — `safe-read` should
  // never be able to grant write/delete, even if the picker shows them.
  const allowedActions = React.useMemo<ScopeAction[]>(() => {
    if (riskCeiling === "safe-read") return ["read"];
    return ["read", "write", "delete"];
  }, [riskCeiling]);

  // When ceiling tightens, prune scopes that are no longer permitted
  // so the operator never silently submits an over-scoped agent.
  React.useEffect(() => {
    const allowed = new Set(allowedActions);
    const pruned: ScopeMap = {};
    let changed = false;
    for (const [resource, actions] of Object.entries(scopes)) {
      const kept = actions.filter((a) => allowed.has(a as ScopeAction)) as ScopeAction[];
      if (kept.length !== actions.length) changed = true;
      if (kept.length > 0) pruned[resource] = kept;
    }
    if (changed) setScopes(pruned);
  }, [allowedActions, scopes]);

  const submit = async (): Promise<void> => {
    setSubmitting(true);
    setErr(undefined);
    try {
      await api("/mcp/admin/agents", {
        method: "POST",
        body: JSON.stringify({
          name,
          description: description || undefined,
          riskCeiling,
          scopes,
          instructions: instructions || undefined,
        }),
      });
      await onCreated();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-surface-0 rounded-lg border border-border shadow-2xl w-full max-w-2xl p-4 space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-base font-semibold">New MCP agent</div>
        <div className="space-y-2">
          <Label className="text-xs">Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Reporting bot" />
        </div>
        <div className="space-y-2">
          <Label className="text-xs">Description</Label>
          <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Generates weekly KPI summaries" />
        </div>
        <div className="space-y-2">
          <Label className="text-xs">Risk ceiling</Label>
          <select
            value={riskCeiling}
            onChange={(e) => setRiskCeiling(e.target.value as Agent["riskCeiling"])}
            className="h-8 w-full rounded-md border border-border bg-surface-0 px-2 text-sm"
          >
            <option value="safe-read">Read only (safest)</option>
            <option value="low-mutation">Low mutation (creates + reversible updates)</option>
            <option value="high-mutation">High mutation (upsert + bulk; requires idempotency keys)</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label className="text-xs">Scopes</Label>
          <ResourceScopePicker
            value={scopes}
            onChange={setScopes}
            allowedActions={allowedActions}
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs">Instructions (returned on initialize)</Label>
          <Textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={3} className="text-xs" placeholder="Optional system-prompt-like guidance for the agent" />
        </div>
        {err && <div className="text-xs text-danger-strong">{err}</div>}
        <div className="flex items-center justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={submitting || !name}>
            {submitting ? "Creating…" : "Create"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export const mcpAgentsView = defineCustomView({
  id: "tools.mcp-agents.view",
  title: "MCP agents",
  description: "Identities, tokens, scopes, and audit feed for AI agents.",
  resource: "admin-tools.mcp-agents",
  archetype: "detail-rich",
  density: "comfortable",
  render: () => <McpAgentsPage />,
});

export const mcpAgentsNavItem = {
  id: "admin-tools.nav.mcp-agents",
  label: "MCP agents",
  icon: "Bot",
  // Mount under /admin-tools/ rather than /settings/ — the latter is
  // claimed by the generic shell Settings page and our hash-router
  // matches that prefix first.
  path: "/admin-tools/mcp-agents",
  view: "tools.mcp-agents.view",
  section: "settings",
  order: 9,
};
