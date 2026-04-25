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

    CREATE TABLE IF NOT EXISTS audit_events (
      id          TEXT PRIMARY KEY,
      actor       TEXT NOT NULL,
      action      TEXT NOT NULL,
      resource    TEXT NOT NULL,
      record_id   TEXT,
      level       TEXT NOT NULL DEFAULT 'info',
      ip          TEXT,
      occurred_at TEXT NOT NULL,
      payload     TEXT
    );
    CREATE INDEX IF NOT EXISTS audit_occurred_idx ON audit_events(occurred_at DESC);

    -- Per-document access control list. Each row grants a SUBJECT a
    -- ROLE on a specific (resource, record_id). The subject is one of:
    --   user        — a single user id; row created on every share
    --   tenant      — every member of a tenant gets the role; default
    --                 row created on doc creation so existing UX (every
    --                 tenant member sees every doc) keeps working
    --   public-link — anyone holding the link token, scoped to a role
    --                 (typically "viewer")
    --   public      — unauthenticated read (anonymous web; we don't
    --                 expose this in the UI yet but the row format is
    --                 ready for it)
    -- Roles: 'owner' > 'editor' > 'viewer' (ordering enforced in code).
    CREATE TABLE IF NOT EXISTS editor_acl (
      resource     TEXT NOT NULL,
      record_id    TEXT NOT NULL,
      subject_kind TEXT NOT NULL,
      subject_id   TEXT NOT NULL,
      role         TEXT NOT NULL,
      granted_by   TEXT NOT NULL,
      granted_at   TEXT NOT NULL,
      PRIMARY KEY (resource, record_id, subject_kind, subject_id)
    );
    CREATE INDEX IF NOT EXISTS editor_acl_subject_idx
      ON editor_acl(subject_kind, subject_id);
    CREATE INDEX IF NOT EXISTS editor_acl_record_idx
      ON editor_acl(resource, record_id);

    -- Saved views with workspace/team scope. Promotes the
    -- localStorage-only frontend store into a real backend table so
    -- "Qualified leads from EU this quarter" can be shared with the
    -- whole tenant or a specific team. Body is the SavedView JSON
    -- (filter tree, sort spec, columns, grouping, density, …).
    -- See contracts/saved-views.ts for the body shape.
    CREATE TABLE IF NOT EXISTS saved_views (
      id          TEXT PRIMARY KEY,
      tenant_id   TEXT NOT NULL,
      resource    TEXT NOT NULL,
      created_by  TEXT NOT NULL,
      scope       TEXT NOT NULL DEFAULT 'personal',  -- personal | team | tenant
      team_id     TEXT,                              -- null unless scope = 'team'
      name        TEXT NOT NULL,
      icon        TEXT,
      body        TEXT NOT NULL,  -- JSON: filter, sort, columns, ...
      pinned      INTEGER NOT NULL DEFAULT 0,
      is_default  INTEGER NOT NULL DEFAULT 0,
      created_at  TEXT NOT NULL,
      updated_at  TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS saved_views_tenant_resource_idx
      ON saved_views(tenant_id, resource);
    CREATE INDEX IF NOT EXISTS saved_views_creator_idx
      ON saved_views(created_by);

    -- Workflows + runs. Each workflow is a directed graph of nodes
    -- (one trigger + N actions) stored as JSON. Runs are created by
    -- the workflow engine when a trigger fires; each run carries its
    -- own variable bag and step-by-step execution log.
    CREATE TABLE IF NOT EXISTS workflows (
      id           TEXT PRIMARY KEY,
      tenant_id    TEXT NOT NULL,
      name         TEXT NOT NULL,
      description  TEXT,
      status       TEXT NOT NULL DEFAULT 'draft',  -- draft | active | paused | archived
      definition   TEXT NOT NULL,                  -- JSON: { nodes, edges, trigger }
      version      INTEGER NOT NULL DEFAULT 1,
      created_by   TEXT NOT NULL,
      created_at   TEXT NOT NULL,
      updated_at   TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS workflows_tenant_status_idx
      ON workflows(tenant_id, status);

    CREATE TABLE IF NOT EXISTS workflow_runs (
      id              TEXT PRIMARY KEY,
      workflow_id     TEXT NOT NULL,
      tenant_id       TEXT NOT NULL,
      status          TEXT NOT NULL DEFAULT 'pending',  -- pending | running | success | failure | skipped
      trigger_payload TEXT,                              -- JSON of the event that triggered
      output          TEXT,                              -- JSON: per-node outputs
      error           TEXT,
      started_at      TEXT NOT NULL,
      finished_at     TEXT,
      duration_ms     INTEGER,
      FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS workflow_runs_workflow_idx
      ON workflow_runs(workflow_id, started_at DESC);
    CREATE INDEX IF NOT EXISTS workflow_runs_tenant_idx
      ON workflow_runs(tenant_id, started_at DESC);

    -- Outbound webhooks. Per-tenant URL list with HMAC secret. The
    -- workflow engine + the resource event bus dispatch through these
    -- whenever a record changes (matched by events_pattern, e.g.
    -- 'crm.contact.*', '*.created', or '*' for everything).
    CREATE TABLE IF NOT EXISTS webhooks (
      id              TEXT PRIMARY KEY,
      tenant_id       TEXT NOT NULL,
      target_url      TEXT NOT NULL,
      secret          TEXT NOT NULL,
      events_pattern  TEXT NOT NULL DEFAULT '*',
      enabled         INTEGER NOT NULL DEFAULT 1,
      headers         TEXT,                       -- JSON: extra headers
      retry_policy    TEXT,                       -- JSON: { maxAttempts, backoffMs }
      created_by      TEXT NOT NULL,
      created_at      TEXT NOT NULL,
      updated_at      TEXT NOT NULL,
      last_delivery_at TEXT,
      last_status     INTEGER
    );
    CREATE INDEX IF NOT EXISTS webhooks_tenant_idx ON webhooks(tenant_id);

    -- Webhook delivery log — one row per delivery attempt for audit
    -- + retry. Body is the JSON we POSTed.
    CREATE TABLE IF NOT EXISTS webhook_deliveries (
      id            TEXT PRIMARY KEY,
      webhook_id    TEXT NOT NULL,
      event_type    TEXT NOT NULL,
      payload       TEXT NOT NULL,
      status_code   INTEGER,
      response_body TEXT,
      error         TEXT,
      attempt       INTEGER NOT NULL DEFAULT 1,
      delivered_at  TEXT NOT NULL,
      FOREIGN KEY (webhook_id) REFERENCES webhooks(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS webhook_deliveries_webhook_idx
      ON webhook_deliveries(webhook_id, delivered_at DESC);

    -- Long-lived API tokens (vs short-lived session tokens).
    -- Bearer-presentable; scoped down to specific resources +
    -- verbs so a Zapier integration can be limited to "read crm.contact
    -- + create crm.contact" without seeing the rest. Token value
    -- itself never stored in plaintext — we keep a SHA-256 hash.
    CREATE TABLE IF NOT EXISTS api_tokens (
      id          TEXT PRIMARY KEY,
      tenant_id   TEXT NOT NULL,
      name        TEXT NOT NULL,
      token_hash  TEXT NOT NULL UNIQUE,
      token_prefix TEXT NOT NULL,        -- first 8 chars (for UI lookup), not secret
      scopes      TEXT NOT NULL,         -- JSON: [{ resource, verbs }]
      created_by  TEXT NOT NULL,
      created_at  TEXT NOT NULL,
      expires_at  TEXT,                  -- null = no expiry
      last_used_at TEXT,
      revoked_at  TEXT
    );
    CREATE INDEX IF NOT EXISTS api_tokens_tenant_idx ON api_tokens(tenant_id);
    CREATE INDEX IF NOT EXISTS api_tokens_hash_idx ON api_tokens(token_hash);

    -- Custom fields per object — the lightweight metadata layer.
    -- Each row defines an extra field on a (tenant, resource) pair.
    -- Field values live inline in the same records.data JSON blob
    -- under the field's "key" so the existing storage path "just
    -- works" with custom fields. The settings UI consumes this table
    -- to render add-field forms; the form/list/filter renderers
    -- merge custom fields into the descriptor at request time.
    CREATE TABLE IF NOT EXISTS field_metadata (
      id           TEXT PRIMARY KEY,
      tenant_id    TEXT NOT NULL,
      resource     TEXT NOT NULL,
      key          TEXT NOT NULL,    -- 'industry', 'lifecycleStage', etc.
      label        TEXT NOT NULL,
      kind         TEXT NOT NULL,    -- 'text' | 'number' | 'select' | 'multiselect' | 'boolean' | 'date' | 'currency' | 'email' | 'phone' | 'url' | 'relation' | 'rich-text' | 'json'
      options      TEXT,             -- JSON: select options, currency code, relation target, validators
      required     INTEGER NOT NULL DEFAULT 0,
      indexed      INTEGER NOT NULL DEFAULT 0,  -- if 1 we keep an inverted-index row for filter speed
      position     INTEGER NOT NULL DEFAULT 0,
      created_by   TEXT NOT NULL,
      created_at   TEXT NOT NULL,
      updated_at   TEXT NOT NULL,
      UNIQUE (tenant_id, resource, key)
    );
    CREATE INDEX IF NOT EXISTS field_metadata_tr_idx
      ON field_metadata(tenant_id, resource);

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

    -- Polymorphic record-to-record links. Powers MORPH_RELATION
    -- (one note attaches to records of any type), favorites,
    -- pinned-records-in-sidebar, "Related records" panels, and the
    -- universal record-picker. Edges are typed via the kind column so the
    -- same row format also expresses ownership, parent/child, etc.
    CREATE TABLE IF NOT EXISTS record_links (
      id           TEXT PRIMARY KEY,
      tenant_id    TEXT NOT NULL,
      from_resource TEXT NOT NULL,
      from_id      TEXT NOT NULL,
      to_resource  TEXT NOT NULL,
      to_id        TEXT NOT NULL,
      kind         TEXT NOT NULL DEFAULT 'related',
      payload      TEXT,
      created_by   TEXT NOT NULL,
      created_at   TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS record_links_from_idx
      ON record_links(tenant_id, from_resource, from_id);
    CREATE INDEX IF NOT EXISTS record_links_to_idx
      ON record_links(tenant_id, to_resource, to_id);
    CREATE INDEX IF NOT EXISTS record_links_kind_idx
      ON record_links(tenant_id, kind);

    -- Per-record timeline events. Auto-emitted on every record CRUD
    -- so detail pages can show "Sarah created this · Bob changed
    -- stage to Customer · Mailer ran a workflow" without each
    -- feature wiring its own audit. Different from audit_events
    -- which is admin-facing — this is record-facing.
    CREATE TABLE IF NOT EXISTS timeline_events (
      id          TEXT PRIMARY KEY,
      tenant_id   TEXT NOT NULL,
      resource    TEXT NOT NULL,
      record_id   TEXT NOT NULL,
      kind        TEXT NOT NULL,           -- 'created' | 'updated' | 'deleted' | 'restored' | 'comment' | 'workflow' | 'integration' | …
      actor       TEXT,                    -- email, system:..., or workflow run id
      diff        TEXT,                    -- JSON: { field: { from, to } }
      message     TEXT,
      occurred_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS timeline_record_idx
      ON timeline_events(tenant_id, resource, record_id, occurred_at DESC);

    -- Sidebar favourites + pinned records per user. Lightweight —
    -- everything else (custom views, recent records) derives from
    -- saved_views + audit-log timestamps.
    CREATE TABLE IF NOT EXISTS user_favorites (
      tenant_id   TEXT NOT NULL,
      user_id     TEXT NOT NULL,
      kind        TEXT NOT NULL,           -- 'view' | 'record' | 'page' | 'link'
      target_id   TEXT NOT NULL,           -- view id, "<resource>:<recordId>", page id, URL
      label       TEXT,
      icon        TEXT,
      folder      TEXT,
      position    INTEGER NOT NULL DEFAULT 0,
      created_at  TEXT NOT NULL,
      PRIMARY KEY (tenant_id, user_id, kind, target_id)
    );
    CREATE INDEX IF NOT EXISTS user_favorites_user_idx
      ON user_favorites(user_id, position);

    -- Connected accounts (Gmail/Outlook/IMAP/CalDAV). Storing the
    -- tokens encrypted-at-rest; we only ever decrypt in-process for
    -- the sync workers. Provider-specific extra config is in
    -- settings JSON.
    CREATE TABLE IF NOT EXISTS connected_accounts (
      id              TEXT PRIMARY KEY,
      tenant_id       TEXT NOT NULL,
      user_id         TEXT NOT NULL,
      provider        TEXT NOT NULL,        -- 'google' | 'microsoft' | 'imap' | 'caldav'
      handle          TEXT NOT NULL,        -- email or principal
      access_token    TEXT,
      refresh_token   TEXT,
      expires_at      TEXT,
      settings        TEXT,                 -- JSON
      last_synced_at  TEXT,
      sync_state      TEXT,                 -- JSON: provider-specific cursor
      enabled         INTEGER NOT NULL DEFAULT 1,
      created_at      TEXT NOT NULL,
      updated_at      TEXT NOT NULL,
      UNIQUE (tenant_id, user_id, provider, handle)
    );
    CREATE INDEX IF NOT EXISTS connected_accounts_user_idx
      ON connected_accounts(user_id);
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
    const defaultTenant = db
      .prepare("SELECT id FROM tenants WHERE slug = 'main' OR slug = 'default' LIMIT 1")
      .get() as { id: string } | undefined;
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
