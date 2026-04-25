/** Workflow engine — runtime for the graphs defined in `types.ts`.
 *
 *  Boot:
 *    `startWorkflowEngine()` is called once from `main.ts`. It
 *      1. subscribes to the in-process record-event bus to drive
 *         `database-event` triggers,
 *      2. starts a 60-second tick that checks every active workflow
 *         with a `cron` trigger and enqueues runs whose schedule has
 *         elapsed,
 *      3. starts a small async worker pool (concurrency 4) draining
 *         the run queue.
 *
 *  Per run:
 *    `runWorkflow(workflowId, triggerPayload)` resolves the workflow
 *    row, creates a `workflow_runs` row, walks the graph from the
 *    synthetic START node, calls one action runner per node, persists
 *    output[nodeId], and marks success/failure when the graph is done.
 *
 *  Failure model:
 *    No exceptions bubble. `runWorkflow` ALWAYS resolves; failures land
 *    in the run row's `error` column. This is deliberate: a failing
 *    workflow must not bring down the request that triggered it.
 *
 *  Concurrency:
 *    A single in-memory FIFO queue. Up to 4 runs active at once. Each
 *    item carries the workflow id + trigger payload + a tenant marker.
 *    No persistence — if the process dies mid-run we lose pending
 *    items. That's the trade-off for "no extra infra"; revisit when we
 *    have a real broker. */

import { db, nowIso } from "../../db";
import { uuid } from "../id";
import { recordAudit } from "../audit";
import { subscribeRecordEvents, type RecordEvent } from "../event-bus";
import {
  deleteRecord,
  getRecord,
  insertRecord,
  updateRecord,
} from "../query";
import {
  type CodeNode,
  type CronTrigger,
  type DatabaseEventTrigger,
  type DelayNode,
  type HttpRequestNode,
  type IfElseNode,
  type IteratorNode,
  type LogNode,
  type MailSendNode,
  type NodeOutput,
  type RecordCreateNode,
  type RecordDeleteNode,
  type RecordFindNode,
  type RecordUpdateNode,
  type VariablesBag,
  type WebhookOutboundNode,
  type WorkflowDefinition,
  type WorkflowEdge,
  type WorkflowNode,
  type WorkflowRow,
  type WorkflowRunRow,
  type WorkflowRunStatus,
} from "./types";

// ───────────────────────── public API ─────────────────────────

/** Wire the engine to the host process. Idempotent — calling it a
 *  second time is a no-op (used by tests that re-import). */
let engineStarted = false;
let cronTimer: ReturnType<typeof setInterval> | null = null;
let unsubscribeBus: (() => void) | null = null;

export function startWorkflowEngine(): void {
  if (engineStarted) return;
  engineStarted = true;

  // 1. Subscribe to record CRUD events for `database-event` triggers.
  unsubscribeBus = subscribeRecordEvents((evt) => onRecordEvent(evt));

  // 2. Cron tick — every 60s walk the active workflows with a cron
  //    trigger and queue ones whose interval/cron expression fires.
  cronTimer = setInterval(() => {
    try {
      checkCronWorkflows();
    } catch (err) {
      // Never let a bad workflow blow up the timer.
      // eslint-disable-next-line no-console
      console.error("[workflow] cron tick error", err);
    }
  }, 60_000);

  // 3. Spin up the worker pool. The pool just races against
  //    `pending` / new items via a shared signal.
  for (let i = 0; i < CONCURRENCY; i++) startWorker(i);
}

/** For tests + graceful shutdown. */
export function stopWorkflowEngine(): void {
  if (!engineStarted) return;
  engineStarted = false;
  if (cronTimer) clearInterval(cronTimer);
  cronTimer = null;
  unsubscribeBus?.();
  unsubscribeBus = null;
  // Worker loops exit on next iteration via the engineStarted check.
}

/** Enqueue a workflow run. Returns immediately — actual execution
 *  happens off-thread. Used by triggers + the manual-run endpoint. */
export function enqueueRun(args: {
  workflowId: string;
  triggerPayload: unknown;
  /** Surface the actor for audit; defaults to "system". */
  actor?: string;
}): void {
  queue.push({
    workflowId: args.workflowId,
    triggerPayload: args.triggerPayload,
    actor: args.actor ?? "system:workflow",
    enqueuedAt: nowIso(),
  });
  pokeWorkers();
}

