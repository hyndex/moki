import { db } from "../db";
import type { SQLQueryBindings } from "bun:sqlite";

export interface ListQueryParams {
  page: number;
  pageSize: number;
  sort?: { field: string; dir: "asc" | "desc" };
  search?: string;
  filters: Record<string, unknown>;
}

export interface ListResult {
  rows: Record<string, unknown>[];
  total: number;
  page: number;
  pageSize: number;
}

/** Parse a URLSearchParams into a structured list query. */
export function parseListQuery(params: URLSearchParams): ListQueryParams {
  const page = Math.max(1, Number(params.get("page") ?? 1));
  const pageSize = Math.min(1000, Math.max(1, Number(params.get("pageSize") ?? 25)));
  const sortField = params.get("sort");
  const sortDir = params.get("dir") === "desc" ? "desc" : "asc";
  const search = params.get("search") ?? undefined;

  // filters come in as filter[field]=value or as flat keys prefixed with f.
  const filters: Record<string, unknown> = {};
  for (const [k, v] of params.entries()) {
    const m = k.match(/^filter\[(.+)\]$/) ?? k.match(/^f\.(.+)$/);
    if (!m) continue;
    const key = m[1];
    if (v === "") continue;
    if (v === "true") filters[key] = true;
    else if (v === "false") filters[key] = false;
    else if (!Number.isNaN(Number(v)) && v.trim() !== "") filters[key] = Number(v);
    else filters[key] = v;
  }

  return {
    page,
    pageSize,
    sort: sortField ? { field: sortField, dir: sortDir } : undefined,
    search: search || undefined,
    filters,
  };
}

/** Translate the structured query into a SQL query against the `records` table.
 *  Uses json_extract() for filter/sort against JSON fields. */
export function listRecords(resource: string, q: ListQueryParams): ListResult {
  const whereClauses: string[] = ["resource = ?"];
  const bindings: SQLQueryBindings[] = [resource];

  if (q.search) {
    whereClauses.push("LOWER(data) LIKE ?");
    bindings.push(`%${q.search.toLowerCase()}%`);
  }

  for (const [field, value] of Object.entries(q.filters)) {
    if (value === undefined || value === null) continue;
    if (typeof value === "boolean") {
      whereClauses.push(`json_extract(data, ?) = ?`);
      bindings.push(`$.${field}`, value ? 1 : 0);
    } else if (typeof value === "number") {
      whereClauses.push(`CAST(json_extract(data, ?) AS REAL) = ?`);
      bindings.push(`$.${field}`, value);
    } else {
      whereClauses.push(`json_extract(data, ?) = ?`);
      bindings.push(`$.${field}`, String(value));
    }
  }

  const where = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

  const countRow = db
    .prepare(`SELECT COUNT(*) AS c FROM records ${where}`)
    .get(...bindings) as { c: number };
  const total = countRow.c;

  let order = "updated_at DESC";
  if (q.sort) {
    order = `json_extract(data, ?) ${q.sort.dir.toUpperCase()}`;
    bindings.push(`$.${q.sort.field}`);
  }

  const offset = (q.page - 1) * q.pageSize;
  const rowsSql = `SELECT data FROM records ${where} ORDER BY ${order} LIMIT ? OFFSET ?`;
  const rows = db
    .prepare(rowsSql)
    .all(...bindings, q.pageSize, offset) as { data: string }[];

  return {
    rows: rows.map((r) => JSON.parse(r.data) as Record<string, unknown>),
    total,
    page: q.page,
    pageSize: q.pageSize,
  };
}

export function getRecord(
  resource: string,
  id: string,
): Record<string, unknown> | null {
  const row = db
    .prepare("SELECT data FROM records WHERE resource = ? AND id = ?")
    .get(resource, id) as { data: string } | undefined;
  return row ? (JSON.parse(row.data) as Record<string, unknown>) : null;
}

export function insertRecord(
  resource: string,
  id: string,
  data: Record<string, unknown>,
): Record<string, unknown> {
  const now = new Date().toISOString();
  const record = { ...data, id, createdAt: now, updatedAt: now };
  db.prepare(
    `INSERT INTO records (resource, id, data, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(resource, id, JSON.stringify(record), now, now);
  return record;
}

export function updateRecord(
  resource: string,
  id: string,
  patch: Record<string, unknown>,
): Record<string, unknown> | null {
  const existing = getRecord(resource, id);
  if (!existing) return null;
  const now = new Date().toISOString();
  const merged = { ...existing, ...patch, id, updatedAt: now };
  db.prepare(
    `UPDATE records SET data = ?, updated_at = ? WHERE resource = ? AND id = ?`,
  ).run(JSON.stringify(merged), now, resource, id);
  return merged;
}

export function deleteRecord(resource: string, id: string): boolean {
  const res = db
    .prepare("DELETE FROM records WHERE resource = ? AND id = ?")
    .run(resource, id);
  return res.changes > 0;
}

/** Bulk insert — used by the seed. Wraps everything in one transaction. */
export function bulkInsert(
  resource: string,
  rows: readonly Record<string, unknown>[],
): number {
  const now = new Date().toISOString();
  const stmt = db.prepare(
    `INSERT OR REPLACE INTO records (resource, id, data, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)`,
  );
  const tx = db.transaction((list: readonly Record<string, unknown>[]) => {
    for (const row of list) {
      const id = String(row.id ?? crypto.randomUUID());
      const created = String(row.createdAt ?? now);
      const updated = String(row.updatedAt ?? now);
      const full = { ...row, id, createdAt: created, updatedAt: updated };
      stmt.run(resource, id, JSON.stringify(full), created, updated);
    }
  });
  tx(rows);
  return rows.length;
}
