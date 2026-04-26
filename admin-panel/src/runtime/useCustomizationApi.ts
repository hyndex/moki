/** Shared HTTP client + cached hooks for the customization layer:
 *  naming-series, print-formats, letter-heads, notification-rules.
 *
 *  Design mirrors useFieldMetadata and usePropertySetters: small modular
 *  caches keyed by resource id, with `bumpX(resource)` invalidators
 *  invoked from the Settings UI after mutations land. Each hook returns
 *  { rows, loading, error, refresh } for consistency. */

import { useCallback, useEffect, useState } from "react";
import { authStore } from "./auth";

function apiBase(): string {
  const base =
    (typeof import.meta !== "undefined"
      ? (import.meta as { env?: { VITE_API_BASE?: string } }).env?.VITE_API_BASE
      : undefined) ?? "/api";
  return base.toString().replace(/\/+$/, "");
}

function authHeaders(json = true): Record<string, string> {
  const headers: Record<string, string> = {};
  if (json) headers["Content-Type"] = "application/json";
  if (authStore.token) headers.Authorization = `Bearer ${authStore.token}`;
  if (authStore.activeTenant?.id) headers["x-tenant"] = authStore.activeTenant.id;
  return headers;
}

async function readError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string };
    if (body?.error) return body.error;
  } catch { /* tolerate */ }
  return `HTTP ${res.status}`;
}

/** Tiny generic resource-cache hook factory. Each kind has its own
 *  cache map keyed by an arbitrary scope string. */
function makeCachedListHook<T>(kind: string) {
  const cache = new Map<string, T[]>();
  const inFlight = new Map<string, Promise<T[]>>();
  const listeners = new Map<string, Set<() => void>>();

  async function fetchFor(scope: string, url: string): Promise<T[]> {
    const existing = inFlight.get(scope);
    if (existing) return existing;
    const p = (async () => {
      try {
        const res = await fetch(url, { headers: authHeaders(false), credentials: "include" });
        if (!res.ok) return [];
        const j = (await res.json()) as { rows: T[] };
        return j.rows ?? [];
      } catch {
        return [];
      }
    })();
    inFlight.set(scope, p);
    const rows = await p;
    inFlight.delete(scope);
    cache.set(scope, rows);
    listeners.get(scope)?.forEach((l) => l());
    return rows;
  }

  function bump(scope: string): void {
    cache.delete(scope);
    listeners.get(scope)?.forEach((l) => l());
  }

  function use(scope: string, url: string): {
    rows: T[];
    loading: boolean;
    refresh: () => Promise<void>;
  } {
    const [, force] = useState(0);
    const cached = cache.get(scope);
    useEffect(() => {
      let cancelled = false;
      if (!cached) {
        void fetchFor(scope, url).then(() => {
          if (!cancelled) force((n) => n + 1);
        });
      }
      let set = listeners.get(scope);
      if (!set) { set = new Set(); listeners.set(scope, set); }
      const l = () => force((n) => n + 1);
      set.add(l);
      return () => { cancelled = true; set?.delete(l); };
    }, [scope, url, cached]);
    const refresh = useCallback(async () => {
      bump(scope);
      await fetchFor(scope, url);
      force((n) => n + 1);
    }, [scope, url]);
    return { rows: cached ?? [], loading: cached === undefined, refresh };
  }

  return { use, bump, fetchFor, cache, _kind: kind };
}

/* ----------------------------- Naming Series ----------------------------- */

