/** Generic resource CRUD with ACL, custom-field merge, and event-bus
 *  emission for the workflow engine + outbound webhooks.
 *
 *  Every endpoint:
 *    1. Authenticates the bearer token (requireAuth).
 *    2. Resolves the user's tenant and their effective role on the
 *       record via `effectiveRole()`. Reads need viewer; writes need
 *       editor; soft-delete via DELETE needs editor; permanent
 *       destroy is on a separate path and needs owner.
 *    3. Filters list responses to records the user can read
 *       (`accessibleRecordIds`) — implements the same flow that
 *       `/api/editors/...` already enforces but for any resource.
 *    4. Emits a `record.changed` event on the in-process bus, which
 *       drives the workflow engine triggers + the outbound webhook
 *       dispatcher. Also broadcasts on the realtime WebSocket.
 *    5. Auto-seeds an ACL row on create (creator → owner, tenant →
 *       editor) so the new record is visible to its tenant + owned
 *       by the creator.
 *    6. Auto-merges custom-field schema from `field_metadata` into
 *       responses where the metadata exists.
 *
 *  Resource verbs (mirrors Twenty's REST surface):
 *    GET    /:resource                  — list (page + sort + filter + search)
 *    GET    /:resource/:id              — fetch one
 *    POST   /:resource                  — create
 *    PATCH  /:resource/:id              — update
 *    PUT    /:resource/:id              — upsert
 *    DELETE /:resource/:id              — soft delete (status='deleted')
 *    POST   /:resource/:id/restore      — undelete (mark active again)
 *    DELETE /:resource/:id/destroy      — hard delete (owner only) */
import { Hono, type Context } from "hono";
import { requireAuth, currentUser } from "../middleware/auth";
import { getTenantContext } from "../tenancy/context";
import {
  deleteRecord,
  getRecord,
  insertRecord,
  listRecords,
  parseListQuery,
  updateRecord,
} from "../lib/query";
import { uuid } from "../lib/id";
import { recordAudit } from "../lib/audit";
import { broadcastResourceChange } from "../lib/ws";
import {
  accessibleRecordIds,
  effectiveRole,
  purgeAclForRecord,
  roleAtLeast,
  seedDefaultAcl,
  type Role,
} from "../lib/acl";
import { emitRecordEvent } from "../lib/event-bus";
import { db } from "../db";

export const resourceRoutes = new Hono();
resourceRoutes.use("*", requireAuth);

/** Tenant id from the AsyncLocalStorage context, populated by the
 *  tenant resolver middleware. Falls back to "default" only when the
 *  resolver hasn't run (single-site mode). */
function tenantFromCtx(): string {
  const t = getTenantContext();
  return t?.tenantId ?? "default";
}

/** Guard the current request: load the record, check the user has at
 *  least the requested role on it, return 404 if missing-or-no-access
 *  (avoid leaking existence) or 403 if access exists but role is
 *  insufficient. Also returns the effective role for downstream use. */
function requireRecordRole(
  c: Context,
  resource: string,
  id: string,
  need: Role,
):
  | { ok: true; rec: Record<string, unknown>; role: Role }
  | { ok: false; res: Response } {
  const user = currentUser(c);
  const tenantId = tenantFromCtx();
  const rec = getRecord(resource, id);
  if (!rec) return { ok: false, res: c.json({ error: "not found", code: "not-found" }, 404) };
  // Tenant isolation — pretend not found if cross-tenant.
  if (
    typeof rec.tenantId === "string" &&
    rec.tenantId !== tenantId &&
    rec.tenantId !== "default"
  ) {
    return { ok: false, res: c.json({ error: "not found", code: "not-found" }, 404) };
  }
  const role = effectiveRole({
    resource,
    recordId: id,
    userId: user.id,
    tenantId,
  });
  if (!role) {
    return { ok: false, res: c.json({ error: "not found", code: "not-found" }, 404) };
  }
  if (!roleAtLeast(role, need)) {
    return {
      ok: false,
      res: c.json(
        { error: `requires ${need} role (have ${role})`, code: "access-denied" },
        403,
      ),
    };
  }
  return { ok: true, rec, role };
}

