import { Hono } from "hono";
import { z } from "zod";
import { requireAuth, currentUser } from "../middleware/auth";
import {
  addMembership,
  archiveTenant,
  createTenant,
  deleteTenantHard,
  getTenant,
  listMembershipsForUser,
  listTenants,
  normalizeSlug,
  removeMembership,
  setPrimaryDomain,
  updateTenant,
} from "../tenancy/provisioner";
import { loadConfig } from "../config";
import { dbx } from "../dbx";
import { recordAudit } from "../lib/audit";
import { closeSocketsForTenant } from "../lib/ws";

export const tenantRoutes = new Hono();

/** Guard — only admins or super-admin email may manage tenants. */
function requireAdmin(c: Parameters<Parameters<typeof Hono.prototype.use>[1]>[0]): boolean {
  const user = currentUser(c);
  const cfg = loadConfig();
  if (user.role === "admin") return true;
  if (cfg.superAdminEmail && user.email.toLowerCase() === cfg.superAdminEmail.toLowerCase()) return true;
  return false;
}

/* ---------------- list + read ---------------- */

tenantRoutes.get("/", requireAuth, async (c) => {
  const user = currentUser(c);
  // Non-admins see only the tenants they're members of.
  if (!requireAdmin(c)) {
    const memberships = await listMembershipsForUser(user.id);
    return c.json({ tenants: memberships.map((m) => ({ ...m.tenant, role: m.role })) });
  }
  const all = await listTenants();
  return c.json({ tenants: all });
});

tenantRoutes.get("/:id", requireAuth, async (c) => {
  const t = await getTenant(c.req.param("id"));
  if (!t) return c.json({ error: "not_found" }, 404);
  return c.json(t);
});

/* ---------------- create ---------------- */

const CreateTenantBody = z.object({
  slug: z.string().min(2).max(63),
  name: z.string().min(1).max(120),
  plan: z.string().optional(),
  settings: z.record(z.unknown()).optional(),
});

tenantRoutes.post("/", requireAuth, async (c) => {
  if (!requireAdmin(c)) return c.json({ error: "forbidden" }, 403);
  const user = currentUser(c);
  const body = await c.req.json().catch(() => null);
  const parsed = CreateTenantBody.safeParse(body);
  if (!parsed.success)
    return c.json({ error: "invalid body", issues: parsed.error.issues }, 400);
  try {
    const tenant = await createTenant({
      slug: normalizeSlug(parsed.data.slug),
      name: parsed.data.name,
      plan: parsed.data.plan,
      settings: parsed.data.settings,
      initialOwnerUserId: user.id,
    });
    recordAudit({
      actor: user.email,
      action: "tenant.created",
      resource: "platform.tenant",
      recordId: tenant.id,
      level: "info",
    });
    return c.json(tenant, 201);
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : "create_failed" }, 400);
  }
});

/* ---------------- update ---------------- */

const UpdateTenantBody = z.object({
  name: z.string().min(1).max(120).optional(),
  plan: z.string().optional(),
  status: z.enum(["active", "suspended", "archived"]).optional(),
  settings: z.record(z.unknown()).optional(),
});

tenantRoutes.patch("/:id", requireAuth, async (c) => {
  if (!requireAdmin(c)) return c.json({ error: "forbidden" }, 403);
  const user = currentUser(c);
  const body = await c.req.json().catch(() => null);
  const parsed = UpdateTenantBody.safeParse(body);
  if (!parsed.success)
    return c.json({ error: "invalid body", issues: parsed.error.issues }, 400);
  try {
    const t = await updateTenant(c.req.param("id"), parsed.data);
    recordAudit({
      actor: user.email,
      action: "tenant.updated",
      resource: "platform.tenant",
      recordId: t.id,
    });
    return c.json(t);
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : "update_failed" }, 400);
  }
});

/* ---------------- lifecycle ---------------- */

tenantRoutes.post("/:id/archive", requireAuth, async (c) => {
  if (!requireAdmin(c)) return c.json({ error: "forbidden" }, 403);
  const user = currentUser(c);
  await archiveTenant(c.req.param("id"));
  recordAudit({
    actor: user.email,
    action: "tenant.archived",
    resource: "platform.tenant",
    recordId: c.req.param("id"),
    level: "warn",
  });
  return c.json({ ok: true });
});

