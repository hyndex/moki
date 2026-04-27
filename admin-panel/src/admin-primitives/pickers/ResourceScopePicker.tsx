/** Resource scope picker — replaces the textarea where operators used
 *  to type scopes as `resource: read, write, delete`.
 *
 *  UX
 *  --
 *    - Tree grouped by plugin domain (CRM, Sales, Inventory, …).
 *    - Each row has the resource label + a row of action checkboxes
 *      (read / write / delete) only for verbs the resource supports.
 *    - Search box filters the tree as you type.
 *    - "Selected" pill at the top shows current scope count + a click
 *      action to clear all.
 *
 *  The component is fully controlled: parent owns the scope map, the
 *  picker just calls `onChange` with the next map. Output shape is
 *  `Record<resourceId, ("read" | "write" | "delete")[]>` — exactly the
 *  shape the MCP admin endpoint expects. */

import * as React from "react";
import { Search, X, ChevronDown, ChevronRight } from "lucide-react";
import { useUiResources, type UiResource } from "../../runtime/useUiMetadata";
import { Input } from "../../primitives/Input";
import { Checkbox } from "../../primitives/Checkbox";
import { Badge } from "../../primitives/Badge";

export type ScopeAction = "read" | "write" | "delete";
export type ScopeMap = Record<string, ScopeAction[]>;

const ALL_ACTIONS: ScopeAction[] = ["read", "write", "delete"];

export interface ResourceScopePickerProps {
  value: ScopeMap;
  onChange: (next: ScopeMap) => void;
  /** Cap actions globally. The MCP risk ceiling implicitly does this
   *  — `safe-read` shouldn't grant write/delete. */
  allowedActions?: ReadonlyArray<ScopeAction>;
  /** Hide resources whose plugin isn't enabled for the active tenant.
   *  Defaults to false — the picker shows the full set so operators
   *  can pre-grant a scope ahead of enabling a plugin. */
  hideDisabled?: boolean;
  className?: string;
}

