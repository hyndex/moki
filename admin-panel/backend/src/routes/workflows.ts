/** Workflow management API.
 *
 *  Surface (mounted at /api/workflows in main.ts):
 *    GET    /                 list (tenant-scoped)
 *    POST   /                 create
 *    GET    /:id              fetch one
 *    PATCH  /:id              update definition + status
 *    DELETE /:id              soft delete (status = 'archived')
 *    POST   /:id/run          manual trigger — runs synchronously
 *    GET    /:id/runs         paginated runs list
 *    GET    /:id/runs/:runId  run detail (output + error)
 *    POST   /:id/duplicate    clone the definition into a new draft
 *
 *    POST   /triggers/webhook/:id  inbound webhook trigger (no auth
 *                                  by default — gated by the trigger's
 *                                  optional `apiKey` header check)
 *
 *  Authorization model:
 *    Workflows are first-class records and live behind the same
 *    editor_acl table as other resources, under the synthetic resource
 *    name "workflow". On create, the creator gets owner + the tenant
 *    gets editor (matches resources.ts). Read needs viewer; PATCH /
 *    run / duplicate need editor; DELETE needs owner. Tenant isolation
 *    is enforced by `tenant_id` on the row + ACL.
 *
 *    The webhook trigger endpoint is intentionally outside the auth
 *    middleware — it's a public-by-design ingestion path. We rely on
 *    the trigger's optional `apiKey` to gate it. */

import { Hono, type Context } from "hono";
import { requireAuth, currentUser } from "../middleware/auth";
import { getTenantContext } from "../tenancy/context";
import { db, nowIso } from "../db";
import { uuid } from "../lib/id";
import { recordAudit } from "../lib/audit";
import {
  effectiveRole,
  grantAcl,
  purgeAclForRecord,
  roleAtLeast,
  seedDefaultAcl,
  type Role,
} from "../lib/acl";
import {
  enqueueRun,
  loadWorkflow,
  runWorkflow,
} from "../lib/workflow/engine";
import type {
  WorkflowDefinition,
  WorkflowRow,
  WorkflowStatus,
} from "../lib/workflow/types";

export const workflowRoutes = new Hono();

/** Tenant id from the request's AsyncLocalStorage. */
function tenantId(): string {
  return getTenantContext()?.tenantId ?? "default";
}

/** Sub-router for the public webhook trigger endpoint. Mounted FIRST
 *  on /triggers so it doesn't get caught by the auth middleware. */
const triggerRoutes = new Hono();

/** Webhook trigger — anyone with the URL (and optional API key) can
 *  fire a workflow. Designed for SaaS integrations (Zapier, Make,
 *  Stripe webhooks). The trigger payload is the request JSON. */
triggerRoutes.post("/webhook/:id", async (c) => {
  const id = c.req.param("id");
  const wf = loadWorkflow(id);
  if (!wf) return c.json({ error: "not found" }, 404);
  if (wf.status !== "active") return c.json({ error: "workflow inactive" }, 409);
  if (wf.definition.trigger?.kind !== "webhook") {
    return c.json({ error: "workflow is not webhook-triggered" }, 400);
  }
  // Optional apiKey gate — header `x-workflow-key`. We compare in
  // constant-ish time (small strings; not super sensitive).
  const expected = wf.definition.trigger.apiKey;
  if (expected) {
    const got = c.req.header("x-workflow-key") ?? "";
    if (got !== expected) return c.json({ error: "unauthorized" }, 401);
  }
  const payload = (await c.req.json().catch(() => ({}))) as unknown;
  enqueueRun({
    workflowId: wf.id,
    triggerPayload: payload,
    actor: "system:webhook",
  });
  return c.json({ ok: true, workflowId: wf.id, queued: true });
});

workflowRoutes.route("/triggers", triggerRoutes);

// ───────────────────────── auth middleware (everything below) ─────────

workflowRoutes.use("*", requireAuth);

/** Guard helper — load + tenant-scope + ACL-check a workflow.
 *  Mirrors the pattern in resources.ts. */
