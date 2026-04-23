import type { Context, MiddlewareHandler } from "hono";
import { resolveTenant } from "./resolver";
import { runWithTenant, type TenantContext } from "./context";
import { dbx } from "../dbx";
import { loadConfig } from "../config";

/** Extract a bearer token, look up its session, return the associated tenant id. */
async function sessionTenantId(c: Context): Promise<string | null> {
  const auth = c.req.header("authorization");
  if (!auth || !auth.toLowerCase().startsWith("bearer ")) return null;
  const token = auth.slice(7).trim();
  if (!token) return null;
  const db = dbx();
  const cfg = loadConfig();
  const prefix = db.kind === "postgres" ? "public." : "";
  const row = await db.get<{ tenant_id: string | null; expires_at: string }>(
    `SELECT tenant_id, expires_at FROM ${prefix}sessions WHERE token = ?`,
    [token],
  );
  if (!row) return null;
  if (row.expires_at && new Date(row.expires_at) < new Date()) return null;
  void cfg;
  return row.tenant_id;
}

/** Hono middleware — runs the rest of the request inside a TenantContext. */
export function tenantMiddleware(): MiddlewareHandler {
  return async (c, next) => {
    const url = new URL(c.req.url);
    const host = c.req.header("host") ?? url.host ?? null;
    const sessionTenant = await sessionTenantId(c);
    const resolved = await resolveTenant({
      host,
      headers: Object.fromEntries(
        Object.entries(c.req.header() ?? {}).map(([k, v]) => [k.toLowerCase(), v as string]),
      ),
      pathname: url.pathname,
      sessionTenantId: sessionTenant,
    });
    const ctx: TenantContext = {
      tenantId: resolved.tenant.id,
      slug: resolved.tenant.slug,
      name: resolved.tenant.name,
      schema: resolved.tenant.schemaName,
    };
    c.set("tenant", ctx);
    await runWithTenant(ctx, () => next());
  };
}
