/** GDPR / privacy operator endpoints.
 *
 *    POST /api/_gdpr/export   { subjectId } → aggregated JSON bag of every
 *                                              plugin's data about the subject
 *    POST /api/_gdpr/delete   { subjectId, confirm: "permanent" }
 *                                            → permanently erases every plugin's
 *                                              data about the subject (audited)
 *
 *  Admin role only. Both endpoints fan out to every plugin's
 *  exportSubjectData / deleteSubjectData hook. Plugins that don't
 *  implement the hook contribute an empty bag (export) or zero
 *  deletions (delete). */

import { Hono } from "hono";
import { requireAuth, currentUser } from "../middleware/auth";
import { getTenantContext } from "../tenancy/context";
import { recordAudit } from "../lib/audit";
import { listPluginRecords } from "../host/plugin-contract";

export const gdprRoutes = new Hono();
gdprRoutes.use("*", requireAuth);

gdprRoutes.post("/export", async (c) => {
  const user = currentUser(c);
  if (user.role !== "admin") return c.json({ error: "admin role required" }, 403);
  const tenantId = getTenantContext().tenantId;
  const body = (await c.req.json().catch(() => ({}))) as { subjectId?: string };
  if (typeof body.subjectId !== "string" || body.subjectId.length === 0) {
    return c.json({ error: "subjectId required", code: "invalid-argument" }, 400);
  }

  const sections: Record<string, unknown> = {};
  const failed: Array<{ pluginId: string; error: string }> = [];

  for (const rec of listPluginRecords()) {
    if (!rec.plugin.exportSubjectData) continue;
    try {
      sections[rec.plugin.id] = await rec.plugin.exportSubjectData({
        tenantId,
        subjectId: body.subjectId,
      });
    } catch (err) {
      failed.push({ pluginId: rec.plugin.id, error: err instanceof Error ? err.message : String(err) });
    }
  }

  recordAudit({
    actor: user.email,
    action: "gdpr.export",
    resource: "subject",
    recordId: body.subjectId,
    payload: { tenantId, plugins: Object.keys(sections), failed },
  });

  return c.json({
    subjectId: body.subjectId,
    tenantId,
    exportedAt: new Date().toISOString(),
    sections,
    failed,
  });
});

gdprRoutes.post("/delete", async (c) => {
  const user = currentUser(c);
  if (user.role !== "admin") return c.json({ error: "admin role required" }, 403);
  const tenantId = getTenantContext().tenantId;
  const body = (await c.req.json().catch(() => ({}))) as { subjectId?: string; confirm?: string };
  if (typeof body.subjectId !== "string" || body.subjectId.length === 0) {
    return c.json({ error: "subjectId required" }, 400);
  }
  if (body.confirm !== "permanent") {
    return c.json({
      error: "permanent erasure requires { confirm: \"permanent\" } in body",
      code: "confirmation-required",
    }, 400);
  }

  const results: Array<{ pluginId: string; deleted: number; error?: string }> = [];
  for (const rec of listPluginRecords()) {
    if (!rec.plugin.deleteSubjectData) continue;
    try {
      const r = await rec.plugin.deleteSubjectData({ tenantId, subjectId: body.subjectId });
      results.push({ pluginId: rec.plugin.id, deleted: r.deleted });
    } catch (err) {
      results.push({
        pluginId: rec.plugin.id,
        deleted: 0,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const totalDeleted = results.reduce((s, r) => s + r.deleted, 0);
  recordAudit({
    actor: user.email,
    action: "gdpr.delete",
    resource: "subject",
    recordId: body.subjectId,
    level: "warn",
    payload: { tenantId, totalDeleted, results },
  });

  return c.json({
    subjectId: body.subjectId,
    tenantId,
    deletedAt: new Date().toISOString(),
    totalDeleted,
    results,
  });
});
