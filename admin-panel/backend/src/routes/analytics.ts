import { Hono } from "hono";
import type { Context } from "hono";
import { maybeAuth } from "../middleware/auth";
import { insertRecord } from "../lib/query";
import { recordAudit } from "../lib/audit";
import { uuid } from "../lib/id";
import { getTenantContext } from "../tenancy/context";

const MAX_EVENTS_PER_BATCH = 100;
const MAX_BODY_BYTES = 256 * 1024;
const MAX_JSON_DEPTH = 5;
const MAX_JSON_KEYS = 64;
const MAX_STRING_LENGTH = 4000;

type AnalyticsUser = { id?: string; email?: string };

export const analyticsRoutes = new Hono();

analyticsRoutes.post("/events", maybeAuth, async (c) => {
  const contentLength = Number(c.req.header("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return c.json({ error: "analytics payload too large" }, 413);
  }

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid analytics payload" }, 400);
  }

  if (!isRecord(body) || !Array.isArray(body.events)) {
    return c.json({ error: "analytics events must be an array" }, 400);
  }
  if (body.events.length === 0) {
    return c.json({ error: "analytics event batch is empty" }, 400);
  }
  if (body.events.length > MAX_EVENTS_PER_BATCH) {
    return c.json({ error: "analytics event batch too large" }, 413);
  }

  const tenant = getTenantContext();
  const user = contextUser(c);
  const actor = user?.email ?? user?.id ?? "anonymous";
  const acceptedIds: string[] = [];

  for (const raw of body.events) {
    const event = normalizeEvent(raw);
    if (!event) return c.json({ error: "invalid analytics event" }, 422);
    const id = uuid();
    insertRecord("analytics.event", id, {
      ...event,
      id,
      tenantId: tenant?.tenantId,
      actorId: user?.id,
      receivedAt: new Date().toISOString(),
    });
    acceptedIds.push(id);
  }

  recordAudit({
    actor,
    action: "analytics.events.ingested",
    resource: "analytics.event",
    payload: {
      accepted: acceptedIds.length,
      tenantId: tenant?.tenantId,
      firstEventId: acceptedIds[0],
    },
  });

  return c.json({ ok: true, accepted: acceptedIds.length, ids: acceptedIds }, 202);
});

function normalizeEvent(raw: unknown): Record<string, unknown> | null {
  if (!isRecord(raw)) return null;
  const name = raw.name;
  if (typeof name !== "string" || !name || name.length > 120) return null;
  const meta = sanitizeJson(raw.meta ?? {});
  const props = sanitizeJson(raw.props ?? {});
  if (!isRecord(meta) || !isRecord(props)) return null;
  const at = typeof meta.at === "string" && !Number.isNaN(Date.parse(meta.at))
    ? meta.at
    : new Date().toISOString();
  return {
    name,
    meta: { ...meta, at },
    props,
  };
}

function sanitizeJson(value: unknown, depth = 0): unknown {
  if (depth > MAX_JSON_DEPTH) return null;
  if (value == null) return null;
  if (typeof value === "string") return value.slice(0, MAX_STRING_LENGTH);
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "boolean") return value;
  if (Array.isArray(value)) {
    return value.slice(0, MAX_JSON_KEYS).map((entry) => sanitizeJson(entry, depth + 1));
  }
  if (!isRecord(value)) return null;
  const out: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value).slice(0, MAX_JSON_KEYS)) {
    if (!key || key.length > 120) continue;
    out[key] = sanitizeJson(entry, depth + 1);
  }
  return out;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function contextUser(c: Context): AnalyticsUser | undefined {
  return (c as unknown as { get(key: string): unknown }).get("user") as AnalyticsUser | undefined;
}
