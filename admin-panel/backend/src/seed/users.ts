import { db, nowIso } from "../db";
import { hashPassword } from "../lib/auth";
import { uuid } from "../lib/id";

const SEED_USERS = [
  { email: "chinmoy@gutu.dev", name: "Chinmoy Bhuyan", role: "admin", password: "password" },
  { email: "sam@gutu.dev", name: "Sam Rivera", role: "member", password: "password" },
  { email: "alex@gutu.dev", name: "Alex Chen", role: "member", password: "password" },
  { email: "taylor@gutu.dev", name: "Taylor Nguyen", role: "member", password: "password" },
  { email: "viewer@gutu.dev", name: "Viewer Account", role: "viewer", password: "password" },
];

export async function seedUsers(): Promise<number> {
  const existing = db.prepare("SELECT COUNT(*) AS c FROM users").get() as { c: number };
  if (existing.c > 0) return 0;
  const now = nowIso();
  const stmt = db.prepare(
    `INSERT INTO users (id, email, name, role, password_hash, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  let count = 0;
  for (const u of SEED_USERS) {
    const hash = await hashPassword(u.password);
    stmt.run(uuid(), u.email, u.name, u.role, hash, now, now);
    count++;
  }
  return count;
}
