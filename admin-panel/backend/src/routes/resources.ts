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
  globalRoleCeiling,
  purgeAclForRecord,
  roleAtLeast,
  seedDefaultAcl,
  type Role,
} from "../lib/acl";
import { emitRecordEvent } from "../lib/event-bus";
import { validateRecordAgainstFieldMeta } from "../lib/field-metadata";
import { listUiResources } from "../lib/ui/metadata";
import { bootstrapMcpTools } from "../lib/mcp/bootstrap";
// Cross-plugin imports via the host alias. The shell's generic resource
// CRUD path fires plugin-owned hooks (notification rules from
// notifications-core, naming-series allocation from template-core) so
// every record write picks up tenant-configured behaviour.
import { fireEvent } from "@gutu-plugin/notifications-core";
import { nextNameForResource } from "@gutu-plugin/template-core";
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

/** Lazy-populated set of known resource ids — anything in the UI
 *  resource catalog. The catalog is rebuilt by listUiResources() on
 *  every call (cheap, in-memory) but we cache the id set per request
 *  via a closure-friendly memo to avoid rebuilding on each handler.
 *
 *  Cache is disabled when NODE_ENV=test so back-to-back tests with
 *  fresh DBs don't see a stale snapshot from a sibling suite. */
let __resourceIdCache: { stamp: number; ids: Set<string> } | null = null;
function knownResourceIds(): Set<string> {
  const isTest = process.env.NODE_ENV === "test";
  // Rebuild every 10s — long enough that hot-path POST/PATCH bursts are
  // cheap; short enough that newly-registered plugin resources show up
  // without restarting the process.
  const now = Date.now();
  if (!isTest && __resourceIdCache && now - __resourceIdCache.stamp < 10_000) {
    return __resourceIdCache.ids;
  }
  bootstrapMcpTools();
  const ids = new Set(listUiResources().map((d) => d.id));
  if (!isTest) __resourceIdCache = { stamp: now, ids };
  return ids;
}

/** Plugin namespace pattern — `<plugin>.<entity>` in lowercase with
 *  optional hyphens. Mirrors lib/mcp/bootstrap.ts. */
