/** Per-document access control.
 *
 *  The model:
 *    - Every document (record in `records` table) has zero or more rows
 *      in `editor_acl` granting a SUBJECT a ROLE.
 *    - Subject kinds: 'user' | 'tenant' | 'public-link' | 'public'.
 *    - Roles: 'owner' | 'editor' | 'viewer' (totally ordered).
 *
 *  When a doc is created we automatically insert TWO rows:
 *    1. (user, creator) → owner          ← personal ownership
 *    2. (tenant, tenant-id) → editor     ← every tenant member can edit
 *
 *  The tenant row keeps backward compatibility with the previous
 *  "every member of the tenant sees every doc" model. Owners can
 *  REMOVE that row to lock the doc down to specific users.
 *
 *  Authorization checks walk all matching rows and pick the highest
 *  role found, so a user who is both an explicit editor AND part of a
 *  tenant-viewer fallback ends up with editor (the higher role).
 *
 *  Global-role clamp: the user's tenant role (owner/admin/member/viewer)
 *  is the *ceiling* on the ACL-derived role. A global "viewer" can
 *  never resolve to editor or owner regardless of per-record ACL —
 *  this defends the "viewer = read-only across the workspace" promise
 *  even when seedDefaultAcl grants tenant-wide editor. See
 *  globalRoleCeiling(). */

import type { SQLQueryBindings } from "bun:sqlite";
import { db, nowIso } from "../db";

export type SubjectKind = "user" | "tenant" | "public-link" | "public";
export type Role = "owner" | "editor" | "viewer";

const ROLE_RANK: Record<Role, number> = {
  viewer: 1,
  editor: 2,
  owner: 3,
};

export function roleAtLeast(have: Role, need: Role): boolean {
  return ROLE_RANK[have] >= ROLE_RANK[need];
}

/** Map a user's global tenant role → maximum per-record role they may
 *  effectively hold. Anything above the ceiling is clamped down.
 *
 *    owner / admin   → owner   (full)
 *    member          → editor  (no destroy, no permission grants)
 *    viewer / *      → viewer  (read-only)
 *
 *  Treat unknown roles as the most restrictive (viewer). */
export function globalRoleCeiling(globalRole: string | null | undefined): Role {
  switch ((globalRole ?? "").toLowerCase()) {
    case "owner":
    case "admin":
      return "owner";
    case "member":
      return "editor";
    case "viewer":
    default:
      return "viewer";
  }
}

function clampRole(have: Role, ceiling: Role): Role {
  return ROLE_RANK[have] <= ROLE_RANK[ceiling] ? have : ceiling;
}

export interface AclRow {
  resource: string;
  recordId: string;
  subjectKind: SubjectKind;
  subjectId: string;
  role: Role;
  grantedBy: string;
  grantedAt: string;
}

interface AclRowDb {
  resource: string;
  record_id: string;
  subject_kind: SubjectKind;
  subject_id: string;
  role: Role;
  granted_by: string;
  granted_at: string;
}

function toAclRow(r: AclRowDb): AclRow {
  return {
    resource: r.resource,
    recordId: r.record_id,
    subjectKind: r.subject_kind,
    subjectId: r.subject_id,
    role: r.role,
    grantedBy: r.granted_by,
    grantedAt: r.granted_at,
  };
}

/** Insert an ACL row. Idempotent: REPLACE updates the role if the
 *  same (resource, recordId, subject) combo is granted again. */
