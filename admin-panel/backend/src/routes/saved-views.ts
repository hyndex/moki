/** Saved views — backend-persisted, scoped, shareable.
 *
 *  Replaces the localStorage-only `SavedViewStore` on the frontend.
 *  Lets a user save a filter/sort/columns combo and SHARE IT WITH the
 *  whole tenant or a specific team. Same view body shape as before
 *  (`contracts/saved-views.ts`); we just persist + scope it.
 *
 *  Visibility rules:
 *    - personal — only the creator sees it (always returned)
 *    - team — every member of the listed team sees it (we don't have
 *      a teams table yet, so for now this row's `team_id` is treated
 *      as "any user with that tenant id" — same as tenant; team-table
 *      arrives in a follow-up)
 *    - tenant — every member of the tenant sees it
 *
 *  Routes:
 *    GET    /:resource             list views the current user can see
 *    GET    /:resource/:id         fetch single view
 *    POST   /:resource             create view
 *    PATCH  /:resource/:id         update (creator-only unless tenant admin)
 *    DELETE /:resource/:id         delete (creator-only unless tenant admin)
 *    POST   /:resource/:id/pin     mark as pinned for current user
 *    POST   /:resource/:id/unpin   unpin */
import { Hono } from "hono";
import { requireAuth, currentUser } from "../middleware/auth";
import { getTenantContext } from "../tenancy/context";
import { db, nowIso } from "../db";
import { uuid } from "../lib/id";
import { recordAudit } from "../lib/audit";

export const savedViewsRoutes = new Hono();
savedViewsRoutes.use("*", requireAuth);

interface SavedViewRow {
  id: string;
  tenant_id: string;
  resource: string;
  created_by: string;
  scope: "personal" | "team" | "tenant";
  team_id: string | null;
  name: string;
  icon: string | null;
  body: string;
  pinned: number;
  is_default: number;
  created_at: string;
  updated_at: string;
}

