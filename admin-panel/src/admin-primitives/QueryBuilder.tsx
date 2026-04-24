import * as React from "react";
import { Filter, Plus, Trash2, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/primitives/Button";
import { Input } from "@/primitives/Input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/primitives/Popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/primitives/Select";
import type {
  FilterLeaf,
  FilterOp,
  FilterTree,
} from "@/contracts/saved-views";
import type { EnumOption } from "@/contracts/fields";
import { OPERATORS, operatorsFor, describeFilter } from "@/lib/filterEngine";

/** Field descriptor for the QueryBuilder. */
export interface QBField {
  field: string;
  label: string;
  kind:
    | "text"
    | "number"
    | "currency"
    | "boolean"
    | "date"
    | "datetime"
    | "enum"
    | "multi-enum"
    | "reference";
  options?: readonly EnumOption[];
}

export interface QueryBuilderProps {
  fields: readonly QBField[];
  value: FilterTree | undefined;
  onChange: (next: FilterTree | undefined) => void;
  className?: string;
  /** Label shown on the trigger button. Default "Filter". */
  triggerLabel?: string;
}

const EMPTY_AND: FilterTree = { and: [] };

/** Normalise `value` into an AND-group root so the UI can always edit it. */
function normalize(v: FilterTree | undefined): { and: FilterTree[] } {
  if (!v) return { and: [] };
  if ("and" in v) return v;
  if ("or" in v) return { and: [v] };
  return { and: [v] };
}

/** Drop the root AND if it's empty, otherwise return it as-is. */
function simplify(root: { and: FilterTree[] }): FilterTree | undefined {
  if (root.and.length === 0) return undefined;
  if (root.and.length === 1) return root.and[0];
  return root;
}

/** The main trigger — opens a popover with the builder. */
export function QueryBuilder({
  fields,
  value,
  onChange,
  className,
  triggerLabel = "Filter",
}: QueryBuilderProps) {
  const count = countLeaves(value);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          iconLeft={<Filter className="h-3.5 w-3.5" />}
          className={className}
          aria-label="Advanced filter"
        >
          {triggerLabel}
          {count > 0 && (
            <span className="ml-1.5 inline-flex items-center justify-center h-4 min-w-4 px-1 rounded bg-accent text-accent-fg text-[10px] font-semibold tabular-nums">
              {count}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[560px] p-0" align="start">
        <QueryBuilderInner fields={fields} value={value} onChange={onChange} />
      </PopoverContent>
    </Popover>
  );
}

function QueryBuilderInner({
  fields,
  value,
  onChange,
}: {
  fields: readonly QBField[];
  value: FilterTree | undefined;
  onChange: (next: FilterTree | undefined) => void;
}) {
  const root = normalize(value);

  const update = (next: { and: FilterTree[] }) => onChange(simplify(next));

  const addLeaf = () => {
    const defaultField = fields[0];
    if (!defaultField) return;
    const ops = operatorsFor(defaultField.kind);
    const op = ops[0]?.op ?? "eq";
    const leaf: FilterLeaf = { field: defaultField.field, op, value: "" };
    update({ and: [...root.and, leaf] });
  };

  const addGroup = (mode: "and" | "or") => {
    const group: FilterTree = mode === "or" ? { or: [] } : { and: [] };
    update({ and: [...root.and, group] });
  };

  const removeAt = (idx: number) => {
    const next = [...root.and];
    next.splice(idx, 1);
    update({ and: next });
  };

  const replaceAt = (idx: number, next: FilterTree | undefined) => {
    const arr = [...root.and];
    if (!next) arr.splice(idx, 1);
    else arr[idx] = next;
    update({ and: arr });
  };

  return (
    <div className="flex flex-col gap-0">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <div className="text-xs font-semibold uppercase tracking-wider text-text-primary">
          Advanced filter
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="xs"
            iconLeft={<X className="h-3 w-3" />}
            disabled={root.and.length === 0}
            onClick={() => onChange(undefined)}
          >
            Clear
          </Button>
        </div>
      </div>

      <div className="p-2 flex flex-col gap-2 max-h-[420px] overflow-y-auto">
        {root.and.length === 0 && (
          <div className="text-xs text-text-muted px-2 py-3 text-center">
            No filters. Add a condition to start.
          </div>
        )}
        {root.and.map((child, idx) => (
          <div key={idx} className="flex items-start gap-1">
            {idx > 0 && (
              <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted px-1 pt-1.5">
                AND
              </span>
            )}
            <div className="flex-1">
              {"and" in child || "or" in child ? (
                <GroupEditor
                  fields={fields}
                  value={child}
                  onChange={(next) => replaceAt(idx, next)}
                />
              ) : (
                <LeafEditor
                  fields={fields}
                  value={child}
                  onChange={(next) => replaceAt(idx, next)}
                />
              )}
            </div>
            <button
              type="button"
              className="h-7 w-7 flex items-center justify-center rounded text-text-muted hover:text-text-primary hover:bg-surface-2"
              onClick={() => removeAt(idx)}
              aria-label="Remove condition"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-1 px-2 py-2 border-t border-border">
        <Button
          variant="ghost"
          size="xs"
          iconLeft={<Plus className="h-3 w-3" />}
          onClick={addLeaf}
        >
          Add condition
        </Button>
        <Button variant="ghost" size="xs" onClick={() => addGroup("or")}>
          + OR group
        </Button>
        <Button variant="ghost" size="xs" onClick={() => addGroup("and")}>
          + AND group
        </Button>
      </div>
    </div>
  );
}

/* ---------------- Group editor ---------------- */

function GroupEditor({
  fields,
  value,
  onChange,
}: {
  fields: readonly QBField[];
  value: { and: FilterTree[] } | { or: FilterTree[] };
  onChange: (next: FilterTree | undefined) => void;
}) {
  const mode: "and" | "or" = "or" in value ? "or" : "and";
  const children: FilterTree[] = "or" in value ? value.or : value.and;

  const replace = (next: FilterTree[]) => {
    if (next.length === 0) onChange(undefined);
    else onChange(mode === "or" ? { or: next } : { and: next });
  };

  const add = () => {
    const defaultField = fields[0];
    if (!defaultField) return;
    const ops = operatorsFor(defaultField.kind);
    const leaf: FilterLeaf = {
      field: defaultField.field,
      op: ops[0]?.op ?? "eq",
      value: "",
    };
    replace([...children, leaf]);
  };

  const toggleMode = () => {
    if (mode === "or") onChange({ and: children });
    else onChange({ or: children });
  };

  return (
    <div className="border border-border rounded-md bg-surface-1 p-2 flex flex-col gap-1.5">
      <button
        type="button"
        className="text-[10px] font-semibold uppercase tracking-wider text-accent hover:underline self-start"
        onClick={toggleMode}
      >
        {mode} group — click to toggle
      </button>
      {children.map((c, i) => (
        <div key={i} className="flex items-start gap-1">
          {i > 0 && (
            <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted pt-1.5">
              {mode.toUpperCase()}
            </span>
          )}
          <div className="flex-1">
            {"and" in c || "or" in c ? (
              <GroupEditor
                fields={fields}
                value={c}
                onChange={(next) => {
                  const arr = [...children];
                  if (!next) arr.splice(i, 1);
                  else arr[i] = next;
                  replace(arr);
                }}
              />
            ) : (
              <LeafEditor
                fields={fields}
                value={c}
                onChange={(next) => {
                  const arr = [...children];
                  if (!next) arr.splice(i, 1);
                  else arr[i] = next;
                  replace(arr);
                }}
              />
            )}
          </div>
          <button
            type="button"
            className="h-7 w-7 flex items-center justify-center rounded text-text-muted hover:text-text-primary hover:bg-surface-2"
            onClick={() => {
              const arr = [...children];
              arr.splice(i, 1);
              replace(arr);
            }}
            aria-label="Remove"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
      <Button
        variant="ghost"
        size="xs"
        iconLeft={<Plus className="h-3 w-3" />}
        onClick={add}
      >
        Add
      </Button>
    </div>
  );
}

/* ---------------- Leaf editor ---------------- */

function LeafEditor({
  fields,
  value,
  onChange,
}: {
  fields: readonly QBField[];
  value: FilterLeaf;
  onChange: (next: FilterTree | undefined) => void;
}) {
  const field = fields.find((f) => f.field === value.field) ?? fields[0];
  const ops = operatorsFor(field?.kind ?? "text");
  const opDef = OPERATORS.find((o) => o.op === value.op);
  const arity = opDef?.arity ?? 1;

  const onFieldChange = (name: string) => {
    const f = fields.find((x) => x.field === name) ?? field;
    const nextOps = operatorsFor(f.kind);
    // Keep op if compatible, else pick first
    const nextOp = nextOps.find((o) => o.op === value.op)?.op ?? nextOps[0]?.op ?? "eq";
    onChange({ field: name, op: nextOp, value: "" });
  };

  const onOpChange = (op: string) => {
    const nextOpDef = OPERATORS.find((o) => o.op === op);
    const nextArity = nextOpDef?.arity ?? 1;
    let nextValue: unknown = value.value;
    if (nextArity === 0) nextValue = undefined;
    else if (nextArity === 2 && !Array.isArray(value.value))
      nextValue = ["", ""];
    onChange({ field: value.field, op: op as FilterOp, value: nextValue });
  };

  const setV = (v: unknown) =>
    onChange({ field: value.field, op: value.op, value: v });

  return (
    <div className="flex items-center gap-1.5 rounded-md border border-border bg-surface-0 px-1.5 py-1">
      <Select value={value.field} onValueChange={onFieldChange}>
        <SelectTrigger className="h-7 min-w-[140px] text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {fields.map((f) => (
            <SelectItem key={f.field} value={f.field}>
              {f.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={value.op} onValueChange={onOpChange}>
        <SelectTrigger className="h-7 min-w-[130px] text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ops.map((o) => (
            <SelectItem key={o.op} value={o.op}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {arity === 1 && (
        <LeafValueInput field={field} op={value.op} value={value.value} onChange={setV} />
      )}
      {arity === 2 && (
        <div className="flex items-center gap-1">
          <LeafValueInput
            field={field}
            op={value.op}
            value={Array.isArray(value.value) ? value.value[0] : ""}
            onChange={(v) => {
              const arr = Array.isArray(value.value) ? [...value.value] : ["", ""];
              arr[0] = v;
              setV(arr);
            }}
          />
          <span className="text-xs text-text-muted">to</span>
          <LeafValueInput
            field={field}
            op={value.op}
            value={Array.isArray(value.value) ? value.value[1] : ""}
            onChange={(v) => {
              const arr = Array.isArray(value.value) ? [...value.value] : ["", ""];
              arr[1] = v;
              setV(arr);
            }}
          />
        </div>
      )}
    </div>
  );
}

function LeafValueInput({
  field,
  op,
  value,
  onChange,
}: {
  field: QBField;
  op: FilterOp;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  if (!field) return null;
  const isArrayOp = op === "in" || op === "nin";
  if (isArrayOp) {
    // Multi-value — comma-separated input for simplicity
    const str = Array.isArray(value) ? value.join(",") : String(value ?? "");
    return (
      <Input
        className="h-7 text-xs min-w-[160px]"
        placeholder="a, b, c"
        value={str}
        onChange={(e) =>
          onChange(e.target.value.split(",").map((s) => s.trim()).filter(Boolean))
        }
      />
    );
  }
  if (op === "last_n_days") {
    return (
      <Input
        className="h-7 text-xs w-20"
        type="number"
        min={1}
        placeholder="N"
        value={value === undefined || value === null ? "" : String(value)}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : undefined)}
      />
    );
  }
  if (field.kind === "enum" && field.options) {
    return (
      <Select value={String(value ?? "")} onValueChange={(v) => onChange(v)}>
        <SelectTrigger className="h-7 min-w-[140px] text-xs">
          <SelectValue placeholder="Value" />
        </SelectTrigger>
        <SelectContent>
          {field.options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }
  if (field.kind === "boolean") {
    return (
      <Select value={String(value ?? "true")} onValueChange={(v) => onChange(v === "true")}>
        <SelectTrigger className="h-7 min-w-[90px] text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="true">True</SelectItem>
          <SelectItem value="false">False</SelectItem>
        </SelectContent>
      </Select>
    );
  }
  if (field.kind === "date" || field.kind === "datetime") {
    return (
      <Input
        className="h-7 text-xs w-[140px]"
        type="date"
        value={typeof value === "string" ? value : ""}
        onChange={(e) => onChange(e.target.value || undefined)}
      />
    );
  }
  if (field.kind === "number" || field.kind === "currency") {
    return (
      <Input
        className="h-7 text-xs w-[110px]"
        type="number"
        value={value === undefined || value === null ? "" : String(value)}
        onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
      />
    );
  }
  return (
    <Input
      className="h-7 text-xs min-w-[140px]"
      value={value === undefined || value === null ? "" : String(value)}
      onChange={(e) => onChange(e.target.value)}
      placeholder={field.label}
    />
  );
}

/* ---------------- Utilities ---------------- */

function countLeaves(tree: FilterTree | undefined): number {
  if (!tree) return 0;
  if ("and" in tree) return tree.and.reduce((a, c) => a + countLeaves(c), 0);
  if ("or" in tree) return tree.or.reduce((a, c) => a + countLeaves(c), 0);
  return 1;
}

export { describeFilter };
