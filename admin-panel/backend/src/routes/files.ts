import { Hono } from "hono";
import path from "node:path";
import fs from "node:fs/promises";
import { existsSync, mkdirSync } from "node:fs";
import { requireAuth, currentUser } from "../middleware/auth";
import { uuid } from "../lib/id";
import { bulkInsert } from "../lib/query";
import { recordAudit } from "../lib/audit";
import { db, nowIso } from "../db";
import { broadcastResourceChange } from "../lib/ws";
import { loadConfig } from "../config";
import { getTenantContext } from "../tenancy/context";

const cfg = loadConfig();

/** Resolve the storage directory for the current request's tenant. Falls
 *  back to a "default" bucket when no tenant context is present (shouldn't
 *  happen under normal routing, but we keep the code defensive). */
function tenantStorageDir(): string {
  const ctx = getTenantContext();
  const bucket = ctx?.schema ?? "default";
  const dir = path.join(cfg.filesRoot, bucket);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

// Ensure the root exists once at module load; per-tenant subdirs are created
// lazily by tenantStorageDir().
if (!existsSync(cfg.filesRoot)) mkdirSync(cfg.filesRoot, { recursive: true });

/** Sanitize a filename for Content-Disposition. Strips CR/LF/quote which
 *  would otherwise enable header injection, plus non-printable bytes.
 *  Keeps the user-visible name intact (we only use it as a hint for the
 *  browser download dialog). */
function sanitizeForHeader(name: string): string {
  return name.replace(/[\r\n"\\]/g, "").replace(/[\x00-\x1f\x7f]/g, "");
}

export const filesRoutes = new Hono();
filesRoutes.use("*", requireAuth);

/** POST /api/files — multipart upload. Stores bytes on disk (per-tenant
 *  directory), metadata in the `files.file` resource. Returns the record. */
filesRoutes.post("/", async (c) => {
  const form = await c.req.formData().catch(() => null);
  if (!form) return c.json({ error: "expected multipart/form-data" }, 400);
  const file = form.get("file");
  if (!(file instanceof File)) return c.json({ error: "no file" }, 400);

  const ownerResource = String(form.get("resource") ?? "");
  const ownerId = String(form.get("recordId") ?? "");
  const user = currentUser(c);
  const tenant = getTenantContext();

  const id = uuid();
  const ext = path.extname(file.name) || "";
  const storageName = `${id}${ext}`;
  const storageDir = tenantStorageDir();
  const storagePath = path.join(storageDir, storageName);
  const buf = await file.arrayBuffer();
  await fs.writeFile(storagePath, Buffer.from(buf));

  const now = nowIso();
  const record = {
    id,
    name: file.name,
    mimeType: file.type || "application/octet-stream",
    sizeBytes: file.size,
    owner: user.email,
    uploadedAt: now,
    storageName,
    url: `/api/files/${id}/content`,
    resource: ownerResource || undefined,
    recordId: ownerId || undefined,
    // Tag the file with the current tenant so we can refuse cross-tenant
    // reads even in the shared-records SQLite model.
    tenantId: tenant?.tenantId,
  };
  bulkInsert("files.file", [record]);
  recordAudit({
    actor: user.email,
    action: "files.file.uploaded",
    resource: "files.file",
    recordId: id,
    payload: { name: file.name, size: file.size },
  });
  broadcastResourceChange("files.file", id, "create", user.email);
  return c.json(record, 201);
});

filesRoutes.get("/:id/content", async (c) => {
  const id = c.req.param("id");
  const row = db
    .prepare("SELECT data FROM records WHERE resource = 'files.file' AND id = ?")
    .get(id) as { data: string } | undefined;
  if (!row) return c.json({ error: "not found" }, 404);
  const rec = JSON.parse(row.data) as {
    storageName: string;
    mimeType: string;
    name: string;
    tenantId?: string;
  };

  // Cross-tenant access refusal — any file tagged with a tenantId MUST
  // match the current request's tenant. Legacy untagged files fall through
  // (they existed before this check was added).
  const tenant = getTenantContext();
  if (rec.tenantId && tenant?.tenantId && rec.tenantId !== tenant.tenantId) {
    return c.json({ error: "not found" }, 404);
  }

  const storageDir = tenantStorageDir();
  const p = path.join(storageDir, rec.storageName);
  if (!existsSync(p)) return c.json({ error: "missing on disk" }, 404);
  const data = await fs.readFile(p);
  const safeName = sanitizeForHeader(rec.name);
  return new Response(data, {
    headers: {
      "Content-Type": rec.mimeType,
      "Content-Disposition": `inline; filename="${safeName}"`,
    },
  });
});

/** GET /api/files?resource=&recordId= — list attachments for a given record,
 *  scoped to the current tenant. */
filesRoutes.get("/", (c) => {
  const url = new URL(c.req.url);
  const resource = url.searchParams.get("resource");
  const recordId = url.searchParams.get("recordId");
  if (!resource || !recordId)
    return c.json({ error: "resource + recordId query params required" }, 400);
  const tenant = getTenantContext();
  const tenantId = tenant?.tenantId ?? null;
  const rows = db
    .prepare(
      `SELECT data FROM records
        WHERE resource = 'files.file'
          AND json_extract(data, '$.resource') = ?
          AND json_extract(data, '$.recordId') = ?
        ORDER BY updated_at DESC`,
    )
    .all(resource, recordId) as { data: string }[];
  const parsed = rows.map((r) => JSON.parse(r.data) as { tenantId?: string });
  const filtered = tenantId
    ? parsed.filter((p) => !p.tenantId || p.tenantId === tenantId)
    : parsed;
  return c.json({ rows: filtered, total: filtered.length });
});
