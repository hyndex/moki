/** Bulk edit dialog — apply a single-field patch to multiple records.
 *
 *  Accepts a list of selected record ids + the resource id. The user
 *  picks the field, value, and confirms. Each PATCH goes through the
 *  regular `/api/resources/:resource/:id` endpoint so ACL, validation,
 *  audit, and notification rules all behave identically to a single
 *  edit. Failures roll up into a per-record error report.
 *
 *  We deliberately don't use a server-side bulk-patch route: the
 *  generic PATCH path already does ACL/validation/audit per record.
 *  Issuing N small PATCHes keeps semantics consistent and means a
 *  partial failure leaves the system in a well-known state (the
 *  succeeded rows committed, the rest reported as errors). */

import * as React from "react";
import { AlertTriangle, Pencil } from "lucide-react";
import { Button } from "@/primitives/Button";
import { Input } from "@/primitives/Input";
import { Label } from "@/primitives/Label";
import { Badge } from "@/primitives/Badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/primitives/Dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/primitives/Select";
import { Textarea } from "@/primitives/Textarea";
import { authStore } from "@/runtime/auth";

interface FieldChoice {
  name: string;
  label: string;
  kind?: "text" | "number" | "boolean" | "date" | "datetime" | "json" | "select";
  options?: Array<{ value: string; label: string }>;
}

interface Props {
  resource: string;
  recordIds: string[];
  /** Fields offered. Typically derived from the list view's column set
   *  + custom fields. If omitted, the dialog allows free text key/value
   *  with JSON coercion. */
  fields?: FieldChoice[];
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onComplete?: (result: { ok: number; failed: number }) => void;
}

interface Result {
  id: string;
  status: "pending" | "ok" | "failed";
  error?: string;
}

function apiBase(): string {
  const base =
    (typeof import.meta !== "undefined"
      ? (import.meta as { env?: { VITE_API_BASE?: string } }).env?.VITE_API_BASE
      : undefined) ?? "/api";
  return base.toString().replace(/\/+$/, "");
}

function authHeaders(): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (authStore.token) h.Authorization = `Bearer ${authStore.token}`;
  if (authStore.activeTenant?.id) h["x-tenant"] = authStore.activeTenant.id;
  return h;
}

