import { db, nowIso } from "../db";
import { token } from "./id";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

export async function hashPassword(plain: string): Promise<string> {
  return Bun.password.hash(plain, { algorithm: "bcrypt", cost: 10 });
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  try {
    return await Bun.password.verify(plain, hash);
  } catch {
    return false;
  }
}

export function createSession(userId: string, ua?: string, ip?: string): string {
  const t = token();
  const now = nowIso();
  const expires = new Date(Date.now() + 7 * 86400_000).toISOString();
  db.prepare(
    `INSERT INTO sessions (token, user_id, created_at, expires_at, ua, ip)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(t, userId, now, expires, ua ?? null, ip ?? null);
  return t;
}

export function deleteSession(t: string): void {
  db.prepare("DELETE FROM sessions WHERE token = ?").run(t);
}

export function getSessionUser(t: string): AuthUser | null {
  const row = db
    .prepare(
      `SELECT u.id, u.email, u.name, u.role
         FROM sessions s
         JOIN users u ON u.id = s.user_id
        WHERE s.token = ?
          AND s.expires_at > ?`,
    )
    .get(t, nowIso()) as AuthUser | undefined;
  return row ?? null;
}

export interface FullUserRow extends AuthUser {
  password_hash: string;
  email_verified_at: string | null;
  mfa_secret: string | null;
  mfa_enabled: number;
}

export function getUserByEmail(email: string): FullUserRow | null {
  const row = db
    .prepare(
      `SELECT id, email, name, role, password_hash,
              email_verified_at, mfa_secret, mfa_enabled
         FROM users
        WHERE LOWER(email) = LOWER(?)`,
    )
    .get(email) as FullUserRow | undefined;
  return row ?? null;
}

export function getUserById(id: string): FullUserRow | null {
  const row = db
    .prepare(
      `SELECT id, email, name, role, password_hash,
              email_verified_at, mfa_secret, mfa_enabled
         FROM users WHERE id = ?`,
    )
    .get(id) as FullUserRow | undefined;
  return row ?? null;
}

export function setMfaSecret(userId: string, secret: string | null): void {
  db.prepare("UPDATE users SET mfa_secret = ?, updated_at = ? WHERE id = ?").run(
    secret,
    nowIso(),
    userId,
  );
}

export function setMfaEnabled(userId: string, enabled: boolean): void {
  db.prepare(
    "UPDATE users SET mfa_enabled = ?, updated_at = ? WHERE id = ?",
  ).run(enabled ? 1 : 0, nowIso(), userId);
}

export function setPasswordHash(userId: string, hash: string): void {
  db.prepare(
    "UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?",
  ).run(hash, nowIso(), userId);
}

export function markEmailVerified(userId: string): void {
  db.prepare(
    "UPDATE users SET email_verified_at = ?, updated_at = ? WHERE id = ?",
  ).run(nowIso(), nowIso(), userId);
}
