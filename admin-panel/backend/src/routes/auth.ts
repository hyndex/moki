import { Hono } from "hono";
import { z } from "zod";
import {
  createSession,
  deleteSession,
  getUserByEmail,
  getUserById,
  verifyPassword,
  hashPassword,
  setPasswordHash,
  setMfaSecret,
  setMfaEnabled,
  markEmailVerified,
} from "../lib/auth";
import { currentUser, requireAuth } from "../middleware/auth";
import { db, nowIso } from "../db";
import { uuid, token as randomToken } from "../lib/id";
import { recordAudit } from "../lib/audit";
import { otpauthUrl, randomSecret, verifyTotp } from "../lib/totp";
import { listMembershipsForUser, getTenant } from "../tenancy/provisioner";
import { dbx } from "../dbx";

export const authRoutes = new Hono();

const LoginBody = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  mfaCode: z.string().optional(),
});

authRoutes.post("/login", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = LoginBody.safeParse(body);
  if (!parsed.success)
    return c.json({ error: "invalid body", issues: parsed.error.issues }, 400);
  const user = getUserByEmail(parsed.data.email);
  if (!user) return c.json({ error: "invalid credentials" }, 401);
  const ok = await verifyPassword(parsed.data.password, user.password_hash);
  if (!ok) return c.json({ error: "invalid credentials" }, 401);
  if (user.mfa_enabled && user.mfa_secret) {
    const code = parsed.data.mfaCode;
    if (!code) return c.json({ error: "mfa_required" }, 401);
    const valid = await verifyTotp(user.mfa_secret, code);
    if (!valid) return c.json({ error: "invalid_mfa_code" }, 401);
  }
  const t = createSession(
    user.id,
    c.req.header("user-agent") ?? undefined,
    c.req.header("x-forwarded-for") ?? undefined,
  );
  recordAudit({
    actor: user.email,
    action: "auth.login",
    resource: "auth.user",
    recordId: user.id,
  });
  return c.json({
    token: t,
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
  });
});

const SignupBody = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  password: z.string().min(6),
});

authRoutes.post("/signup", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = SignupBody.safeParse(body);
  if (!parsed.success)
    return c.json({ error: "invalid body", issues: parsed.error.issues }, 400);
  if (getUserByEmail(parsed.data.email))
    return c.json({ error: "email already registered" }, 409);
  const now = nowIso();
  const id = uuid();
  const hash = await hashPassword(parsed.data.password);
  db.prepare(
    `INSERT INTO users (id, email, name, role, password_hash, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, parsed.data.email, parsed.data.name, "member", hash, now, now);
  const t = createSession(id);
  recordAudit({
    actor: parsed.data.email,
    action: "auth.signup",
    resource: "auth.user",
    recordId: id,
  });
  return c.json({
    token: t,
    user: { id, email: parsed.data.email, name: parsed.data.name, role: "member" },
  });
});

authRoutes.get("/me", requireAuth, (c) => {
  return c.json(currentUser(c));
});

authRoutes.post("/logout", requireAuth, (c) => {
  const t = c.get("token") as string;
  deleteSession(t);
  return c.json({ ok: true });
});

/* -- Password reset ------------------------------------------------------- */

authRoutes.post("/forgot-password", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = z.object({ email: z.string().email() }).safeParse(body);
  if (!parsed.success) return c.json({ ok: true });
  const user = getUserByEmail(parsed.data.email);
  if (!user) {
    // Never leak account existence — always return OK.
    return c.json({ ok: true });
  }
  const t = randomToken();
  const expires = new Date(Date.now() + 60 * 60_000).toISOString();
  db.prepare(
    `INSERT INTO password_reset_tokens (token, user_id, created_at, expires_at)
     VALUES (?, ?, ?, ?)`,
  ).run(t, user.id, nowIso(), expires);
  recordAudit({
    actor: user.email,
    action: "auth.password.reset_requested",
    resource: "auth.user",
    recordId: user.id,
  });
  // No mailer wired — print to console so the dev can complete the flow.
  console.log(
    `\n[auth] password reset for ${user.email}: ` +
      `http://localhost:5173/#/auth/reset?token=${t}\n`,
  );
  return c.json({ ok: true, devToken: t });
});

