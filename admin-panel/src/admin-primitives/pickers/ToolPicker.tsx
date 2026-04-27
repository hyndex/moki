/** Tool picker — replaces raw inputs where operators used to type
 *  MCP tool names like `sales.deal.delete` (typo-prone, no risk hint).
 *
 *  UX
 *  --
 *    - Searchable list with type-ahead.
 *    - Each row shows the tool name in mono, the human description,
 *      a risk badge, and a destructive flag if applicable.
 *    - Optional `riskFilter` — the dual-key dialog only needs
 *      irreversible tools, no point listing safe-read.
 *
 *  Output is the tool name string; parent owns the value. */

import * as React from "react";
import { Search } from "lucide-react";
import { useUiTools, type UiTool } from "../../runtime/useUiMetadata";
import { Input } from "../../primitives/Input";
import { Badge } from "../../primitives/Badge";

const RISK_INTENT: Record<UiTool["risk"], "success" | "info" | "warning" | "danger"> = {
  "safe-read": "success",
  "low-mutation": "info",
  "high-mutation": "warning",
  "irreversible": "danger",
};

const RISK_LABEL: Record<UiTool["risk"], string> = {
  "safe-read": "Read only",
  "low-mutation": "Low mutation",
  "high-mutation": "High mutation",
  "irreversible": "Irreversible",
};

export interface ToolPickerProps {
  value?: string;
  onChange: (toolName: string | undefined) => void;
  /** Restrict the listing to specific risk levels. The dual-key dialog
   *  passes `["irreversible"]` since dual-key only matters for
   *  irreversible ops. */
  riskFilter?: ReadonlyArray<UiTool["risk"]>;
  /** Restrict to a single resource if known (e.g. when the operator
   *  has already chosen a target). */
  resource?: string;
  placeholder?: string;
  className?: string;
}

export function ToolPicker({
  value,
  onChange,
  riskFilter,
  resource,
  placeholder = "Search tools…",
  className,
}: ToolPickerProps): React.ReactElement {
  const { data: tools, loading, error } = useUiTools();
  const [query, setQuery] = React.useState("");
  const [open, setOpen] = React.useState(false);

  const filtered = React.useMemo(() => {
    let out = tools;
    if (riskFilter && riskFilter.length > 0) {
      const set = new Set(riskFilter);
      out = out.filter((t) => set.has(t.risk));
    }
    if (resource) out = out.filter((t) => t.resource === resource);
    const q = query.trim().toLowerCase();
    if (q) {
      out = out.filter((t) =>
        t.name.toLowerCase().includes(q)
        || t.description.toLowerCase().includes(q),
      );
    }
    return out;
  }, [tools, riskFilter, resource, query]);

  const selected = value ? tools.find((t) => t.name === value) : undefined;
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handler = (e: MouseEvent): void => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={containerRef} className={["relative", className].filter(Boolean).join(" ")}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full h-8 rounded-md border border-border bg-surface-0 px-2 text-left text-xs flex items-center gap-2 hover:border-border-strong"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {selected ? (
          <>
            <code className="font-mono">{selected.name}</code>
            <Badge intent={RISK_INTENT[selected.risk]}>{RISK_LABEL[selected.risk]}</Badge>
          </>
        ) : (
          <span className="text-text-muted">{placeholder}</span>
        )}
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 rounded-md border border-border bg-surface-0 shadow-lg max-h-72 overflow-hidden flex flex-col">
          <div className="relative p-1.5 border-b border-border-subtle">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter…"
              className="pl-7 h-7 text-xs"
              autoFocus
            />
          </div>
          <div className="overflow-auto">
            {loading && tools.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-text-muted">Loading tools…</div>
            ) : error ? (
              <div className="px-3 py-2 text-xs text-danger-strong">Failed to load: {error}</div>
            ) : filtered.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-text-muted">No tools match.</div>
            ) : (
              <ul role="listbox" className="divide-y divide-border-subtle">
                {filtered.map((t) => (
                  <li
                    key={t.name}
                    role="option"
                    aria-selected={t.name === value}
                    className={[
                      "px-2.5 py-1.5 text-xs cursor-pointer hover:bg-surface-1 flex items-start gap-2",
                      t.name === value ? "bg-surface-1" : "",
                    ].join(" ")}
                    onClick={() => {
                      onChange(t.name);
                      setOpen(false);
                      setQuery("");
                    }}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <code className="font-mono text-[11px]">{t.name}</code>
                        <Badge intent={RISK_INTENT[t.risk]}>{RISK_LABEL[t.risk]}</Badge>
                        {t.annotations?.destructiveHint && (
                          <Badge intent="danger">Destructive</Badge>
                        )}
                      </div>
                      {t.description && (
                        <div className="text-[10px] text-text-muted mt-0.5 line-clamp-2">
                          {t.description}
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
