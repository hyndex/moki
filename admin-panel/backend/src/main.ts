import { migrate } from "./migrations";
import { createApp } from "./server";
import { seedAll } from "./seed/run";
import { registerSocket, unregisterSocket } from "./lib/ws";
import { loadConfig } from "./config";
import { migrateGlobal, migrateTenantSchema } from "./tenancy/migrations";
import { ensureDefaultTenant, listTenants } from "./tenancy/provisioner";

const cfg = loadConfig();

/* Migrations.
 *
 * Single-site SQLite: existing legacy migrate() builds sync tables.
 * Multi-site or Postgres: async migrateGlobal() + per-tenant schema migration. */
if (cfg.dbKind === "sqlite" && !cfg.multisite) {
  migrate();
  await migrateGlobal(); // idempotent; adds tenants/memberships tables
} else {
  await migrateGlobal();
}

// Ensure default tenant exists and its schema is migrated.
const defaultTenant = await ensureDefaultTenant();
await migrateTenantSchema(defaultTenant.schemaName);

// Ensure all existing users have at least the default-tenant membership.
const { backfillDefaultMemberships } = await import("./tenancy/provisioner");
const backfilled = await backfillDefaultMemberships();
if (backfilled > 0) console.log(`[tenancy] backfilled ${backfilled} default memberships`);

// In multisite, migrate every existing tenant schema on boot (catches
// app-level schema changes shipped in a release).
if (cfg.multisite) {
  for (const t of await listTenants()) {
    try { await migrateTenantSchema(t.schemaName); }
    catch (err) { console.error(`[boot] tenant ${t.slug} migration failed`, err); }
  }
}

const app = createApp();
await seedAll({ force: process.env.SEED_FORCE === "1" });

const port = cfg.port;
console.log(
  `[gutu-backend] listening on http://127.0.0.1:${port} ` +
    `(${cfg.dbKind}, ${cfg.multisite ? "multisite" : "singlesite"}, default=${defaultTenant.slug})`,
);

import { resolveTenant } from "./tenancy/resolver";
import { dbx } from "./dbx";

async function resolveWsTenantId(req: Request): Promise<string | null> {
  // Parse auth from either Authorization header or `?token=` query param
  // (WebSockets can't set headers in all browsers).
  const url = new URL(req.url);
  let token: string | null = null;
  const auth = req.headers.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) {
    token = auth.slice(7).trim();
  } else {
    token = url.searchParams.get("token");
  }
  let sessionTenantId: string | null = null;
  if (token) {
    const db = dbx();
    const prefix = db.kind === "postgres" ? "public." : "";
    const row = await db.get<{ tenant_id: string | null }>(
      `SELECT tenant_id FROM ${prefix}sessions WHERE token = ?`,
      [token],
    );
    sessionTenantId = row?.tenant_id ?? null;
  }
  const host = req.headers.get("host");
  const { tenant } = await resolveTenant({
    host,
    headers: Object.fromEntries(req.headers.entries()),
    pathname: url.pathname,
    sessionTenantId,
  });
  return tenant.id;
}

Bun.serve({
  port,
  hostname: "127.0.0.1",
  async fetch(req, server) {
    const url = new URL(req.url);
    if (url.pathname === "/api/ws") {
      const tenantId = await resolveWsTenantId(req);
      const upgraded = server.upgrade(req, { data: { tenantId } });
      if (upgraded) return;
      return new Response("WebSocket upgrade failed", { status: 400 });
    }
    return app.fetch(req, { server });
  },
  websocket: {
    open(ws) {
      registerSocket(ws as never);
    },
    close(ws) {
      unregisterSocket(ws as never);
    },
    message() {
      // client-initiated messages are currently ignored
    },
  },
});
