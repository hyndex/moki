/** Connections card — ERPNext-style "linked documents" panel.
 *
 *  Mounts on any detail page; shows records that reference *this*
 *  record (inbound) and records *this* record references (outbound),
 *  grouped by target resource. Backed by `/api/connections/:resource/:id`.
 *
 *  Each group shows a count badge and a few sample labels with click-
 *  through. Clicking the group header navigates to a list filtered to
 *  the linked records. */

import * as React from "react";
import { ArrowLeftRight, ArrowRight, ArrowLeft, ChevronDown, ChevronRight, Spline } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./Card";
import { Badge } from "@/primitives/Badge";
import { Spinner } from "@/primitives/Spinner";
import { authStore } from "@/runtime/auth";

interface Sample {
  id: string;
  label: string;
  url: string;
}

interface Group {
  resource: string;
  count: number;
  kind: string;
  direction: "outbound" | "inbound";
  samples: Sample[];
}

interface Props {
  resource: string;
  recordId: string;
  /** Cap the number of groups shown initially; collapsed groups expose
   *  a "+N more" link. Default: show all. */
  collapseAfter?: number;
}

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

const directionIcon = (d: Group["direction"]) =>
  d === "outbound" ? (
    <ArrowRight className="h-3 w-3 text-text-muted" />
  ) : (
    <ArrowLeft className="h-3 w-3 text-text-muted" />
  );

export function ConnectionsCard({ resource, recordId, collapseAfter }: Props): React.JSX.Element {
  const [groups, setGroups] = React.useState<Group[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [open, setOpen] = React.useState<Record<string, boolean>>({});

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(
          `${apiBase()}/connections/${encodeURIComponent(resource)}/${encodeURIComponent(recordId)}`,
          { headers: authHeaders(), credentials: "include" },
        );
        if (!res.ok) {
          if (!cancelled) {
            setError(`HTTP ${res.status}`);
            setGroups([]);
          }
          return;
        }
        const j = (await res.json()) as { groups: Group[] };
        if (!cancelled) {
          setGroups(j.groups ?? []);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
          setGroups([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [resource, recordId]);

  if (groups === null) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Spline className="h-3.5 w-3.5 text-text-muted" />
            Connections
          </CardTitle>
        </CardHeader>
        <CardContent className="py-6 flex items-center justify-center text-text-muted text-xs">
          <Spinner size={12} />
          <span className="ml-2">Loading…</span>
        </CardContent>
      </Card>
    );
  }
  if (groups.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Spline className="h-3.5 w-3.5 text-text-muted" />
            Connections
          </CardTitle>
        </CardHeader>
        <CardContent className="py-3 text-xs text-text-muted">
          No linked records yet.
        </CardContent>
      </Card>
    );
  }

  // Collapse based on a limit if provided.
  const visible =
    typeof collapseAfter === "number" ? groups.slice(0, collapseAfter) : groups;
  const hidden =
    typeof collapseAfter === "number" ? groups.slice(collapseAfter) : [];

  const renderGroup = (g: Group) => {
    const key = `${g.direction}:${g.resource}:${g.kind}`;
    const isOpen = open[key] ?? false;
    return (
      <li key={key} className="border-b border-border-subtle last:border-b-0">
        <button
          type="button"
          className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-surface-1"
          onClick={() => setOpen((s) => ({ ...s, [key]: !s[key] }))}
        >
          {isOpen ? (
            <ChevronDown className="h-3.5 w-3.5 text-text-muted shrink-0" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-text-muted shrink-0" />
          )}
          {directionIcon(g.direction)}
          <span className="text-text-primary truncate">
            <code className="font-mono text-xs">{g.resource}</code>
          </span>
          <Badge intent="neutral" className="font-normal text-[10px] ml-auto">
            {g.count}
          </Badge>
          <span className="text-[10px] text-text-muted">{g.kind}</span>
        </button>
        {isOpen ? (
          <ul className="bg-surface-1/30 border-t border-border-subtle">
            {g.samples.map((s) => (
              <li key={s.id} className="px-9 py-1.5 text-xs">
                <a
                  href={s.url}
                  className="text-accent hover:underline truncate block"
                  title={s.id}
                >
                  {s.label}
                </a>
              </li>
            ))}
            {g.count > g.samples.length ? (
              <li className="px-9 py-1.5 text-xs text-text-muted">
                + {g.count - g.samples.length} more
              </li>
            ) : null}
          </ul>
        ) : null}
      </li>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <Spline className="h-3.5 w-3.5 text-text-muted" />
          Connections
          <span className="text-xs text-text-muted">({groups.length})</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0 max-h-[420px] overflow-auto">
        {error ? (
          <div className="px-3 py-2 text-xs text-intent-danger">{error}</div>
        ) : null}
        <ul className="divide-y divide-border-subtle">
          {visible.map(renderGroup)}
        </ul>
        {hidden.length > 0 ? (
          <details className="border-t border-border-subtle">
            <summary className="cursor-pointer px-3 py-2 text-xs text-text-muted hover:bg-surface-1 flex items-center gap-1">
              <ArrowLeftRight className="h-3 w-3" />
              {hidden.length} more group{hidden.length === 1 ? "" : "s"}…
            </summary>
            <ul className="divide-y divide-border-subtle">
              {hidden.map(renderGroup)}
            </ul>
          </details>
        ) : null}
      </CardContent>
    </Card>
  );
}