const NAMESPACED_RESOURCE_RE = /^[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*$/;

/** Allow-listed plugin namespaces — every shipped plugin's resource
 *  prefix. A POST to `<ns>.<anything>` is accepted as a first write
 *  even before the catalog has discovered the resource (which only
 *  happens lazily once a record exists). Anything outside this list
 *  must already be in the catalog or the request 404s.
 *
 *  Adding a new plugin? Append its namespace here. The check is also
 *  performed by `lib/mcp/bootstrap.ts:isValidResourceId`, but this
 *  set is the *operational* allow-list — bootstrap's regex is the
 *  *syntactic* check. */
const ALLOWED_PLUGIN_NAMESPACES = new Set<string>([
  "accounting", "ai-assist", "ai-core", "ai-evals", "ai-rag", "ai-skills",
  "analytics", "analytics-bi", "assets", "audit", "auth", "automation",
  "booking", "business-portals", "collab", "community", "company-builder",
  "content", "contracts", "crm", "dashboards", "document", "document-editor",
  "e-invoicing", "editor", "editors", "execution-workspaces",
  "favorites", "field-metadata", "field-service", "files", "forms",
  "hr", "hr-payroll",
  "integration", "inventory", "issues",
  "jobs", "knowledge",
  "mail", "maintenance-cmms", "manufacturing",
  "notifications",
  "org-tenant",
  "page-builder", "party-relationships", "payments", "platform",
  "portal", "pos", "pricing-tax", "procurement", "product-catalog", "projects",
  "quality",
  "record-links", "role-policy", "runtime-bridge",
  "sales", "saved-views", "search", "slides", "spreadsheet", "subscriptions",
  "support-service",
  "template", "timeline", "traceability", "treasury",
  "user-directory",
  "webhook", "whiteboard", "workflow",
]);

function isAllowlistedNamespace(resource: string): boolean {
  if (!NAMESPACED_RESOURCE_RE.test(resource)) return false;
  const ns = resource.split(".", 1)[0];
  return ALLOWED_PLUGIN_NAMESPACES.has(ns);
}

/** Verify the route's `:resource` is a known catalog id. Returns a 404
 *  Response if unknown so writers can't fabricate arbitrary resource
 *  names and pollute the records table.
 *
 *  Acceptance order:
 *    1. Resource is already in the catalog (plugin tools or existing
 *       records) → allow.
 *    2. Resource matches the strict `<plugin>.<entity>` namespace
 *       pattern AND the plugin namespace is on the allow-list →
 *       allow (lets first writes seed the catalog without an
 *       explicit registration round-trip).
 *    3. Otherwise → 404. `totallymadeup` (no namespace) and
 *       `fake.unknown` (unlisted namespace) both fail here. */
function requireKnownResource(c: Context, resource: string): { ok: true } | { ok: false; res: Response } {
  if (knownResourceIds().has(resource)) return { ok: true };
  if (isAllowlistedNamespace(resource)) return { ok: true };
  return {
    ok: false,
    res: c.json({ error: `unknown resource: ${resource}`, code: "unknown-resource" }, 404),
  };
}

/** Conservative ISO-8601 date validator. Catches calendar-impossible
 *  dates ("2024-02-30") that JS's Date constructor silently rolls
 *  forward to the next valid day. Returns an array of (field, error)
 *  for any string-valued field on the body that ends in `At`/`Date`/
 *  `On` and parses to a different round-trip representation. Empty
 *  array means no problems. */
const DATE_FIELD_RE = /(At|Date|On)$/;
function findInvalidDates(body: Record<string, unknown>): Array<{ field: string; error: string }> {
  const errs: Array<{ field: string; error: string }> = [];
  for (const [k, v] of Object.entries(body)) {
    if (typeof v !== "string" || !v) continue;
    if (!DATE_FIELD_RE.test(k)) continue;
    // Accept date-only YYYY-MM-DD, datetime YYYY-MM-DDTHH:MM[:SS][Z|+hh:mm].
    if (!/^\d{4}-\d{2}-\d{2}([T\s]\d{2}:\d{2}(:\d{2}(\.\d{1,9})?)?(Z|[+\-]\d{2}:?\d{2})?)?$/.test(v)) {
      errs.push({ field: k, error: "invalid date format" });
      continue;
    }
    const [datePart] = v.split(/[T\s]/);
    const [yStr, moStr, dStr] = datePart.split("-");
    const y = Number(yStr);
    const mo = Number(moStr);
    const d = Number(dStr);
    if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) {
      errs.push({ field: k, error: "invalid date components" });
      continue;
    }
    if (mo < 1 || mo > 12 || d < 1 || d > 31) {
      errs.push({ field: k, error: "invalid month or day" });
      continue;
    }
    // Final calendar check via Date round-trip — rejects 2024-02-30.
    const dt = new Date(Date.UTC(y, mo - 1, d));
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) {
      errs.push({ field: k, error: `not a real date (${v})` });
    }
  }
  return errs;
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
    globalRole: user.role,
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

/** Reject the request if the authenticated user's global tenant role
 *  is below `need`. Use this on write endpoints that aren't gated by a
 *  per-record role check (POST creates), and on hard-destroy where we
 *  also want to require admin. */
function requireGlobalRole(c: Context, need: Role): { ok: true } | { ok: false; res: Response } {
  const user = currentUser(c);
  const ceiling = globalRoleCeiling(user.role);
  if (!roleAtLeast(ceiling, need)) {
    return {
      ok: false,
      res: c.json(
        { error: `requires ${need} role (have ${ceiling})`, code: "access-denied" },
        403,
      ),
    };
  }
  return { ok: true };
}