export interface NamingSeries {
  id: string;
  tenantId: string;
  resource: string;
  pattern: string;
  label: string | null;
  isDefault: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

const namingSeriesCache = makeCachedListHook<NamingSeries>("naming-series");

export function useNamingSeries(resource: string): {
  rows: NamingSeries[];
  loading: boolean;
  refresh: () => Promise<void>;
} {
  return namingSeriesCache.use(
    `naming:${resource}`,
    `${apiBase()}/naming-series/${encodeURIComponent(resource)}`,
  );
}

export function bumpNamingSeries(resource: string): void {
  namingSeriesCache.bump(`naming:${resource}`);
}

export async function createNamingSeriesApi(
  resource: string,
  body: { pattern: string; label?: string; isDefault?: boolean },
): Promise<NamingSeries> {
  const res = await fetch(`${apiBase()}/naming-series/${encodeURIComponent(resource)}`, {
    method: "POST",
    headers: authHeaders(),
    credentials: "include",
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await readError(res));
  return (await res.json()) as NamingSeries;
}

export async function updateNamingSeriesApi(
  resource: string,
  id: string,
  patch: { label?: string | null; isDefault?: boolean },
): Promise<NamingSeries> {
  const res = await fetch(
    `${apiBase()}/naming-series/${encodeURIComponent(resource)}/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      headers: authHeaders(),
      credentials: "include",
      body: JSON.stringify(patch),
    },
  );
  if (!res.ok) throw new Error(await readError(res));
  return (await res.json()) as NamingSeries;
}

export async function deleteNamingSeriesApi(resource: string, id: string): Promise<void> {
  const res = await fetch(
    `${apiBase()}/naming-series/${encodeURIComponent(resource)}/${encodeURIComponent(id)}`,
    { method: "DELETE", headers: authHeaders(false), credentials: "include" },
  );
  if (!res.ok) throw new Error(await readError(res));
}

export async function previewNamingSeries(
  resource: string,
  pattern: string,
): Promise<{ bucket: string; samples: string[] }> {
  const res = await fetch(`${apiBase()}/naming-series/${encodeURIComponent(resource)}/preview`, {
    method: "POST",
    headers: authHeaders(),
    credentials: "include",
    body: JSON.stringify({ pattern }),
  });
  if (!res.ok) throw new Error(await readError(res));
  return (await res.json()) as { bucket: string; samples: string[] };
}

/* ----------------------------- Print Formats ----------------------------- */

export interface PrintFormat {
  id: string;
  tenantId: string;
  resource: string;
  name: string;
  template: string;
  paperSize: string;
  orientation: "portrait" | "landscape";
  letterheadId: string | null;
  isDefault: boolean;
  disabled: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface LetterHead {
  id: string;
  tenantId: string;
  name: string;
  headerHtml: string | null;
  footerHtml: string | null;
  isDefault: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

const printFormatCache = makeCachedListHook<PrintFormat>("print-format");
const letterHeadCache = makeCachedListHook<LetterHead>("letter-head");

export function usePrintFormats(resource: string): {
  rows: PrintFormat[];
  loading: boolean;
  refresh: () => Promise<void>;
} {
  return printFormatCache.use(
    `pf:${resource}`,
    `${apiBase()}/print-formats/${encodeURIComponent(resource)}`,
  );
}

export function bumpPrintFormats(resource: string): void {
  printFormatCache.bump(`pf:${resource}`);
}

export function useLetterHeads(): {
  rows: LetterHead[];
  loading: boolean;
  refresh: () => Promise<void>;
} {
  return letterHeadCache.use("lh:all", `${apiBase()}/print-formats/letter-heads`);
}

export function bumpLetterHeads(): void {
  letterHeadCache.bump("lh:all");
}

export async function createPrintFormatApi(
  resource: string,
  body: Partial<Omit<PrintFormat, "id" | "tenantId" | "resource" | "createdAt" | "updatedAt" | "createdBy">>,
): Promise<PrintFormat> {
  const res = await fetch(`${apiBase()}/print-formats/${encodeURIComponent(resource)}`, {
    method: "POST",
    headers: authHeaders(),
    credentials: "include",
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await readError(res));
  return (await res.json()) as PrintFormat;
}

export async function updatePrintFormatApi(
  resource: string,
  id: string,
  patch: Partial<PrintFormat>,
): Promise<PrintFormat> {
  const res = await fetch(
    `${apiBase()}/print-formats/${encodeURIComponent(resource)}/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      headers: authHeaders(),
      credentials: "include",
      body: JSON.stringify(patch),
    },
  );
  if (!res.ok) throw new Error(await readError(res));
  return (await res.json()) as PrintFormat;
}

export async function deletePrintFormatApi(resource: string, id: string): Promise<void> {
  const res = await fetch(
    `${apiBase()}/print-formats/${encodeURIComponent(resource)}/${encodeURIComponent(id)}`,
    { method: "DELETE", headers: authHeaders(false), credentials: "include" },
  );
  if (!res.ok) throw new Error(await readError(res));
}

export async function renderPrintFormatApi(
  resource: string,
  id: string,
  body: { record?: Record<string, unknown>; context?: Record<string, unknown>; letterheadId?: string },
): Promise<{
  html: string;
  errors: Array<{ message: string; near: string }>;
  paperSize: string;
  orientation: "portrait" | "landscape";
}> {
  const res = await fetch(
    `${apiBase()}/print-formats/${encodeURIComponent(resource)}/${encodeURIComponent(id)}/render`,
    {
      method: "POST",
      headers: authHeaders(),
      credentials: "include",
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) throw new Error(await readError(res));
  return (await res.json()) as never;
}

/* ----------------------------- Notification Rules ------------------------ */

export type NotificationEvent =
  | "create"
  | "update"
  | "submit"
  | "cancel"
  | "value-change"
  | "days-after"
  | "days-before"
  | "cron";

export interface ChannelDescriptor {
  kind: "in-app" | "email" | "webhook" | "sms";
  config: Record<string, unknown>;
}

export type ConditionLeaf = {
  op: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "in" | "truthy" | "falsy";
  field: string;
  value?: unknown;
};

export type ConditionGroup = {
  op: "and" | "or";
  args: ConditionExpression[];
};

export type ConditionExpression = ConditionLeaf | ConditionGroup;

export interface NotificationRule {
  id: string;
  tenantId: string;
  name: string;
  resource: string;
  event: NotificationEvent;
  condition: ConditionExpression | null;
  triggerField: string | null;
  offsetDays: number | null;
  cronExpr: string | null;
  channels: ChannelDescriptor[];
  subject: string | null;
  bodyTemplate: string;
  enabled: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

const notificationRulesCache = makeCachedListHook<NotificationRule>("notification-rule");

export function useNotificationRules(resource: string): {
  rows: NotificationRule[];
  loading: boolean;
  refresh: () => Promise<void>;
} {
  return notificationRulesCache.use(
    `nr:${resource}`,
    `${apiBase()}/notification-rules/${encodeURIComponent(resource)}`,
  );
}

export function bumpNotificationRules(resource: string): void {
  notificationRulesCache.bump(`nr:${resource}`);
}

export async function createNotificationRuleApi(
  resource: string,
  body: Partial<Omit<NotificationRule, "id" | "tenantId" | "resource" | "createdAt" | "updatedAt" | "createdBy">>,
): Promise<NotificationRule> {
  const res = await fetch(`${apiBase()}/notification-rules/${encodeURIComponent(resource)}`, {
    method: "POST",
    headers: authHeaders(),
    credentials: "include",
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await readError(res));
  return (await res.json()) as NotificationRule;
}

export async function updateNotificationRuleApi(
  resource: string,
  id: string,
  patch: Partial<NotificationRule>,
): Promise<NotificationRule> {
  const res = await fetch(
    `${apiBase()}/notification-rules/${encodeURIComponent(resource)}/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      headers: authHeaders(),
      credentials: "include",
      body: JSON.stringify(patch),
    },
  );
  if (!res.ok) throw new Error(await readError(res));
  return (await res.json()) as NotificationRule;
}

export async function deleteNotificationRuleApi(resource: string, id: string): Promise<void> {
  const res = await fetch(
    `${apiBase()}/notification-rules/${encodeURIComponent(resource)}/${encodeURIComponent(id)}`,
    { method: "DELETE", headers: authHeaders(false), credentials: "include" },
  );
  if (!res.ok) throw new Error(await readError(res));
}

export async function testNotificationRule(
  resource: string,
  id: string,
  body: { record?: Record<string, unknown>; fire?: boolean },
): Promise<{
  matched: boolean;
  subject: string | null;
  body: string;
  errors: Array<{ message: string; near: string }>;
  dispatch: { fired: number; deliveries: number } | null;
}> {
  const res = await fetch(
    `${apiBase()}/notification-rules/${encodeURIComponent(resource)}/${encodeURIComponent(id)}/test`,
    {
      method: "POST",
      headers: authHeaders(),
      credentials: "include",
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) throw new Error(await readError(res));
  return (await res.json()) as never;
}

/* ----------------------------- Property Setter API ----------------------- */

export interface PropertySetter {
  id: string;
  tenantId: string;
  resource: string;
  field: string;
  property: string;
  value: unknown;
  scope: string;
  reason: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

const propertySetterListCache = makeCachedListHook<PropertySetter>("property-setter");

export function usePropertySetterList(resource: string): {
  rows: PropertySetter[];
  loading: boolean;
  refresh: () => Promise<void>;
} {
  return propertySetterListCache.use(
    `ps:${resource}`,
    `${apiBase()}/property-setters/${encodeURIComponent(resource)}`,
  );
}

export function bumpPropertySetterList(resource: string): void {
  propertySetterListCache.bump(`ps:${resource}`);
}

export async function upsertPropertySetterApi(
  resource: string,
  body: { field: string; property: string; value: unknown; scope?: string; reason?: string },
): Promise<PropertySetter> {
  const res = await fetch(`${apiBase()}/property-setters/${encodeURIComponent(resource)}`, {
    method: "POST",
    headers: authHeaders(),
    credentials: "include",
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await readError(res));
  return (await res.json()) as PropertySetter;
}

export async function deletePropertySetterApi(resource: string, id: string): Promise<void> {
  const res = await fetch(
    `${apiBase()}/property-setters/${encodeURIComponent(resource)}/${encodeURIComponent(id)}`,
    { method: "DELETE", headers: authHeaders(false), credentials: "include" },
  );
  if (!res.ok) throw new Error(await readError(res));
}
