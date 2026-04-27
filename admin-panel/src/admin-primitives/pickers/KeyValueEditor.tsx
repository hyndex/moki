/** Key/value editor — replaces the "paste JSON" textarea where it
 *  exists today (webhook custom headers, plugin settings, etc.).
 *
 *  Why
 *  ---
 *  JSON in a textarea is fragile: a missing quote silently breaks the
 *  whole entry, and operators can't preview structure. The structured
 *  editor enforces unique keys, gives each value its own input, and
 *  yields the same `Record<string, string>` shape on save.
 *
 *  Edge cases handled:
 *  - Reserved-keyword keys (Authorization, Cookie, Set-Cookie) are
 *    flagged with a warning — these usually shouldn't be set by users.
 *  - Whitespace-only keys are auto-stripped on serialise.
 *  - Empty rows render but are dropped on serialise. */

import * as React from "react";
import { Plus, X, AlertTriangle } from "lucide-react";
import { Input } from "../../primitives/Input";
import { Button } from "../../primitives/Button";
import { Label } from "../../primitives/Label";

const RESERVED = new Set([
  "authorization", "cookie", "set-cookie", "host",
  "content-length", "content-encoding", "transfer-encoding", "te",
]);

export interface KeyValueEditorProps {
  value: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
  /** Field labels — defaults to "Key" / "Value". Override for domain
   *  contexts ("Header" / "Value", "Tag" / "Score", etc.). */
  keyLabel?: string;
  valueLabel?: string;
  /** Keys the editor warns the operator about overriding. Pass empty
   *  to suppress warnings. */
  reservedKeys?: ReadonlySet<string>;
  /** Cap row count — defaults to 32. */
  maxRows?: number;
  className?: string;
}

interface Row { key: string; value: string }

function toRows(map: Record<string, string>): Row[] {
  return Object.entries(map).map(([key, value]) => ({ key, value }));
}

function toMap(rows: Row[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const r of rows) {
    const k = r.key.trim();
    if (!k) continue;
    out[k] = r.value;
  }
  return out;
}

export function KeyValueEditor({
  value,
  onChange,
  keyLabel = "Key",
  valueLabel = "Value",
  reservedKeys = RESERVED,
  maxRows = 32,
  className,
}: KeyValueEditorProps): React.ReactElement {
  const [rows, setRows] = React.useState<Row[]>(() => toRows(value));

  // Sync down when the parent's `value` changes (e.g. a different
  // record gets loaded into the form).
  React.useEffect(() => {
    setRows(toRows(value));
  }, [value]);

  const commit = (next: Row[]): void => {
    setRows(next);
    onChange(toMap(next));
  };

  const updateRow = (i: number, patch: Partial<Row>): void => {
    commit(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  };

  const addRow = (): void => {
    if (rows.length >= maxRows) return;
    commit([...rows, { key: "", value: "" }]);
  };

  const removeRow = (i: number): void => {
    commit(rows.filter((_, idx) => idx !== i));
  };

  const seenKeys = new Set<string>();
  return (
    <div className={["space-y-1.5", className].filter(Boolean).join(" ")}>
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)_28px] gap-1.5">
        <Label className="text-[11px] text-text-muted">{keyLabel}</Label>
        <Label className="text-[11px] text-text-muted">{valueLabel}</Label>
        <span />
      </div>
      {rows.length === 0 && (
        <div className="text-[11px] text-text-muted px-1">
          No {keyLabel.toLowerCase()}s. Click + to add one.
        </div>
      )}
      {rows.map((row, i) => {
        const k = row.key.trim().toLowerCase();
        const reserved = !!k && reservedKeys.has(k);
        const duplicate = !!k && seenKeys.has(k);
        seenKeys.add(k);
        return (
          <div key={i} className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)_28px] gap-1.5 items-center">
            <Input
              value={row.key}
              onChange={(e) => updateRow(i, { key: e.target.value })}
              placeholder={`${keyLabel.toLowerCase()}…`}
              className={["h-8 text-xs font-mono", reserved || duplicate ? "border-warning" : ""].filter(Boolean).join(" ")}
              aria-invalid={duplicate}
            />
            <Input
              value={row.value}
              onChange={(e) => updateRow(i, { value: e.target.value })}
              placeholder={`${valueLabel.toLowerCase()}…`}
              className="h-8 text-xs font-mono"
            />
            <button
              type="button"
              onClick={() => removeRow(i)}
              className="text-text-muted hover:text-danger flex items-center justify-center h-8"
              aria-label={`Remove ${row.key || "row"}`}
            >
              <X size={14} />
            </button>
            {(reserved || duplicate) && (
              <div className="col-span-3 flex items-center gap-1.5 text-[10px] text-warning-strong">
                <AlertTriangle size={11} />
                <span>
                  {duplicate
                    ? `Duplicate key — only the last "${row.key}" row will be used`
                    : `"${row.key}" is reserved; the runtime may override your value`}
                </span>
              </div>
            )}
          </div>
        );
      })}
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={addRow}
        disabled={rows.length >= maxRows}
        iconLeft={<Plus size={12} />}
      >
        Add {keyLabel.toLowerCase()}
      </Button>
    </div>
  );
}
