/** Typed shape of a workflow definition.
 *
 *  A workflow is a directed graph: ONE trigger plus N action nodes wired
 *  together by edges. The trigger fires (database event, manual call,
 *  cron tick, inbound webhook), the engine creates a `workflow_runs`
 *  row, walks edges from a synthetic START node and executes each
 *  action it lands on. Each action carries a discriminated `params`
 *  object so the action runner has compile-time guarantees.
 *
 *  Why a graph (not a linear list)? Two reasons:
 *   1. `if-else` and `iterator` need fan-out edges with conditions.
 *   2. Twenty/Pipedream/Zapier all settled on graphs — users can build
 *      the same control flows the wider market expects.
 *
 *  The `definition` JSON column on the `workflows` table stores exactly
 *  this shape. The engine never reaches past these types when reading
 *  user-defined workflows; ill-typed JSON gets caught at validate-time
 *  and we fail the run cleanly.
 */

// ───────────────────────── triggers ─────────────────────────

/** Fires when a record CRUD event matches this pattern.
 *
 *  `resource` accepts an exact name ("crm.contact") or a glob with `*`
 *  ("crm.*", "*.contact", "*"). `on` is an array of CRUD verbs to match.
 *  `fields` (optional) restricts `updated` matches to runs where at
 *  least one of these field paths actually changed (uses the `diff`
 *  attached to the RecordEvent). */
export interface DatabaseEventTrigger {
  kind: "database-event";
  resource: string;
  on: Array<"created" | "updated" | "deleted" | "restored" | "destroyed">;
  /** Optional: only fire `updated` when one of these fields changed. */
  fields?: string[];
}

/** Fires only when something explicitly calls the manual-run endpoint.
 *  `availability` says where the "Run" button is exposed: globally in
 *  the workflows page, on a specific record's detail page, or via API.
 *  Defaults to "global" if omitted. */
export interface ManualTrigger {
  kind: "manual";
  availability?: "global" | "record-detail" | "api-only";
  /** When availability = 'record-detail', restrict to this resource. */
  resource?: string;
}

/** Fires on a schedule. Either a 5-field cron string ("*​/5 * * * *")
 *  or a simple "every N minutes" interval. The engine accepts both;
 *  the cron parser is implemented inline in `engine.ts`. */
export interface CronTrigger {
  kind: "cron";
  /** Cron expression — minute, hour, day-of-month, month, day-of-week.
   *  `*​/N` and explicit numbers supported; ranges + lists are not
   *  (keeps the tiny inline parser tiny). */
  cron?: string;
  /** Alternative: run every N milliseconds. Use for sub-minute polls.
   *  Simpler and avoids cron-syntax confusion. */
  intervalMs?: number;
  /** Last successful trigger fire — engine writes this back into the
   *  workflow definition's metadata so we don't double-fire after a
   *  restart. Stored ISO-8601. */
  lastFiredAt?: string;
}

/** Fires when someone POSTs to /api/workflows/triggers/webhook/:id.
 *  Optional `apiKey` requires that header on inbound requests. */
export interface WebhookTrigger {
  kind: "webhook";
  /** Optional pre-shared key. Rejected with 401 if mismatched. */
  apiKey?: string;
}

export type WorkflowTrigger =
  | DatabaseEventTrigger
  | ManualTrigger
  | CronTrigger
  | WebhookTrigger;

// ───────────────────────── nodes ─────────────────────────

/** Action types the engine knows how to run. New verbs go here AND in
 *  `engine.ts` `runNode()`. Anything not in this union is rejected. */
export type WorkflowActionType =
  | "record.create"
  | "record.update"
  | "record.delete"
  | "record.find"
  | "http.request"
  | "mail.send"
  | "webhook.outbound"
  | "delay"
  | "if-else"
  | "iterator"
  | "code"
  | "log";

