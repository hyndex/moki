/** Hover-preview for record link cells.
 *
 *  Wraps any inline anchor / clickable link to a record id; on
 *  pointer-enter, fetches the linked record and shows a small floating
 *  card with its title, subtitle, and a few preview fields. Cached in
 *  module memory so subsequent hovers are instant.
 *
 *  Usage:
 *    <LinkPreview resource="crm.contact" id={row.contactId}>
 *      <a href={`#/contacts/${row.contactId}`}>{row.contactName}</a>
 *    </LinkPreview>
 *
 *  The preview fetches `/api/resources/<resource>/<id>` (the existing
 *  generic CRUD endpoint). For domain primitives that aren't behind
 *  the generic resources API (gl.account, gl.journal, etc.), pass a
 *  custom `fetchPreview` function that returns the data shape.
 */

import * as React from "react";
import { authStore } from "@/runtime/auth";
import { Spinner } from "@/primitives/Spinner";
import { cn } from "@/lib/cn";

interface PreviewData {
  title: string;
  subtitle: string | null;
  fields: Array<{ label: string; value: string }>;
}

interface Props {
  resource: string;
  id: string;
  children: React.ReactNode;
  /** Override the fetch path. */
  fetchPreview?: (resource: string, id: string) => Promise<PreviewData | null>;
  /** Hover delay in ms. Default 250 — feels instant without spamming. */
  hoverDelayMs?: number;
}

const cache = new Map<string, PreviewData | null>();
const inFlight = new Map<string, Promise<PreviewData | null>>();

function apiBase(): string {
  const base =
    (typeof import.meta !== "undefined"
      ? (import.meta as { env?: { VITE_API_BASE?: string } }).env?.VITE_API_BASE
      : undefined) ?? "/api";
  return base.toString().replace(/\/+$/, "");
}

function authHeaders(): Record<string, string> {
  const h: Record<string, string> = {};
  if (authStore.token) h.Authorization = `Bearer ${authStore.token}`;
  if (authStore.activeTenant?.id) h["x-tenant"] = authStore.activeTenant.id;
  return h;
}

const TITLE_KEYS = ["title", "name", "label", "displayName", "subject", "number", "code"];
const SUBTITLE_KEYS = ["description", "email", "phone", "memo", "type", "status"];
const PREVIEW_KEYS = [
  "status", "type", "company", "department", "priority",
  "amount", "amountMinor", "totalMinor", "rateMinor",
  "createdAt", "updatedAt", "dueDate", "postingDate",
  "owner", "assignee", "currency",
];

function projectPreview(data: Record<string, unknown>): PreviewData {
  const title =
    TITLE_KEYS.map((k) => data[k]).find((v) => typeof v === "string" && v.length > 0) as
      | string
      | undefined ?? "";
  const subtitle =
    SUBTITLE_KEYS.map((k) => data[k]).find((v) => typeof v === "string" && v.length > 0) as
      | string
      | undefined ?? null;
  const fields: PreviewData["fields"] = [];
  for (const k of PREVIEW_KEYS) {
    if (k === "title" || k === "name" || k === "label") continue;
    const v = data[k];
    if (v === undefined || v === null || v === "") continue;
    const formatted =
      typeof v === "string"
        ? v.length > 80 ? v.slice(0, 80) + "…" : v
        : typeof v === "number"
          ? String(v)
          : typeof v === "boolean"
            ? (v ? "yes" : "no")
            : Array.isArray(v)
              ? v.length === 0 ? "—" : `${v.length} item${v.length === 1 ? "" : "s"}`
              : "(object)";
    fields.push({ label: k, value: formatted });
    if (fields.length >= 6) break;
  }
  return { title, subtitle, fields };
}

async function defaultFetch(resource: string, id: string): Promise<PreviewData | null> {
  const key = `${resource}:${id}`;
  if (cache.has(key)) return cache.get(key) ?? null;
  if (inFlight.has(key)) return (await inFlight.get(key)!) ?? null;
  const p = (async () => {
    try {
      const res = await fetch(
        `${apiBase()}/resources/${encodeURIComponent(resource)}/${encodeURIComponent(id)}`,
        { headers: authHeaders(), credentials: "include" },
      );
      if (!res.ok) return null;
      const j = (await res.json()) as Record<string, unknown>;
      return projectPreview(j);
    } catch {
      return null;
    }
  })();
  inFlight.set(key, p);
  const out = await p;
  inFlight.delete(key);
  cache.set(key, out);
  return out;
}

export function bumpLinkPreview(resource: string, id: string): void {
  cache.delete(`${resource}:${id}`);
}

export function LinkPreview({
  resource,
  id,
  children,
  fetchPreview,
  hoverDelayMs = 250,
}: Props): React.JSX.Element {
  const [open, setOpen] = React.useState(false);
  const [data, setData] = React.useState<PreviewData | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [position, setPosition] = React.useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const wrapperRef = React.useRef<HTMLSpanElement>(null);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const onEnter = React.useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      const rect = wrapperRef.current?.getBoundingClientRect();
      if (rect) setPosition({ x: rect.left, y: rect.bottom + 4 });
      setOpen(true);
      const cached = cache.get(`${resource}:${id}`);
      if (cached !== undefined) {
        setData(cached);
        return;
      }
      setLoading(true);
      try {
        const fetched = fetchPreview
          ? await fetchPreview(resource, id)
          : await defaultFetch(resource, id);
        setData(fetched);
      } finally {
        setLoading(false);
      }
    }, hoverDelayMs);
  }, [resource, id, fetchPreview, hoverDelayMs]);

  const onLeave = React.useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setOpen(false);
  }, []);

  React.useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  return (
    <span
      ref={wrapperRef}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onFocus={onEnter}
      onBlur={onLeave}
      className="inline-flex items-center"
    >
      {children}
      {open ? (
        <span
          className={cn(
            "fixed z-50 w-72 rounded-md border border-border bg-surface-0 shadow-lg p-3 text-xs",
            "pointer-events-none",
          )}
          style={{ left: position.x, top: position.y }}
          role="tooltip"
        >
          {loading || !data ? (
            <div className="flex items-center gap-2 text-text-muted">
              <Spinner size={10} />
              <span>{loading ? "Loading…" : "No preview available"}</span>
            </div>
          ) : (
            <>
              <div className="text-sm font-medium text-text-primary truncate">
                {data.title || id}
              </div>
              {data.subtitle ? (
                <div className="text-text-muted truncate">{data.subtitle}</div>
              ) : null}
              {data.fields.length > 0 ? (
                <dl className="mt-2 grid grid-cols-2 gap-x-2 gap-y-0.5">
                  {data.fields.map((f) => (
                    <React.Fragment key={f.label}>
                      <dt className="text-text-muted">{f.label}</dt>
                      <dd className="text-text-secondary truncate">{f.value}</dd>
                    </React.Fragment>
                  ))}
                </dl>
              ) : null}
            </>
          )}
        </span>
      ) : null}
    </span>
  );
}