authRoutes.post("/reset-password", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = z
    .object({ token: z.string(), password: z.string().min(6) })
    .safeParse(body);
  if (!parsed.success)
    return c.json({ error: "invalid body" }, 400);
  const row = db
    .prepare(
      `SELECT token, user_id, expires_at, used_at
         FROM password_reset_tokens WHERE token = ?`,
    )
    .get(parsed.data.token) as
    | { token: string; user_id: string; expires_at: string; used_at: string | null }
    | undefined;
  if (!row) return c.json({ error: "invalid_token" }, 400);
  if (row.used_at) return c.json({ error: "token_already_used" }, 400);
  if (row.expires_at < nowIso()) return c.json({ error: "token_expired" }, 400);
  const hash = await hashPassword(parsed.data.password);
  setPasswordHash(row.user_id, hash);
  db.prepare(
    "UPDATE password_reset_tokens SET used_at = ? WHERE token = ?",
  ).run(nowIso(), parsed.data.token);
  // Invalidate all existing sessions for safety
  db.prepare("DELETE FROM sessions WHERE user_id = ?").run(row.user_id);
  const user = getUserById(row.user_id);
  recordAudit({
    actor: user?.email ?? "unknown",
    action: "auth.password.reset",
    resource: "auth.user",
    recordId: row.user_id,
  });
  return c.json({ ok: true });
});

/* -- Email verification --------------------------------------------------- */

authRoutes.post("/send-verify-email", requireAuth, (c) => {
  const user = currentUser(c);
  const t = randomToken();
  db.prepare(
    `INSERT INTO email_verify_tokens (token, user_id, created_at, expires_at)
     VALUES (?, ?, ?, ?)`,
  ).run(
    t,
    user.id,
    nowIso(),
    new Date(Date.now() + 24 * 3600_000).toISOString(),
  );
  console.log(
    `\n[auth] verify email for ${user.email}: ` +
      `http://localhost:5173/#/auth/verify?token=${t}\n`,
  );
  return c.json({ ok: true, devToken: t });
});

authRoutes.post("/verify-email", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = z.object({ token: z.string() }).safeParse(body);
  if (!parsed.success) return c.json({ error: "invalid body" }, 400);
  const row = db
    .prepare(
      `SELECT token, user_id, expires_at, used_at
         FROM email_verify_tokens WHERE token = ?`,
    )
    .get(parsed.data.token) as
    | { user_id: string; expires_at: string; used_at: string | null }
    | undefined;
  if (!row) return c.json({ error: "invalid_token" }, 400);
  if (row.used_at) return c.json({ error: "token_already_used" }, 400);
  if (row.expires_at < nowIso()) return c.json({ error: "token_expired" }, 400);
  markEmailVerified(row.user_id);
  db.prepare(
    "UPDATE email_verify_tokens SET used_at = ? WHERE token = ?",
  ).run(nowIso(), parsed.data.token);
  return c.json({ ok: true });
});

/* -- MFA ----------------------------------------------------------------- */

authRoutes.post("/mfa/setup", requireAuth, (c) => {
  const user = currentUser(c);
  const secret = randomSecret();
  setMfaSecret(user.id, secret);
  return c.json({
    secret,
    otpauthUrl: otpauthUrl("Gutu", user.email, secret),
  });
});