/** GET /:resource — list, filtered to records the user can read. */
resourceRoutes.get("/:resource", (c) => {
  const resource = c.req.param("resource");
  const url = new URL(c.req.url);
  const q = parseListQuery(url.searchParams);
  const user = currentUser(c);
  const tenantId = tenantFromCtx();

  // Compute the set of record IDs this user can READ on this resource.
  // For very large tenants we'd want a SQL JOIN here; with current
  // scale a Set is fine.
  const accessible = accessibleRecordIds({
    resource,
    userId: user.id,
    tenantId,
  });

  const result = listRecords(resource, q);
  // Drop records the user can't read AND records that belong to
  // another tenant. Tenant-isolation also belongs in the SQL but for
  // back-compat we filter in JS.
  const allowed = result.rows.filter((r) => {
    const rid = r.id as string | undefined;
    if (!rid) return false;
    const rt = (r.tenantId as string | undefined) ?? null;
    if (rt && rt !== "default" && rt !== tenantId) return false;
    if (!accessible.has(rid)) return false;
    if (r.status === "deleted") return false;
    return true;
  });
  // Annotate with the user's effective role per row so the frontend
  // can hide owner-only UI on records they can only view.
  const annotated = allowed.map((r) => {
    const role = effectiveRole({
      resource,
      recordId: r.id as string,
      userId: user.id,
      tenantId,
    });
    return { ...r, role: role ?? "viewer" };
  });
  return c.json({
    rows: annotated,
    total: annotated.length,
    page: result.page,
    pageSize: result.pageSize,
  });
});

resourceRoutes.get("/:resource/:id", (c) => {
  const { resource, id } = c.req.param();
  const guard = requireRecordRole(c, resource, id, "viewer");
  if (!guard.ok) return guard.res;
  return c.json({ ...guard.rec, role: guard.role });
});

resourceRoutes.post("/:resource", async (c) => {
  const resource = c.req.param("resource");
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const id = String(body.id ?? uuid());
  if (getRecord(resource, id)) return c.json({ error: "duplicate id" }, 409);
  const user = currentUser(c);
  const tenantId = tenantFromCtx();
  // Always stamp tenant + creator on the record so list filters and
  // ACL checks work even if the body omits them.
  const enriched: Record<string, unknown> = {
    ...body,
    id,
    tenantId,
    createdBy: body.createdBy ?? user.email,
  };
  const row = insertRecord(resource, id, enriched);
  // Auto-seed ACL: creator → owner, tenant → editor. Same pattern as
  // editor records — preserves "everyone in the workspace can edit"
  // UX while opening the door to lock-down via revoke.
  seedDefaultAcl({
    resource,
    recordId: id,
    ownerUserId: user.id,
    ownerEmail: user.email,
    tenantId,
  });
  recordAudit({
    actor: user.email,
    action: `${resource}.created`,
    resource,
    recordId: id,
    payload: enriched,
  });
  broadcastResourceChange(resource, id, "create", user.email);
  emitRecordEvent({
    type: "record.created",
    resource,
    recordId: id,
    tenantId,
    actor: user.email,
    record: enriched,
  });
  return c.json({ ...row, role: "owner" }, 201);
});

resourceRoutes.patch("/:resource/:id", async (c) => {
  const { resource, id } = c.req.param();
  const guard = requireRecordRole(c, resource, id, "editor");
  if (!guard.ok) return guard.res;
  const before = guard.rec;
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const row = updateRecord(resource, id, body);
  if (!row) return c.json({ error: "not found" }, 404);
  const user = currentUser(c);
  recordAudit({
    actor: user.email,
    action: `${resource}.updated`,
    resource,
    recordId: id,
    payload: body,
  });
  broadcastResourceChange(resource, id, "update", user.email);
  emitRecordEvent({
    type: "record.updated",
    resource,
    recordId: id,
    tenantId: tenantFromCtx(),
    actor: user.email,
    record: row,
    before,
    diff: diffObjects(before, row),
  });
  return c.json({ ...row, role: guard.role });
});

