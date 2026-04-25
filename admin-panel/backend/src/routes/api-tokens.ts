/** API tokens — long-lived bearer tokens for external integrations.
 *
 *  Differs from session tokens:
 *    - No 7-day expiry (configurable per-token, can be open-ended)
 *    - Carry SCOPES — array of `{ resource, verbs }` so you can mint
 *      a Zapier token limited to "crm.contact: read,create" only
 *    - Hashed in DB (SHA-256). Plaintext returned exactly once on
 *      create. Lookup by prefix for UI; auth path hashes incoming
 *      token + does a UNIQUE-indexed lookup on `token_hash`.
 *
 *  Scope examples:
 *    - `[{ resource: "crm.contact", verbs: ["read", "create"] }]`
 *    - `[{ resource: "*", verbs: ["read"] }]` (read-only firehose)
 *    - `[{ resource: "*", verbs: ["*"] }]` (full power, equivalent to admin session) */
import { Hono } from "hono";
import { requireAuth, currentUser } from "../middleware/auth";
import { getTenantContext } from "../tenancy/context";
import { db, nowIso } from "../db";
import { uuid } from "../lib/id";
import { recordAudit } from "../lib/audit";
import { createHash } from "node:crypto";

export const apiTokenRoutes = new Hono();
apiTokenRoutes.use("*", requireAuth);

interface TokenRow {
  id: string;
  tenant_id: string;
  name: string;
  token_hash: string;
  token_prefix: string;
  scopes: string;
  created_by: string;
  created_at: string;
  expires_at: string | null;
  last_used_at: string | null;
  revoked_at: string | null;
}

function tenantId(): string {
  return getTenantContext()?.tenantId ?? "default";
}

function rowToPublic(r: TokenRow): Record<string, unknown> {
  let scopes: unknown = [];
  try { scopes = JSON.parse(r.scopes); } catch { /* tolerate */ }
  return {
    id: r.id,
    tenantId: r.tenant_id,
    name: r.name,
    prefix: r.token_prefix,
    scopes,
    createdBy: r.created_by,
    createdAt: r.created_at,
    expiresAt: r.expires_at,
    lastUsedAt: r.last_used_at,
    revokedAt: r.revoked_at,
    status: r.revoked_at
      ? "revoked"
      : (r.expires_at && new Date(r.expires_at) < new Date()
          ? "expired"
          : "active"),
  };
}

apiTokenRoutes.get("/", (c) => {
  const rows = db
    .prepare(
      `SELECT * FROM api_tokens WHERE tenant_id = ? ORDER BY created_at DESC`,
    )
    .all(tenantId()) as TokenRow[];
  return c.json({ rows: rows.map(rowToPublic) });
});

apiTokenRoutes.post("/", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as {
    name?: string;
    scopes?: Array<{ resource: string; verbs: string[] }>;
    expiresAt?: string | null;
  };
  if (!body.name || typeof body.name !== "string") {
    return c.json({ error: "name required" }, 400);
  }
  if (!Array.isArray(body.scopes) || body.scopes.length === 0) {
    return c.json({ error: "scopes[] required (use [{ resource: '*', verbs: ['*'] }] for full access)" }, 400);
  }
  // Generate a token: 48 random base64url-safe chars. Prefix is `gtu_`
  // followed by 4 random chars for at-a-glance lookup, then the rest.
  // We DO store the prefix unhashed (it's not secret on its own — to
  // authenticate you need the rest).
  const rawSuffix = crypto.randomUUID().replaceAll("-", "") + crypto.randomUUID().replaceAll("-", "");
  const token = `gtu_${rawSuffix.slice(0, 48)}`;
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const tokenPrefix = token.slice(0, 12); // "gtu_xxxxxxxx"
  const id = uuid();
  const now = nowIso();
  const user = currentUser(c);
  db.prepare(
    `INSERT INTO api_tokens
       (id, tenant_id, name, token_hash, token_prefix, scopes, created_by, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    tenantId(),
    body.name.slice(0, 200),
    tokenHash,
    tokenPrefix,
    JSON.stringify(body.scopes),
    user.email,
    now,
    body.expiresAt ?? null,
  );
  recordAudit({
    actor: user.email,
    action: "api-token.created",
    resource: "api-token",
    recordId: id,
    payload: { name: body.name, scopes: body.scopes },
  });
  // Plaintext returned ONCE.
  const row = db.prepare(`SELECT * FROM api_tokens WHERE id = ?`).get(id) as TokenRow;
  return c.json({ ...rowToPublic(row), token }, 201);
});

apiTokenRoutes.delete("/:id", (c) => {
  const id = c.req.param("id");
  const tid = tenantId();
  const result = db
    .prepare(`UPDATE api_tokens SET revoked_at = ? WHERE id = ? AND tenant_id = ? AND revoked_at IS NULL`)
    .run(nowIso(), id, tid);
  if (result.changes === 0) {
    return c.json({ error: "not found or already revoked" }, 404);
  }
  const user = currentUser(c);
  recordAudit({
    actor: user.email,
    action: "api-token.revoked",
    resource: "api-token",
    recordId: id,
  });
  return c.json({ ok: true });
});