const HardDeleteBody = z.object({ confirm: z.literal("DELETE"), slug: z.string() });

tenantRoutes.post("/:id/delete-hard", requireAuth, async (c) => {
  if (!requireAdmin(c)) return c.json({ error: "forbidden" }, 403);
  const user = currentUser(c);
  const body = await c.req.json().catch(() => null);
  const parsed = HardDeleteBody.safeParse(body);
  if (!parsed.success) return c.json({ error: "confirmation_required" }, 400);
  const t = await getTenant(c.req.param("id"));
  if (!t) return c.json({ error: "not_found" }, 404);
  if (t.slug !== parsed.data.slug) return c.json({ error: "slug_mismatch" }, 400);
  if (t.slug === loadConfig().defaultTenantSlug)
    return c.json({ error: "cannot_delete_default_tenant" }, 400);
  await deleteTenantHard(t.id);
  // Kick every live socket off — they now hold a session that was just
  // deleted, and we must not keep feeding them broadcasts from the ghost
  // tenant id.
  const closed = closeSocketsForTenant(t.id, 4001, "tenant_deleted");
  recordAudit({
    actor: user.email,
    action: "tenant.deleted_hard",
    resource: "platform.tenant",
    recordId: t.id,
    level: "error",
    payload: { closedSockets: closed },
  });
  return c.json({ ok: true, closedSockets: closed });
});

/* ---------------- memberships ---------------- */

const MembershipBody = z.object({
  userId: z.string().min(1),
  role: z.enum(["owner", "admin", "member", "viewer"]).default("member"),
});

tenantRoutes.post("/:id/members", requireAuth, async (c) => {
  if (!requireAdmin(c)) return c.json({ error: "forbidden" }, 403);
  const user = currentUser(c);
  const body = await c.req.json().catch(() => null);
  const parsed = MembershipBody.safeParse(body);
  if (!parsed.success) return c.json({ error: "invalid body" }, 400);
  await addMembership(c.req.param("id"), parsed.data.userId, parsed.data.role);
  recordAudit({
    actor: user.email,
    action: "tenant.member.added",
    resource: "platform.tenant",
    recordId: c.req.param("id"),
    payload: parsed.data,
  });
  return c.json({ ok: true });
});

tenantRoutes.delete("/:id/members/:userId", requireAuth, async (c) => {
  if (!requireAdmin(c)) return c.json({ error: "forbidden" }, 403);
  const user = currentUser(c);
  await removeMembership(c.req.param("id"), c.req.param("userId"));
  recordAudit({
    actor: user.email,
    action: "tenant.member.removed",
    resource: "platform.tenant",
    recordId: c.req.param("id"),
  });
  return c.json({ ok: true });
});

tenantRoutes.get("/:id/members", requireAuth, async (c) => {
  const db = dbx();
  const prefix = db.kind === "postgres" ? "public." : "";
  const rows = await db.all<{
    user_id: string;
    email: string;
    name: string;
    role: string;
    joined_at: string;
  }>(
    `SELECT m.user_id, u.email, u.name, m.role, m.joined_at
     FROM ${prefix}tenant_memberships m
     JOIN ${prefix}users u ON u.id = m.user_id
     WHERE m.tenant_id = ?
     ORDER BY m.joined_at ASC`,
    [c.req.param("id")],
  );
  return c.json({ members: rows });
});

/* ---------------- domains ---------------- */

const DomainBody = z.object({ domain: z.string().min(3).max(253) });

tenantRoutes.post("/:id/domains", requireAuth, async (c) => {
  if (!requireAdmin(c)) return c.json({ error: "forbidden" }, 403);
  const user = currentUser(c);
  const body = await c.req.json().catch(() => null);
  const parsed = DomainBody.safeParse(body);
  if (!parsed.success) return c.json({ error: "invalid body" }, 400);
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(parsed.data.domain))
    return c.json({ error: "invalid_domain" }, 400);
  await setPrimaryDomain(c.req.param("id"), parsed.data.domain);
  recordAudit({
    actor: user.email,
    action: "tenant.domain.set",
    resource: "platform.tenant",
    recordId: c.req.param("id"),
    payload: parsed.data,
  });
  return c.json({ ok: true });
});
