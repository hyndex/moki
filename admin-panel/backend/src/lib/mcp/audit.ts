/** MCP call audit log.
 *
 *  Every agent-initiated request lands here BEFORE the actual handler
 *  runs (so denied calls are recorded too). The `mcp_call_log` table
 *  holds the full chain — agent → tool → resource → action — and is
 *  the canonical record for compliance + post-incident forensics.
 *
 *  This is independent of the existing `audit_events` chain (which
 *  is hash-chained for tamper-evidence) — agent calls hit BOTH so
 *  ops can correlate. The `audit_events` write is fire-and-forget
 *  (not on the critical path); the `mcp_call_log` write IS on the
 *  critical path because we read it back for the agent dashboard. */

import { db } from "../../db";
import { uuid } from "../id";
import type { Risk } from "./risk";

export interface AuditCallStart {
  agentId: string;
  tenantId: string;
  method: string;
  toolName?: string;
  resource?: string;
  recordId?: string;
  action?: string;
  risk?: Risk;
  arguments?: unknown;
  idempotencyKey?: string;
}

export interface AuditCallEnd {
  ok: boolean;
  errorCode?: number;
  errorMessage?: string;
  resultSummary?: string;
  latencyMs: number;
}

export function logCallStart(args: AuditCallStart): string {
  const id = uuid();
  db.prepare(
    `INSERT INTO mcp_call_log
       (id, agent_id, tenant_id, method, tool_name, resource, record_id,
        action, risk, arguments, ok, idempotency_key, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
  ).run(
    id,
    args.agentId,
    args.tenantId,
    args.method,
    args.toolName ?? null,
    args.resource ?? null,
    args.recordId ?? null,
    args.action ?? null,
    args.risk ?? null,
    args.arguments !== undefined ? JSON.stringify(args.arguments).slice(0, 4000) : null,
    args.idempotencyKey ?? null,
    new Date().toISOString(),
  );
  return id;
}

export function logCallEnd(id: string, end: AuditCallEnd): void {
  db.prepare(
    `UPDATE mcp_call_log SET
       ok = ?,
       error_code = ?,
       error_message = ?,
       result_summary = ?,
       latency_ms = ?
     WHERE id = ?`,
  ).run(
    end.ok ? 1 : 0,
    end.errorCode ?? null,
    end.errorMessage ?? null,
    end.resultSummary ? end.resultSummary.slice(0, 2000) : null,
    end.latencyMs,
    id,
  );
}

export interface CallLogRow {
  id: string;
  agentId: string;
  tenantId: string;
  method: string;
  toolName?: string;
  resource?: string;
  recordId?: string;
  action?: string;
  risk?: string;
  arguments?: string;
  resultSummary?: string;
  ok: boolean;
  errorCode?: number;
  errorMessage?: string;
  latencyMs?: number;
  idempotencyKey?: string;
  createdAt: string;
}

interface DbRow {
  id: string;
  agent_id: string;
  tenant_id: string;
  method: string;
  tool_name: string | null;
  resource: string | null;
  record_id: string | null;
  action: string | null;
  risk: string | null;
  arguments: string | null;
  result_summary: string | null;
  ok: number;
  error_code: number | null;
  error_message: string | null;
  latency_ms: number | null;
  idempotency_key: string | null;
  created_at: string;
}

function rowToCall(r: DbRow): CallLogRow {
  return {
    id: r.id,
    agentId: r.agent_id,
    tenantId: r.tenant_id,
    method: r.method,
    toolName: r.tool_name ?? undefined,
    resource: r.resource ?? undefined,
    recordId: r.record_id ?? undefined,
    action: r.action ?? undefined,
    risk: r.risk ?? undefined,
    arguments: r.arguments ?? undefined,
    resultSummary: r.result_summary ?? undefined,
    ok: r.ok === 1,
    errorCode: r.error_code ?? undefined,
    errorMessage: r.error_message ?? undefined,
    latencyMs: r.latency_ms ?? undefined,
    idempotencyKey: r.idempotency_key ?? undefined,
    createdAt: r.created_at,
  };
}

export function listCalls(args: { tenantId: string; agentId?: string; limit?: number }): CallLogRow[] {
  const limit = Math.max(1, Math.min(args.limit ?? 100, 500));
  const params: unknown[] = [args.tenantId];
  let where = `WHERE tenant_id = ?`;
  if (args.agentId) {
    where += ` AND agent_id = ?`;
    params.push(args.agentId);
  }
  params.push(limit);
  const rows = db
    .prepare(`SELECT * FROM mcp_call_log ${where} ORDER BY created_at DESC LIMIT ?`)
    .all(...params) as DbRow[];
  return rows.map(rowToCall);
}

export interface AgentStats {
  callsTotal: number;
  callsOk: number;
  callsError: number;
  errorRate: number;
  avgLatencyMs: number;
  callsLast24h: number;
  mutationCallsLast24h: number;
}

export function getAgentStats(agentId: string): AgentStats {
  const since24h = new Date(Date.now() - 86_400_000).toISOString();
  const total = db
    .prepare(`SELECT COUNT(*) AS n FROM mcp_call_log WHERE agent_id = ?`)
    .get(agentId) as { n: number };
  const ok = db
    .prepare(`SELECT COUNT(*) AS n FROM mcp_call_log WHERE agent_id = ? AND ok = 1`)
    .get(agentId) as { n: number };
  const err = db
    .prepare(`SELECT COUNT(*) AS n FROM mcp_call_log WHERE agent_id = ? AND ok = 0`)
    .get(agentId) as { n: number };
  const lat = db
    .prepare(`SELECT AVG(latency_ms) AS a FROM mcp_call_log WHERE agent_id = ? AND latency_ms IS NOT NULL`)
    .get(agentId) as { a: number | null };
  const last24 = db
    .prepare(`SELECT COUNT(*) AS n FROM mcp_call_log WHERE agent_id = ? AND created_at >= ?`)
    .get(agentId, since24h) as { n: number };
  const mut24 = db
    .prepare(
      `SELECT COUNT(*) AS n FROM mcp_call_log
       WHERE agent_id = ? AND created_at >= ?
       AND risk IS NOT NULL AND risk != 'safe-read'`,
    )
    .get(agentId, since24h) as { n: number };
  const errorRate = total.n > 0 ? err.n / total.n : 0;
  return {
    callsTotal: total.n,
    callsOk: ok.n,
    callsError: err.n,
    errorRate,
    avgLatencyMs: Math.round(lat.a ?? 0),
    callsLast24h: last24.n,
    mutationCallsLast24h: mut24.n,
  };
}
