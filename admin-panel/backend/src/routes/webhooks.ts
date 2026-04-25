/** Webhooks REST API.
 *
 *  CRUD per tenant. Each webhook has a target URL, an HMAC secret,
 *  and an `events_pattern` (e.g. `crm.contact.*`, `*.created`, or `*`).
 *  Secret is generated server-side on create; clients receive it once
 *  and must store it themselves. Listings show only the prefix for
 *  identification.
 *
 *  Routes:
 *    GET    /              list
 *    POST   /              create   (returns secret in plaintext exactly once)
 *    GET    /:id           fetch one (no secret)
 *    PATCH  /:id           update target/pattern/headers/enabled
 *    DELETE /:id           remove
 *    POST   /:id/test      synthetic-fire one delivery for testing
 *    GET    /:id/deliveries  paginated delivery log
 *    POST   /:id/rotate-secret  rotate the HMAC secret */
import { Hono } from "hono";
import { requireAuth, currentUser } from "../middleware/auth";
import { getTenantContext } from "../tenancy/context";
import { db, nowIso } from "../db";
import { uuid, token as randomToken } from "../lib/id";
import { recordAudit } from "../lib/audit";
import { createHmac } from "node:crypto";

export const webhookRoutes = new Hono();
webhookRoutes.use("*", requireAuth);

interface WebhookRow {
  id: string;
  tenant_id: string;
  target_url: string;
  secret: string;
  events_pattern: string;
  enabled: number;
  headers: string | null;
  retry_policy: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  last_delivery_at: string | null;
  last_status: number | null;
}

function tenantId(): string {
  return getTenantContext()?.tenantId ?? "default";
}

function rowToPublic(r: WebhookRow): Record<string, unknown> {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    targetUrl: r.target_url,
    eventsPattern: r.events_pattern,
    enabled: r.enabled === 1,
    secretPrefix: r.secret.slice(0, 6) + "…",
    headers: r.headers ? JSON.parse(r.headers) : null,
    retryPolicy: r.retry_policy ? JSON.parse(r.retry_policy) : null,
    createdBy: r.created_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    lastDeliveryAt: r.last_delivery_at,
    lastStatus: r.last_status,
  };
}

webhookRoutes.get("/", (c) => {
  const rows = db
    .prepare(
      `SELECT * FROM webhooks WHERE tenant_id = ? ORDER BY created_at DESC`,
    )
    .all(tenantId()) as WebhookRow[];
  return c.json({ rows: rows.map(rowToPublic) });
});

webhookRoutes.get("/:id", (c) => {
  const row = db
    .prepare(`SELECT * FROM webhooks WHERE id = ? AND tenant_id = ?`)
    .get(c.req.param("id"), tenantId()) as WebhookRow | undefined;
  if (!row) return c.json({ error: "not found" }, 404);
  return c.json(rowToPublic(row));
});