/** GET /:resource — list, filtered to records the user can read.
 *
 *  Query params:
 *    page, pageSize, sort, dir, search, filter[<field>], f.<field>
 *    includeDeleted=1   include status=deleted rows (for "show
 *                       deleted" toggle in ListView). Default: drop them.
 *    deletedOnly=1      ONLY status=deleted rows (Twenty-style trash). */
resourceRoutes.get("/:resource", (c) => {
  const resource = c.req.param("resource");
  const url = new URL(c.req.url);
  const q = parseListQuery(url.searchParams);
  const user = currentUser(c);
  const tenantId = tenantFromCtx();
  const includeDeleted = url.searchParams.get("includeDeleted") === "1";
  const deletedOnly = url.searchParams.get("deletedOnly") === "1";

  const accessible = accessibleRecordIds({ resource, userId: user.id, tenantId });

  // SQL-level access + tenant + soft-delete filtering: push everything
  // into the listRecords WHERE clause so total + pagination are
  // computed against the filtered universe instead of pre-filter.
  const result = listRecords(resource, {
    ...q,
    accessibleIds: accessible,
    tenantId,
    includeDeleted,
    deletedOnly,
  });

  // Annotate with effective role for client-side UI gating.
  const annotated = result.rows.map((r) => {
    const role = effectiveRole({
      resource,
      recordId: r.id as string,
      userId: user.id,
      tenantId,
      globalRole: user.role,
    });
    return { ...r, role: role ?? "viewer" };
  });

  return c.json({
    rows: annotated,
    total: result.total,
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
  // Catalog gate — reject `fake.unknown`, `totallymadeup`, anything not
  // in the UI resource registry. Stops API clients from spamming the
  // records table with arbitrary resource names.
  const known = requireKnownResource(c, resource);
  if (!known.ok) return known.res;
  // Global-role gate — viewers cannot create. Member+ required for any
  // mutation. Per-record ACL kicks in for PATCH/DELETE; create has no
  // existing record to gate against, so we use the global ceiling.
  const globalGate = requireGlobalRole(c, "editor");
  if (!globalGate.ok) return globalGate.res;
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  // Reject calendar-impossible dates so they never make it onto a row.
  // JS's Date silently rolls "2024-02-30" forward to March 1st; we'd
  // rather fail loud at the boundary.
  const dateErrs = findInvalidDates(body);
  if (dateErrs.length > 0) {
    return c.json(
      { error: "invalid date value", code: "invalid-argument", errors: dateErrs },
      400,
    );
  }
  const id = String(body.id ?? uuid());
  if (getRecord(resource, id)) return c.json({ error: "duplicate id" }, 409);
  const user = currentUser(c);
  const tenantId = tenantFromCtx();
  // Always stamp tenant + creator on the record so list filters and
  // ACL checks work even if the body omits them.
  let enriched: Record<string, unknown> = {
    ...body,
    id,
    tenantId,
    createdBy: body.createdBy ?? user.email,
  };
  // Validate custom fields. Coerces values per kind, applies defaults,
  // rejects required-missing or wrong-type values. System fields
  // (Zod-validated by the frontend) pass through untouched.
  const validated = validateRecordAgainstFieldMeta(tenantId, resource, enriched);
  if (!validated.ok) {
    return c.json(
      { error: "custom field validation failed", code: "invalid-argument", errors: validated.errors },
      400,
    );
  }
  enriched = validated.record;
  // Auto-allocate document name from naming series if the resource has
  // a default series configured AND the body didn't supply one. The
  // allocated name lands on the standard `name` field (visible in lists
  // + form headers). Failures here are non-fatal: write proceeds, name
  // stays whatever the caller set.
  if (typeof enriched.name !== "string" || !enriched.name) {
    try {
      const allocated = nextNameForResource(tenantId, resource);
      if (allocated) enriched = { ...enriched, name: allocated };
    } catch {
      // keep going — naming-series is opt-in
    }
  }
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
  // Notification rules listen on the create event. Failures here are
  // logged into notification_deliveries (status='failed') by the
  // dispatcher; never block the write.
  try {
    fireEvent({
      tenantId,
      resource,
      event: "create",
      recordId: id,
      record: enriched,
      context: { actor: user.email },
    });
  } catch (err) {
    console.error("[notification-rules] fire on create failed", err);
  }
  return c.json({ ...row, role: "owner" }, 201);
});

resourceRoutes.patch("/:resource/:id", async (c) => {
  const { resource, id } = c.req.param();
  const known = requireKnownResource(c, resource);
  if (!known.ok) return known.res;
  const guard = requireRecordRole(c, resource, id, "editor");
  if (!guard.ok) return guard.res;
  const before = guard.rec;
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const dateErrs = findInvalidDates(body);
  if (dateErrs.length > 0) {
    return c.json(
      { error: "invalid date value", code: "invalid-argument", errors: dateErrs },
      400,
    );
  }
  // Validate any custom fields present in the patch body. PATCH is
  // partial — we don't enforce `required` on patches (already
  // enforced on create), but we DO type-check whatever fields are
  // being changed.
  const tid = tenantFromCtx();
  const merged = { ...before, ...body };
  const validated = validateRecordAgainstFieldMeta(tid, resource, merged);
  if (!validated.ok) {
    // Filter to errors that actually concern the patched fields —
    // don't fail the patch on a `required` violation that pre-existed.
    const patchedKeys = new Set(Object.keys(body));
    const relevant = validated.errors.filter((e) => patchedKeys.has(e.field) && e.error !== "required");
    if (relevant.length > 0) {
      return c.json(
        { error: "custom field validation failed", code: "invalid-argument", errors: relevant },
        400,
      );
    }
  }
  const sanitized = validated.ok
    ? Object.fromEntries(Object.entries(validated.record).filter(([k]) => k in body))
    : body;
  const row = updateRecord(resource, id, sanitized);
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
  // Fire notification rules: 'update' for any change, 'value-change'
  // additionally so rules can subscribe specifically to changes to a
  // particular field (the rule body inspects `previous` vs current).
  // 'submit'/'cancel' are inferred from a 'status' change.
  try {
    const beforeStatus = (before as { status?: string }).status;
    const afterStatus = (row as { status?: string }).status;
    fireEvent({
      tenantId: tenantFromCtx(),
      resource,
      event: "update",
      recordId: id,
      record: row,
      previous: before,
      context: { actor: user.email },
    });
    fireEvent({
      tenantId: tenantFromCtx(),
      resource,
      event: "value-change",
      recordId: id,
      record: row,
      previous: before,
      context: { actor: user.email },
    });
    if (beforeStatus !== afterStatus) {
      if (afterStatus === "submitted") {
        fireEvent({
          tenantId: tenantFromCtx(),
          resource,
          event: "submit",
          recordId: id,
          record: row,
          previous: before,
          context: { actor: user.email },
        });
      } else if (afterStatus === "cancelled" || afterStatus === "canceled") {
        fireEvent({
          tenantId: tenantFromCtx(),
          resource,
          event: "cancel",
          recordId: id,
          record: row,
          previous: before,
          context: { actor: user.email },
        });
      }
    }
  } catch (err) {
    console.error("[notification-rules] fire on update failed", err);
  }
  return c.json({ ...row, role: guard.role });
});

resourceRoutes.put("/:resource/:id", async (c) => {
  const { resource, id } = c.req.param();
  const known = requireKnownResource(c, resource);
  if (!known.ok) return known.res;
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const dateErrs = findInvalidDates(body);
  if (dateErrs.length > 0) {
    return c.json(
      { error: "invalid date value", code: "invalid-argument", errors: dateErrs },
      400,
    );
  }
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
  const known = requireKnownResource(c, resource);
  if (!known.ok) return known.res;
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
  const known = requireKnownResource(c, resource);
  if (!known.ok) return known.res;
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
  const known = requireKnownResource(c, resource);
  if (!known.ok) return known.res;
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
