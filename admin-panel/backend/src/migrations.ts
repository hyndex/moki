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
}