function requireWorkflowRole(
  c: Context,
  id: string,
  need: Role,
):
  | { ok: true; wf: WorkflowRow; role: Role }
  | { ok: false; res: Response } {
  const user = currentUser(c);
  const tid = tenantId();
  const wf = loadWorkflow(id);
  if (!wf) return { ok: false, res: c.json({ error: "not found" }, 404) };
  if (wf.tenantId !== tid && wf.tenantId !== "default") {
    return { ok: false, res: c.json({ error: "not found" }, 404) };
  }
  const role = effectiveRole({
    resource: "workflow",
    recordId: id,
    userId: user.id,
    tenantId: tid,
  });
  if (!role) return { ok: false, res: c.json({ error: "not found" }, 404) };
  if (!roleAtLeast(role, need)) {
    return {
      ok: false,
      res: c.json(
        { error: `requires ${need} role (have ${role})`, code: "access-denied" },
        403,
      ),
    };
  }
  return { ok: true, wf, role };
}

/** Strip + serialize a definition before persistence. We keep parsing
 *  on read elsewhere; this is just a JSON.stringify with a safety net. */
function serializeDefinition(def: unknown): string {
  // Minimum sanity: trigger + nodes + edges + variables present. We
  // don't fully validate against the discriminated union here — the
  // engine catches malformed nodes at run time and records the error.
  const safe = (def ?? {}) as Partial<WorkflowDefinition>;
  const out: WorkflowDefinition = {
    trigger: (safe.trigger ?? { kind: "manual" }) as WorkflowDefinition["trigger"],
    nodes: Array.isArray(safe.nodes) ? safe.nodes : [],
    edges: Array.isArray(safe.edges) ? safe.edges : [],
    variables: { initial: { ...(safe.variables?.initial ?? {}) } },
    ...(safe.meta ? { meta: safe.meta } : {}),
  };
  return JSON.stringify(out);
}

/** Common row → API shape mapper. */
function toApi(wf: WorkflowRow) {
  return {
    id: wf.id,
    tenantId: wf.tenantId,
    name: wf.name,
    description: wf.description,
    status: wf.status,
    definition: wf.definition,
    version: wf.version,
    createdBy: wf.createdBy,
    createdAt: wf.createdAt,
    updatedAt: wf.updatedAt,
  };
}

// ───────────────────────── REST: workflows ─────────────────────────

/** GET / — list workflows visible to the current user.
 *  Filters by tenant + ACL. Excludes archived unless ?includeArchived=1. */
workflowRoutes.get("/", (c) => {
  const tid = tenantId();
  const user = currentUser(c);
  const url = new URL(c.req.url);
  const includeArchived = url.searchParams.get("includeArchived") === "1";
  const sql = includeArchived
    ? `SELECT * FROM workflows WHERE tenant_id = ? ORDER BY updated_at DESC`
    : `SELECT * FROM workflows WHERE tenant_id = ? AND status != 'archived'
        ORDER BY updated_at DESC`;
  const rows = db.prepare(sql).all(tid) as Array<{
    id: string;
    tenant_id: string;
    name: string;
    description: string | null;
    status: WorkflowStatus;
    definition: string;
    version: number;
    created_by: string;
    created_at: string;
    updated_at: string;
  }>;
  // ACL filter — keep only rows where the user has at least viewer.
  const visible = rows.filter((r) => {
    const role = effectiveRole({
      resource: "workflow",
      recordId: r.id,
      userId: user.id,
      tenantId: tid,
    });
    return Boolean(role);
  });
  const result = visible.map((r) => {
    let def: WorkflowDefinition;
    try { def = JSON.parse(r.definition) as WorkflowDefinition; }
    catch { def = { trigger: { kind: "manual" }, nodes: [], edges: [], variables: { initial: {} } }; }
    return {
      id: r.id,
      tenantId: r.tenant_id,
      name: r.name,
      description: r.description,
      status: r.status,
      definition: def,
      version: r.version,
      createdBy: r.created_by,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      role:
        effectiveRole({
          resource: "workflow",
          recordId: r.id,
          userId: user.id,
          tenantId: tid,
        }) ?? "viewer",
    };
  });
  return c.json({ rows: result, total: result.length });
});

