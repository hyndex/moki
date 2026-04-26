import { db } from "./db";

/** All schema lives here. Every resource goes through a single generic
 *  `records` table keyed by (resource, id), with the record body stored as
 *  JSON. That keeps adding a resource zero-effort and lets the generic CRUD
 *  handler be one file. For hot queries we index json-extracted fields when
 *  needed (see query.ts).
 *
 *  Users + sessions are proper tables because auth touches them on every
 *  request. */
export function migrate(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS meta (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS records (
      resource   TEXT NOT NULL,
      id         TEXT NOT NULL,
      data       TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (resource, id)
    );
    CREATE INDEX IF NOT EXISTS records_resource_idx ON records(resource);
    CREATE INDEX IF NOT EXISTS records_updated_idx  ON records(resource, updated_at DESC);

    CREATE TABLE IF NOT EXISTS users (
      id            TEXT PRIMARY KEY,
      email         TEXT NOT NULL UNIQUE,
      name          TEXT NOT NULL,
      role          TEXT NOT NULL DEFAULT 'member',
      password_hash TEXT NOT NULL,
      email_verified_at TEXT,
      mfa_secret    TEXT,
      mfa_enabled   INTEGER NOT NULL DEFAULT 0,
      created_at    TEXT NOT NULL,
      updated_at    TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS users_email_idx ON users(LOWER(email));

    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      token      TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      used_at    TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS pw_reset_user_idx ON password_reset_tokens(user_id);

    CREATE TABLE IF NOT EXISTS email_verify_tokens (
      token      TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      used_at    TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token      TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      ua         TEXT,
      ip         TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);

    -- Audit events with hash-chained tamper-evidence. Each row carries
    -- a SHA-256 hash of (prev_hash + canonical-row-bytes); breaking the
    -- chain requires recomputing every subsequent row's hash, which is
    -- detectable via verifyAuditChain(). prev_hash of the genesis row
    -- is the literal string "GENESIS".
    CREATE TABLE IF NOT EXISTS audit_events (
      id          TEXT PRIMARY KEY,
      actor       TEXT NOT NULL,
      action      TEXT NOT NULL,
      resource    TEXT NOT NULL,
      record_id   TEXT,
      level       TEXT NOT NULL DEFAULT 'info',
      ip          TEXT,
      occurred_at TEXT NOT NULL,
      payload     TEXT,
      prev_hash   TEXT NOT NULL DEFAULT 'GENESIS',
      hash        TEXT NOT NULL DEFAULT ''
    );
    CREATE INDEX IF NOT EXISTS audit_occurred_idx ON audit_events(occurred_at DESC);

    -- editor_acl now owned by editor-core plugin (db/migrate.ts).
    -- saved_views now owned by saved-views-core plugin.
    -- The shell schema only carries cross-cutting concerns: meta,
    -- records, users, sessions, audit_events, password_reset_tokens,
    -- email_verify_tokens, roles, user_roles, i18n_strings.

    -- Roles + permission rules. Roles are tenant-scoped. Each role
    -- carries a JSON policy — an array of rules of the shape:
    --   { resource, verbs, scope, condition?, fieldMask? }
    -- with five composition layers: object-level, field-level,
    -- row-level (predicate), tenant-wide flag, and assignability.
    CREATE TABLE IF NOT EXISTS roles (
      id          TEXT PRIMARY KEY,
      tenant_id   TEXT NOT NULL,
      name        TEXT NOT NULL,
      description TEXT,
      flags       TEXT,                       -- JSON: { canUpdateAllSettings, canReadAllRecords, ... }
      policy      TEXT NOT NULL,              -- JSON: PolicyRule[]
      created_by  TEXT NOT NULL,
      created_at  TEXT NOT NULL,
      updated_at  TEXT NOT NULL,
      UNIQUE (tenant_id, name)
    );
    CREATE INDEX IF NOT EXISTS roles_tenant_idx ON roles(tenant_id);

    -- User → Role assignments per tenant.
    CREATE TABLE IF NOT EXISTS user_roles (
      tenant_id   TEXT NOT NULL,
      user_id     TEXT NOT NULL,
      role_id     TEXT NOT NULL,
      assigned_by TEXT NOT NULL,
      assigned_at TEXT NOT NULL,
      PRIMARY KEY (tenant_id, user_id, role_id),
      FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS user_roles_user_idx ON user_roles(user_id);

    -- record_links, timeline_events, user_favorites now owned by their
    -- respective plugins (record-links-core, timeline-core, favorites-core).
    -- ERP infrastructure (mappings, posting batches/entries, portal links)
    -- now owned by erp-actions-core. Connected accounts now owned by
    -- connections-core. Webhook tables now owned by webhooks-core. The
    -- shell migration only carries truly cross-cutting tables: meta,
    -- records, users, sessions, audit, password/email tokens, roles +
    -- user_roles (referenced by middleware/auth), i18n_strings.

    -- i18n strings: tenant-scoped translations. Kept in the shell
    -- because i18n is cross-cutting (every plugin's UI strings flow
    -- through it) — moving it into a plugin would create a boot-order
    -- circular dependency.
    CREATE TABLE IF NOT EXISTS i18n_strings (
      id          TEXT PRIMARY KEY,
      tenant_id   TEXT NOT NULL,
      locale      TEXT NOT NULL,
      namespace   TEXT NOT NULL DEFAULT 'app',
      key         TEXT NOT NULL,
      value       TEXT NOT NULL,
      created_at  TEXT NOT NULL,
      updated_at  TEXT NOT NULL,
      UNIQUE (tenant_id, locale, namespace, key)
    );
    CREATE INDEX IF NOT EXISTS i18n_strings_lookup_idx
      ON i18n_strings(tenant_id, locale, namespace);

    -- connected_accounts now owned by connections-core plugin.
  `);

  // Backfill-style ALTERs for columns added after the initial schema.
  const userCols = new Set(
    (db
      .prepare("PRAGMA table_info(users)")
      .all() as { name: string }[]).map((c) => c.name),
  );
  if (!userCols.has("email_verified_at"))
    db.exec("ALTER TABLE users ADD COLUMN email_verified_at TEXT");
  if (!userCols.has("mfa_secret"))
    db.exec("ALTER TABLE users ADD COLUMN mfa_secret TEXT");
  if (!userCols.has("mfa_enabled"))
    db.exec("ALTER TABLE users ADD COLUMN mfa_enabled INTEGER NOT NULL DEFAULT 0");

  // Audit event tamper-evidence: prev_hash + hash columns. Old rows
  // get prev_hash="GENESIS" + hash="LEGACY-<id>" so the chain still
  // validates after this migration. New rows are computed properly
  // via recordAudit().
  const auditCols = new Set(
    (db.prepare("PRAGMA table_info(audit_events)").all() as { name: string }[]).map((c) => c.name),
  );
  if (!auditCols.has("prev_hash")) {
    db.exec("ALTER TABLE audit_events ADD COLUMN prev_hash TEXT NOT NULL DEFAULT 'GENESIS'");
  }
  if (!auditCols.has("hash")) {
    db.exec("ALTER TABLE audit_events ADD COLUMN hash TEXT NOT NULL DEFAULT ''");
    // Backfill existing rows with a placeholder hash so the chain
    // verifier can distinguish pre-chain rows from tampered rows.
    db.exec("UPDATE audit_events SET hash = 'LEGACY-' || id WHERE hash = ''");
  }

  // One-time backfill: any record that pre-dates the ACL schema has
  // zero rows in editor_acl, which would make it invisible to every
  // user once the list endpoint starts ACL-filtering. Seed a tenant-
  // editor row so existing records keep behaving like before (every
  // tenant member sees them) and a user-owner row for the creator if
  // we know who created it. Idempotent — keyed by a `meta` marker.
  //
  // The first backfill (editor records only) ran at marker
  // `editor_acl_backfilled`. We're now broadening to every resource,
  // so use a NEW marker `record_acl_backfilled_v2` — leaves the old
  // one alone, runs once for every record that doesn't already have
  // ACL rows.
  const backfilled = db
    .prepare(`SELECT value FROM meta WHERE key = ?`)
    .get("record_acl_backfilled_v2") as { value: string } | undefined;
  if (!backfilled) {
    // Walk ALL records (every resource), seed ACL where missing.
    const records = db
      .prepare(`SELECT resource, id, data FROM records`)
      .all() as { resource: string; id: string; data: string }[];
    let inserted = 0;
    const hasAclStmt = db.prepare(
      `SELECT 1 FROM editor_acl WHERE resource = ? AND record_id = ? LIMIT 1`,
    );
    const insertStmt = db.prepare(
      `INSERT OR IGNORE INTO editor_acl
         (resource, record_id, subject_kind, subject_id, role, granted_by, granted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );
    const now = new Date().toISOString();
    // Resolve the "default" tenant id once. Any record without an
    // explicit tenantId in its body gets fallback-attached to this
    // tenant — that's what `runtime/auth.ts` resolves to when the
    // tenant strategy doesn't pin a specific one. Without this every
    // pre-existing demo record (4000+ rows) becomes invisible.
    // Tenants table is created by tenancy/migrations.ts (`migrateGlobal`)
    // which the boot sequence runs adjacent to this. In tests where the
    // order is reversed, or in a fresh DB before the tenancy migration
    // has executed, the table doesn't exist yet — fall back to "default".
    let defaultTenant: { id: string } | undefined;
    try {
      defaultTenant = db
        .prepare("SELECT id FROM tenants WHERE slug = 'main' OR slug = 'default' LIMIT 1")
        .get() as { id: string } | undefined;
    } catch {
      defaultTenant = undefined;
    }
    const fallbackTenantId = defaultTenant?.id ?? "default";

    for (const row of records) {
      // Skip records that already have ACL — they were handled by an
      // earlier migration or seed.
      if (hasAclStmt.get(row.resource, row.id)) continue;
      let parsed: { tenantId?: string; createdBy?: string };
      try {
        parsed = JSON.parse(row.data) as { tenantId?: string; createdBy?: string };
      } catch { continue; }
      const tenantId = parsed.tenantId ?? fallbackTenantId;
      const creator = parsed.createdBy;
      // Always emit a tenant-editor grant so the record is visible to
      // every member of its (resolved) tenant.
      insertStmt.run(row.resource, row.id, "tenant", tenantId, "editor", "system:backfill", now);
      inserted++;
      if (creator) {
        const userRow = db
          .prepare("SELECT id FROM users WHERE LOWER(email) = LOWER(?)")
          .get(creator) as { id: string } | undefined;
        if (userRow) {
          insertStmt.run(row.resource, row.id, "user", userRow.id, "owner", "system:backfill", now);
          inserted++;
        }
      }
    }
    db.prepare(
      `INSERT INTO meta (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    ).run("record_acl_backfilled_v2", new Date().toISOString());
    if (inserted > 0) {
      // eslint-disable-next-line no-console
      console.log(`[migrate] backfilled ${inserted} ACL rows for ${records.length} records (all resources)`);
    }
  }
}