authRoutes.post("/mfa/enable", requireAuth, async (c) => {
  const user = currentUser(c);
  const body = await c.req.json().catch(() => null);
  const parsed = z.object({ code: z.string() }).safeParse(body);
  if (!parsed.success) return c.json({ error: "invalid body" }, 400);
  const full = getUserById(user.id);
  if (!full?.mfa_secret) return c.json({ error: "mfa_not_set_up" }, 400);
  const valid = await verifyTotp(full.mfa_secret, parsed.data.code);
  if (!valid) return c.json({ error: "invalid_code" }, 400);
  setMfaEnabled(user.id, true);
  recordAudit({
    actor: user.email,
    action: "auth.mfa.enabled",
    resource: "auth.user",
    recordId: user.id,
  });
  return c.json({ ok: true });
});

authRoutes.post("/mfa/disable", requireAuth, async (c) => {
  const user = currentUser(c);
  const body = await c.req.json().catch(() => null);
  const parsed = z.object({ code: z.string() }).safeParse(body);
  if (!parsed.success) return c.json({ error: "invalid body" }, 400);
  const full = getUserById(user.id);
  if (!full?.mfa_secret) return c.json({ error: "mfa_not_set_up" }, 400);
  const valid = await verifyTotp(full.mfa_secret, parsed.data.code);
  if (!valid) return c.json({ error: "invalid_code" }, 400);
  setMfaEnabled(user.id, false);
  setMfaSecret(user.id, null);
  recordAudit({
    actor: user.email,
    action: "auth.mfa.disabled",
    resource: "auth.user",
    recordId: user.id,
  });
  return c.json({ ok: true });
});

authRoutes.get("/mfa/status", requireAuth, (c) => {
  const user = currentUser(c);
  const full = getUserById(user.id);
  return c.json({
    enabled: !!full?.mfa_enabled,
    setupStarted: !!full?.mfa_secret,
  });
});

/* -- Tenant memberships ---------------------------------------------------- */

/** List all tenants the current user is a member of, plus their active tenant
 *  (derived from session's `tenant_id`). */
authRoutes.get("/memberships", requireAuth, async (c) => {
  const user = currentUser(c);
  const memberships = await listMembershipsForUser(user.id);
  const token = c.get("token") as string | undefined;
  let active: Awaited<ReturnType<typeof getTenant>> = null;
  if (token) {
    const db = dbx();
    const prefix = db.kind === "postgres" ? "public." : "";
    const row = await db.get<{ tenant_id: string | null }>(
      `SELECT tenant_id FROM ${prefix}sessions WHERE token = ?`,
      [token],
    );
    if (row?.tenant_id) active = await getTenant(row.tenant_id);
  }
  return c.json({
    tenants: memberships.map((m) => ({ ...m.tenant, role: m.role })),
    active: active ?? null,
  });
});

const SwitchBody = z.object({ tenantId: z.string().min(1) });

/** Switch the active tenant bound to the current session.
 *  - Verifies the user is a member of the target tenant.
 *  - Updates `sessions.tenant_id`.
 *  - Audits the event.
 *  - Rotates nothing else — the token stays valid.
 *  The frontend should clear caches and re-issue reads after switching. */
authRoutes.post("/switch-tenant", requireAuth, async (c) => {
  const user = currentUser(c);
  const body = await c.req.json().catch(() => null);
  const parsed = SwitchBody.safeParse(body);
  if (!parsed.success) return c.json({ error: "invalid body" }, 400);

  const target = await getTenant(parsed.data.tenantId);
  if (!target) return c.json({ error: "tenant_not_found" }, 404);

  const memberships = await listMembershipsForUser(user.id);
  const isMember = memberships.some((m) => m.tenant.id === target.id);
  if (!isMember && user.role !== "admin") {
    return c.json({ error: "forbidden" }, 403);
  }

  const db = dbx();
  const prefix = db.kind === "postgres" ? "public." : "";
  const token = c.get("token") as string;
  await db.run(
    `UPDATE ${prefix}sessions SET tenant_id = ? WHERE token = ?`,
    [target.id, token],
  );
  recordAudit({
    actor: user.email,
    action: "auth.tenant.switched",
    resource: "platform.tenant",
    recordId: target.id,
  });
  return c.json({ ok: true, active: target });
});
