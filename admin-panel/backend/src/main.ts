import { migrate } from "./migrations";
import { createApp } from "./server";
import { seedAll } from "./seed/run";
import { registerSocket, unregisterSocket, type SocketData } from "./lib/ws";
import { loadConfig } from "./config";
import { migrateGlobal, migrateTenantSchema } from "./tenancy/migrations";
import { ensureDefaultTenant, listTenants } from "./tenancy/provisioner";
import { bootstrapStorage } from "./storage";

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

// Bootstrap the storage registry BEFORE creating the app so routes that
// reach for the registry (uploads, presign, downloads) have adapters ready.
bootstrapStorage({
  filesRoot: cfg.filesRoot,
  publicBaseUrl: process.env.PUBLIC_BASE_URL ?? `http://127.0.0.1:${cfg.port}`,
  defaultTenantId: defaultTenant.id,
});

const app = createApp();
await seedAll({ force: process.env.SEED_FORCE === "1" });

const port = cfg.port;
console.log(
  `[gutu-backend] listening on http://127.0.0.1:${port} ` +
    `(${cfg.dbKind}, ${cfg.multisite ? "multisite" : "singlesite"}, default=${defaultTenant.slug})`,
);

import { resolveTenant } from "./tenancy/resolver";
import { dbx } from "./dbx";

/** Resolve a WebSocket upgrade's session + tenant. Returns null if the token
 *  is missing, unknown, or expired — caller refuses the upgrade in that case. */
async function resolveWsSession(req: Request): Promise<{
  userId: string;
  tenantId: string;
} | null> {
  const url = new URL(req.url);
  let token: string | null = null;
  const auth = req.headers.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) {
    token = auth.slice(7).trim();
  } else {
    token = url.searchParams.get("token");
  }
  if (!token) return null;
  const db = dbx();
  const prefix = db.kind === "postgres" ? "public." : "";
  const row = await db.get<{
    user_id: string;
    tenant_id: string | null;
    expires_at: string;
  }>(
    `SELECT user_id, tenant_id, expires_at FROM ${prefix}sessions WHERE token = ?`,
    [token],
  );
  if (!row) return null;
  if (row.expires_at && new Date(row.expires_at) < new Date()) return null;

  // Resolve tenant — session's bound tenant first, else strategy-based
  // fallback (subdomain/header/path/default). Always returns a tenant.
  const { tenant } = await resolveTenant({
    host: req.headers.get("host"),
    headers: Object.fromEntries(req.headers.entries()),
    pathname: url.pathname,
    sessionTenantId: row.tenant_id,
  });
  return { userId: row.user_id, tenantId: tenant.id };
}

Bun.serve<SocketData>({
  port,
  hostname: "127.0.0.1",
  async fetch(req, server) {
    const url = new URL(req.url);
    if (url.pathname === "/api/ws") {
      const session = await resolveWsSession(req);
      if (!session) {
        return new Response("unauthorized", { status: 401 });
      }
      const upgraded = server.upgrade(req, {
        data: { userId: session.userId, tenantId: session.tenantId },
      });
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