interface SavedView {
  id: string;
  tenantId: string;
  resource: string;
  createdBy: string;
  scope: "personal" | "team" | "tenant";
  teamId: string | null;
  name: string;
  icon: string | null;
  body: unknown; // SavedView body — filter, sort, columns, …
  pinned: boolean;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

function rowToView(r: SavedViewRow): SavedView {
  let body: unknown = {};
  try { body = JSON.parse(r.body); } catch { /* tolerate corrupt body */ }
  return {
    id: r.id,
    tenantId: r.tenant_id,
    resource: r.resource,
    createdBy: r.created_by,
    scope: r.scope,
    teamId: r.team_id,
    name: r.name,
    icon: r.icon,
    body,
    pinned: r.pinned === 1,
    isDefault: r.is_default === 1,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function tenantId(): string {
  return getTenantContext()?.tenantId ?? "default";
}

savedViewsRoutes.get("/:resource", (c) => {
  const resource = c.req.param("resource");
  const tid = tenantId();
  const user = currentUser(c);
  const rows = db
    .prepare(
      `SELECT * FROM saved_views
       WHERE tenant_id = ? AND resource = ?
         AND (scope = 'tenant' OR scope = 'team' OR (scope = 'personal' AND created_by = ?))
       ORDER BY is_default DESC, pinned DESC, name COLLATE NOCASE ASC`,
    )
    .all(tid, resource, user.email) as SavedViewRow[];
  return c.json({ rows: rows.map(rowToView) });
});

savedViewsRoutes.get("/:resource/:id", (c) => {
  const id = c.req.param("id");
  const tid = tenantId();
  const user = currentUser(c);
  const row = db
    .prepare(`SELECT * FROM saved_views WHERE id = ? AND tenant_id = ?`)
    .get(id, tid) as SavedViewRow | undefined;
  if (!row) return c.json({ error: "not found" }, 404);
  if (row.scope === "personal" && row.created_by !== user.email) {
    return c.json({ error: "not found" }, 404);
  }
  return c.json(rowToView(row));
});

savedViewsRoutes.post("/:resource", async (c) => {
  const resource = c.req.param("resource");
  const body = (await c.req.json().catch(() => ({}))) as Partial<SavedView> & { body?: unknown };
  const tid = tenantId();
  const user = currentUser(c);
  const id = body.id ?? uuid();
  const name = (body.name ?? "Untitled view").toString().slice(0, 200);
  const icon = body.icon?.toString().slice(0, 64) ?? null;
  const scope: "personal" | "team" | "tenant" =
    body.scope === "team" || body.scope === "tenant" || body.scope === "personal"
      ? body.scope
      : "personal";
  const teamId = body.teamId ?? null;
  const pinned = body.pinned ? 1 : 0;
  const isDefault = body.isDefault ? 1 : 0;
  const now = nowIso();
  // The view body is JSON we trust the frontend to validate against
  // contracts/saved-views.ts. We store as-is and parse on read.
  const bodyJson = JSON.stringify(body.body ?? {});
  db.prepare(
    `INSERT INTO saved_views
       (id, tenant_id, resource, created_by, scope, team_id, name, icon, body, pinned, is_default, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, tid, resource, user.email, scope, teamId, name, icon, bodyJson, pinned, isDefault, now, now);
  recordAudit({
    actor: user.email,
    action: "saved-view.created",
    resource: "saved-view",
    recordId: id,
    payload: { resource, scope, name },
  });
  const row = db
    .prepare(`SELECT * FROM saved_views WHERE id = ?`)
    .get(id) as SavedViewRow;
  return c.json(rowToView(row), 201);
});

savedViewsRoutes.patch("/:resource/:id", async (c) => {
  const id = c.req.param("id");
  const tid = tenantId();
  const user = currentUser(c);
  const existing = db
    .prepare(`SELECT * FROM saved_views WHERE id = ? AND tenant_id = ?`)
    .get(id, tid) as SavedViewRow | undefined;
  if (!existing) return c.json({ error: "not found" }, 404);
  // Creator is allowed to edit their own view at any scope. Tenant
  // admins (role:admin in users table) can also edit any view in
  // their tenant — useful for cleaning up "team" views when a member
  // leaves.
  const isAdmin = user.role === "admin";
  if (existing.created_by !== user.email && !isAdmin) {
    return c.json({ error: "forbidden", code: "access-denied" }, 403);
  }
  const patch = (await c.req.json().catch(() => ({}))) as Partial<SavedView> & { body?: unknown };
  const fields: string[] = [];
  const args: unknown[] = [];
  if (patch.name !== undefined) { fields.push("name = ?"); args.push(String(patch.name).slice(0, 200)); }
  if (patch.icon !== undefined) { fields.push("icon = ?"); args.push(patch.icon ? String(patch.icon).slice(0, 64) : null); }
  if (patch.scope !== undefined) {
    const s = patch.scope === "tenant" || patch.scope === "team" || patch.scope === "personal" ? patch.scope : "personal";
    fields.push("scope = ?"); args.push(s);
  }
  if (patch.teamId !== undefined) { fields.push("team_id = ?"); args.push(patch.teamId); }
  if (patch.pinned !== undefined) { fields.push("pinned = ?"); args.push(patch.pinned ? 1 : 0); }
  if (patch.isDefault !== undefined) { fields.push("is_default = ?"); args.push(patch.isDefault ? 1 : 0); }
  if (patch.body !== undefined) { fields.push("body = ?"); args.push(JSON.stringify(patch.body)); }
  fields.push("updated_at = ?"); args.push(nowIso());
  args.push(id);
  db.prepare(`UPDATE saved_views SET ${fields.join(", ")} WHERE id = ?`).run(...args);
  const row = db.prepare(`SELECT * FROM saved_views WHERE id = ?`).get(id) as SavedViewRow;
  return c.json(rowToView(row));
});

savedViewsRoutes.delete("/:resource/:id", (c) => {
  const id = c.req.param("id");
  const tid = tenantId();
  const user = currentUser(c);
  const existing = db
    .prepare(`SELECT * FROM saved_views WHERE id = ? AND tenant_id = ?`)
    .get(id, tid) as SavedViewRow | undefined;
  if (!existing) return c.json({ error: "not found" }, 404);
  const isAdmin = user.role === "admin";
  if (existing.created_by !== user.email && !isAdmin) {
    return c.json({ error: "forbidden", code: "access-denied" }, 403);
  }
  db.prepare(`DELETE FROM saved_views WHERE id = ?`).run(id);
  recordAudit({
    actor: user.email,
    action: "saved-view.deleted",
    resource: "saved-view",
    recordId: id,
  });
  return c.json({ ok: true });
});

savedViewsRoutes.post("/:resource/:id/pin", (c) => {
  const id = c.req.param("id");
  db.prepare(`UPDATE saved_views SET pinned = 1, updated_at = ? WHERE id = ?`).run(nowIso(), id);
  return c.json({ ok: true });
});

savedViewsRoutes.post("/:resource/:id/unpin", (c) => {
  const id = c.req.param("id");
  db.prepare(`UPDATE saved_views SET pinned = 0, updated_at = ? WHERE id = ?`).run(nowIso(), id);
  return c.json({ ok: true });
});
