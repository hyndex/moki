import { Hono } from "hono";
import { requireAuth, currentUser } from "../middleware/auth";
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

export const resourceRoutes = new Hono();
resourceRoutes.use("*", requireAuth);

/** Convention: /api/resources/:resource/... — lets the client freely namespace
 *  resource ids without colliding with auth / health paths. */

resourceRoutes.get("/:resource", (c) => {
  const resource = c.req.param("resource");
  const url = new URL(c.req.url);
  const q = parseListQuery(url.searchParams);
  return c.json(listRecords(resource, q));
});

resourceRoutes.get("/:resource/:id", (c) => {
  const { resource, id } = c.req.param();
  const rec = getRecord(resource, id);
  if (!rec) return c.json({ error: "not found" }, 404);
  return c.json(rec);
});

resourceRoutes.post("/:resource", async (c) => {
  const resource = c.req.param("resource");
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const id = String(body.id ?? uuid());
  if (getRecord(resource, id))
    return c.json({ error: "duplicate id" }, 409);
  const row = insertRecord(resource, id, body);
  const user = currentUser(c);
  recordAudit({
    actor: user.email,
    action: `${resource}.created`,
    resource,
    recordId: id,
    payload: body,
  });
  broadcastResourceChange(resource, id, "create", user.email);
  return c.json(row, 201);
});

resourceRoutes.patch("/:resource/:id", async (c) => {
  const { resource, id } = c.req.param();
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
  return c.json(row);
});

// PUT is accepted as alias for PATCH (some clients use PUT for upsert).
resourceRoutes.put("/:resource/:id", async (c) => {
  const { resource, id } = c.req.param();
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const existing = getRecord(resource, id);
  const row = existing
    ? updateRecord(resource, id, body)
    : insertRecord(resource, id, body);
  const user = currentUser(c);
  recordAudit({
    actor: user.email,
    action: `${resource}.${existing ? "updated" : "created"}`,
    resource,
    recordId: id,
  });
  broadcastResourceChange(resource, id, existing ? "update" : "create", user.email);
  return c.json(row);
});

resourceRoutes.delete("/:resource/:id", (c) => {
  const { resource, id } = c.req.param();
  const ok = deleteRecord(resource, id);
  if (!ok) return c.json({ error: "not found" }, 404);
  const user = currentUser(c);
  recordAudit({
    actor: user.email,
    action: `${resource}.deleted`,
    resource,
    recordId: id,
  });
  broadcastResourceChange(resource, id, "delete", user.email);
  return c.json({ ok: true });
});
