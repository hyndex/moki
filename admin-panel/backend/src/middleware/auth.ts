import type { Context, Next } from "hono";
import { getSessionUser, type AuthUser } from "../lib/auth";

/** Extract the Bearer token, look up the user, attach to the request. */
export async function requireAuth(c: Context, next: Next) {
  const header = c.req.header("authorization") ?? "";
  const m = /^Bearer\s+(.+)$/i.exec(header);
  if (!m) return c.json({ error: "unauthenticated" }, 401);
  const user = getSessionUser(m[1]);
  if (!user) return c.json({ error: "invalid or expired session" }, 401);
  c.set("user", user);
  c.set("token", m[1]);
  await next();
}

/** Optional variant — attaches user if the token is valid, never rejects. */
export async function maybeAuth(c: Context, next: Next) {
  const header = c.req.header("authorization") ?? "";
  const m = /^Bearer\s+(.+)$/i.exec(header);
  if (m) {
    const user = getSessionUser(m[1]);
    if (user) {
      c.set("user", user);
      c.set("token", m[1]);
    }
  }
  await next();
}

export function currentUser(c: Context): AuthUser {
  return c.get("user") as AuthUser;
}