interface BaseNode {
  /** Stable id within the graph — referenced by edges and by the
   *  per-node output bag. */
  id: string;
  /** Display label for the editor. */
  label?: string;
}

/** Insert a new record on the given resource. `data` may reference
 *  variables via `{{ var.path }}` templates (resolved at run time). */
export interface RecordCreateNode extends BaseNode {
  type: "record.create";
  params: {
    resource: string;
    data: Record<string, unknown>;
  };
}

/** Patch a record by id. `id` may be a literal or a variable template. */
export interface RecordUpdateNode extends BaseNode {
  type: "record.update";
  params: {
    resource: string;
    id: string;
    patch: Record<string, unknown>;
  };
}

export interface RecordDeleteNode extends BaseNode {
  type: "record.delete";
  params: {
    resource: string;
    id: string;
  };
}

export interface RecordFindNode extends BaseNode {
  type: "record.find";
  params: {
    resource: string;
    id: string;
  };
}

export interface HttpRequestNode extends BaseNode {
  type: "http.request";
  params: {
    url: string;
    method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    headers?: Record<string, string>;
    body?: unknown;
    /** Hard timeout — if the request hangs, we abort. Default 15s. */
    timeoutMs?: number;
  };
}

export interface MailSendNode extends BaseNode {
  type: "mail.send";
  params: {
    to: string | string[];
    subject: string;
    body: string;
    /** "html" forwards as multipart/alternative; "text" plain. */
    format?: "html" | "text";
  };
}

/** Send to one of the tenant's configured outbound webhooks. The fan-
 *  out is owned by a separate dispatcher (we just enqueue here). */
export interface WebhookOutboundNode extends BaseNode {
  type: "webhook.outbound";
  params: {
    /** Either a specific webhook id... */
    webhookId?: string;
    /** ...or a free-form URL (one-off, unrecorded). */
    url?: string;
    payload: unknown;
    /** Optional event-type tag for the delivery log. */
    eventType?: string;
  };
}

export interface DelayNode extends BaseNode {
  type: "delay";
  params: {
    /** Wait this many ms before running the next node. Capped server-
     *  side at 5 minutes — workflows aren't meant to be sleeps. */
    ms: number;
  };
}

/** Branches by reading a variable path and choosing an outgoing edge.
 *  The edge whose `condition` evaluates true is taken; if multiple
 *  match, the first by index runs. The engine consults edges' `branch`
 *  field to mark "true" / "false" / "default" sides. */
export interface IfElseNode extends BaseNode {
  type: "if-else";
  params: {
    /** Path into the variables bag, e.g. "trigger.record.status". */
    path: string;
    /** Comparison operator. */
    op: "eq" | "neq" | "gt" | "lt" | "gte" | "lte" | "contains" | "exists";
    /** Right-hand side — literal value, ignored for `exists`. */
    value?: unknown;
  };
}

/** Loops a sub-graph over an array. The first edge marked
 *  `branch: 'each'` is the body entry point. The engine seeds a
 *  per-iteration variable named `params.itemVar` (default "item") and
 *  joins back to the main flow once exhausted. */
export interface IteratorNode extends BaseNode {
  type: "iterator";
  params: {
    /** Path to the array in the variables bag. */
    path: string;
    /** Variable name to bind each item under. Default "item". */
    itemVar?: string;
    /** Hard cap to prevent runaways (default 1000). */
    maxIterations?: number;
  };
}

/** Run a snippet of JavaScript with the variables bag as `vars`. The
 *  snippet's `return` value is stored under `output[nodeId]`.
 *
 *  Security: this is **not** a true sandbox. We use `new Function`
 *  with a restricted global scope and a timeout via Promise.race. A
 *  determined attacker with workflow-edit privileges can still escape
 *  to the host process — DON'T expose workflow editing to untrusted
 *  users. (Bun lacks a hardened sandbox; vm2 is dead. We accept the
 *  trade-off in exchange for first-class scripting.) */