/** POST / — create a new workflow. */
workflowRoutes.post("/", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as {
    id?: string;
    name?: string;
    description?: string;
    status?: WorkflowStatus;
    definition?: WorkflowDefinition;
  };
  const id = body.id ?? uuid();
  const tid = tenantId();
  const user = currentUser(c);
  const now = nowIso();
  const status: WorkflowStatus =
    body.status === "active" || body.status === "paused" || body.status === "archived"
      ? body.status
      : "draft";
  const definitionJson = serializeDefinition(body.definition);
  db.prepare(
    `INSERT INTO workflows
       (id, tenant_id, name, description, status, definition, version,
        created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
  ).run(
    id,
    tid,
    String(body.name ?? "Untitled workflow").slice(0, 200),
    body.description ? String(body.description).slice(0, 4000) : null,
    status,
    definitionJson,
    user.email,
    now,
    now,
  );
  // ACL — creator owns, tenant edits. Mirrors resources.ts. Workflow
  // editing is privileged (the `code` action runs in-process), but we
  // grant tenant-editor by default to match the rest of the app's UX.
  // Lock down via revokeAcl if needed.
  seedDefaultAcl({
    resource: "workflow",
    recordId: id,
    ownerUserId: user.id,
    ownerEmail: user.email,
    tenantId: tid,
  });
  recordAudit({
    actor: user.email,
    action: "workflow.created",
    resource: "workflow",
    recordId: id,
    payload: { name: body.name, status },
  });
  const wf = loadWorkflow(id);
  if (!wf) return c.json({ error: "create failed" }, 500);
  return c.json({ ...toApi(wf), role: "owner" }, 201);
});

/** GET /:id — fetch a workflow. */
workflowRoutes.get("/:id", (c) => {
  const guard = requireWorkflowRole(c, c.req.param("id"), "viewer");
  if (!guard.ok) return guard.res;
  return c.json({ ...toApi(guard.wf), role: guard.role });
});

/** PATCH /:id — update definition / status / metadata. Increments
 *  version when the definition changes (simple optimistic-locking
 *  hint for clients). */
workflowRoutes.patch("/:id", async (c) => {
  const id = c.req.param("id");
  const guard = requireWorkflowRole(c, id, "editor");
  if (!guard.ok) return guard.res;
  const body = (await c.req.json().catch(() => ({}))) as {
    name?: string;
    description?: string | null;
    status?: WorkflowStatus;
    definition?: WorkflowDefinition;
  };
  const fields: string[] = [];
  const args: unknown[] = [];
  let bumpVersion = false;
  if (body.name !== undefined) {
    fields.push("name = ?");
    args.push(String(body.name).slice(0, 200));
  }
  if (body.description !== undefined) {
    fields.push("description = ?");
    args.push(body.description ? String(body.description).slice(0, 4000) : null);
  }
  if (body.status !== undefined) {
    const s: WorkflowStatus =
      body.status === "active" ||
      body.status === "draft" ||
      body.status === "paused" ||
      body.status === "archived"
        ? body.status
        : guard.wf.status;
    fields.push("status = ?");
    args.push(s);
  }
  if (body.definition !== undefined) {
    fields.push("definition = ?");
    args.push(serializeDefinition(body.definition));
    bumpVersion = true;
  }
  if (bumpVersion) {
    fields.push("version = version + 1");
  }
  fields.push("updated_at = ?");
  args.push(nowIso());
  args.push(id);
  if (fields.length === 1) {
    // Only `updated_at` — nothing to do.
    return c.json({ ...toApi(guard.wf), role: guard.role });
  }
  db.prepare(`UPDATE workflows SET ${fields.join(", ")} WHERE id = ?`).run(...args);
  const wf = loadWorkflow(id);
  if (!wf) return c.json({ error: "not found" }, 404);
  const user = currentUser(c);
  recordAudit({
    actor: user.email,
    action: "workflow.updated",
    resource: "workflow",
    recordId: id,
    payload: { fields: Object.keys(body) },
  });
  return c.json({ ...toApi(wf), role: guard.role });
});

/** DELETE /:id — soft delete via status='archived'. Owner-only. */
workflowRoutes.delete("/:id", (c) => {
  const id = c.req.param("id");
  const guard = requireWorkflowRole(c, id, "owner");
  if (!guard.ok) return guard.res;
  db.prepare(
    `UPDATE workflows SET status = 'archived', updated_at = ? WHERE id = ?`,
  ).run(nowIso(), id);
  const user = currentUser(c);
  recordAudit({
    actor: user.email,
    action: "workflow.archived",
    resource: "workflow",
    recordId: id,
  });
  return c.json({ ok: true, archived: true });
});

/** POST /:id/run — manual trigger. Runs synchronously and returns the
 *  full output. Useful for the "Run now" button + smoke tests. */
workflowRoutes.post("/:id/run", async (c) => {
  const id = c.req.param("id");
  const guard = requireWorkflowRole(c, id, "editor");
  if (!guard.ok) return guard.res;
  const payload = (await c.req.json().catch(() => ({}))) as unknown;
  const user = currentUser(c);
  const run = await runWorkflow(id, payload, { actor: user.email });
  return c.json(run);
});

/** GET /:id/runs — paginated history of a workflow's runs. */
workflowRoutes.get("/:id/runs", (c) => {
  const id = c.req.param("id");
  const guard = requireWorkflowRole(c, id, "viewer");
  if (!guard.ok) return guard.res;
  const url = new URL(c.req.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
  const pageSize = Math.min(
    200,
    Math.max(1, Number(url.searchParams.get("pageSize") ?? 25)),
  );
  const offset = (page - 1) * pageSize;
  const rows = db
    .prepare(
      `SELECT id, workflow_id, tenant_id, status, started_at, finished_at,
              duration_ms, error
         FROM workflow_runs
        WHERE workflow_id = ?
        ORDER BY started_at DESC
        LIMIT ? OFFSET ?`,
    )
    .all(id, pageSize, offset) as Array<{
    id: string;
    workflow_id: string;
    tenant_id: string;
    status: string;
    started_at: string;
    finished_at: string | null;
    duration_ms: number | null;
    error: string | null;
  }>;
  const total = (
    db.prepare(`SELECT COUNT(*) AS c FROM workflow_runs WHERE workflow_id = ?`)
      .get(id) as { c: number }
  ).c;
  return c.json({
    rows: rows.map((r) => ({
      id: r.id,
      workflowId: r.workflow_id,
      tenantId: r.tenant_id,
      status: r.status,
      startedAt: r.started_at,
      finishedAt: r.finished_at,
      durationMs: r.duration_ms,
      error: r.error,
    })),
    total,
    page,
    pageSize,
  });
});

/** GET /:id/runs/:runId — full run detail incl. output JSON. */
workflowRoutes.get("/:id/runs/:runId", (c) => {
  const id = c.req.param("id");
  const runId = c.req.param("runId");
  const guard = requireWorkflowRole(c, id, "viewer");
  if (!guard.ok) return guard.res;
  const row = db
    .prepare(
      `SELECT id, workflow_id, tenant_id, status, trigger_payload, output,
              error, started_at, finished_at, duration_ms
         FROM workflow_runs
        WHERE id = ? AND workflow_id = ?`,
    )
    .get(runId, id) as
    | {
        id: string;
        workflow_id: string;
        tenant_id: string;
        status: string;
        trigger_payload: string | null;
        output: string | null;
        error: string | null;
        started_at: string;
        finished_at: string | null;
        duration_ms: number | null;
      }
    | undefined;
  if (!row) return c.json({ error: "not found" }, 404);
  return c.json({
    id: row.id,
    workflowId: row.workflow_id,
    tenantId: row.tenant_id,
    status: row.status,
    triggerPayload: row.trigger_payload ? JSON.parse(row.trigger_payload) : null,
    output: row.output ? JSON.parse(row.output) : null,
    error: row.error,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    durationMs: row.duration_ms,
  });
});

/** POST /:id/duplicate — clone definition into a new draft. */
workflowRoutes.post("/:id/duplicate", (c) => {
  const id = c.req.param("id");
  const guard = requireWorkflowRole(c, id, "editor");
  if (!guard.ok) return guard.res;
  const newId = uuid();
  const now = nowIso();
  const user = currentUser(c);
  const tid = tenantId();
  db.prepare(
    `INSERT INTO workflows
       (id, tenant_id, name, description, status, definition, version,
        created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'draft', ?, 1, ?, ?, ?)`,
  ).run(
    newId,
    tid,
    `${guard.wf.name} (copy)`,
    guard.wf.description,
    JSON.stringify(guard.wf.definition),
    user.email,
    now,
    now,
  );
  // Grant ACL the same way as fresh-create. The cloner becomes owner
  // — the original's owner doesn't transfer.
  seedDefaultAcl({
    resource: "workflow",
    recordId: newId,
    ownerUserId: user.id,
    ownerEmail: user.email,
    tenantId: tid,
  });
  recordAudit({
    actor: user.email,
    action: "workflow.duplicated",
    resource: "workflow",
    recordId: newId,
    payload: { sourceId: id },
  });
  const wf = loadWorkflow(newId);
  if (!wf) return c.json({ error: "duplicate failed" }, 500);
  return c.json({ ...toApi(wf), role: "owner" }, 201);
});

/** Re-export for tests / explicit-grant flows from migrations.
 *  `grantAcl` and `purgeAclForRecord` aren't called here but importers
 *  occasionally want them off the workflows surface. */
export { grantAcl, purgeAclForRecord };
