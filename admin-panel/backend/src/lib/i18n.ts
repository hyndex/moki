/** Tenant-scoped i18n translations.
 *
 *  A simple key/value store partitioned by (tenant, locale, namespace).
 *  Keys are arbitrary identifiers; values are arbitrary strings. The
 *  resolver supports per-locale overrides + fallback to a base locale
 *  (default 'en') when a key is missing in the requested locale.
 *
 *  Namespaces let callers segregate categories: 'app' for UI labels,
 *  'crm' for CRM-specific strings, 'invoice' for documents, etc.
 *
 *  Bulk import accepts an object map { key: value } so an entire pack
 *  can be loaded in one POST.
 */

import { db, nowIso } from "../db";
import { uuid } from "./id";

export interface I18nString {
  id: string;
  tenantId: string;
  locale: string;
  namespace: string;
  key: string;
  value: string;
  createdAt: string;
  updatedAt: string;
}

export class I18nError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = "I18nError";
  }
}

const LOCALE_RE = /^[a-z]{2,3}(-[A-Z]{2})?$/;

function validateLocale(locale: string): void {
  if (!LOCALE_RE.test(locale))
    throw new I18nError("invalid-locale", "Locale must be ISO-639 (e.g. en, hi, en-US)");
}

interface Row {
  id: string;
  tenant_id: string;
  locale: string;
  namespace: string;
  key: string;
  value: string;
  created_at: string;
  updated_at: string;
}

function rowToString(r: Row): I18nString {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    locale: r.locale,
    namespace: r.namespace,
    key: r.key,
    value: r.value,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export interface UpsertArgs {
  tenantId: string;
  locale: string;
  namespace?: string;
  key: string;
  value: string;
}

export function upsertString(args: UpsertArgs): I18nString {
  validateLocale(args.locale);
  const namespace = args.namespace ?? "app";
  const now = nowIso();
  const existing = db
    .prepare(
      `SELECT * FROM i18n_strings
         WHERE tenant_id = ? AND locale = ? AND namespace = ? AND key = ?`,
    )
    .get(args.tenantId, args.locale, namespace, args.key) as Row | undefined;
  if (existing) {
    db.prepare(
      `UPDATE i18n_strings SET value = ?, updated_at = ? WHERE id = ?`,
    ).run(args.value, now, existing.id);
    const r = db.prepare(`SELECT * FROM i18n_strings WHERE id = ?`).get(existing.id) as Row;
    return rowToString(r);
  }
  const id = uuid();
  db.prepare(
    `INSERT INTO i18n_strings
       (id, tenant_id, locale, namespace, key, value, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, args.tenantId, args.locale, namespace, args.key, args.value, now, now);
  const r = db.prepare(`SELECT * FROM i18n_strings WHERE id = ?`).get(id) as Row;
  return rowToString(r);
}

export function bulkUpsert(args: {
  tenantId: string;
  locale: string;
  namespace?: string;
  entries: Record<string, string>;
}): { upserted: number } {
  validateLocale(args.locale);
  const namespace = args.namespace ?? "app";
  const tx = db.transaction(() => {
    for (const [key, value] of Object.entries(args.entries)) {
      upsertString({ tenantId: args.tenantId, locale: args.locale, namespace, key, value });
    }
  });
  tx();
  return { upserted: Object.keys(args.entries).length };
}

export function deleteString(tenantId: string, id: string): boolean {
  const r = db.prepare(`DELETE FROM i18n_strings WHERE id = ? AND tenant_id = ?`).run(id, tenantId);
  return r.changes > 0;
}

export interface ResolveArgs {
  tenantId: string;
  locale: string;
  namespace?: string;
  baseLocale?: string;
}

/** Resolve a full bag for the requested locale, falling back to the
 *  base locale when a key is missing. Returns
 *  { namespace, locale, baseLocale, strings: Record<key, value> }. */
export function resolveStrings(args: ResolveArgs): {
  namespace: string;
  locale: string;
  baseLocale: string;
  strings: Record<string, string>;
} {
  validateLocale(args.locale);
  const namespace = args.namespace ?? "app";
  const baseLocale = args.baseLocale ?? "en";
  const baseRows = db
    .prepare(
      `SELECT key, value FROM i18n_strings
         WHERE tenant_id = ? AND locale = ? AND namespace = ?`,
    )
    .all(args.tenantId, baseLocale, namespace) as Array<{ key: string; value: string }>;
  const localeRows = db
    .prepare(
      `SELECT key, value FROM i18n_strings
         WHERE tenant_id = ? AND locale = ? AND namespace = ?`,
    )
    .all(args.tenantId, args.locale, namespace) as Array<{ key: string; value: string }>;
  const strings: Record<string, string> = {};
  for (const r of baseRows) strings[r.key] = r.value;
  for (const r of localeRows) strings[r.key] = r.value; // override
  return { namespace, locale: args.locale, baseLocale, strings };
}

export function listLocales(tenantId: string): Array<{ locale: string; count: number }> {
  const rows = db
    .prepare(
      `SELECT locale, COUNT(*) as count FROM i18n_strings
         WHERE tenant_id = ? GROUP BY locale ORDER BY locale ASC`,
    )
    .all(tenantId) as Array<{ locale: string; count: number }>;
  return rows;
}

export function listNamespaces(tenantId: string): Array<{ namespace: string; count: number }> {
  const rows = db
    .prepare(
      `SELECT namespace, COUNT(*) as count FROM i18n_strings
         WHERE tenant_id = ? GROUP BY namespace ORDER BY namespace ASC`,
    )
    .all(tenantId) as Array<{ namespace: string; count: number }>;
  return rows;
}

/** Render a string with placeholder substitution. Placeholders are
 *  `{name}` style; missing keys are left as-is. */
export function format(template: string, values: Record<string, unknown>): string {
  return template.replace(/\{(\w+)\}/g, (_match, key) => {
    const v = values[key];
    return v === undefined || v === null ? "" : String(v);
  });
}
