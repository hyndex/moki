/** Tags / chip input — replaces the checkbox-grid `multi-enum` and
 *  also serves as a free-form tag input when no `options` are given.
 *
 *  Two modes:
 *    1. Constrained — `field.options` is set: the user picks from a
 *       searchable list (typeahead-style). Free-form values rejected.
 *    2. Free-form  — no options: the user types and presses Enter /
 *       comma to add a chip. Values are deduped + trimmed.
 *
 *  Hardening:
 *    - Backspace on an empty input removes the last chip (keyboard
 *      symmetry with Slack / Linear / Mail).
 *    - aria-label points at the field.label so screen readers announce
 *      the chip group correctly.
 *    - Focus stays inside the chip group when adding/removing — never
 *      jumps off the form. */

import * as React from "react";
import { X, Plus } from "lucide-react";
import { cn } from "@/lib/cn";
import type {
  FieldKindFormProps,
  FieldKindListCellProps,
  FieldKindDetailProps,
  FieldKindRenderer,
} from "../fieldKindRegistry";
import type { EnumOption } from "@/contracts/fields";

const INTENT_CLASS: Record<string, string> = {
  neutral: "bg-surface-2 text-text-primary border-border",
  accent: "bg-accent-soft text-accent border-accent/30",
  success: "bg-success-soft text-success-strong border-success-strong/20",
  warning: "bg-warning-soft text-warning-strong border-warning-strong/20",
  danger: "bg-danger-soft text-danger-strong border-danger-strong/20",
  info: "bg-info-soft text-info-strong border-info-strong/20",
};

function toArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x) => typeof x === "string") as string[];
  if (typeof v === "string" && v) return v.split(/[,\n]+/).map((s) => s.trim()).filter(Boolean);
  return [];
}

function chipClass(opt: EnumOption | undefined): string {
  return INTENT_CLASS[opt?.intent ?? "neutral"] ?? INTENT_CLASS.neutral;
}

function TagsForm(props: FieldKindFormProps): React.ReactElement {
  const { field, value, onChange, disabled, invalid, inputId } = props;
  const options = (field.options ?? []) as readonly EnumOption[];
  const constrained = options.length > 0;
  const tags = toArray(value);
  const [input, setInput] = React.useState("");
  const [open, setOpen] = React.useState(false);

  const optionByValue = React.useMemo(() => {
    const m = new Map<string, EnumOption>();
    for (const o of options) m.set(o.value, o);
    return m;
  }, [options]);

  const filteredOptions = React.useMemo(() => {
    if (!constrained) return [];
    const taken = new Set(tags);
    const q = input.trim().toLowerCase();
    return options
      .filter((o) => !taken.has(o.value))
      .filter((o) => !q || o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q))
      .slice(0, 25);
  }, [options, tags, input, constrained]);

  const add = (raw: string): void => {
    const next = raw.trim();
    if (!next) return;
    if (constrained && !optionByValue.has(next)) return;
    if (tags.includes(next)) return;
    onChange([...tags, next]);
    setInput("");
  };

  const remove = (idx: number): void => {
    const next = tags.slice();
    next.splice(idx, 1);
    onChange(next);
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === "Enter" || e.key === "," || (e.key === "Tab" && input.trim())) {
      if (input.trim()) {
        e.preventDefault();
        if (constrained) {
          const match = filteredOptions[0];
          if (match) add(match.value);
        } else {
          add(input);
        }
      }
    } else if (e.key === "Backspace" && !input && tags.length > 0) {
      remove(tags.length - 1);
    }
  };

  return (
    <div
      className={cn(
        "min-h-9 px-2 py-1 inline-flex flex-wrap items-center gap-1.5 rounded-md border bg-surface-0 transition-colors w-full",
        invalid ? "border-danger" : "border-border focus-within:border-accent focus-within:shadow-focus",
        disabled && "opacity-50 pointer-events-none",
      )}
      role="group"
      aria-label={`Tags for ${field.label ?? field.name}`}
      onClick={() => document.getElementById(inputId ?? `${field.name}-tag-input`)?.focus()}
    >
      {tags.map((tag, i) => {
        const opt = optionByValue.get(tag);
        return (
          <span
            key={`${tag}-${i}`}
            className={cn(
              "inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-xs font-medium",
              chipClass(opt),
            )}
          >
            {opt?.label ?? tag}
            {!disabled && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  remove(i);
                }}
                className="opacity-60 hover:opacity-100 transition-opacity"
                aria-label={`Remove ${opt?.label ?? tag}`}
              >
                <X className="h-3 w-3" aria-hidden />
              </button>
            )}
          </span>
        );
      })}
      <div className="relative flex-1 min-w-[100px]">
        <input
          id={inputId ?? `${field.name}-tag-input`}
          type="text"
          value={input}
          placeholder={tags.length === 0 ? (constrained ? "Pick…" : "Type and press Enter…") : ""}
          onChange={(e) => {
            setInput(e.target.value);
            if (constrained) setOpen(true);
          }}
          onFocus={() => constrained && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={onKey}
          disabled={disabled}
          className="w-full h-7 px-1 bg-transparent text-sm outline-none placeholder:text-text-muted"
        />
        {constrained && open && filteredOptions.length > 0 && (
          <ul
            role="listbox"
            className="absolute left-0 top-full mt-1 z-30 max-h-56 overflow-auto rounded-md border border-border bg-surface-0 shadow-lg min-w-[200px]"
          >
            {filteredOptions.map((o) => (
              <li
                key={o.value}
                role="option"
                onMouseDown={(e) => {
                  e.preventDefault();
                  add(o.value);
                }}
                className="px-3 py-1.5 text-sm cursor-pointer hover:bg-surface-1 flex items-center gap-2"
              >
                <span className={cn("inline-block h-2 w-2 rounded-full", chipClass(o).replace(/text-\S+/g, ""))} />
                {o.label}
              </li>
            ))}
          </ul>
        )}
      </div>
      {!constrained && input.trim() && (
        <button
          type="button"
          onClick={() => add(input)}
          className="text-text-muted hover:text-text-primary transition-colors"
          aria-label="Add tag"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden />
        </button>
      )}
    </div>
  );
}

function TagsCell(props: FieldKindListCellProps): React.ReactElement {
  const { field, value } = props;
  const tags = toArray(value);
  const options = (field.options ?? []) as readonly EnumOption[];
  if (tags.length === 0) return <span className="text-text-muted">—</span>;
  const byValue = new Map(options.map((o) => [o.value, o]));
  return (
    <span className="inline-flex flex-wrap gap-1">
      {tags.slice(0, 4).map((t) => {
        const opt = byValue.get(t);
        return (
          <span
            key={t}
            className={cn(
              "inline-flex items-center rounded-sm border px-1.5 py-0.5 text-[11px] font-medium",
              chipClass(opt),
            )}
          >
            {opt?.label ?? t}
          </span>
        );
      })}
      {tags.length > 4 && (
        <span className="text-[11px] text-text-muted">+{tags.length - 4}</span>
      )}
    </span>
  );
}

function TagsDetail(props: FieldKindDetailProps): React.ReactElement {
  return <TagsCell field={props.field} value={props.value} record={props.record} />;
}

export const tagsKind: FieldKindRenderer = {
  Form: TagsForm,
  ListCell: TagsCell,
  Detail: TagsDetail,
};
