import { randomUUID } from "node:crypto";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { loadConfig } from "../config";
import { dbx } from "../dbx";
import { migrateTenantSchema } from "./migrations";

export interface Tenant {
  id: string;
  slug: string;
  name: string;
  schemaName: string;
  status: "active" | "suspended" | "archived";
  plan: string;
  settings: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

interface TenantRow {
  id: string;
  slug: string;
  name: string;
  schema_name: string;
  status: string;
  plan: string;
  settings: string | Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

function hydrate(row: TenantRow): Tenant {
  const s =
    typeof row.settings === "string"
      ? ((): Record<string, unknown> => {
          try { return JSON.parse(row.settings) as Record<string, unknown>; }
          catch { return {}; }
        })()
      : (row.settings as Record<string, unknown> | null) ?? {};
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    schemaName: row.schema_name,
    status: (row.status as Tenant["status"]) ?? "active",
    plan: row.plan ?? "free",
    settings: s,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Validate + normalize a slug for use as a URL fragment and Postgres schema
 *  identifier. Schema identifiers must match `[a-z_][a-z0-9_]{0,62}`. */
export function normalizeSlug(raw: string): string {
  const s = raw.toLowerCase().trim().replace(/[^a-z0-9_-]/g, "-").replace(/^-+|-+$/g, "");
  if (!/^[a-z][a-z0-9_-]{1,62}$/.test(s)) {
    throw new Error(
      `Invalid tenant slug "${raw}". Must start with a letter, 2-63 chars, a-z/0-9/- only.`,
    );
  }
  return s;
}

export function schemaForSlug(slug: string): string {
  const cfg = loadConfig();
  return `${cfg.tenantSchemaPrefix}${slug.replace(/-/g, "_")}`;
}

/* ------------------------------------------------------------------ */
/* Read                                                                */
/* ------------------------------------------------------------------ */

export async function listTenants(): Promise<Tenant[]> {
  const db = dbx();
  const prefix = db.kind === "postgres" ? "public." : "";
  const rows = await db.all<TenantRow>(
    `SELECT * FROM ${prefix}tenants ORDER BY name ASC`,
  );
  return rows.map(hydrate);
}

export async function getTenant(id: string): Promise<Tenant | null> {
  const db = dbx();
  const prefix = db.kind === "postgres" ? "public." : "";
  const row = await db.get<TenantRow>(
    `SELECT * FROM ${prefix}tenants WHERE id = ?`,
    [id],
  );
  return row ? hydrate(row) : null;
}

export async function getTenantBySlug(slug: string): Promise<Tenant | null> {
  const db = dbx();
  const prefix = db.kind === "postgres" ? "public." : "";
  const row = await db.get<TenantRow>(
    `SELECT * FROM ${prefix}tenants WHERE slug = ?`,
    [slug],
  );
  return row ? hydrate(row) : null;
}

export async function getTenantByDomain(domain: string): Promise<Tenant | null> {
  const db = dbx();
  const prefix = db.kind === "postgres" ? "public." : "";
  const row = await db.get<TenantRow>(
    `SELECT t.* FROM ${prefix}tenants t
     JOIN ${prefix}tenant_domains d ON d.tenant_id = t.id
     WHERE d.domain = ?`,
    [domain.toLowerCase()],
  );
  return row ? hydrate(row) : null;
}

export async function listMembershipsForUser(userId: string): Promise<
  { tenant: Tenant; role: string }[]
> {
  const db = dbx();
  const prefix = db.kind === "postgres" ? "public." : "";
  const rows = await db.all<TenantRow & { mem_role: string }>(
    `SELECT t.*, m.role AS mem_role
     FROM ${prefix}tenant_memberships m
     JOIN ${prefix}tenants t ON t.id = m.tenant_id
     WHERE m.user_id = ?
     ORDER BY t.name ASC`,
    [userId],
  );
  return rows.map((r) => ({ tenant: hydrate(r), role: r.mem_role }));
}

/* ------------------------------------------------------------------ */
/* Create                                                              */
/* ------------------------------------------------------------------ */

export interface CreateTenantInput {
  slug: string;
  name: string;
  plan?: string;
  initialOwnerUserId?: string;
  settings?: Record<string, unknown>;
}

export async function createTenant(input: CreateTenantInput): Promise<Tenant> {
  const slug = normalizeSlug(input.slug);
  const existing = await getTenantBySlug(slug);
  if (existing) throw new Error(`Tenant with slug "${slug}" already exists`);

  const db = dbx();
  const id = randomUUID();
  const schemaName = schemaForSlug(slug);
  const now = new Date().toISOString();
  const prefix = db.kind === "postgres" ? "public." : "";

  await db.transaction(async (tx) => {
    await tx.run(
      `INSERT INTO ${prefix}tenants (id, slug, name, schema_name, status, plan, settings, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?)`,
      [
        id,
        slug,
        input.name,
        schemaName,
        input.plan ?? "free",
        JSON.stringify(input.settings ?? {}),
        now,
        now,
      ],
    );
    if (input.initialOwnerUserId) {
      await tx.run(
        `INSERT INTO ${prefix}tenant_memberships (tenant_id, user_id, role, joined_at)
         VALUES (?, ?, 'owner', ?)`,
        [id, input.initialOwnerUserId, now],
      );
    }
  });

  // Provision the schema (Postgres) or a conceptual tenant (SQLite).
  await migrateTenantSchema(schemaName);

  // Per-tenant file directory.
  const cfg = loadConfig();
  const dir = path.join(cfg.filesRoot, schemaName);
  try {
    await mkdir(dir, { recursive: true });
  } catch {
    /* already exists */
  }

  const created = await getTenant(id);
  if (!created) throw new Error("Created tenant could not be re-read");
  return created;
}

/* ------------------------------------------------------------------ */
/* Update / lifecycle                                                  */
/* ------------------------------------------------------------------ */

export async function updateTenant(
  id: string,
  patch: Partial<Pick<Tenant, "name" | "plan" | "status" | "settings">>,
): Promise<Tenant> {
  const current = await getTenant(id);
  if (!current) throw new Error(`Tenant ${id} not found`);
  const db = dbx();
  const prefix = db.kind === "postgres" ? "public." : "";
  const now = new Date().toISOString();
  const next = { ...current, ...patch };
  await db.run(
    `UPDATE ${prefix}tenants SET name = ?, plan = ?, status = ?, settings = ?, updated_at = ? WHERE id = ?`,
    [
      next.name,
      next.plan,
      next.status,
      JSON.stringify(next.settings),
      now,
      id,
    ],
  );
  return (await getTenant(id))!;
}

export async function addMembership(
  tenantId: string,
  userId: string,
  role = "member",
): Promise<void> {
  const db = dbx();
  const prefix = db.kind === "postgres" ? "public." : "";
  const now = new Date().toISOString();
  // INSERT ... ON CONFLICT / INSERT OR IGNORE for idempotency.
  if (db.kind === "postgres") {
    await db.run(
      `INSERT INTO ${prefix}tenant_memberships (tenant_id, user_id, role, joined_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT (tenant_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
      [tenantId, userId, role, now],
    );
  } else {
    await db.run(
      `INSERT OR REPLACE INTO tenant_memberships (tenant_id, user_id, role, joined_at)
       VALUES (?, ?, ?, ?)`,
      [tenantId, userId, role, now],
    );
  }
}

export async function removeMembership(tenantId: string, userId: string): Promise<void> {
  const db = dbx();
  const prefix = db.kind === "postgres" ? "public." : "";
  await db.run(
    `DELETE FROM ${prefix}tenant_memberships WHERE tenant_id = ? AND user_id = ?`,
    [tenantId, userId],
  );
}

export async function setPrimaryDomain(
  tenantId: string,
  domain: string,
): Promise<void> {
  const db = dbx();
  const prefix = db.kind === "postgres" ? "public." : "";
  const now = new Date().toISOString();
  await db.transaction(async (tx) => {
    await tx.run(
      `UPDATE ${prefix}tenant_domains SET is_primary = 0 WHERE tenant_id = ?`,
      [tenantId],
    );
    if (tx.kind === "postgres") {
      await tx.run(
        `INSERT INTO ${prefix}tenant_domains (domain, tenant_id, is_primary, created_at)
         VALUES (?, ?, 1, ?)
         ON CONFLICT (domain) DO UPDATE SET tenant_id = EXCLUDED.tenant_id, is_primary = 1`,
        [domain.toLowerCase(), tenantId, now],
      );
    } else {
      await tx.run(
        `INSERT OR REPLACE INTO tenant_domains (domain, tenant_id, is_primary, created_at)
         VALUES (?, ?, 1, ?)`,
        [domain.toLowerCase(), tenantId, now],
      );
    }
  });
}

/* ------------------------------------------------------------------ */
/* Off-board                                                           */
/* ------------------------------------------------------------------ */

/** Archive a tenant — hides it from switchers but keeps data.
 *  Safe, reversible. */
export async function archiveTenant(id: string): Promise<void> {
  await updateTenant(id, { status: "archived" });
}

/** Destructive — drops the tenant schema, memberships, domains, files.
 *  Irreversible. Requires explicit confirmation at the HTTP layer. */
export async function deleteTenantHard(id: string): Promise<void> {
  const tenant = await getTenant(id);
  if (!tenant) return;
  const db = dbx();
  const prefix = db.kind === "postgres" ? "public." : "";
  const cfg = loadConfig();

  await db.transaction(async (tx) => {
    await tx.run(`DELETE FROM ${prefix}tenant_memberships WHERE tenant_id = ?`, [id]);
    await tx.run(`DELETE FROM ${prefix}tenant_domains WHERE tenant_id = ?`, [id]);
    await tx.run(`DELETE FROM ${prefix}sessions WHERE tenant_id = ?`, [id]);
    await tx.run(`DELETE FROM ${prefix}tenants WHERE id = ?`, [id]);
  });

  if (db.kind === "postgres") {
    try {
      await db.exec(`DROP SCHEMA IF EXISTS ${tenant.schemaName} CASCADE`);
    } catch (err) {
      console.error(`[provisioner] drop schema failed`, err);
    }
  }

  // Delete per-tenant files directory.
  try {
    await rm(path.join(cfg.filesRoot, tenant.schemaName), { recursive: true, force: true });
  } catch {
    /* missing is fine */
  }
}

/* ------------------------------------------------------------------ */
/* Bootstrap                                                           */
/* ------------------------------------------------------------------ */

/** Ensure the default tenant exists. Called once at boot. */
export async function ensureDefaultTenant(): Promise<Tenant> {
  const cfg = loadConfig();
  let t = await getTenantBySlug(cfg.defaultTenantSlug);
  if (t) return t;
  t = await createTenant({
    slug: cfg.defaultTenantSlug,
    name: "Main",
    plan: "builtin",
  });
  return t;
}

/** In single-site mode every authenticated user implicitly belongs to the
 *  default tenant. This backfills memberships for any existing users that
 *  predate multi-tenancy being installed. */
export async function backfillDefaultMemberships(): Promise<number> {
  const cfg = loadConfig();
  const tenant = await ensureDefaultTenant();
  const db = dbx();
  const prefix = db.kind === "postgres" ? "public." : "";
  const users = await db.all<{ id: string; role: string }>(
    `SELECT u.id, u.role
     FROM ${prefix}users u
     WHERE NOT EXISTS (
       SELECT 1 FROM ${prefix}tenant_memberships m
       WHERE m.user_id = u.id AND m.tenant_id = ?
     )`,
    [tenant.id],
  );
  void cfg;
  const now = new Date().toISOString();
  for (const u of users) {
    const role = u.role === "admin" ? "owner" : u.role === "viewer" ? "viewer" : "member";
    await addMembership(tenant.id, u.id, role);
    void now;
  }
  return users.length;
}