export interface CodeNode extends BaseNode {
  type: "code";
  params: {
    /** Body of the function. Receives `vars`, returns a value (sync or
     *  promise). */
    source: string;
    /** Hard timeout in ms; default 5 000. */
    timeoutMs?: number;
  };
}

export interface LogNode extends BaseNode {
  type: "log";
  params: {
    /** Message — may contain `{{ var.path }}` templates. */
    message: string;
    level?: "info" | "warn" | "error";
  };
}

export type WorkflowNode =
  | RecordCreateNode
  | RecordUpdateNode
  | RecordDeleteNode
  | RecordFindNode
  | HttpRequestNode
  | MailSendNode
  | WebhookOutboundNode
  | DelayNode
  | IfElseNode
  | IteratorNode
  | CodeNode
  | LogNode;

// ───────────────────────── edges ─────────────────────────

/** Connection from one node to another. Most edges have no condition;
 *  the runner just follows them. `branch` lets if-else / iterator nodes
 *  pick a specific outgoing edge by tag. */
export interface WorkflowEdge {
  id?: string;
  /** Source node id, or "start" for the synthetic entry node. */
  from: string;
  /** Target node id. */
  to: string;
  /** Optional tag: "true" / "false" for if-else, "each" / "after" for
   *  iterator. Untagged edges run unconditionally. */
  branch?: "true" | "false" | "each" | "after" | "default";
}

// ───────────────────────── definition ─────────────────────────

export interface WorkflowDefinition {
  trigger: WorkflowTrigger;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  /** Variables seeded into every run's bag at start. Useful for env-
   *  like config (e.g. an admin email to notify). */
  variables: { initial: Record<string, unknown> };
  /** Engine-managed metadata. Don't write from API requests. */
  meta?: WorkflowMeta;
}

/** Engine-managed metadata stored back into the definition JSON. */
export interface WorkflowMeta {
  /** ISO timestamp of the last cron fire. */
  lastFiredAt?: string;
  /** ISO timestamp of the last run for any reason. */
  lastRunAt?: string;
  /** Total runs since this workflow was created. */
  totalRuns?: number;
}

// ───────────────────────── persisted row + run ─────────────────────────

export type WorkflowStatus = "draft" | "active" | "paused" | "archived";
export type WorkflowRunStatus =
  | "pending"
  | "running"
  | "success"
  | "failure"
  | "skipped";

/** Shape of the `workflows` table after we parse the JSON columns. */
export interface WorkflowRow {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  status: WorkflowStatus;
  definition: WorkflowDefinition;
  version: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/** Shape of the `workflow_runs` table after JSON parse. */
export interface WorkflowRunRow {
  id: string;
  workflowId: string;
  tenantId: string;
  status: WorkflowRunStatus;
  triggerPayload: unknown;
  output: Record<string, unknown> | null;
  error: string | null;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
}

/** Per-node output entry stored under `output[nodeId]`. */
export interface NodeOutput {
  ok: boolean;
  /** Free-form result of the action — `{ id }` for record.create,
   *  HTTP response for http.request, return value for code, etc. */
  value?: unknown;
  /** Error message if `ok === false`. */
  error?: string;
  /** Wall-clock duration of the step. */
  durationMs?: number;
}

/** Variables bag: anything the workflow author or upstream nodes have
 *  put in scope. Standard slots:
 *   - `trigger`: the event payload (record diff for db-event,
 *     request body for webhook, payload for manual).
 *   - `output[nodeId]`: per-node outputs (mirrors the column).
 *   - `vars[user-key]`: anything the workflow author seeds.
 */
export interface VariablesBag {
  trigger: unknown;
  output: Record<string, unknown>;
  vars: Record<string, unknown>;
  /** Iteration cursor (set by iterator nodes). */
  item?: unknown;
  /** Allow extra keys for user-set variables. */
  [k: string]: unknown;
}