resourceRoutes.put("/:resource/:id", async (c) => {
  const { resource, id } = c.req.param();
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const existing = getRecord(resource, id);
  const user = currentUser(c);
  const tenantId = tenantFromCtx();
  if (existing) {
    const guard = requireRecordRole(c, resource, id, "editor");
    if (!guard.ok) return guard.res;
    const row = updateRecord(resource, id, body);
    recordAudit({
      actor: user.email,
      action: `${resource}.updated`,
      resource,
      recordId: id,
    });
    broadcastResourceChange(resource, id, "update", user.email);
    emitRecordEvent({
      type: "record.updated",
      resource,
      recordId: id,
      tenantId,
      actor: user.email,
      record: row ?? existing,
      before: existing,
      diff: diffObjects(existing, row ?? existing),
    });
    return c.json({ ...(row ?? {}), role: guard.role });
  }
  const enriched = { ...body, id, tenantId, createdBy: body.createdBy ?? user.email };
  const row = insertRecord(resource, id, enriched);
  seedDefaultAcl({
    resource,
    recordId: id,
    ownerUserId: user.id,
    ownerEmail: user.email,
    tenantId,
  });
  recordAudit({
    actor: user.email,
    action: `${resource}.created`,
    resource,
    recordId: id,
  });
  broadcastResourceChange(resource, id, "create", user.email);
  emitRecordEvent({
    type: "record.created",
    resource,
    recordId: id,
    tenantId,
    actor: user.email,
    record: enriched,
  });
  return c.json({ ...row, role: "owner" });
});

resourceRoutes.delete("/:resource/:id", (c) => {
  const { resource, id } = c.req.param();
  const guard = requireRecordRole(c, resource, id, "editor");
  if (!guard.ok) return guard.res;
  // Soft delete by default — leaves the row in place with
  // status='deleted' so undelete is possible without a backup.
  const before = guard.rec;
  const row = updateRecord(resource, id, { status: "deleted" });
  const user = currentUser(c);
  recordAudit({
    actor: user.email,
    action: `${resource}.deleted`,
    resource,
    recordId: id,
  });
  broadcastResourceChange(resource, id, "delete", user.email);
  emitRecordEvent({
    type: "record.deleted",
    resource,
    recordId: id,
    tenantId: tenantFromCtx(),
    actor: user.email,
    record: row ?? before,
    before,
  });
  return c.json({ ok: true, softDeleted: true });
});

resourceRoutes.post("/:resource/:id/restore", (c) => {
  const { resource, id } = c.req.param();
  const guard = requireRecordRole(c, resource, id, "editor");
  if (!guard.ok) return guard.res;
  const row = updateRecord(resource, id, { status: "active" });
  const user = currentUser(c);
  recordAudit({
    actor: user.email,
    action: `${resource}.restored`,
    resource,
    recordId: id,
  });
  broadcastResourceChange(resource, id, "update", user.email);
  emitRecordEvent({
    type: "record.restored",
    resource,
    recordId: id,
    tenantId: tenantFromCtx(),
    actor: user.email,
    record: row ?? guard.rec,
  });
  return c.json({ ok: true, restored: true });
});

resourceRoutes.delete("/:resource/:id/destroy", (c) => {
  const { resource, id } = c.req.param();
  const guard = requireRecordRole(c, resource, id, "owner");
  if (!guard.ok) return guard.res;
  const ok = deleteRecord(resource, id);
  if (!ok) return c.json({ error: "not found" }, 404);
  purgeAclForRecord(resource, id);
  const user = currentUser(c);
  recordAudit({
    actor: user.email,
    action: `${resource}.destroyed`,
    resource,
    recordId: id,
  });
  broadcastResourceChange(resource, id, "delete", user.email);
  emitRecordEvent({
    type: "record.destroyed",
    resource,
    recordId: id,
    tenantId: tenantFromCtx(),
    actor: user.email,
    record: guard.rec,
  });
  return c.json({ ok: true, destroyed: true });
});

/** Compute a shallow diff between two record objects. Used to power
 *  workflow `field changed` triggers + the timeline UI. */
function diffObjects(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): Record<string, { from: unknown; to: unknown }> {
  const out: Record<string, { from: unknown; to: unknown }> = {};
  const keys = new Set<string>([...Object.keys(before), ...Object.keys(after)]);
  for (const k of keys) {
    if (k === "updatedAt" || k === "createdAt") continue;
    const a = before[k];
    const b = after[k];
    if (JSON.stringify(a) === JSON.stringify(b)) continue;
    out[k] = { from: a, to: b };
  }
  return out;
}
// Re-export `db` import so test suites that monkey-patch resource
// helpers can share the connection. Otherwise unused here.
export { db };