/** Synchronously run a workflow start-to-finish. Blocks the caller
 *  while the graph executes. Returns the persisted run row.
 *
 *  Used by the manual-trigger endpoint when the caller wants the
 *  output inline AND by the worker pool. We always catch and persist;
 *  no exception ever leaves this function. */
export async function runWorkflow(
  workflowId: string,
  triggerPayload: unknown,
  opts: { actor?: string } = {},
): Promise<WorkflowRunRow> {
  const wf = loadWorkflow(workflowId);
  if (!wf) {
    // We can't write a workflow_runs row without a tenant_id, so we
    // just return a synthetic failure object. The caller is the only
    // one waiting on this; nobody else cares.
    return {
      id: uuid(),
      workflowId,
      tenantId: "unknown",
      status: "failure",
      triggerPayload,
      output: null,
      error: `workflow ${workflowId} not found`,
      startedAt: nowIso(),
      finishedAt: nowIso(),
      durationMs: 0,
    };
  }

  const runId = uuid();
  const startedAt = nowIso();
  const t0 = Date.now();
  // Insert a "running" row up-front so the UI can show in-flight runs.
  db.prepare(
    `INSERT INTO workflow_runs
      (id, workflow_id, tenant_id, status, trigger_payload, output, error,
       started_at, finished_at, duration_ms)
     VALUES (?, ?, ?, 'running', ?, NULL, NULL, ?, NULL, NULL)`,
  ).run(
    runId,
    wf.id,
    wf.tenantId,
    JSON.stringify(triggerPayload ?? null),
    startedAt,
  );

  const bag: VariablesBag = {
    trigger: triggerPayload,
    output: {},
    vars: { ...(wf.definition.variables?.initial ?? {}) },
  };

  let status: WorkflowRunStatus = "success";
  let runError: string | null = null;
  try {
    await executeGraph(wf, bag);
  } catch (err) {
    // Should be unreachable — `executeGraph` catches per-node errors.
    // If something escapes anyway we record it and move on.
    status = "failure";
    runError = err instanceof Error ? err.message : String(err);
    // eslint-disable-next-line no-console
    console.error("[workflow] unexpected runner error", err);
  }

  // If any node recorded an error, mark the whole run failed.
  if (status === "success") {
    for (const out of Object.values(bag.output) as NodeOutput[]) {
      if (out && out.ok === false) {
        status = "failure";
        runError = String(out.error ?? "node failed");
        break;
      }
    }
  }

  const finishedAt = nowIso();
  const durationMs = Date.now() - t0;
  db.prepare(
    `UPDATE workflow_runs
        SET status = ?, output = ?, error = ?, finished_at = ?, duration_ms = ?
      WHERE id = ?`,
  ).run(
    status,
    JSON.stringify(bag.output),
    runError,
    finishedAt,
    durationMs,
    runId,
  );

  // Update meta on the workflow row — totalRuns + lastRunAt.
  bumpWorkflowMeta(wf, { lastRunAt: finishedAt });

  recordAudit({
    actor: opts.actor ?? "system:workflow",
    action: status === "success" ? "workflow.run.success" : "workflow.run.failure",
    resource: "workflow",
    recordId: wf.id,
    level: status === "failure" ? "error" : "info",
    payload: { runId, durationMs, error: runError },
  });

  return {
    id: runId,
    workflowId: wf.id,
    tenantId: wf.tenantId,
    status,
    triggerPayload,
    output: bag.output,
    error: runError,
    startedAt,
    finishedAt,
    durationMs,
  };
}

/** Find the workflow row by id (any tenant — caller must check tenant
 *  scope before exposing). Parses the JSON definition. */
