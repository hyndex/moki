import { Hono } from "hono";
import type { SQLQueryBindings } from "bun:sqlite";
import { db } from "../db";
import { requireAuth, currentUser } from "../middleware/auth";
import { verifyAuditChain } from "../lib/audit";

export const auditRoutes = new Hono();
auditRoutes.use("*", requireAuth);

/** Walk the hash chain end-to-end and report integrity status. Cheap
 *  for the typical small audit volume; for huge logs an operator
 *  passes ?limit=N to scope. Admin role only — surfaces enough info
 *  to attribute a tamper attempt. */
auditRoutes.get("/verify", (c) => {
  const user = currentUser(c);
  if (user.role !== "admin") return c.json({ error: "admin role required" }, 403);
  const url = new URL(c.req.url);
  const limit = Math.min(1_000_000, Math.max(1, Number(url.searchParams.get("limit") ?? 100_000)));
  const result = verifyAuditChain({ limit });
  return c.json(result);
});

auditRoutes.get("/", (c) => {
  const url = new URL(c.req.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
  const pageSize = Math.min(500, Math.max(1, Number(url.searchParams.get("pageSize") ?? 50)));
  const search = url.searchParams.get("search") ?? "";

  const where: string[] = [];
  const bindings: SQLQueryBindings[] = [];
  if (search) {
    where.push("(action LIKE ? OR actor LIKE ? OR resource LIKE ?)");
    const q = `%${search}%`;
    bindings.push(q, q, q);
  }
  const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

  const count = db
    .prepare(`SELECT COUNT(*) AS c FROM audit_events ${whereSql}`)
    .get(...bindings) as { c: number };

  const rows = db
    .prepare(
      `SELECT id, actor, action, resource, record_id as recordId, level, ip,
              occurred_at as occurredAt, payload
         FROM audit_events
         ${whereSql}
         ORDER BY occurred_at DESC
         LIMIT ? OFFSET ?`,
    )
    .all(...bindings, pageSize, (page - 1) * pageSize);

  return c.json({ rows, total: count.c, page, pageSize });
});