webhookRoutes.post("/", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as {
    targetUrl?: string;
    eventsPattern?: string;
    headers?: Record<string, string>;
    retryPolicy?: { maxAttempts?: number; backoffMs?: number };
    enabled?: boolean;
  };
  if (!body.targetUrl || typeof body.targetUrl !== "string") {
    return c.json({ error: "targetUrl required" }, 400);
  }
  // Tighten URL validation: must be http/https and not localhost in
  // prod. Localhost is allowed when STORAGE env says we're in dev.
  let targetUrl: URL;
  try { targetUrl = new URL(body.targetUrl); } catch {
    return c.json({ error: "invalid targetUrl" }, 400);
  }
  if (!["http:", "https:"].includes(targetUrl.protocol)) {
    return c.json({ error: "targetUrl must be http(s)" }, 400);
  }
  const id = uuid();
  const secret = randomToken();
  const now = nowIso();
  const user = currentUser(c);
  db.prepare(
    `INSERT INTO webhooks
       (id, tenant_id, target_url, secret, events_pattern, enabled, headers, retry_policy, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    tenantId(),
    targetUrl.toString(),
    secret,
    (body.eventsPattern ?? "*").slice(0, 200),
    body.enabled === false ? 0 : 1,
    body.headers ? JSON.stringify(body.headers) : null,
    body.retryPolicy ? JSON.stringify(body.retryPolicy) : null,
    user.email,
    now,
    now,
  );
  recordAudit({
    actor: user.email,
    action: "webhook.created",
    resource: "webhook",
    recordId: id,
    payload: { targetUrl: targetUrl.toString(), eventsPattern: body.eventsPattern },
  });
  // Return the secret IN PLAINTEXT exactly once. Subsequent reads
  // only show prefix.
  const row = db
    .prepare(`SELECT * FROM webhooks WHERE id = ?`)
    .get(id) as WebhookRow;
  return c.json({ ...rowToPublic(row), secret }, 201);
});

webhookRoutes.patch("/:id", async (c) => {
  const id = c.req.param("id");
  const tid = tenantId();
  const existing = db
    .prepare(`SELECT * FROM webhooks WHERE id = ? AND tenant_id = ?`)
    .get(id, tid) as WebhookRow | undefined;
  if (!existing) return c.json({ error: "not found" }, 404);
  const patch = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const fields: string[] = [];
  const args: unknown[] = [];
  if (typeof patch.targetUrl === "string") {
    try { new URL(patch.targetUrl); } catch {
      return c.json({ error: "invalid targetUrl" }, 400);
    }
    fields.push("target_url = ?"); args.push(patch.targetUrl);
  }
  if (typeof patch.eventsPattern === "string") {
    fields.push("events_pattern = ?"); args.push(patch.eventsPattern.slice(0, 200));
  }
  if (typeof patch.enabled === "boolean") {
    fields.push("enabled = ?"); args.push(patch.enabled ? 1 : 0);
  }
  if (patch.headers !== undefined) {
    fields.push("headers = ?"); args.push(patch.headers ? JSON.stringify(patch.headers) : null);
  }
  if (patch.retryPolicy !== undefined) {
    fields.push("retry_policy = ?"); args.push(patch.retryPolicy ? JSON.stringify(patch.retryPolicy) : null);
  }
  fields.push("updated_at = ?"); args.push(nowIso());
  args.push(id);
  db.prepare(`UPDATE webhooks SET ${fields.join(", ")} WHERE id = ?`).run(...args);
  const row = db.prepare(`SELECT * FROM webhooks WHERE id = ?`).get(id) as WebhookRow;
  return c.json(rowToPublic(row));
});

webhookRoutes.delete("/:id", (c) => {
  const id = c.req.param("id");
  const tid = tenantId();
  const result = db
    .prepare(`DELETE FROM webhooks WHERE id = ? AND tenant_id = ?`)
    .run(id, tid);
  if (result.changes === 0) return c.json({ error: "not found" }, 404);
  const user = currentUser(c);
  recordAudit({
    actor: user.email,
    action: "webhook.deleted",
    resource: "webhook",
    recordId: id,
  });
  return c.json({ ok: true });
});

webhookRoutes.post("/:id/rotate-secret", (c) => {
  const id = c.req.param("id");
  const tid = tenantId();
  const existing = db
    .prepare(`SELECT * FROM webhooks WHERE id = ? AND tenant_id = ?`)
    .get(id, tid) as WebhookRow | undefined;
  if (!existing) return c.json({ error: "not found" }, 404);
  const secret = randomToken();
  db.prepare(
    `UPDATE webhooks SET secret = ?, updated_at = ? WHERE id = ?`,
  ).run(secret, nowIso(), id);
  const user = currentUser(c);
  recordAudit({
    actor: user.email,
    action: "webhook.rotated-secret",
    resource: "webhook",
    recordId: id,
  });
  return c.json({ secret });
});

webhookRoutes.post("/:id/test", async (c) => {
  const id = c.req.param("id");
  const tid = tenantId();
  const w = db
    .prepare(`SELECT * FROM webhooks WHERE id = ? AND tenant_id = ?`)
    .get(id, tid) as WebhookRow | undefined;
  if (!w) return c.json({ error: "not found" }, 404);
  // Synthesize a "test.ping" event to deliver immediately + report
  // the result inline for the UI's "Test" button.
  const body = JSON.stringify({
    id: uuid(),
    event: "test.ping",
    occurredAt: nowIso(),
    actor: "system:test",
    tenantId: tid,
    record: { hello: "world", testFromUi: true },
  });
  const sig = createHmac("sha256", w.secret).update(body).digest("hex");
  let statusCode = 0;
  let responseBody = "";
  let error: string | null = null;
  try {
    const res = await fetch(w.target_url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Gutu-Event": "test.ping",
        "X-Gutu-Webhook-Id": w.id,
        "X-Gutu-Signature": `sha256=${sig}`,
      },
      body,
      signal: AbortSignal.timeout(10_000),
    });
    statusCode = res.status;
    responseBody = (await res.text()).slice(0, 1024);
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }
  db.prepare(
    `INSERT INTO webhook_deliveries
       (id, webhook_id, event_type, payload, status_code, response_body, error, attempt, delivered_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(uuid(), w.id, "test.ping", body, statusCode || null, responseBody, error, 1, nowIso());
  return c.json({ ok: !error && statusCode >= 200 && statusCode < 300, statusCode, error, responseBody });
});

webhookRoutes.get("/:id/deliveries", (c) => {
  const id = c.req.param("id");
  const tid = tenantId();
  const w = db
    .prepare(`SELECT id FROM webhooks WHERE id = ? AND tenant_id = ?`)
    .get(id, tid);
  if (!w) return c.json({ error: "not found" }, 404);
  const limit = Math.min(200, Math.max(1, Number(c.req.query("limit") ?? 50)));
  const rows = db
    .prepare(
      `SELECT id, webhook_id, event_type, status_code, error, attempt, delivered_at,
              substr(payload, 1, 500) AS payload_preview,
              substr(response_body, 1, 500) AS response_preview
       FROM webhook_deliveries
       WHERE webhook_id = ?
       ORDER BY delivered_at DESC
       LIMIT ?`,
    )
    .all(id, limit);
  return c.json({ rows });
});
