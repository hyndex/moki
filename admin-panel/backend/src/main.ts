import { migrate } from "./migrations";
import { createApp } from "./server";
import { seedAll } from "./seed/run";
import { registerSocket, unregisterSocket } from "@gutu-host/ws";
import { loadConfig } from "./config";
import { migrateGlobal, migrateTenantSchema } from "./tenancy/migrations";
import { ensureDefaultTenant, listTenants } from "./tenancy/provisioner";
import { bootstrapStorage } from "./storage";

// Mail plugin (kept in shell until extracted into its own gutu-plugin-mail-core).
import { migrateMail } from "./lib/mail/migrations";
import { ensureProviders } from "./lib/mail/oauth";
import { bootstrapMailJobs } from "./jobs";

import { markReady, startDrain } from "./host/lifecycle";

// Plugin loader: routes all lifecycle through a tiny contract. Plugins
// announce themselves via `package.json["gutuPlugins"]` (or env
// GUTU_PLUGINS); the loader auto-imports them, sorts by dependency,
// runs migrate / install / mount / start with per-plugin isolation
// (one plugin's failure doesn't bring down the rest), and surfaces
// status on /api/_plugins.
import {
  loadPlugins,
  runPluginMigrations,
  mountPluginRoutes,
  installPluginsIfNeeded,
  startPlugins,
  stopPlugins,
} from "./host/plugin-contract";
import { loadDiscoveredPlugins } from "./host/discover";
import { ensureTenantEnablementSchema } from "./host/tenant-enablement";
import { registerPluginWsRoutes, matchWsRoute } from "./host/ws-router";
import { pluginsRoutes, setActivePlugins } from "./routes/_plugins";

// Discover every plugin from package.json["gutuPlugins"] / env /
// monorepo scan. The HOST_PLUGINS list is no longer hardcoded — adding
// a plugin is `bun add @acme/gutu-foo` + appending to `gutuPlugins`.
const HOST_PLUGINS = await loadDiscoveredPlugins();

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

// Plugin migrations: each plugin owns its own tables. Topologically
// sorted by dependsOn so a plugin's tables exist before any plugin
// that depends on it runs. Failures quarantine the offending plugin
// (status reported via /api/_plugins) rather than aborting boot.
const orderedPlugins = loadPlugins(HOST_PLUGINS);
ensureTenantEnablementSchema();
await runPluginMigrations(orderedPlugins);
await installPluginsIfNeeded(orderedPlugins);  // one-shot per (plugin, version)
registerPluginWsRoutes(orderedPlugins);          // compile WS routing table
setActivePlugins(orderedPlugins);                 // make /api/_plugins aware

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

// Mail plugin bootstrapping: schema migrations, OAuth provider registry,
// and background job scheduler. These all gracefully no-op when the mail
// plugin isn't enabled — the migrations are idempotent.
migrateMail();
ensureProviders();
if (process.env.MAIL_DISABLE_JOBS !== "1") bootstrapMailJobs();

const app = createApp();

// Mount the operator-facing plugin admin endpoint. /api/_plugins
// surfaces every loaded plugin's manifest, status, errors, leases,
// ws routes, and per-tenant enablement. Wired into shell so it's
// always available even when individual plugins are quarantined.
app.route("/api/_plugins", pluginsRoutes);

// Mount every plugin's contributed routes under /api/<mountPath>. The
// shell no longer mounts any domain routes directly — every domain
// surface (workflows, webhooks, api-tokens, field-metadata, timeline,
// favorites, …) is contributed by a plugin discovered above.
mountPluginRoutes(orderedPlugins, app);

// Fire start hooks — each plugin spins up its own workers (notification
// dispatcher, scheduler, auto-email cron, workflow engine, …) inside
// its start() hook. Workers that need leader election use
// `withLeadership(name, fn)` from `@gutu-host/leader`.
await startPlugins(orderedPlugins);

// Boot done: flip readiness so /api/ready returns 200. /api/health
// has been returning 200 throughout — that's liveness, not readiness.
markReady();

// Graceful shutdown — flip readiness off, refuse new requests, wait
// for in-flight requests to finish (up to 25s), then run plugin stop
// hooks, then exit. Modern PaaS deployers send SIGTERM and wait
// `terminationGracePeriodSeconds` for the pod to clean up; this
// timeline matches that contract.
const shutdown = async (signal: string) => {
  console.log(`[gutu-backend] received ${signal}, beginning graceful drain`);
  await startDrain({
    drainMs: Number(process.env.DRAIN_TIMEOUT_MS ?? 25_000),
    onDrained: () => stopPlugins(orderedPlugins),
  });
  process.exit(0);
};
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

await seedAll({ force: process.env.SEED_FORCE === "1" });

const port = cfg.port;
console.log(
  `[gutu-backend] listening on http://127.0.0.1:${port} ` +
    `(${cfg.dbKind}, ${cfg.multisite ? "multisite" : "singlesite"}, default=${defaultTenant.slug})`,
);

import { resolveTenant } from "./tenancy/resolver";
import { dbx } from "./dbx";
import { effectiveRole } from "@gutu-host/acl";
import {
  yjsOnOpen,
  yjsOnMessage,
  yjsOnClose,
  type YjsSocketData,
} from "@gutu-plugin/editor-core";
import { db } from "./db";