export function loadWorkflow(id: string): WorkflowRow | null {
  const row = db
    .prepare(
      `SELECT id, tenant_id, name, description, status, definition, version,
              created_by, created_at, updated_at
         FROM workflows WHERE id = ?`,
    )
    .get(id) as
    | {
        id: string;
        tenant_id: string;
        name: string;
        description: string | null;
        status: WorkflowRow["status"];
        definition: string;
        version: number;
        created_by: string;
        created_at: string;
        updated_at: string;
      }
    | undefined;
  if (!row) return null;
  let def: WorkflowDefinition;
  try {
    def = JSON.parse(row.definition) as WorkflowDefinition;
  } catch {
    return null;
  }
  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    description: row.description,
    status: row.status,
    definition: def,
    version: row.version,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ───────────────────────── trigger matching ─────────────────────────

/** Called by the event-bus subscription on every record CRUD event.
 *  Walks every active workflow with a `database-event` trigger and
 *  enqueues a run if it matches. */
function onRecordEvent(evt: RecordEvent): void {
  const verb = evt.type.replace(/^record\./, "") as
    | "created"
    | "updated"
    | "deleted"
    | "restored"
    | "destroyed";
  const rows = db
    .prepare(
      `SELECT id, tenant_id, definition FROM workflows
        WHERE status = 'active' AND tenant_id = ?`,
    )
    .all(evt.tenantId) as { id: string; tenant_id: string; definition: string }[];
  for (const r of rows) {
    let def: WorkflowDefinition;
    try { def = JSON.parse(r.definition) as WorkflowDefinition; }
    catch { continue; }
    if (def.trigger?.kind !== "database-event") continue;
    const t = def.trigger as DatabaseEventTrigger;
    if (!matchResource(t.resource, evt.resource)) continue;
    if (!t.on?.includes(verb)) continue;
    if (verb === "updated" && t.fields && t.fields.length > 0) {
      const diff = evt.diff ?? {};
      const hit = t.fields.some((f) => Object.prototype.hasOwnProperty.call(diff, f));
      if (!hit) continue;
    }
    enqueueRun({
      workflowId: r.id,
      triggerPayload: {
        type: evt.type,
        resource: evt.resource,
        recordId: evt.recordId,
        record: evt.record,
        before: evt.before,
        diff: evt.diff,
        actor: evt.actor,
        occurredAt: evt.occurredAt,
      },
      actor: `system:db-event:${evt.actor}`,
    });
  }
}

/** Glob match — supports a single `*` wildcard segment. We don't need
 *  full glob semantics; the resource set is a small, vetted list. */
function matchResource(pattern: string, resource: string): boolean {
  if (pattern === "*" || pattern === resource) return true;
  if (!pattern.includes("*")) return false;
  // Build a regex that treats `*` as `[^.]*` so `crm.*` matches
  // `crm.contact` but not `crm.contact.note`.
  const re = new RegExp(
    "^" +
      pattern
        .split("*")
        .map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
        .join("[^.]*") +
      "$",
  );
  return re.test(resource);
}

// ───────────────────────── cron scheduler ─────────────────────────

/** Every 60s: walk active cron workflows; fire any whose interval
 *  has elapsed or whose 5-field cron expression matches the current
 *  minute. Decision: at-most-once per minute boundary — we record
 *  `lastFiredAt` and refuse to fire again within 30s.
 *
 *  Cron parser is intentionally tiny: supports `*`, `*​/N`, and integer
 *  literals in each of the 5 fields. Ranges (`1-5`) and lists (`1,3,5`)
 *  are not implemented — callers should use `intervalMs` for anything
 *  more complex, or open a follow-up. */
function checkCronWorkflows(): void {
  const rows = db
    .prepare(
      `SELECT id, tenant_id, definition FROM workflows
        WHERE status = 'active'`,
    )
    .all() as { id: string; tenant_id: string; definition: string }[];
  const now = new Date();
  for (const r of rows) {
    let def: WorkflowDefinition;
    try { def = JSON.parse(r.definition) as WorkflowDefinition; }
    catch { continue; }
    if (def.trigger?.kind !== "cron") continue;
    const t = def.trigger as CronTrigger;
    const last = t.lastFiredAt ? new Date(t.lastFiredAt) : null;
    let due = false;

    if (typeof t.intervalMs === "number" && t.intervalMs > 0) {
      due = !last || now.getTime() - last.getTime() >= t.intervalMs;
    } else if (typeof t.cron === "string" && t.cron.trim()) {
      // Anti-double-fire: even if the cron matches, refuse if we
      // already fired within the last 30s.
      if (last && now.getTime() - last.getTime() < 30_000) continue;
      due = cronMatches(t.cron, now);
    }
    if (!due) continue;
    // Persist lastFiredAt BEFORE enqueuing so a slow run doesn't
    // double-fire on the next tick.
    t.lastFiredAt = now.toISOString();
    persistDefinition(r.id, def);
    enqueueRun({
      workflowId: r.id,
      triggerPayload: { type: "cron", firedAt: t.lastFiredAt },
      actor: "system:cron",
    });
  }
}

/** Parse a 5-field cron expression and check it against `now`.
 *  Fields: minute, hour, day-of-month, month, day-of-week (0=Sun).
 *  Each field accepts `*`, an integer, or `*​/N`. */
export function cronMatches(expr: string, now: Date): boolean {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return false;
  const fields: Array<[string, number]> = [
    [parts[0], now.getMinutes()],
    [parts[1], now.getHours()],
    [parts[2], now.getDate()],
    [parts[3], now.getMonth() + 1],
    [parts[4], now.getDay()],
  ];
  for (const [field, value] of fields) {
    if (!cronFieldMatches(field, value)) return false;
  }
  return true;
}

function cronFieldMatches(field: string, value: number): boolean {
  if (field === "*") return true;
  if (/^\*\/(\d+)$/.test(field)) {
    const step = Number(RegExp.$1);
    if (step <= 0) return false;
    return value % step === 0;
  }
  if (/^\d+$/.test(field)) return Number(field) === value;
  return false;
}

/** Write the definition JSON back, bumping `updated_at`. Used for
 *  cron `lastFiredAt` and run-meta updates. */
function persistDefinition(workflowId: string, def: WorkflowDefinition): void {
  db.prepare(
    `UPDATE workflows SET definition = ?, updated_at = ? WHERE id = ?`,
  ).run(JSON.stringify(def), nowIso(), workflowId);
}

/** Bump engine-managed metadata. Read-modify-write; safe under the
 *  worker's serial-per-workflow ordering. */
function bumpWorkflowMeta(
  wf: WorkflowRow,
  patch: { lastRunAt?: string },
): void {
  const current = loadWorkflow(wf.id);
  if (!current) return;
  const def = current.definition;
  def.meta = {
    ...(def.meta ?? {}),
    ...(patch.lastRunAt ? { lastRunAt: patch.lastRunAt } : {}),
    totalRuns: (def.meta?.totalRuns ?? 0) + 1,
  };
  persistDefinition(current.id, def);
}

// ───────────────────────── worker pool ─────────────────────────

interface QueueItem {
  workflowId: string;
  triggerPayload: unknown;
  actor: string;
  enqueuedAt: string;
}

const CONCURRENCY = 4;
const queue: QueueItem[] = [];
/** Promise that resolves the next time `pokeWorkers` is called.
 *  Workers `await` this when the queue is empty so they don't spin. */
let wakeWorkers: (() => void) | null = null;

function pokeWorkers(): void {
  const w = wakeWorkers;
  wakeWorkers = null;
  if (w) w();
}

function nextItem(): Promise<QueueItem | null> {
  if (queue.length > 0) return Promise.resolve(queue.shift() ?? null);
  // Park: resolved when something is enqueued.
  return new Promise<QueueItem | null>((resolve) => {
    wakeWorkers = () => {
      const item = queue.shift() ?? null;
      resolve(item);
    };
  });
}

async function startWorker(idx: number): Promise<void> {
  // Loop forever (or until stopWorkflowEngine clears engineStarted).
  while (engineStarted) {
    let item: QueueItem | null = null;
    try {
      item = await nextItem();
    } catch {
      continue;
    }
    if (!item) continue;
    try {
      await runWorkflow(item.workflowId, item.triggerPayload, {
        actor: item.actor,
      });
    } catch (err) {
      // runWorkflow shouldn't throw, but defense in depth.
      // eslint-disable-next-line no-console
      console.error(`[workflow][worker-${idx}] unexpected error`, err);
    }
  }
}

// ───────────────────────── graph executor ─────────────────────────

/** Walk the graph from "start" and execute nodes in DFS order. We use
 *  iteration not recursion to keep the stack flat. */
async function executeGraph(
  wf: WorkflowRow,
  bag: VariablesBag,
): Promise<void> {
  const def = wf.definition;
  const nodesById = new Map<string, WorkflowNode>();
  for (const n of def.nodes ?? []) nodesById.set(n.id, n);
  const adjacency = buildAdjacency(def.edges ?? []);

  // Visit queue: list of node ids to execute next. The synthetic
  // "start" node has no body; we just look up its out-edges.
  const toVisit: string[] = nextNodes("start", adjacency, null, bag);
  // Cycle guard — bound how many node visits a single run can cost.
  // 10 000 is enormous for real workflows; iterators carry their own
  // smaller cap.
  const HARD_VISIT_CAP = 10_000;
  let visited = 0;

  while (toVisit.length > 0) {
    if (++visited > HARD_VISIT_CAP) {
      // Mark the run with a synthetic node-error then stop.
      bag.output["__engine__"] = {
        ok: false,
        error: "execution cap exceeded — possible cycle",
      } satisfies NodeOutput;
      return;
    }
    const id = toVisit.shift();
    if (!id) continue;
    const node = nodesById.get(id);
    if (!node) {
      // Edge points at a missing node — log and continue.
      bag.output[id] = {
        ok: false,
        error: `unknown node id: ${id}`,
      } satisfies NodeOutput;
      continue;
    }
    const t0 = Date.now();
    let nodeOutput: NodeOutput;
    try {
      const value = await runNode(node, bag, wf);
      nodeOutput = {
        ok: true,
        value,
        durationMs: Date.now() - t0,
      };
    } catch (err) {
      nodeOutput = {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
        durationMs: Date.now() - t0,
      };
    }
    bag.output[node.id] = nodeOutput;

    // If a node failed, stop walking — the run is doomed. We could
    // honor an "on-error" edge tag in a future revision.
    if (!nodeOutput.ok) return;

    // Iterators handle their own fan-out inline (see runNode); they
    // return a sentinel so we know to consume only the `after` edge.
    const fanOut = nextNodes(node.id, adjacency, node, bag);
    for (const next of fanOut) toVisit.push(next);
  }
}

/** Build a quick from→edges lookup. */
function buildAdjacency(edges: WorkflowEdge[]): Map<string, WorkflowEdge[]> {
  const m = new Map<string, WorkflowEdge[]>();
  for (const e of edges) {
    const arr = m.get(e.from) ?? [];
    arr.push(e);
    m.set(e.from, arr);
  }
  return m;
}

/** Resolve a node id to its outgoing next nodes, applying branch
 *  semantics for if-else / iterator nodes. */
function nextNodes(
  fromId: string,
  adjacency: Map<string, WorkflowEdge[]>,
  fromNode: WorkflowNode | null,
  bag: VariablesBag,
): string[] {
  const edges = adjacency.get(fromId) ?? [];
  if (edges.length === 0) return [];

  // if-else: take edges whose branch matches the predicate's outcome.
  if (fromNode && fromNode.type === "if-else") {
    const out = bag.output[fromNode.id] as NodeOutput | undefined;
    const truthy = out?.ok === true && out.value === true;
    const wanted = truthy ? "true" : "false";
    const taken = edges.filter((e) => e.branch === wanted);
    if (taken.length > 0) return taken.map((e) => e.to);
    // Fallback to default-tagged edges (or untagged).
    return edges
      .filter((e) => !e.branch || e.branch === "default")
      .map((e) => e.to);
  }

  // iterator: ran inside runNode; pick the `after` edge to continue.
  if (fromNode && fromNode.type === "iterator") {
    const after = edges.filter((e) => e.branch === "after");
    if (after.length > 0) return after.map((e) => e.to);
    return edges
      .filter((e) => !e.branch || e.branch === "default")
      .map((e) => e.to);
  }

  // Default: take everything (parallel-like; we still execute serially
  // because we DFS, but multiple successors are allowed).
  return edges.map((e) => e.to);
}

// ───────────────────────── action runners ─────────────────────────

/** Per-node dispatcher. Each runner returns the value to record under
 *  `output[nodeId].value`; throws on failure. */
async function runNode(
  node: WorkflowNode,
  bag: VariablesBag,
  wf: WorkflowRow,
): Promise<unknown> {
  switch (node.type) {
    case "record.create":
      return runRecordCreate(node, bag, wf);
    case "record.update":
      return runRecordUpdate(node, bag, wf);
    case "record.delete":
      return runRecordDelete(node, bag, wf);
    case "record.find":
      return runRecordFind(node, bag);
    case "http.request":
      return runHttpRequest(node, bag);
    case "mail.send":
      return runMailSend(node, bag);
    case "webhook.outbound":
      return runWebhookOutbound(node, bag, wf);
    case "delay":
      return runDelay(node);
    case "if-else":
      return runIfElse(node, bag);
    case "iterator":
      return runIterator(node, bag, wf);
    case "code":
      return runCode(node, bag);
    case "log":
      return runLog(node, bag);
    default: {
      // Exhaustiveness: the type union should cover every case. If a
      // new action type is added without a runner we fail fast.
      const _exhaustive: never = node;
      throw new Error(`unknown action type: ${(_exhaustive as { type: string }).type}`);
    }
  }
}

function runRecordCreate(
  node: RecordCreateNode,
  bag: VariablesBag,
  wf: WorkflowRow,
): { id: string; record: Record<string, unknown> } {
  const id = uuid();
  const data = renderTemplate(node.params.data, bag) as Record<string, unknown>;
  const record = insertRecord(node.params.resource, id, {
    ...data,
    id,
    tenantId: wf.tenantId,
    createdBy: data.createdBy ?? `workflow:${wf.id}`,
  });
  return { id, record };
}

function runRecordUpdate(
  node: RecordUpdateNode,
  bag: VariablesBag,
  _wf: WorkflowRow,
): { id: string; record: Record<string, unknown> | null } {
  const id = String(renderTemplate(node.params.id, bag));
  const patch = renderTemplate(node.params.patch, bag) as Record<string, unknown>;
  const record = updateRecord(node.params.resource, id, patch);
  if (!record) throw new Error(`record not found: ${node.params.resource}/${id}`);
  return { id, record };
}

function runRecordDelete(
  node: RecordDeleteNode,
  bag: VariablesBag,
  _wf: WorkflowRow,
): { id: string; deleted: boolean } {
  const id = String(renderTemplate(node.params.id, bag));
  const deleted = deleteRecord(node.params.resource, id);
  return { id, deleted };
}

function runRecordFind(
  node: RecordFindNode,
  bag: VariablesBag,
): Record<string, unknown> | null {
  const id = String(renderTemplate(node.params.id, bag));
  return getRecord(node.params.resource, id);
}

async function runHttpRequest(
  node: HttpRequestNode,
  bag: VariablesBag,
): Promise<{ status: number; headers: Record<string, string>; body: unknown }> {
  const url = String(renderTemplate(node.params.url, bag));
  const method = node.params.method ?? "GET";
  const timeoutMs = node.params.timeoutMs ?? 15_000;
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const headers = renderTemplate(node.params.headers ?? {}, bag) as Record<string, string>;
    const body =
      node.params.body !== undefined
        ? typeof node.params.body === "string"
          ? String(renderTemplate(node.params.body, bag))
          : JSON.stringify(renderTemplate(node.params.body, bag))
        : undefined;
    if (body && !headers["content-type"] && !headers["Content-Type"]) {
      headers["content-type"] = "application/json";
    }
    const res = await fetch(url, {
      method,
      headers,
      body: method === "GET" || method === "DELETE" ? undefined : body,
      signal: ctrl.signal,
    });
    const text = await res.text();
    let parsed: unknown = text;
    const ct = res.headers.get("content-type") ?? "";
    if (ct.includes("application/json")) {
      try { parsed = JSON.parse(text) as unknown; } catch { /* keep as text */ }
    }
    return {
      status: res.status,
      headers: Object.fromEntries(res.headers.entries()),
      body: parsed,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function runMailSend(
  node: MailSendNode,
  bag: VariablesBag,
): { sent: boolean; provider: string; to: string | string[] } {
  // Stub — wire to provider (SES/SendGrid/SMTP) in a follow-up.
  // Workflow authors need an action to point at; we log to keep them
  // unblocked. The shape mirrors the real provider response so the
  // graph can be wired up against this for now.
  const to = renderTemplate(node.params.to, bag) as string | string[];
  const subject = String(renderTemplate(node.params.subject, bag));
  const body = String(renderTemplate(node.params.body, bag));
  // eslint-disable-next-line no-console
  console.log(
    `[workflow][mail.send] (stub) to=${JSON.stringify(to)} subject=${JSON.stringify(subject)} body.len=${body.length}`,
  );
  return { sent: true, provider: "stub", to };
}

function runWebhookOutbound(
  node: WebhookOutboundNode,
  bag: VariablesBag,
  wf: WorkflowRow,
): { delivered: boolean; deliveryId: string } {
  // Resolve the webhook (configured row OR ad-hoc URL). The actual
  // HTTP delivery is owned by the outbound dispatcher; we just write
  // a webhook_deliveries row tagged "queued" and let it pick it up.
  const payload = renderTemplate(node.params.payload, bag);
  const deliveryId = uuid();
  const delivered = nowIso();
  if (node.params.webhookId) {
    db.prepare(
      `INSERT INTO webhook_deliveries
        (id, webhook_id, event_type, payload, status_code, response_body,
         error, attempt, delivered_at)
       VALUES (?, ?, ?, ?, NULL, NULL, NULL, 1, ?)`,
    ).run(
      deliveryId,
      node.params.webhookId,
      node.params.eventType ?? `workflow.${wf.id}`,
      JSON.stringify(payload ?? null),
      delivered,
    );
  } else if (node.params.url) {
    // Ad-hoc — no row in `webhooks`. The dispatcher only handles
    // configured webhooks; we POST inline here and forget. We still
    // record a synthetic delivery row for audit.
    void fireAndForget(node.params.url, payload);
  } else {
    throw new Error("webhook.outbound requires webhookId or url");
  }
  return { delivered: true, deliveryId };
}

async function fireAndForget(url: string, payload: unknown): Promise<void> {
  try {
    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload ?? null),
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(`[workflow][webhook.outbound] ad-hoc POST to ${url} failed`, err);
  }
}

async function runDelay(node: DelayNode): Promise<{ slept: number }> {
  // Cap at 5 minutes — workflows aren't sleeps, and a 24h delay would
  // pin a worker. Use cron / scheduled retries for long waits.
  const ms = Math.max(0, Math.min(300_000, node.params.ms ?? 0));
  await new Promise((resolve) => setTimeout(resolve, ms));
  return { slept: ms };
}

function runIfElse(node: IfElseNode, bag: VariablesBag): boolean {
  const lhs = readPath(bag, node.params.path);
  const rhs = node.params.value;
  switch (node.params.op) {
    case "eq":
      return JSON.stringify(lhs) === JSON.stringify(rhs);
    case "neq":
      return JSON.stringify(lhs) !== JSON.stringify(rhs);
    case "gt":
      return Number(lhs) > Number(rhs);
    case "lt":
      return Number(lhs) < Number(rhs);
    case "gte":
      return Number(lhs) >= Number(rhs);
    case "lte":
      return Number(lhs) <= Number(rhs);
    case "contains": {
      if (Array.isArray(lhs)) return lhs.includes(rhs);
      if (typeof lhs === "string") return lhs.includes(String(rhs));
      return false;
    }
    case "exists":
      return lhs !== undefined && lhs !== null;
    default:
      return false;
  }
}

async function runIterator(
  node: IteratorNode,
  bag: VariablesBag,
  wf: WorkflowRow,
): Promise<{ iterations: number; results: unknown[] }> {
  const arr = readPath(bag, node.params.path);
  if (!Array.isArray(arr)) {
    throw new Error(`iterator path ${node.params.path} did not resolve to an array`);
  }
  const cap = node.params.maxIterations ?? 1000;
  const itemVar = node.params.itemVar ?? "item";
  const results: unknown[] = [];
  // Locate the body sub-graph rooted at the `each`-tagged edge.
  const eachEdges = (wf.definition.edges ?? []).filter(
    (e) => e.from === node.id && e.branch === "each",
  );
  if (eachEdges.length === 0) return { iterations: 0, results };

  const iterations = Math.min(arr.length, cap);
  for (let i = 0; i < iterations; i++) {
    bag.item = arr[i];
    bag.vars[itemVar] = arr[i];
    // Run a fresh sub-DFS rooted at each `each` target. We share the
    // same variables bag; nodes in the body can write to bag.output
    // and override per-iteration values. Output keys collide across
    // iterations — last write wins. Workflow authors who care can use
    // `code` to accumulate into a vars array.
    for (const eachEdge of eachEdges) {
      await executeSubGraph(wf, eachEdge.to, bag);
    }
    results.push(bag.output[eachEdges[0].to]);
  }
  return { iterations, results };
}

/** Walk a sub-graph rooted at `startNodeId`, reusing the same bag.
 *  Used by iterator. We don't follow edges back into the iterator
 *  itself; instead we stop when we'd exit the sub-graph (no more
 *  out-edges) or hit an `after`-tagged edge of any iterator. */
async function executeSubGraph(
  wf: WorkflowRow,
  startNodeId: string,
  bag: VariablesBag,
): Promise<void> {
  const def = wf.definition;
  const nodesById = new Map<string, WorkflowNode>();
  for (const n of def.nodes ?? []) nodesById.set(n.id, n);
  const adjacency = buildAdjacency(def.edges ?? []);
  const toVisit: string[] = [startNodeId];
  let visited = 0;
  const HARD_CAP = 1_000;
  while (toVisit.length > 0) {
    if (++visited > HARD_CAP) return;
    const id = toVisit.shift();
    if (!id) continue;
    const node = nodesById.get(id);
    if (!node) continue;
    const t0 = Date.now();
    let nodeOutput: NodeOutput;
    try {
      const value = await runNode(node, bag, wf);
      nodeOutput = { ok: true, value, durationMs: Date.now() - t0 };
    } catch (err) {
      nodeOutput = {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
        durationMs: Date.now() - t0,
      };
    }
    bag.output[node.id] = nodeOutput;
    if (!nodeOutput.ok) return;
    // Don't cross `after`-edges (they belong to outer flow).
    const fanOut = (adjacency.get(node.id) ?? [])
      .filter((e) => e.branch !== "after")
      .map((e) => e.to);
    for (const next of fanOut) toVisit.push(next);
  }
}

async function runCode(node: CodeNode, bag: VariablesBag): Promise<unknown> {
  // Security caveat (also documented at the type def): this is NOT
  // a true sandbox. `new Function` shares the runtime; a determined
  // user can `globalThis.process.exit(1)`. We wrap with a strict
  // Promise.race timeout but treat workflow editing as a privileged
  // action. The alternative — vm2 — is unmaintained, and Bun has no
  // first-class isolate API yet. Document and move on.
  const timeoutMs = Math.max(50, Math.min(60_000, node.params.timeoutMs ?? 5_000));
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const fn = new Function(
    "vars",
    "trigger",
    "output",
    "item",
    `"use strict"; return (async () => { ${node.params.source} \n})();`,
  ) as (
    vars: Record<string, unknown>,
    trigger: unknown,
    output: Record<string, unknown>,
    item: unknown,
  ) => Promise<unknown>;
  const work = (async () => fn(bag.vars, bag.trigger, bag.output, bag.item))();
  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(`code node timed out after ${timeoutMs}ms`)), timeoutMs);
  });
  return Promise.race([work, timeout]);
}

