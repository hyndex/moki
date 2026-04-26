/** i18n REST API.
 *
 *  Routes:
 *    GET    /locales                     list locales with counts
 *    GET    /namespaces                  list namespaces with counts
 *    GET    /strings                     resolve a bag (?locale=&namespace=&base=)
 *    POST   /strings                     upsert one
 *    POST   /strings/bulk                bulk upsert (body: { locale, namespace, entries })
 *    DELETE /strings/:id                 delete one
 */

import { Hono } from "hono";
import { requireAuth } from "../middleware/auth";
import { getTenantContext } from "../tenancy/context";
import {
  I18nError,
  bulkUpsert,
  deleteString,
  listLocales,
  listNamespaces,
  resolveStrings,
  upsertString,
} from "../lib/i18n";

export const i18nRoutes = new Hono();
i18nRoutes.use("*", requireAuth);

function tenantId(): string {
  return getTenantContext()?.tenantId ?? "default";
}

function handle(err: unknown, c: Parameters<Parameters<typeof i18nRoutes.get>[1]>[0]) {
  if (err instanceof I18nError) return c.json({ error: err.message, code: err.code }, 400);
  throw err;
}

i18nRoutes.get("/locales", (c) => c.json({ rows: listLocales(tenantId()) }));

i18nRoutes.get("/namespaces", (c) => c.json({ rows: listNamespaces(tenantId()) }));

i18nRoutes.get("/strings", (c) => {
  const locale = c.req.query("locale") ?? "en";
  const namespace = c.req.query("namespace") ?? "app";
  const baseLocale = c.req.query("base") ?? "en";
  try {
    return c.json(
      resolveStrings({ tenantId: tenantId(), locale, namespace, baseLocale }),
    );
  } catch (err) {
    return handle(err, c) as never;
  }
});

i18nRoutes.post("/strings", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    const s = upsertString({
      tenantId: tenantId(),
      locale: String(body.locale ?? ""),
      namespace: typeof body.namespace === "string" ? body.namespace : undefined,
      key: String(body.key ?? ""),
      value: String(body.value ?? ""),
    });
    return c.json(s, 201);
  } catch (err) {
    return handle(err, c) as never;
  }
});

i18nRoutes.post("/strings/bulk", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    const out = bulkUpsert({
      tenantId: tenantId(),
      locale: String(body.locale ?? ""),
      namespace: typeof body.namespace === "string" ? body.namespace : undefined,
      entries: (body.entries as Record<string, string>) ?? {},
    });
    return c.json(out);
  } catch (err) {
    return handle(err, c) as never;
  }
});

i18nRoutes.delete("/strings/:id", (c) => {
  const ok = deleteString(tenantId(), c.req.param("id"));
  if (!ok) return c.json({ error: "not found" }, 404);
  return c.json({ ok: true });
});
