import * as React from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/primitives/Button";
import { Input } from "@/primitives/Input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/primitives/Select";
import { cn } from "@/lib/cn";
import type { FilterLeaf, FilterTree } from "@/contracts/saved-views";

export interface FilterFieldDef {
  field: string;
  label: string;
  kind: "text" | "number" | "enum" | "date" | "boolean";
  options?: { value: string; label: string }[];
}

export interface AdvancedFilterBuilderProps {
  fields: readonly FilterFieldDef[];
  value: FilterTree | undefined;
  onChange: (tree: FilterTree | undefined) => void;
  className?: string;
}

const OPS_BY_KIND: Record<FilterFieldDef["kind"], FilterLeaf["op"][]> = {
  text: ["contains", "eq", "neq", "starts_with", "is_null", "is_not_null"],
  number: ["eq", "neq", "lt", "lte", "gt", "gte", "between", "is_null", "is_not_null"],
  enum: ["eq", "neq", "in", "nin", "is_null", "is_not_null"],
  date: ["eq", "lt", "lte", "gt", "gte", "between", "is_null", "is_not_null"],
  boolean: ["eq", "is_null", "is_not_null"],
};

const OP_LABELS: Partial<Record<FilterLeaf["op"], string>> = {
  eq: "equals",
  neq: "not equals",
  lt: "less than",
  lte: "≤",
  gt: "greater than",
  gte: "≥",
  in: "in list",
  nin: "not in list",
  contains: "contains",
  starts_with: "starts with",
  between: "between",
  is_null: "is empty",
  is_not_null: "is not empty",
};

function isLeaf(tree: FilterTree): tree is FilterLeaf {
  return "field" in tree && "op" in tree;
}

function emptyLeaf(fields: readonly FilterFieldDef[]): FilterLeaf {
  const first = fields[0];
  return { field: first?.field ?? "", op: "eq", value: "" };
}

function toGroup(tree: FilterTree | undefined): {
  mode: "and" | "or";
  children: FilterTree[];
} {
  if (!tree) return { mode: "and", children: [] };
  if ("and" in tree) return { mode: "and", children: tree.and };
  if ("or" in tree) return { mode: "or", children: tree.or };
  return { mode: "and", children: [tree] };
}

export function AdvancedFilterBuilder({
  fields,
  value,
  onChange,
  className,
}: AdvancedFilterBuilderProps) {
  const group = toGroup(value);

  const emit = (children: FilterTree[], mode: "and" | "or" = group.mode) => {
    if (children.length === 0) onChange(undefined);
    else if (children.length === 1 && isLeaf(children[0])) onChange(children[0]);
    else onChange(mode === "and" ? { and: children } : { or: children });
  };

  const addLeaf = () => emit([...group.children, emptyLeaf(fields)]);
  const removeAt = (idx: number) =>
    emit(group.children.filter((_, i) => i !== idx));
  const updateAt = (idx: number, next: FilterTree) =>
    emit(group.children.map((c, i) => (i === idx ? next : c)));

  return (
    <div
      className={cn(
        "flex flex-col gap-2 p-3 border border-border rounded-md bg-surface-1",
        className,
      )}
      role="group"
      aria-label="Advanced filter"
    >
      <div className="flex items-center gap-2 text-xs text-text-muted">
        <span>Match</span>
        <Select
          value={group.mode}
          onValueChange={(v) => emit(group.children, v as "and" | "or")}
        >
          <SelectTrigger className="h-7 w-20">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="and">all</SelectItem>
            <SelectItem value="or">any</SelectItem>
          </SelectContent>
        </Select>
        <span>of the following:</span>
      </div>
      {group.children.map((child, idx) => (
        <LeafRow
          key={idx}
          fields={fields}
          leaf={isLeaf(child) ? child : emptyLeaf(fields)}
          onChange={(next) => updateAt(idx, next)}
          onRemove={() => removeAt(idx)}
        />
      ))}
      <div>
        <Button
          variant="ghost"
          size="sm"
          onClick={addLeaf}
          iconLeft={<Plus className="h-3 w-3" />}
        >
          Add filter
        </Button>
      </div>
    </div>
  );
}

function LeafRow({
  fields,
  leaf,
  onChange,
  onRemove,
}: {
  fields: readonly FilterFieldDef[];
  leaf: FilterLeaf;
  onChange: (leaf: FilterLeaf) => void;
  onRemove: () => void;
}) {
  const def = fields.find((f) => f.field === leaf.field);
  const ops: FilterLeaf["op"][] = def ? OPS_BY_KIND[def.kind] : ["eq"];
  const showValue = leaf.op !== "is_null" && leaf.op !== "is_not_null";

  return (
    <div className="flex items-center gap-2">
      <Select
        value={leaf.field}
        onValueChange={(v) => onChange({ ...leaf, field: v })}
      >
        <SelectTrigger className="h-8 w-40">
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
      <Select
        value={leaf.op}
        onValueChange={(v) => onChange({ ...leaf, op: v as FilterLeaf["op"] })}
      >
        <SelectTrigger className="h-8 w-36">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ops.map((op) => (
            <SelectItem key={op} value={op}>
              {OP_LABELS[op] ?? op}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {showValue && (
        <>
          {def?.kind === "enum" && def.options ? (
            <Select
              value={typeof leaf.value === "string" ? leaf.value : ""}
              onValueChange={(v) => onChange({ ...leaf, value: v })}
            >
              <SelectTrigger className="h-8 flex-1">
                <SelectValue placeholder="value" />
              </SelectTrigger>
              <SelectContent>
                {def.options.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              className="h-8 flex-1"
              type={def?.kind === "number" ? "number" : def?.kind === "date" ? "date" : "text"}
              value={(leaf.value ?? "") as string | number}
              onChange={(e) => onChange({ ...leaf, value: e.target.value })}
              placeholder="value"
            />
          )}
        </>
      )}
      <button
        type="button"
        onClick={onRemove}
        className="h-8 w-8 flex items-center justify-center rounded hover:bg-surface-2 text-text-muted"
        aria-label="Remove filter"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