export function ResourceScopePicker({
  value,
  onChange,
  allowedActions = ALL_ACTIONS,
  className,
}: ResourceScopePickerProps): React.ReactElement {
  const { data: resources, loading, error } = useUiResources();
  const [query, setQuery] = React.useState("");
  const [collapsed, setCollapsed] = React.useState<Record<string, boolean>>({});

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return resources;
    return resources.filter((r) =>
      r.id.toLowerCase().includes(q)
      || (r.label ?? "").toLowerCase().includes(q)
      || (r.group ?? "").toLowerCase().includes(q),
    );
  }, [resources, query]);

  const grouped = React.useMemo(() => {
    const map = new Map<string, UiResource[]>();
    for (const r of filtered) {
      const g = r.group ?? "Other";
      const arr = map.get(g) ?? [];
      arr.push(r);
      map.set(g, arr);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  const totalSelected = Object.values(value).reduce((a, b) => a + b.length, 0);
  const selectedResourceCount = Object.keys(value).filter((k) => value[k] && value[k]!.length > 0).length;

  const toggle = (resource: UiResource, action: ScopeAction): void => {
    const next: ScopeMap = { ...value };
    const cur = new Set(next[resource.id] ?? []);
    if (cur.has(action)) cur.delete(action);
    else cur.add(action);
    if (cur.size === 0) delete next[resource.id];
    else next[resource.id] = Array.from(cur).sort() as ScopeAction[];
    onChange(next);
  };

  const toggleAllForResource = (resource: UiResource): void => {
    const next: ScopeMap = { ...value };
    const supported = (resource.actions ?? ALL_ACTIONS)
      .filter((a) => allowedActions.includes(a));
    if (next[resource.id] && next[resource.id]!.length === supported.length) {
      delete next[resource.id];
    } else {
      next[resource.id] = supported;
    }
    onChange(next);
  };

  const clearAll = (): void => onChange({});

  return (
    <div className={["space-y-2", className].filter(Boolean).join(" ")}>
      {/* Header — search + summary */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-text-muted" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search resources…"
            className="pl-7 h-8 text-xs"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <Badge intent={totalSelected > 0 ? "accent" : "neutral"}>
            {selectedResourceCount} resource{selectedResourceCount === 1 ? "" : "s"} · {totalSelected} action{totalSelected === 1 ? "" : "s"}
          </Badge>
          {totalSelected > 0 && (
            <button
              type="button"
              onClick={clearAll}
              className="text-[11px] text-text-muted hover:text-danger flex items-center gap-0.5"
              aria-label="Clear all scopes"
            >
              <X size={12} /> Clear
            </button>
          )}
        </div>
      </div>

      {/* Tree */}
      <div className="rounded-md border border-border bg-surface-0 max-h-72 overflow-auto">
        {loading && resources.length === 0 ? (
          <div className="px-3 py-6 text-center text-xs text-text-muted">Loading resources…</div>
        ) : error ? (
          <div className="px-3 py-3 text-xs text-danger-strong">Failed to load: {error}</div>
        ) : grouped.length === 0 ? (
          <div className="px-3 py-6 text-center text-xs text-text-muted">
            {query ? "No resources match." : "No resources registered yet."}
          </div>
        ) : (
          <div className="divide-y divide-border-subtle">
            {grouped.map(([group, items]) => {
              const groupKey = group;
              const isCollapsed = !!collapsed[groupKey];
              const groupSelected = items.filter((r) => (value[r.id] ?? []).length > 0).length;
              return (
                <div key={groupKey}>
                  <button
                    type="button"
                    onClick={() => setCollapsed((c) => ({ ...c, [groupKey]: !c[groupKey] }))}
                    className="w-full flex items-center gap-1.5 px-2.5 py-1.5 bg-surface-1 text-[11px] font-semibold text-text-secondary uppercase tracking-wide hover:bg-surface-2"
                    aria-expanded={!isCollapsed}
                  >
                    {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                    <span className="flex-1 text-left">{group}</span>
                    <span className="text-text-muted normal-case font-normal">
                      {groupSelected > 0 ? `${groupSelected}/${items.length}` : items.length}
                    </span>
                  </button>
                  {!isCollapsed && (
                    <ul role="list" className="divide-y divide-border-subtle">
                      {items.map((r) => {
                        const supported = (r.actions ?? ALL_ACTIONS)
                          .filter((a) => allowedActions.includes(a));
                        const selectedActions = value[r.id] ?? [];
                        const allSelected = selectedActions.length === supported.length && supported.length > 0;
                        return (
                          <li key={r.id} className="px-2.5 py-1.5 flex items-center gap-2 hover:bg-surface-1">
                            <button
                              type="button"
                              onClick={() => toggleAllForResource(r)}
                              className="flex-1 flex items-center gap-2 min-w-0 text-left"
                              aria-label={`${allSelected ? "Disable" : "Grant"} all scopes for ${r.label ?? r.id}`}
                            >
                              {r.icon && <span className="text-sm">{r.icon}</span>}
                              <div className="min-w-0 flex-1">
                                <div className="text-xs font-medium text-text-primary truncate">
                                  {r.label ?? r.id}
                                </div>
                                <div className="text-[10px] font-mono text-text-muted truncate">
                                  {r.id}
                                </div>
                              </div>
                            </button>
                            <div className="flex items-center gap-2.5">
                              {supported.map((action) => (
                                <label
                                  key={action}
                                  className="flex items-center gap-1 text-[11px] text-text-secondary cursor-pointer"
                                  title={`${action} on ${r.id}`}
                                >
                                  <Checkbox
                                    checked={selectedActions.includes(action)}
                                    onCheckedChange={() => toggle(r, action)}
                                  />
                                  <span className={selectedActions.includes(action) ? "font-medium" : ""}>
                                    {action}
                                  </span>
                                </label>
                              ))}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/** Single-resource picker — for places that need exactly one resource
 *  (workflow node target, notification rule's resource, etc.). Renders
 *  a native <select> grouped by plugin domain. */
export interface ResourcePickerProps {
  value?: string;
  onChange: (next: string | undefined) => void;
  placeholder?: string;
  allowCustom?: boolean;
  filter?: (r: UiResource) => boolean;
  className?: string;
  id?: string;
}

export function ResourcePicker({
  value,
  onChange,
  placeholder = "Select a resource…",
  allowCustom = false,
  filter,
  className,
  id,
}: ResourcePickerProps): React.ReactElement {
  const { data: resources, loading } = useUiResources();
  const filtered = React.useMemo(
    () => (filter ? resources.filter(filter) : resources),
    [resources, filter],
  );
  const grouped = React.useMemo(() => {
    const map = new Map<string, UiResource[]>();
    for (const r of filtered) {
      const g = r.group ?? "Other";
      const arr = map.get(g) ?? [];
      arr.push(r);
      map.set(g, arr);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  // If the current value isn't in the registry, keep it visible so the
  // form doesn't silently drop a setting from a disabled plugin.
  const valueInRegistry = !value || filtered.some((r) => r.id === value);

  return (
    <select
      id={id}
      value={value ?? ""}
      onChange={(e) => {
        const v = e.target.value;
        onChange(v === "" ? undefined : v);
      }}
      className={["h-8 rounded-md border border-border bg-surface-0 px-2 text-xs", className].filter(Boolean).join(" ")}
    >
      <option value="">{loading ? "Loading…" : placeholder}</option>
      {!valueInRegistry && value && (
        <option value={value}>{value} (not in registry)</option>
      )}
      {grouped.map(([group, items]) => (
        <optgroup key={group} label={group}>
          {items.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label ?? r.id} — {r.id}
            </option>
          ))}
        </optgroup>
      ))}
      {allowCustom && <option value="__custom__">Custom resource id…</option>}
    </select>
  );
}