export function grantAcl(args: {
  resource: string;
  recordId: string;
  subjectKind: SubjectKind;
  subjectId: string;
  role: Role;
  grantedBy: string;
}): void {
  db.prepare(
    `INSERT OR REPLACE INTO editor_acl
       (resource, record_id, subject_kind, subject_id, role, granted_by, granted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    args.resource,
    args.recordId,
    args.subjectKind,
    args.subjectId,
    args.role,
    args.grantedBy,
    nowIso(),
  );
}

export function revokeAcl(args: {
  resource: string;
  recordId: string;
  subjectKind: SubjectKind;
  subjectId: string;
}): void {
  db.prepare(
    `DELETE FROM editor_acl
     WHERE resource = ? AND record_id = ?
       AND subject_kind = ? AND subject_id = ?`,
  ).run(args.resource, args.recordId, args.subjectKind, args.subjectId);
}

export function listAcl(resource: string, recordId: string): AclRow[] {
  const rows = db
    .prepare(
      `SELECT resource, record_id, subject_kind, subject_id, role, granted_by, granted_at
       FROM editor_acl
       WHERE resource = ? AND record_id = ?
       ORDER BY granted_at DESC`,
    )
    .all(resource, recordId) as AclRowDb[];
  return rows.map(toAclRow);
}

/** Auto-grant on doc creation: owner = creator, editor = tenant.
 *  Called from the editor-create endpoint right after the record row
 *  is inserted. */
export function seedDefaultAcl(args: {
  resource: string;
  recordId: string;
  ownerUserId: string;
  ownerEmail: string;
  tenantId: string;
}): void {
  grantAcl({
    resource: args.resource,
    recordId: args.recordId,
    subjectKind: "user",
    subjectId: args.ownerUserId,
    role: "owner",
    grantedBy: args.ownerEmail,
  });
  grantAcl({
    resource: args.resource,
    recordId: args.recordId,
    subjectKind: "tenant",
    subjectId: args.tenantId,
    role: "editor",
    grantedBy: args.ownerEmail,
  });
}

/** Resolve the effective role a user has on a specific document.
 *  Returns null if the user has no access.
 *
 *  The result is the **minimum** of:
 *    1. The highest ACL grant matching (user, tenant, public)
 *    2. The user's global tenant role ceiling (see globalRoleCeiling)
 *
 *  Without the global clamp, seedDefaultAcl's tenant-wide editor grant
 *  would let global-viewers mutate any record in their tenant. With it,
 *  a global viewer is held to viewer regardless of ACL. */
export function effectiveRole(args: {
  resource: string;
  recordId: string;
  userId: string;
  tenantId: string | null;
  globalRole?: string | null;
}): Role | null {
  const params: SQLQueryBindings[] = [args.resource, args.recordId, "user", args.userId];
  let q =
    `SELECT role FROM editor_acl
     WHERE resource = ? AND record_id = ?
       AND ((subject_kind = ? AND subject_id = ?)`;
  if (args.tenantId) {
    q += ` OR (subject_kind = 'tenant' AND subject_id = ?)`;
    params.push(args.tenantId);
  }
  q += ` OR (subject_kind = 'public'))`;
  const rows = db.prepare(q).all(...params) as { role: Role }[];
  if (rows.length === 0) return null;
  let best: Role = "viewer";
  for (const r of rows) {
    if (ROLE_RANK[r.role] > ROLE_RANK[best]) best = r.role;
  }
  if (args.globalRole !== undefined) {
    const ceiling = globalRoleCeiling(args.globalRole);
    return clampRole(best, ceiling);
  }
  return best;
}

/** Resolve a public-link token → role. Returns null if the token
 *  doesn't grant access. Callers should still verify the requested
 *  resource+recordId matches what the row says. */
export function roleFromLinkToken(args: {
  resource: string;
  recordId: string;
  token: string;
}): Role | null {
  const row = db
    .prepare(
      `SELECT role FROM editor_acl
       WHERE resource = ? AND record_id = ?
         AND subject_kind = 'public-link' AND subject_id = ?`,
    )
    .get(args.resource, args.recordId, args.token) as { role: Role } | undefined;
  return row?.role ?? null;
}

/** Set of record IDs the user can READ for a given resource. Used to
 *  filter the list endpoint. */
export function accessibleRecordIds(args: {
  resource: string;
  userId: string;
  tenantId: string | null;
}): Set<string> {
  const params: SQLQueryBindings[] = [args.resource, "user", args.userId];
  let q =
    `SELECT DISTINCT record_id FROM editor_acl
     WHERE resource = ?
       AND ((subject_kind = ? AND subject_id = ?)`;
  if (args.tenantId) {
    q += ` OR (subject_kind = 'tenant' AND subject_id = ?)`;
    params.push(args.tenantId);
  }
  q += ` OR (subject_kind = 'public'))`;
  const rows = db.prepare(q).all(...params) as { record_id: string }[];
  return new Set(rows.map((r) => r.record_id));
}

/** Remove ALL ACL rows for a record — called from the editor-delete
 *  endpoint so we don't accumulate orphaned rows. */
export function purgeAclForRecord(resource: string, recordId: string): void {
  db.prepare(
    `DELETE FROM editor_acl WHERE resource = ? AND record_id = ?`,
  ).run(resource, recordId);
}
