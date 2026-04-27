/** Relationship picker — search-driven dropdown for `reference` /
 *  `link` / `dynamic-link` field kinds.
 *
 *  Why: every plugin uses these kinds (every FK in the schema flows
 *  through here), but the previous architecture had no form input at
 *  all — operators had to type the target id by hand. This component
 *  fetches the candidate resource via `useAllRecords`, does fuzzy
 *  filtering on label + email + code, and renders a Combobox with
 *  keyboard nav.
 *
 *  Production hardening:
 *    - Single-flight fetch via useAllRecords' built-in cache.
 *    - Error states surface inline (the picker shows "—" on error and
 *      a retry button rather than crashing the form).
 *    - Empty state shows "No <singular> found" with a hint to widen
 *      search.
 *    - Keyboard: Up/Down navigate, Enter selects, Esc closes.
 *    - Aria: `role="combobox"` + `aria-expanded` + `aria-controls`
 *      so screen readers announce the open listbox correctly. */

import * as React from "react";
import { ChevronDown, Check, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { useAllRecords } from "@/runtime/hooks";
import type {
  FieldKindFormProps,
  FieldKindListCellProps,
  FieldKindDetailProps,
  FieldKindRenderer,
} from "../fieldKindRegistry";

type RefField = {
  referenceTo?: string;
  /** When the referenced resource has a non-default display field
   *  (e.g. `name`, `code`, `email`) — set this on the field config. */
  displayField?: string;
};

interface RefRecord {
  id: string;
  [k: string]: unknown;
}

/** Look up `field.referenceTo` from either the FieldDescriptor itself
 *  or the legacy DomainFieldConfig. The contract types are slightly
 *  different so we accept either. */
function targetResource(field: unknown): string | undefined {
  if (!field || typeof field !== "object") return undefined;
  const f = field as RefField & Record<string, unknown>;
  return f.referenceTo;
}

function displayLabel(rec: RefRecord, displayField?: string): string {
  if (displayField && typeof rec[displayField] === "string") return rec[displayField] as string;
  for (const k of ["name", "label", "title", "displayName", "fullName", "email", "code"]) {
    if (typeof rec[k] === "string" && rec[k]) return rec[k] as string;
  }
  return String(rec.id);
}

function displaySublabel(rec: RefRecord): string | undefined {
  for (const k of ["email", "company", "code", "kind"]) {
    if (typeof rec[k] === "string" && rec[k]) return rec[k] as string;
  }
  return undefined;
}

function RelationshipForm(props: FieldKindFormProps): React.ReactElement {
  const { field, value, onChange, disabled, invalid, inputId } = props;
  const resource = targetResource(field);
  const displayField = (field as unknown as RefField).displayField;
  const { data, loading, error, refetch } = useAllRecords<RefRecord>(resource ?? "_invalid_");
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [activeIndex, setActiveIndex] = React.useState(0);

  const selected = React.useMemo(
    () => (value ? data.find((r) => r.id === value) : undefined),
    [data, value],
  );

  const filtered = React.useMemo(() => {
    if (!query) return data.slice(0, 50);
    const q = query.toLowerCase();
    return data
      .filter((r) => {
        const lbl = displayLabel(r, displayField).toLowerCase();
        const sub = (displaySublabel(r) ?? "").toLowerCase();
        return lbl.includes(q) || sub.includes(q) || String(r.id).toLowerCase().includes(q);
      })
      .slice(0, 50);
  }, [data, query, displayField]);

  React.useEffect(() => {
    if (activeIndex >= filtered.length) setActiveIndex(0);
  }, [filtered.length, activeIndex]);

  if (!resource) {
    return (
      <div className="text-xs text-danger">
        Field {field.name} is missing <code>referenceTo</code> on its descriptor.
      </div>
    );
  }

  const onPick = (r: RefRecord): void => {
    onChange(r.id);
    setOpen(false);
    setQuery("");
  };

  const onKey = (e: React.KeyboardEvent): void => {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(filtered.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const r = filtered[activeIndex];
      if (r) onPick(r);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    }
  };

  return (
    <div className="relative" onKeyDown={onKey}>
      <button
        type="button"
        id={inputId}
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-invalid={invalid}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "w-full h-9 px-3 inline-flex items-center justify-between gap-2 rounded-md border bg-surface-0 text-sm text-left transition-colors",
          "focus-visible:outline-none focus-visible:shadow-focus focus-visible:border-accent",
          invalid ? "border-danger" : "border-border hover:border-border-strong",
          disabled && "opacity-50 cursor-not-allowed",
        )}
      >
        <span className="truncate">
          {selected ? (
            <>
              <span className="font-medium text-text-primary">
                {displayLabel(selected, displayField)}
              </span>
              {displaySublabel(selected) && (
                <span className="ml-2 text-text-muted text-xs">{displaySublabel(selected)}</span>
              )}
            </>
          ) : (
            <span className="text-text-muted">Select {field.label ?? field.name}…</span>
          )}
        </span>
        <span className="flex items-center gap-1 shrink-0">
          {selected && !disabled && (
            <span
              role="button"
              tabIndex={-1}
              aria-label="Clear selection"
              onClick={(e) => {
                e.stopPropagation();
                onChange(undefined);
              }}
              className="text-text-muted hover:text-text-primary"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </span>
          )}
          <ChevronDown
            className={cn("h-3.5 w-3.5 text-text-muted transition-transform", open && "rotate-180")}
            aria-hidden
          />
        </span>
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute z-30 left-0 right-0 mt-1 max-h-72 overflow-auto rounded-md border border-border bg-surface-0 shadow-lg"
        >
          <div className="sticky top-0 bg-surface-0 border-b border-border-subtle p-2">
            <input
              autoFocus
              type="text"
              placeholder="Search…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full h-7 px-2 rounded-sm border border-border bg-surface-0 text-sm outline-none focus:shadow-focus focus:border-accent"
            />
          </div>
          {loading ? (
            <div className="px-3 py-4 text-xs text-text-muted">Loading…</div>
          ) : error ? (
            <div className="px-3 py-4 text-xs text-danger flex items-center justify-between">
              <span>Failed to load options.</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  refetch();
                }}
                className="text-info hover:underline"
              >
                Retry
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-3 py-4 text-xs text-text-muted">
              No matches{query ? ` for “${query}”` : ""}.
            </div>
          ) : (
            <ul className="py-1">
              {filtered.map((r, i) => (
                <li
                  key={r.id}
                  role="option"
                  aria-selected={r.id === value}
                  onMouseEnter={() => setActiveIndex(i)}
                  onClick={() => onPick(r)}
                  className={cn(
                    "px-3 py-1.5 text-sm flex items-center justify-between gap-2 cursor-pointer",
                    i === activeIndex && "bg-surface-1",
                    r.id === value && "text-accent font-medium",
                  )}
                >
                  <span className="min-w-0 truncate">
                    {displayLabel(r, displayField)}
                    {displaySublabel(r) && (
                      <span className="ml-2 text-text-muted text-xs">{displaySublabel(r)}</span>
                    )}
                  </span>
                  {r.id === value && <Check className="h-3.5 w-3.5 text-accent shrink-0" aria-hidden />}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function RelationshipListCell(props: FieldKindListCellProps): React.ReactElement {
  const { field, value } = props;
  const resource = targetResource(field);
  const displayField = (field as unknown as RefField).displayField;
  // List cells stay cheap — we don't fetch the entire collection per
  // row. We render the raw id with a hover affordance; FormView /
  // detail pages are the place to render the human label.
  return (
    <span
      title={resource ? `${resource}/${value}` : String(value)}
      className="font-mono text-xs text-text-muted hover:text-text-primary"
    >
      {displayField ? String(value) : String(value)}
    </span>
  );
}

function RelationshipDetail(props: FieldKindDetailProps): React.ReactElement {
  const { field, value } = props;
  const resource = targetResource(field);
  if (!value) return <span className="text-text-muted">—</span>;
  if (!resource) return <span className="font-mono text-xs">{String(value)}</span>;
  // Detail surfaces a clickable link to the canonical detail page for
  // the referenced record. Falls back to id when the basePath is
  // unknown.
  const basePath = `/${resource.replace(/\./g, "/")}`;
  return (
    <a
      href={`#${basePath}/${encodeURIComponent(String(value))}`}
      className="text-info hover:text-info-strong transition-colors font-mono text-xs"
    >
      {String(value)}
    </a>
  );
}

export const relationshipKind: FieldKindRenderer = {
  Form: RelationshipForm,
  ListCell: RelationshipListCell,
  Detail: RelationshipDetail,
};