// In-process workers (webhook dispatcher, timeline writer, workflow
// engine, notification dispatcher, auto-email scheduler, …) are owned
// by their plugins and started by `startPlugins(HOST_PLUGINS)` above.
// Nothing for the shell to start here.

/** Resolve a WebSocket upgrade's session + tenant. Returns null if the token
 *  is missing, unknown, or expired — caller refuses the upgrade in that case. */
async function resolveWsSession(req: Request): Promise<{
  userId: string;
  tenantId: string;
  userRole: string | null;
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
    role: string | null;
  }>(
    `SELECT s.user_id, s.tenant_id, s.expires_at, u.role
       FROM ${prefix}sessions s
       JOIN ${prefix}users u ON u.id = s.user_id
      WHERE s.token = ?`,
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
  return { userId: row.user_id, tenantId: tenant.id, userRole: row.role };
}

/** Match `/api/yjs/<resource>/<recordId>` for the editor sync upgrade. */
const YJS_PATH_RE = /^\/api\/yjs\/([^/]+)\/([^/]+)\/?$/;

/** Resolve a session for the Yjs upgrade, then verify the user has at
 *  least viewer role on the document. We also fetch a display name +
 *  email so the room's awareness tracks who's editing. */
async function resolveYjsSession(req: Request): Promise<
  | { ok: true; data: YjsSocketData }
  | { ok: false; status: number; body: string }
> {
  const url = new URL(req.url);
  const m = YJS_PATH_RE.exec(url.pathname);
  if (!m) return { ok: false, status: 404, body: "not found" };
  const resourceSlug = decodeURIComponent(m[1]);
  const recordId = decodeURIComponent(m[2]);
  // Resource slug is one of "spreadsheet" / "document" / "slides" /
  // "page" / "whiteboard". Map to the canonical resourceId we use in
  // editor_acl + records (e.g. "collab.page").
  const RESOURCE_MAP: Record<string, string> = {
    spreadsheet: "spreadsheet.workbook",
    document: "document.page",
    slides: "slides.deck",
    page: "collab.page",
    whiteboard: "whiteboard.canvas",
  };
  const resource = RESOURCE_MAP[resourceSlug];
  if (!resource) return { ok: false, status: 400, body: "unknown resource" };

  const session = await resolveWsSession(req);
  if (!session) return { ok: false, status: 401, body: "unauthorized" };

  const role = effectiveRole({
    resource,
    recordId,
    userId: session.userId,
    tenantId: session.tenantId,
    globalRole: session.userRole,
  });
  if (!role) return { ok: false, status: 403, body: "forbidden" };

  // Look up display fields for awareness.
  const userRow = db
    .prepare(`SELECT id, email, name FROM users WHERE id = ?`)
    .get(session.userId) as { id: string; email: string; name: string } | undefined;
  const name = userRow?.name ?? userRow?.email ?? "User";
  const email = userRow?.email ?? "";

  return {
    ok: true,
    data: {
      userId: session.userId,
      tenantId: session.tenantId,
      resource,
      recordId,
      role,
      user: {
        id: session.userId,
        name,
        email,
        color: pickColor(session.userId),
      },
    },
  };
}

/** Stable color per user id — used to paint that user's awareness
 *  cursor on every other client. Hash → palette index. */
const COLOR_PALETTE = [
  "#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6",
  "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#a855f7",
];
function pickColor(userId: string): string {
  let h = 0;
  for (let i = 0; i < userId.length; i++) {
    h = (h * 31 + userId.charCodeAt(i)) >>> 0;
  }
  return COLOR_PALETTE[h % COLOR_PALETTE.length];
}

/** Discriminated union covering both WebSocket flavours we serve. The
 *  Bun.serve generic forces `data` to a single type, so we widen here
 *  and discriminate inside the handlers. */
type SocketData = YjsSocketData | { userId: string; tenantId: string };

Bun.serve<SocketData>({
  port,
  hostname: "127.0.0.1",
  async fetch(req, server) {
    const url = new URL(req.url);

    // Editor real-time sync (Yjs) — per-document WebSocket rooms with
    // ACL enforcement at upgrade time.
    if (YJS_PATH_RE.test(url.pathname)) {
      const session = await resolveYjsSession(req);
      if (!session.ok) {
        return new Response(session.body, { status: session.status });
      }
      const upgraded = server.upgrade(req, { data: session.data });
      if (upgraded) return;
      return new Response("WebSocket upgrade failed", { status: 400 });
    }

    // Shell-level realtime (resource.changed events).
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
    async open(ws) {
      // Discriminate by socket data shape — Yjs sockets carry resource+
      // recordId, shell sockets don't.
      if ("resource" in ws.data && typeof ws.data.resource === "string") {
        await yjsOnOpen(ws as never);
      } else {
        registerSocket(ws as never);
      }
    },
    async close(ws) {
      if ("resource" in ws.data && typeof ws.data.resource === "string") {
        await yjsOnClose(ws as never);
      } else {
        unregisterSocket(ws as never);
      }
    },
    message(ws, message) {
      if ("resource" in ws.data && typeof ws.data.resource === "string") {
        yjsOnMessage(ws as never, message);
      }
      // Shell sockets don't accept inbound messages.
    },
  },
});
