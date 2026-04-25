/** Outbound webhook dispatcher.
 *
 *  Subscribes to the in-process event bus. When a record changes, we
 *  look up every webhook in `webhooks` table that
 *    a) is enabled,
 *    b) belongs to the same tenant as the event,
 *    c) has an `events_pattern` that matches `<resource>.<op>`.
 *  For each match we POST the event payload as JSON to the target URL,
 *  with an HMAC-SHA-256 signature header so the receiver can verify
 *  authenticity.
 *
 *  Retry strategy: simple exponential backoff (up to 3 attempts at
 *  1s/4s/15s). Each delivery attempt is logged in `webhook_deliveries`
 *  for observability + manual retry. On 2xx → success; otherwise
 *  scheduled retry until attempts exhausted.
 *
 *  We intentionally don't use a queue/broker — this is in-process so
 *  it works in single-node deployments. For multi-node, swap the
 *  scheduler for a Redis-backed queue but keep the same handler
 *  signature. */
import { db, nowIso } from "../db";
import { uuid } from "./id";
import { subscribeRecordEvents, type RecordEvent } from "./event-bus";
import { createHmac } from "node:crypto";

interface WebhookRow {
  id: string;
  tenant_id: string;
  target_url: string;
  secret: string;
  events_pattern: string;
  enabled: number;
  headers: string | null;
  retry_policy: string | null;
}

const RETRY_DELAYS_MS = [1_000, 4_000, 15_000];

function shortOp(eventType: RecordEvent["type"]): string {
  // record.created → created
  return eventType.replace(/^record\./, "");
}

function patternMatches(pattern: string, resource: string, op: string): boolean {
  // Patterns: '*' matches all; 'crm.contact.*' matches any op on crm.contact;
  // '*.created' matches any resource on created; 'crm.contact.created' exact.
  if (pattern === "*") return true;
  const candidate = `${resource}.${op}`;
  if (pattern === candidate) return true;
  // Glob: replace '*' with '[^.]*' style match per segment.
  const re = new RegExp(
    "^" +
      pattern
        .split(".")
        .map((seg) => (seg === "*" ? "[^.]+" : escapeRegex(seg)))
        .join("\\.") +
      "$",
  );
  return re.test(candidate);
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function deliver(webhook: WebhookRow, event: RecordEvent): Promise<void> {
  const op = shortOp(event.type);
  const eventName = `${event.resource}.${op}`;
  const body = JSON.stringify({
    id: uuid(),
    event: eventName,
    occurredAt: event.occurredAt,
    actor: event.actor,
    tenantId: event.tenantId,
    resource: event.resource,
    recordId: event.recordId,
    record: event.record,
    before: event.before,
    diff: event.diff,
  });
  const sig = createHmac("sha256", webhook.secret).update(body).digest("hex");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Gutu-Event": eventName,
    "X-Gutu-Webhook-Id": webhook.id,
    "X-Gutu-Signature": `sha256=${sig}`,
  };
  if (webhook.headers) {
    try {
      const extra = JSON.parse(webhook.headers) as Record<string, string>;
      Object.assign(headers, extra);
    } catch { /* tolerate */ }
  }
  let attempt = 0;
  while (attempt < RETRY_DELAYS_MS.length + 1) {
    attempt++;
    let statusCode: number | null = null;
    let responseBody: string | null = null;
    let error: string | null = null;
    try {
      // 10s timeout per attempt — protects us from hanging slow
      // receivers. Bun's fetch supports AbortSignal.timeout.
      const res = await fetch(webhook.target_url, {
        method: "POST",
        headers,
        body,
        signal: AbortSignal.timeout(10_000),
      });
      statusCode = res.status;
      responseBody = await res.text().then((t) => t.slice(0, 1024)).catch(() => null);
      if (res.ok) {
        await logDelivery(webhook.id, eventName, body, statusCode, responseBody, null, attempt);
        await markWebhookHealthy(webhook.id, statusCode);
        return;
      }
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }
    await logDelivery(webhook.id, eventName, body, statusCode, responseBody, error, attempt);
    if (attempt >= RETRY_DELAYS_MS.length + 1) {
      await markWebhookHealthy(webhook.id, statusCode);
      return;
    }
    const delay = RETRY_DELAYS_MS[attempt - 1];
    await new Promise((r) => setTimeout(r, delay));
  }
}

async function logDelivery(
  webhookId: string,
  eventType: string,
  payload: string,
  statusCode: number | null,
  responseBody: string | null,
  error: string | null,
  attempt: number,
): Promise<void> {
  db.prepare(
    `INSERT INTO webhook_deliveries
       (id, webhook_id, event_type, payload, status_code, response_body, error, attempt, delivered_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    uuid(),
    webhookId,
    eventType,
    payload,
    statusCode,
    responseBody,
    error,
    attempt,
    nowIso(),
  );
}

async function markWebhookHealthy(webhookId: string, statusCode: number | null): Promise<void> {
  db.prepare(
    `UPDATE webhooks SET last_delivery_at = ?, last_status = ? WHERE id = ?`,
  ).run(nowIso(), statusCode, webhookId);
}

export function startWebhookDispatcher(): () => void {
  const unsubscribe = subscribeRecordEvents((event) => {
    const op = shortOp(event.type);
    // Find matching webhooks. We do this synchronously inside the
    // subscriber so the row is selected at event time (not later when
    // the row may have been deleted).
    const rows = db
      .prepare(
        `SELECT id, tenant_id, target_url, secret, events_pattern, enabled, headers, retry_policy
         FROM webhooks
         WHERE tenant_id = ? AND enabled = 1`,
      )
      .all(event.tenantId) as WebhookRow[];
    for (const w of rows) {
      if (!patternMatches(w.events_pattern, event.resource, op)) continue;
      // Fire and forget — `deliver` is async + retrying internally.
      // Errors are logged; we don't propagate to the bus.
      void deliver(w, event).catch((err) => {
        // eslint-disable-next-line no-console
        console.error("[webhook-dispatcher] delivery error", err);
      });
    }
  });
  return unsubscribe;
}
