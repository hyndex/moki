import type { Context, Next } from "hono";
import { getSessionUser, type AuthUser } from "../lib/auth";
import { db, nowIso } from "../db";
import { createHash } from "node:crypto";

/** Extract the Bearer token, attach a user.
 *
 *  We accept TWO token kinds via the same `Authorization: Bearer …`
 *  header:
 *    1. **Session tokens** — opaque random strings issued by login.
 *       Looked up in `sessions` table. The default for browser users.
 *    2. **API tokens** — long-lived tokens prefixed `gtu_`. Looked
 *       up in `api_tokens` (by SHA-256 of the token). Carry scopes
 *       which are attached to the request context for downstream
 *       per-route enforcement.
 *
 *  When an API token authenticates, we synthesize an `AuthUser` from
 *  the `created_by` email so the rest of the auth path (currentUser,
 *  recordAudit, ACL lookups) doesn't need to know which kind it is.
 *  Scopes are exposed via `currentTokenScopes(c)` for routes that
 *  want to enforce them. */
export async function requireAuth(c: Context, next: Next) {
  const header = c.req.header("authorization") ?? "";
  const m = /^Bearer\s+(.+)$/i.exec(header);
  if (!m) return c.json({ error: "unauthenticated" }, 401);
  const token = m[1];
  const user = await resolveAuthUser(token);
  if (!user) return c.json({ error: "invalid or expired session" }, 401);
  c.set("user", user.user);
  c.set("token", token);
  if (user.kind === "api-token") {
    c.set("apiTokenId", user.tokenId);
    c.set("apiTokenScopes", user.scopes);
  }
  await next();
}

/** Optional variant — attaches user if the token is valid, never rejects. */
export async function maybeAuth(c: Context, next: Next) {
  const header = c.req.header("authorization") ?? "";
  const m = /^Bearer\s+(.+)$/i.exec(header);
  if (m) {
    const user = await resolveAuthUser(m[1]);
    if (user) {
      c.set("user", user.user);
      c.set("token", m[1]);
      if (user.kind === "api-token") {
        c.set("apiTokenId", user.tokenId);
        c.set("apiTokenScopes", user.scopes);
      }
    }
  }
  await next();
}

export function currentUser(c: Context): AuthUser {
  return c.get("user") as AuthUser;
}

export interface ApiTokenScope { resource: string; verbs: string[]; }

/** Returns the API token scopes if the request was authenticated with
 *  an API token; null for session-token requests. Routes that want to
 *  restrict to specific scopes call `requireScope(c, resource, verb)`
 *  to enforce. */
export function currentTokenScopes(c: Context): ApiTokenScope[] | null {
  return (c.get("apiTokenScopes") as ApiTokenScope[] | undefined) ?? null;
}

export function tokenAllows(
  scopes: ApiTokenScope[] | null,
  resource: string,
  verb: string,
): boolean {
  if (scopes === null) return true; // session-token = full access
  for (const s of scopes) {
    if (s.resource !== resource && s.resource !== "*") continue;
    if (s.verbs.includes(verb) || s.verbs.includes("*")) return true;
  }
  return false;
}

interface ResolvedAuth {
  kind: "session" | "api-token";
  user: AuthUser;
  tokenId?: string;
  scopes?: ApiTokenScope[];
}

async function resolveAuthUser(token: string): Promise<ResolvedAuth | null> {
  // Session token first — the common path.
  const sessUser = getSessionUser(token);
  if (sessUser) return { kind: "session", user: sessUser };

  // API token — must match the `gtu_` prefix to even bother looking
  // up. Prevents pointless DB queries for malformed bearer tokens.
  if (!token.startsWith("gtu_")) return null;
  const hash = createHash("sha256").update(token).digest("hex");
  const row = db
    .prepare(
      `SELECT id, tenant_id, scopes, created_by, expires_at, revoked_at
       FROM api_tokens
       WHERE token_hash = ?`,
    )
    .get(hash) as
    | {
        id: string;
        tenant_id: string;
        scopes: string;
        created_by: string;
        expires_at: string | null;
        revoked_at: string | null;
      }
    | undefined;
  if (!row) return null;
  if (row.revoked_at) return null;
  if (row.expires_at && new Date(row.expires_at) < new Date()) return null;
  // Touch last_used_at — best-effort, don't block the request on it.
  try {
    db.prepare(`UPDATE api_tokens SET last_used_at = ? WHERE id = ?`).run(nowIso(), row.id);
  } catch { /* ignore */ }
  // Resolve the creator email → AuthUser. API tokens always
  // impersonate their creator for audit clarity.
  const userRow = db
    .prepare(
      `SELECT id, email, name, role FROM users WHERE LOWER(email) = LOWER(?)`,
    )
    .get(row.created_by) as AuthUser | undefined;
  if (!userRow) return null;
  let scopes: ApiTokenScope[] = [];
  try { scopes = JSON.parse(row.scopes) as ApiTokenScope[]; } catch { /* tolerate */ }
  return {
    kind: "api-token",
    user: userRow,
    tokenId: row.id,
    scopes,
  };
}
