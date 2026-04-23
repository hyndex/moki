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

const STORAGE_DIR = path.join(import.meta.dir, "..", "..", "uploads");
if (!existsSync(STORAGE_DIR)) mkdirSync(STORAGE_DIR, { recursive: true });

export const filesRoutes = new Hono();
filesRoutes.use("*", requireAuth);

/** POST /api/files — multipart upload. Stores bytes on disk, metadata in
 *  the `files.file` resource. Returns the file record. */
filesRoutes.post("/", async (c) => {
  const form = await c.req.formData().catch(() => null);
  if (!form) return c.json({ error: "expected multipart/form-data" }, 400);
  const file = form.get("file");
  if (!(file instanceof File)) return c.json({ error: "no file" }, 400);

  const ownerResource = String(form.get("resource") ?? "");
  const ownerId = String(form.get("recordId") ?? "");
  const user = currentUser(c);

  const id = uuid();
  const ext = path.extname(file.name) || "";
  const storageName = `${id}${ext}`;
  const storagePath = path.join(STORAGE_DIR, storageName);
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
  const rec = JSON.parse(row.data) as { storageName: string; mimeType: string; name: string };
  const p = path.join(STORAGE_DIR, rec.storageName);
  if (!existsSync(p)) return c.json({ error: "missing on disk" }, 404);
  const data = await fs.readFile(p);
  return new Response(data, {
    headers: {
      "Content-Type": rec.mimeType,
      "Content-Disposition": `inline; filename="${rec.name.replace(/"/g, "")}"`,
    },
  });
});

/** GET /api/files?resource=&recordId= — list attachments for a given record. */
filesRoutes.get("/", (c) => {
  const url = new URL(c.req.url);
  const resource = url.searchParams.get("resource");
  const recordId = url.searchParams.get("recordId");
  if (!resource || !recordId)
    return c.json({ error: "resource + recordId query params required" }, 400);
  const rows = db
    .prepare(
      `SELECT data FROM records
        WHERE resource = 'files.file'
          AND json_extract(data, '$.resource') = ?
          AND json_extract(data, '$.recordId') = ?
        ORDER BY updated_at DESC`,
    )
    .all(resource, recordId) as { data: string }[];
  return c.json({ rows: rows.map((r) => JSON.parse(r.data)), total: rows.length });
});
