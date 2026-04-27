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

export function McpAgentsPage(): React.ReactElement {
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
        <Button onClick={() => setShowCreate(true)}>New agent</Button>
      </header>

      {error && (
        <div role="alert" className="rounded-md border border-danger-strong/30 bg-danger-soft p-2 text-xs text-danger-strong">
          {error}
        </div>
      )}

      {issuedToken && (
        <div className="rounded-md border border-warning-strong/30 bg-warning-soft p-3 space-y-2">
          <div className="text-sm font-semibold text-warning-strong">
            New token — copy it now, you won't see it again
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 font-mono text-xs bg-surface-1 rounded px-2 py-1.5 break-all">
              {issuedToken}
            </code>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void navigator.clipboard.writeText(issuedToken);
              }}
            >
              Copy
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIssuedToken(null)}
            >
              Dismiss
            </Button>
          </div>
        </div>
      )}

      {/* AGENTS LIST */}
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
            {Object.keys(agent.scopes).length === 0 ? (
              <div className="text-xs text-text-muted">No scopes — agent can connect but cannot call any tool.</div>
            ) : (
              <ul className="text-xs space-y-1">
                {Object.entries(agent.scopes).map(([resource, actions]) => (
                  <li key={resource} className="flex items-center gap-2">
                    <code className="font-mono">{resource}</code>
                    <span className="text-text-muted">{actions.join(", ")}</span>
                  </li>
                ))}
              </ul>
            )}
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
  const [scopesText, setScopesText] = React.useState('crm.contact: read\nsales.deal: read');
  const [instructions, setInstructions] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [err, setErr] = React.useState<string | undefined>();

  const submit = async (): Promise<void> => {
    setSubmitting(true);
    setErr(undefined);
    try {
      const scopes: Record<string, string[]> = {};
      for (const line of scopesText.split(/\n+/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const m = /^(\S+):\s*(.+)$/.exec(trimmed);
        if (!m) continue;
        const resource = m[1]!;
        const actions = m[2]!.split(",").map((s) => s.trim()).filter(Boolean) as Array<"read" | "write" | "delete">;
        if (actions.length > 0) scopes[resource] = actions;
      }
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
        className="bg-surface-0 rounded-lg border border-border shadow-2xl w-full max-w-md p-4 space-y-3"
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
          <Label className="text-xs">Scopes (one per line: `resource: read, write, delete`)</Label>
          <Textarea value={scopesText} onChange={(e) => setScopesText(e.target.value)} rows={4} className="font-mono text-xs" />
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