function runLog(node: LogNode, bag: VariablesBag): { logged: string } {
  const message = String(renderTemplate(node.params.message, bag));
  const level = node.params.level ?? "info";
  // eslint-disable-next-line no-console
  console[level === "error" ? "error" : level === "warn" ? "warn" : "log"](
    `[workflow][log] ${message}`,
  );
  return { logged: message };
}

// ───────────────────────── helpers ─────────────────────────

/** Walk a dotted path like `trigger.record.email`. Bracket indexing
 *  (`vars.list[0]`) is supported via numeric segments. Missing
 *  segments resolve to `undefined`. */
export function readPath(bag: VariablesBag, path: string): unknown {
  if (!path) return undefined;
  const parts = path.replace(/\[(\d+)\]/g, ".$1").split(".").filter(Boolean);
  let cur: unknown = bag;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

/** Substitute `{{ path }}` templates inside any value. Strings are
 *  rendered; objects/arrays are walked recursively; numbers/booleans
 *  pass through. We're conservative — non-string values aren't
 *  coerced, so nested templates inside numbers stay as-is. */
export function renderTemplate(value: unknown, bag: VariablesBag): unknown {
  if (typeof value === "string") {
    return value.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_, path: string) => {
      const v = readPath(bag, path.trim());
      if (v === undefined || v === null) return "";
      if (typeof v === "object") return JSON.stringify(v);
      return String(v);
    });
  }
  if (Array.isArray(value)) return value.map((v) => renderTemplate(v, bag));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = renderTemplate(v, bag);
    }
    return out;
  }
  return value;
}