export function BulkEditDialog({
  resource,
  recordIds,
  fields,
  open,
  onOpenChange,
  onComplete,
}: Props): React.JSX.Element {
  const [fieldName, setFieldName] = React.useState<string>(() => fields?.[0]?.name ?? "");
  const [valueRaw, setValueRaw] = React.useState<string>("");
  const [running, setRunning] = React.useState(false);
  const [results, setResults] = React.useState<Result[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setFieldName(fields?.[0]?.name ?? "");
    setValueRaw("");
    setResults([]);
    setError(null);
  }, [open, fields]);

  const fieldMeta = fields?.find((f) => f.name === fieldName);

  const coerceValue = (): unknown => {
    const k = fieldMeta?.kind;
    if (k === "boolean") return valueRaw === "true";
    if (k === "number") {
      const n = Number(valueRaw);
      if (!Number.isFinite(n)) throw new Error("Value must be a number");
      return n;
    }
    if (k === "json") {
      try {
        return JSON.parse(valueRaw);
      } catch {
        throw new Error("Value must be valid JSON");
      }
    }
    if (k === "date" || k === "datetime") return valueRaw;
    return valueRaw;
  };

  const run = async () => {
    setError(null);
    if (!fieldName.trim()) {
      setError("Pick a field to update");
      return;
    }
    let value: unknown;
    try {
      value = coerceValue();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return;
    }
    setRunning(true);
    setResults(recordIds.map((id) => ({ id, status: "pending" })));
    let ok = 0;
    let failed = 0;
    // Run patches with a small concurrency window — high enough to feel
    // fast for hundreds of rows, low enough to avoid hammering SQLite.
    const concurrency = 5;
    let cursor = 0;
    const next = async (): Promise<void> => {
      while (cursor < recordIds.length) {
        const idx = cursor++;
        const id = recordIds[idx]!;
        try {
          const res = await fetch(
            `${apiBase()}/resources/${encodeURIComponent(resource)}/${encodeURIComponent(id)}`,
            {
              method: "PATCH",
              headers: authHeaders(),
              credentials: "include",
              body: JSON.stringify({ [fieldName]: value }),
            },
          );
          if (!res.ok) {
            let msg = `HTTP ${res.status}`;
            try {
              const j = (await res.json()) as { error?: string };
              if (j.error) msg = j.error;
            } catch { /* tolerate */ }
            throw new Error(msg);
          }
          ok++;
          setResults((r) => r.map((x) => (x.id === id ? { ...x, status: "ok" } : x)));
        } catch (err) {
          failed++;
          setResults((r) =>
            r.map((x) =>
              x.id === id
                ? { ...x, status: "failed", error: err instanceof Error ? err.message : String(err) }
                : x,
            ),
          );
        }
      }
    };
    await Promise.all(Array.from({ length: concurrency }, () => next()));
    setRunning(false);
    onComplete?.({ ok, failed });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>
            <span className="flex items-center gap-2">
              <Pencil className="h-4 w-4" />
              Bulk edit {recordIds.length} record{recordIds.length === 1 ? "" : "s"}
            </span>
          </DialogTitle>
          <DialogDescription>
            Apply a single field change to every selected record on{" "}
            <code className="font-mono">{resource}</code>. Patches go through the
            normal CRUD path so ACL, validation, audit, and notifications all run.
          </DialogDescription>
        </DialogHeader>

        {error ? (
          <div className="rounded-md border border-intent-danger/40 bg-intent-danger-bg/30 px-3 py-2 text-sm text-intent-danger flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <span className="flex-1">{error}</span>
          </div>
        ) : null}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="be-field" required>Field</Label>
            {fields && fields.length > 0 ? (
              <Select value={fieldName} onValueChange={setFieldName}>
                <SelectTrigger id="be-field">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {fields.map((f) => (
                    <SelectItem key={f.name} value={f.name}>
                      <div className="flex flex-col">
                        <span>{f.label}</span>
                        <span className="text-xs text-text-muted font-mono">{f.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                id="be-field"
                placeholder="field_name"
                value={fieldName}
                onChange={(e) => setFieldName(e.target.value)}
                className="font-mono"
              />
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="be-value" required>Value</Label>
            {fieldMeta?.kind === "boolean" ? (
              <Select value={valueRaw} onValueChange={setValueRaw}>
                <SelectTrigger id="be-value">
                  <SelectValue placeholder="true / false" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">true</SelectItem>
                  <SelectItem value="false">false</SelectItem>
                </SelectContent>
              </Select>
            ) : fieldMeta?.kind === "select" ? (
              <Select value={valueRaw} onValueChange={setValueRaw}>
                <SelectTrigger id="be-value">
                  <SelectValue placeholder="…" />
                </SelectTrigger>
                <SelectContent>
                  {(fieldMeta.options ?? []).map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : fieldMeta?.kind === "json" ? (
              <Textarea
                id="be-value"
                rows={4}
                placeholder="{}"
                value={valueRaw}
                onChange={(e) => setValueRaw(e.target.value)}
                className="font-mono text-xs"
              />
            ) : fieldMeta?.kind === "date" ? (
              <Input id="be-value" type="date" value={valueRaw} onChange={(e) => setValueRaw(e.target.value)} />
            ) : fieldMeta?.kind === "datetime" ? (
              <Input id="be-value" type="datetime-local" value={valueRaw} onChange={(e) => setValueRaw(e.target.value)} />
            ) : fieldMeta?.kind === "number" ? (
              <Input id="be-value" type="number" value={valueRaw} onChange={(e) => setValueRaw(e.target.value)} />
            ) : (
              <Input id="be-value" value={valueRaw} onChange={(e) => setValueRaw(e.target.value)} />
            )}
          </div>
        </div>

        {results.length > 0 ? (
          <div className="rounded-md border border-border-subtle max-h-72 overflow-auto">
            <table className="w-full text-xs">
              <thead className="bg-surface-1 text-text-muted sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Record</th>
                  <th className="px-3 py-2 text-left font-medium w-24">Status</th>
                  <th className="px-3 py-2 text-left font-medium">Error</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr key={r.id} className="border-t border-border-subtle">
                    <td className="px-3 py-1.5">
                      <code className="font-mono">{r.id}</code>
                    </td>
                    <td className="px-3 py-1.5">
                      <Badge
                        intent={
                          r.status === "ok"
                            ? "success"
                            : r.status === "failed"
                              ? "danger"
                              : "neutral"
                        }
                        className="font-normal text-[10px]"
                      >
                        {r.status}
                      </Badge>
                    </td>
                    <td className="px-3 py-1.5 text-intent-danger">{r.error ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={running}>
            {results.length > 0 ? "Close" : "Cancel"}
          </Button>
          {results.length === 0 ? (
            <Button variant="primary" onClick={() => void run()} loading={running} disabled={running}>
              Apply to {recordIds.length} record{recordIds.length === 1 ? "" : "s"}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
