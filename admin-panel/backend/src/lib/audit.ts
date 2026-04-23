import { db, nowIso } from "./../db";
import { uuid } from "./id";

/** Every mutation lands here. Keeps the audit log honest and non-optional. */
export function recordAudit(input: {
  actor: string;
  action: string;
  resource: string;
  recordId?: string;
  level?: "info" | "warn" | "error";
  ip?: string;
  payload?: unknown;
}): void {
  db.prepare(
    `INSERT INTO audit_events
       (id, actor, action, resource, record_id, level, ip, occurred_at, payload)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    uuid(),
    input.actor,
    input.action,
    input.resource,
    input.recordId ?? null,
    input.level ?? "info",
    input.ip ?? null,
    nowIso(),
    input.payload ? JSON.stringify(input.payload) : null,
  );
}
